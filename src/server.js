const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const AppDatabase = require("./db");
const AuthService = require("./auth");
const createUsageMiddleware = require("./middleware/usage");
const MLController = require("./ml");
const createClassificationsRouter = require("./routes/classifications");
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

  configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cookieParser());

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
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      optionsSuccessStatus: 200
    };

    this.corsOptions = corsOptions;
    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
  }

  initializeAuth() {
    this.db = new AppDatabase();
    this.auth = new AuthService(this.db, {
      jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
      cookieSecure: false
    });
    this.auth.seedAdmin();
    this.usage = createUsageMiddleware(this.auth, this.db);
  }

  registerAuthRoutes() {
    const router = express.Router();

    /**
     * @swagger
     * tags:
     *   - name: Auth
     *   - name: Admin
     */

    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           example:
     *             email: "user@example.com"
     *             password: "123"
     *     responses:
     *       200:
     *         description: Successfully registered
     */
    router.post("/auth/register", (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

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
     *     summary: Login and receive JWT token
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           example:
     *             email: "user@example.com"
     *             password: "123"
     *     responses:
     *       200:
     *         description: Login successful
     */
    router.post("/auth/login", (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

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
     *     summary: Get current logged-in user's profile
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User profile
     */
    router.get(
      "/auth/me",
      this.usage.requireAuth,
      this.usage.trackUsage(),
      (req, res) => {
        return res.status(200).json({
          email: req.user.email,
          role: req.user.role,
          usage: req.user.usage,
          warning: res.locals.apiUsageWarning || null
        });
      }
    );

    /**
     * @swagger
     * /api/auth/logout:
     *   post:
     *     summary: Logout (delete JWT cookie)
     *     tags: [Auth]
     *     responses:
     *       200:
     *         description: Logged out
     */
    router.post("/auth/logout", (req, res) => {
      res.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
      return res.status(200).json({ ok: true });
    });

  // Admin stats
    const requireAdmin = (req, res, next) => {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      next();
    };

    /**
     * @swagger
     * /api/admin/stats:
     *   get:
     *     summary: Get API usage stats by endpoint
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Endpoint stats
     */
    router.get("/admin/stats", this.usage.requireAuth, requireAdmin, (req, res) => {
      try {
        const endpointStats = this.db.getEndpointStats();
        res.json({ endpoints: endpointStats });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch statistics" });
      }
    });

    /**
     * @swagger
     * /api/admin/users:
     *   get:
     *     summary: Get all users and usage stats
     *     tags: [Admin]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User usage stats
     */
    router.get("/admin/users", this.usage.requireAuth, requireAdmin, (req, res) => {
      try {
        const userStats = this.db.getUserUsageStats();
        res.json({ users: userStats });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch user statistics" });
      }
    });

    this.app.use("/api", router);
    this.app.use("/api/v1", router);
  }

  registerRouters() {
    this.app.use(
      "/api/classifications",
      createClassificationsRouter({
        db: this.db,
        usage: this.usage
      })
    );
    this.app.use(
      "/api/v1/classifications",
      createClassificationsRouter({
        db: this.db,
        usage: this.usage
      })
    );

    const ml = new MLController({
      db: this.db,
      requireAuth: this.usage?.requireAuth,
      trackUsage: this.usage?.trackUsage
    });

    this.app.use("/api/ml", ml.router);
    this.app.use("/api/v1/ml", ml.router);

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

  catchAll() {
    this.app.use((req, res) => {
      res.status(404).send("Not Found");
    });
  }

  startServer() {
    this.app.listen(this.PORT, () => {
      console.log(`API running on port ${this.PORT}`);
      console.log(`CORS allowed origins: ${this.corsOptions.origin.join(", ")}`);
    });
  }
}

new Server();
