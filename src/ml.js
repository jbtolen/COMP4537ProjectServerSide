const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// ✅ CORS options for both local + hosted
const corsOptions = {
  origin: [
    "https://comp4537projectclientside.onrender.com/index.html",
    "http://localhost:5500",
  ],
  credentials: true,
};

// ✅ Always handle preflight first
router.options("*", cors(corsOptions));

// ✅ Apply CORS before all routes
router.use(cors(corsOptions));

const upload = multer({ dest: path.join(__dirname, "../uploads/") });

// ✅ Cross-platform Python path resolution
function resolvePythonPath() {
  const candidates = [
    path.join(__dirname, "../venv/bin/python3"), // macOS/Linux venv
    path.join(__dirname, "../venv/Scripts/python.exe"), // Windows venv
    "python3",
    "python"
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) || candidate === "python3" || candidate === "python") {
      console.log("✅ Using Python path:", candidate);
      return candidate;
    }
  }

  throw new Error("No Python interpreter found. Install Python or create a venv.");
}

// ✅ POST /api/ml/classify
router.post("/classify", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imgPath = req.file.path;
  const scriptPath = path.join(__dirname, "waste_model.py");
  const pythonPath = resolvePythonPath();

  try {
    const py = spawn(pythonPath, ["-u", scriptPath, imgPath]);

    let dataBuffer = "";
    let errorBuffer = "";

    py.stdout.on("data", (data) => (dataBuffer += data.toString()));
    py.stderr.on("data", (data) => (errorBuffer += data.toString()));

    py.on("close", (code) => {
      fs.unlink(imgPath, () => {}); // delete uploaded file

      console.log(`\n🐍 Python exited with code ${code}`);
      if (errorBuffer) console.error("Python stderr:", errorBuffer);

      const clean = (dataBuffer || "").trim();
      console.log("🧩 Raw stdout:", clean);

      // ✅ Always send CORS headers in response
      res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");

      try {
        if (!clean) throw new Error("Empty stdout");
        const parsed = JSON.parse(clean);
        return res.json(parsed);
      } catch (err) {
        console.error("❌ Invalid model output:", clean);
        return res
          .status(500)
          .json({ error: "Invalid model output", raw: clean || errorBuffer || "" });
      }
    });
  } catch (err) {
    console.error("🔥 Server-side error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
