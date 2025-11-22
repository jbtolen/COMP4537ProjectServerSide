const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const AppDatabase = require("./db");
const AuthService = require("./auth");
const createUsageMiddleware = require("./middleware/usage");
const MLController = require("./ml"); 
const swaggerDocs = require("./swagger");

class Server {
  constructor() {
    this.PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    this.app = express();
    this.configureMiddleware();
    this.initializeAuth();
    this.registerAuthRoutes();
    this.registerRouters();
    swaggerDocs(this.app);
    this.catchAll();
    this.startServer();
  }

  // 🚀 MIDDLEWARE SETUP (IMPORTANT!)
  configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cookieParser());

    // --- CORS Options ---
    const corsOptions = {
      origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://comp4537projectclientside.netlify.app",
        "https://comp4537projectclientside.onrender.com",
        "https://comp4537clientside.onrender.com"
      ],
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type"],
      methods: ["GET", "POST", "OPTIONS"],
      optionsSuccessStatus: 200,
    };

    this.corsOptions = corsOptions;
    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions)); // handle preflight

    // ❗ IMPORTANT: Force CORS headers on all responses
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      next();
    });
  }

  // 🔐 AUTH SETUP
  initializeAuth() {
    this.db = new AppDatabase();
    this.auth = new AuthService(this.db, {
      jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
      cookieSecure: false,
    });
    this.auth.seedAdmin();
    this.usage = createUsageMiddleware(this.auth, this.db);
  }

  // 🔑 AUTH ROUTES
// 🔑 AUTH ROUTES  
registerAuthRoutes() {
  const router = express.Router();

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             email: "test@gmail.com"
   *             password: "123"
   *     responses:
   *       200:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             example:
   *               id: "uuid-v4"
   *               email: "test@gmail.com"
   *               role: "user"
   */
  router.post("/auth/register", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    try {
      const dto = this.auth.register(String(email).toLowerCase(), String(password));
      return res.status(200).json(dto);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             email: "test@gmail.com"
   *             password: "123"
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             example:
   *               email: "test@gmail.com"
   *               role: "user"
   *               token: "jwt_token_here"
   */
  router.post("/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    try {
      const { token, user } = this.auth.login(String(email).toLowerCase(), String(password));
      res.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
      return res.status(200).json({ email: user.email, role: user.role, token });
    } catch (e) {
      return res.status(401).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Get the logged-in user's profile
   *     tags:
   *       - Auth
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile data
   *         content:
   *           application/json:
   *             example:
   *               email: "test@gmail.com"
   *               role: "user"
   *               usage:
   *                 used: 2
   *                 limit: 20
   */
  router.get("/auth/me", this.usage.requireAuth, (req, res) => {
    return res.status(200).json({
      email: req.user.email,
      role: req.user.role,
      usage: req.user.usage,
      warning: res.locals.apiUsageWarning || null,
    });
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout user (clear cookie)
   *     tags:
   *       - Auth
   *     responses:
   *       200:
   *         description: Logged out successfully
   */
  router.post("/auth/logout", (req, res) => {
    res.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
    return res.status(200).json({ ok: true });
  });

  // --- ADMIN ROUTES (need auth + admin role) ---

  /**
   * @swagger
   * /api/admin/stats:
   *   get:
   *     summary: Get API endpoint call statistics
   *     tags:
   *       - Admin
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Stats of API usage per endpoint
   */
  router.get("/admin/stats", this.usage.requireAuth, requireAdmin, (req, res) => {
    try {
      const endpointStats = this.db.connection
        .prepare(`SELECT method, path AS endpoint, request_count AS requests FROM endpoint_stats`)
        .all();
      res.json({ endpoints: endpointStats });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  /**
   * @swagger
   * /api/admin/users:
   *   get:
   *     summary: Get all users and their usage stats
   *     tags:
   *       - Admin
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of users and their API usage
   */
  router.get("/admin/users", this.usage.requireAuth, requireAdmin, (req, res) => {
    try {
      const userStats = this.db.connection.prepare(`
        SELECT u.email, u.role, au.used AS totalRequests, au.quota_limit AS quotaLimit
        FROM users u
        LEFT JOIN api_usage au ON u.id = au.user_id
      `).all();
      res.json({ users: userStats });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user statistics" });
    }
  });

  this.app.use("/api", router);
}


  // 🧠 ML ROUTES
  registerRouters() {
    const ml = new MLController({
      db: this.db,
      requireAuth: this.usage?.requireAuth,
      trackUsage: this.usage?.trackUsage,
    });

    this.app.use("/api/ml", ml.router);
  this.app.get("/api/ml/mine", this.usage.requireAuth, (req, res) => {
    try {
      const rows = this.db.connection
        .prepare("SELECT * FROM classifications WHERE user_id = ? ORDER BY created_at DESC")
        .all(req.user.id);

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  }

  // 🔚 404 + CORS PRESERVED
  catchAll() {
    this.app.use((req, res) => {
      res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
      res.status(404).send("Not Found");
    });
  }

  // 🚀 START SERVER
  startServer() {
    this.app.listen(this.PORT, () => {
      console.log(`✅ API running on port ${this.PORT}`);
      console.log(`🌍 CORS allowed: ${this.corsOptions.origin.join(", ")}`);
    });
  }
}

// Boot the server
new Server();
