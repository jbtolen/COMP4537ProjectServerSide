const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor(db, options = {}) {
    this.db = db;
    this.jwtSecret = options.jwtSecret || 'dev_secret_change_me';
    this.cookieName = options.cookieName || 'auth';
    this.cookieSecure = options.cookieSecure ?? false; // set true in prod HTTPS
  }

  seedAdmin() {
    const existing = this.db.getUserByEmail('admin@admin.com');
    if (existing) return existing;

    const passwordHash = bcrypt.hashSync('111', 10);
    const admin = this.db.createUser({
      id: uuidv4(),
      email: 'admin@admin.com',
      passwordHash,
      role: 'admin',
      quotaLimit: 20
    });
    // eslint-disable-next-line no-console
    console.log('Seeded admin user admin@admin.com / 111');
    return admin;
  }

  register(email, password, firstName = null) {
    const normalizedEmail = String(email).toLowerCase();
    const existing = this.db.getUserByEmail(normalizedEmail);
    if (existing) throw new Error('Email already registered');

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = this.db.createUser({
      id: uuidv4(),
      email: normalizedEmail,
      passwordHash,
      firstName,
      role: 'user',
      quotaLimit: 20
    });
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName };
  }

  login(email, password) {
    const normalizedEmail = String(email).toLowerCase();
    const user = this.db.getUserByEmail(normalizedEmail);
    if (!user) throw new Error('Invalid credentials');
    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.jwtSecret, { expiresIn: '2h' });
    return { token, user: this.#publicUser(user) };
  }

  getUserProfile(userId) {
    const user = this.db.getUserById(userId);
    if (!user) return null;
    return this.#publicUser(user);
  }

  verify(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (e) {
      return null;
    }
  }

  cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
      maxAge: 2 * 60 * 60 * 1000
    };
  }

  #publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      usage: user.usage
    };
  }
}

module.exports = AuthService;

