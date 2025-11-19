const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

class MLController {
  constructor(options = {}) {
    this.db = options.db;
    this.requireAuth = options.requireAuth;
    this.trackUsage = options.trackUsage;
    this.router = express.Router();
    this.upload = multer({ dest: path.join(__dirname, "../uploads/") });
    this.setupCors();
    this.registerRoutes();
  }

  setupCors() {
    const corsOptions = {
      origin: [
        "https://comp4537projectclientside.onrender.com",
        "https://comp4537projectclientside.netlify.app",
        "http://localhost:5500"
      ],
      credentials: true
    };

    this.router.options("*", cors(corsOptions));
    this.router.use(cors(corsOptions));
  }

  registerRoutes() {
    const middleware = [];
    if (this.requireAuth) middleware.push(this.requireAuth);
    if (this.trackUsage) middleware.push(this.trackUsage("POST /api/ml/classify"));
    middleware.push(this.upload.single("image"), this.handleClassify.bind(this));

    this.router.post("/classify", ...middleware);
  }

  resolvePythonPath() {
    const candidates = [
      path.join(__dirname, "../venv/bin/python3"),
      path.join(__dirname, "../venv/Scripts/python.exe"),
      "python3",
      "python"
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) || candidate === "python3" || candidate === "python") {
        console.log("Using Python path:", candidate);
        return candidate;
      }
    }

    throw new Error("No Python interpreter found. Install Python or create a venv.");
  }

  async handleClassify(req, res) {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const imgPath = req.file.path;
    const scriptPath = path.join(__dirname, "waste_model.py");
    const pythonPath = this.resolvePythonPath();

    try {
      const py = spawn(pythonPath, ["-u", scriptPath, imgPath]);

      let dataBuffer = "";
      let errorBuffer = "";

      py.stdout.on("data", (data) => (dataBuffer += data.toString()));
      py.stderr.on("data", (data) => (errorBuffer += data.toString()));

      py.on("close", (code) => {
        fs.unlink(imgPath, () => {});

        console.log(`Python exited with code ${code}`);
        if (errorBuffer) console.error("Python stderr:", errorBuffer);

        const clean = (dataBuffer || "").trim();
        console.log("Raw stdout:", clean);

        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.header("Access-Control-Allow-Credentials", "true");

        try {
          if (!clean) throw new Error("Empty stdout");
          const parsed = JSON.parse(clean);
          this.#persistClassification(req, parsed);
          return res.json(parsed);
        } catch (err) {
          console.error("Invalid model output:", clean);
          return res
            .status(500)
            .json({ error: "Invalid model output", raw: clean || errorBuffer || "" });
        }
      });
    } catch (err) {
      console.error("Server-side error:", err);
      res.status(500).json({ error: err.message });
    }
  }

  #persistClassification(req, result) {
    if (!this.db) return;
    try {
      this.db.saveClassification({
        id: uuidv4(),
        userId: req.user?.id || null,
        imagePath: req.file?.originalname || req.file?.filename || null,
        resultJson: result,
        status: result?.error ? "failed" : "completed"
      });
    } catch (err) {
      console.warn("Unable to store classification record:", err.message);
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = (options) => new MLController(options).getRouter();
