// ml.js – FINAL VERSION using Hugging Face Space
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

let Client, handle_file;

class MLController {
  constructor(options = {}) {
    this.db = options.db;                    // <-- REQUIRED (server.js gives this)
    this.requireAuth = options.requireAuth;  // Middleware (optional)
    this.trackUsage = options.trackUsage;    // Middleware (optional)
    this.router = express.Router();
    this.upload = multer({ dest: path.join(__dirname, "../uploads/") });

    this.setupCors();
    this.registerRoutes();
  }

  setupCors() {
    const corsOptions = {
      origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "https://comp4537projectclientside.netlify.app",
        "https://comp4537projectclientside.onrender.com"
      ],
      credentials: true
    };

    this.router.options("*", cors(corsOptions));
    this.router.use(cors(corsOptions));
  }

  registerRoutes() {
    const middleware = [];

    if (this.requireAuth) middleware.push(this.requireAuth); // 🔐 Only if logged-in user
    if (this.trackUsage) middleware.push(this.trackUsage());
    
    middleware.push(this.upload.single("image"), this.handleClassify.bind(this));
    /**
 * @swagger
 * /ml/classify:
 *   post:
 *     summary: Upload an image for ML classification
 *     tags:
 *       - ML
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image to classify
 *     responses:
 *       200:
 *         description: Classification result
 *         content:
 *           application/json:
 *             example:
 *               model_output: { class: "paper", confidence: 0.92 }
 *               classification_id: "uuid-v4"
 */
this.router.post("/classify", ...middleware);


  }

  // ------------------------------------------------------------
  //      🧠 CLASSIFICATION HANDLER (SAVES TO SQLITE DB!)
  // ------------------------------------------------------------
  async handleClassify(req, res) {
    console.log("📩 ML Request Received!");

    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const imgPath = req.file.path;
    console.log("📸 Image saved at:", imgPath);

  try {
    // Dynamically import @gradio/client (ES module)
    if (!Client) {
      const gradio = await import("@gradio/client");
      Client = gradio.Client;
      handle_file = gradio.handle_file;
    }
    
    const client = await Client.connect("jbtolen/PythonService");
    console.log("🌐 Connected to Hugging Face");

    const result = await client.predict("/predict", {
      image: handle_file(imgPath),
    });
    console.log("🧠 HF Prediction:", result.data);

      // 🧹 Delete temp file
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

      // --------------------- SAVE TO DB --------------------- //
      const classificationId = uuidv4();
      const userId = req?.user?.id || null; // if not logged in → null

      if (this.db) {
        this.db.saveClassification({
          id: classificationId,
          userId,
          imagePath: imgPath,
          resultJson: result.data,
          status: "completed"
        });
        console.log("💾 Saved classification:", classificationId);
      }

      // --------------------- RESPONSE --------------------- //
      return res.json({
        model_output: result.data,
        classification_id: classificationId
      });
    } catch (err) {
      console.error("💥 ML Error:", err.message);

      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

      return res.status(500).json({
        error: "ML API failed",
        details: err.message
      });
    }
  }
}

module.exports = MLController;
