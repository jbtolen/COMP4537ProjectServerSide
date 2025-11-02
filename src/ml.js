const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../uploads/") });

// ✅ Cross-platform Python resolution
function resolvePythonPath() {
  const candidates = [
    path.join(__dirname, "../venv/bin/python3"), // Mac/Linux venv
    path.join(__dirname, "../venv/Scripts/python.exe"), // Windows venv
    "python3", // global Python
    "python"   // fallback
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) || candidate === "python3" || candidate === "python") {
      console.log("✅ Using Python path:", candidate);
      return candidate;
    }
  }

  throw new Error("No Python interpreter found. Install Python or create a venv.");
}

router.post("/classify", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const imgPath = req.file.path;
  const scriptPath = path.join(__dirname, "waste_model.py");
  const pythonPath = resolvePythonPath();

  try {
    const py = spawn(pythonPath, [scriptPath, imgPath]);
    let dataBuffer = "";
    let errorBuffer = "";

    py.stdout.on("data", (data) => (dataBuffer += data.toString()));
    py.stderr.on("data", (data) => (errorBuffer += data.toString()));

    py.on("close", (code) => {
      fs.unlink(imgPath, () => {});
      console.log(`Python exited with code ${code}`);
      if (errorBuffer) console.error("Python stderr:", errorBuffer);
      try {
        const parsed = JSON.parse(dataBuffer);
        res.json(parsed);
      } catch {
        console.error("Bad model output:", dataBuffer);
        res.status(500).json({ error: "Invalid model output", raw: dataBuffer });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
