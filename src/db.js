const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

class AppDatabase {
  constructor(dbFilePath = path.join(__dirname, '..', 'data', 'app.db')) {
    this.dbFilePath = dbFilePath;
    this.#ensureDirectory();
    this.connection = new Database(this.dbFilePath);
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('journal_mode = WAL');
    this.#migrate();
    this.#hydrateLegacyJson();
    this.#prepareStatements();
  }

  #ensureDirectory() {
    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  #migrate() {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS api_usage (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        used INTEGER NOT NULL DEFAULT 0,
        quota_limit INTEGER NOT NULL DEFAULT 20,
        last_request_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS endpoint_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        last_call_at TEXT,
        UNIQUE(method, path)
      )`,
      `CREATE TABLE IF NOT EXISTS classifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        image_path TEXT,
        result_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE INDEX IF NOT EXISTS idx_classifications_user ON classifications(user_id)`
    ];
    const exec = this.connection.prepare.bind(this.connection);
    this.connection.transaction(() => {
      migrations.forEach((sql) => exec(sql).run());
    })();
  }

  #hydrateLegacyJson() {
    const userCount = this.connection.prepare('SELECT COUNT(1) as count FROM users').get().count;
    if (userCount > 0) return;

    const legacyPath = path.join(__dirname, '..', 'data', 'db.json');
    if (!fs.existsSync(legacyPath)) return;

    try {
      const raw = fs.readFileSync(legacyPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.users) || parsed.users.length === 0) return;

      const insertUser = this.connection.prepare(
        'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (@id, @email, @password_hash, @role, @created_at)'
      );
      const insertUsage = this.connection.prepare(
        'INSERT INTO api_usage (user_id, used, quota_limit) VALUES (@user_id, @used, @quota_limit)'
      );

      this.connection.transaction(() => {
        parsed.users.forEach((user) => {
          insertUser.run({
            id: user.id,
            email: user.email,
            password_hash: user.passwordHash,
            role: user.role || 'user',
            created_at: new Date().toISOString()
          });
          insertUsage.run({
            user_id: user.id,
            used: user.usage?.used ?? 0,
            quota_limit: user.usage?.limit ?? 20
          });
        });
      })();
      // eslint-disable-next-line no-console
      console.log(`Imported ${parsed.users.length} users from legacy JSON store.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Legacy JSON import skipped:', err.message);
    }
  }

  #prepareStatements() {
    this.statements = {
      userByEmail: this.connection.prepare(
        `SELECT u.*, au.used AS usage_used, au.quota_limit AS usage_limit,
                au.last_request_at AS usage_last_request_at
         FROM users u
         LEFT JOIN api_usage au ON au.user_id = u.id
         WHERE LOWER(u.email) = LOWER(?)`
      ),
      userById: this.connection.prepare(
        `SELECT u.*, au.used AS usage_used, au.quota_limit AS usage_limit,
                au.last_request_at AS usage_last_request_at
         FROM users u
         LEFT JOIN api_usage au ON au.user_id = u.id
         WHERE u.id = ?`
      ),
      insertUser: this.connection.prepare(
        `INSERT INTO users (id, email, password_hash, first_name, role)
         VALUES (@id, @email, @password_hash, @first_name, @role)`
      ),
      insertUsage: this.connection.prepare(
        `INSERT INTO api_usage (user_id, quota_limit)
         VALUES (@user_id, @quota_limit)`
      ),
      ensureUsage: this.connection.prepare(
        `INSERT INTO api_usage (user_id, quota_limit, used)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO NOTHING`
      ),
      incrementUsage: this.connection.prepare(
        `UPDATE api_usage
         SET used = used + ?, last_request_at = datetime('now')
         WHERE user_id = ?`
      ),
      upsertEndpointStat: this.connection.prepare(
        `INSERT INTO endpoint_stats (method, path, request_count, last_call_at)
         VALUES (?, ?, 1, datetime('now'))
         ON CONFLICT(method, path)
         DO UPDATE SET
           request_count = request_count + 1,
           last_call_at = excluded.last_call_at`
      ),
      insertClassification: this.connection.prepare(
        `INSERT INTO classifications (id, user_id, image_path, result_json, status)
         VALUES (@id, @user_id, @image_path, @result_json, @status)`
      )
    };
  }

  getUserByEmail(email) {
    return this.#mapUser(this.statements.userByEmail.get(email));
  }

  getUserById(id) {
    return this.#mapUser(this.statements.userById.get(id));
  }

  createUser({ id, email, passwordHash, firstName = null, role = 'user', quotaLimit = 20 }) {
    const tx = this.connection.transaction(() => {
      this.statements.insertUser.run({
        id,
        email,
        password_hash: passwordHash,
        first_name: firstName,
        role
      });
      this.statements.insertUsage.run({
        user_id: id,
        quota_limit: quotaLimit
      });
    });
    tx();
    return this.getUserById(id);
  }

  ensureUsageRow(userId, quotaLimit = 20, used = 0) {
    this.statements.ensureUsage.run(userId, quotaLimit, used);
  }

  incrementUsage(userId, amount = 1) {
    return this.statements.incrementUsage.run(amount, userId).changes > 0;
  }

  recordEndpointCall(method, endpointPath) {
    this.statements.upsertEndpointStat.run(method, endpointPath);
  }

  saveClassification({ id, userId = null, imagePath = null, resultJson, status = 'completed' }) {
    this.statements.insertClassification.run({
      id,
      user_id: userId,
      image_path: imagePath,
      result_json: typeof resultJson === 'string' ? resultJson : JSON.stringify(resultJson),
      status
    });
  }

  #mapUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      role: row.role,
      createdAt: row.created_at,
      usage: {
        used: row.usage_used ?? 0,
        limit: row.usage_limit ?? 20,
        lastRequestAt: row.usage_last_request_at || null
      }
    };
  }
}

module.exports = AppDatabase;
