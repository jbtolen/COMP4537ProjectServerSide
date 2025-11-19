const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const AppDatabase = require("./db");
const AuthService = require("./auth");
const createUsageMiddleware = require("./middleware/usage");
const mlRouter = require("./ml");

class Server {
  constructor() {
    this.PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    this.app = express();
    this.configureMiddleware();
    this.initializeAuth();
    this.registerAuthRoutes();
    this.registerRouters();
    this.catchAll();
    this.startServer();
  }

  // ✅ Middleware setupp
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
      optionsSuccessStatus: 200
    };

    this.corsOptions = corsOptions;
    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));
  }

  // ✅ Auth setup
  initializeAuth() {
    this.db = new AppDatabase();
    this.auth = new AuthService(this.db, {
      jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
      cookieSecure: false
    });
    this.auth.seedAdmin();
    this.usage = createUsageMiddleware(this.auth, this.db);
  }

  // ✅ Auth routes
  registerAuthRoutes() {
    const router = express.Router();

    router.post("/auth/register", (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      try {
        const dto = this.auth.register(String(email).toLowerCase(), String(password));
        return res.status(200).json(dto);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    });

    router.post("/auth/login", (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      try {
        const { token, user } = this.auth.login(String(email).toLowerCase(), String(password));
        res.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
        return res.status(200).json({ email: user.email, role: user.role, token });
      } catch (e) {
        return res.status(401).json({ error: e.message });
      }
    });

    router.get(
      "/auth/me",
      this.usage.requireAuth,
      this.usage.trackUsage("GET /api/auth/me"),
      (req, res) => {
        return res.status(200).json({
          email: req.user.email,
          role: req.user.role,
          usage: req.user.usage,
          warning: res.locals.apiUsageWarning || null
        });
      }
    );

    router.post("/auth/logout", (req, res) => {
      res.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
      return res.status(200).json({ ok: true });
    });

    this.app.use("/api", router);
  }

  // ✅ Other routers (e.g., ML controller)
  registerRouters() {
    this.app.use(
      "/api/ml",
      mlRouter({
        db: this.db,
        requireAuth: this.usage?.requireAuth,
        trackUsage: this.usage?.trackUsage
      })
    );
  }

  // ✅ Catch-all route to preserve CORS headers
  catchAll() {
    this.app.use((req, res) => {
      res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
      res.status(404).send("Not Found");
    });
  }

  // ✅ Start the server
startServer() {
  this.app.listen(this.PORT, () => {
    console.log(`✅ API listening on port ${this.PORT}`);
    console.log(`Base API path: /api`);
    console.log(`CORS allowed origins: ${this.corsOptions.origin.join(", ")}`);
  });
}

}

// Start everything
new Server();
