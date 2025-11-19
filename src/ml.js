// ml.js – FINAL VERSION using Hugging Face Space
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { Client, handle_file } = require("@gradio/client");

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
        "https://comp4537projectclientside.netlify.app",
        "https://comp4537projectclientside.onrender.com",
        "http://localhost:5500",
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

async handleClassify(req, res) {
  console.log("📩 ML Request Received!");

  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imgPath = req.file.path;
  console.log("📸 Saved image at:", imgPath);

  try {
    const client = await Client.connect("jbtolen/PythonService");
    console.log("🌐 Connected to Hugging Face");

    const result = await client.predict("/predict", {
      image: handle_file(imgPath),
    });
    console.log("🧠 HF Prediction:", result.data);

    // 🧹 SAFE DELETE
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
      console.log("🗑 Deleted temp file");
    } else {
      console.warn("⚠ Temp file missing, could NOT delete:", imgPath);
    }

    return res.json({ model_output: result.data });

  } catch (err) {
    console.error("💥 ML ERROR:", err);

    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
      console.log("🗑 Deleted temp file AFTER ERROR");
    }

    return res.status(500).json({
      error: "ML API failed",
      details: err.message
    });
  }
}

}

// IMPORTANT 🔥 — EXPORT THE CLASS, NOT THE INSTANCE
module.exports = MLController;
