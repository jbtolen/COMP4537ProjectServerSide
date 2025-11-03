import sys
import json
import warnings
import torch
from transformers import AutoImageProcessor, SiglipForImageClassification, logging
from PIL import Image

# ───────────────────────────────
#  Basic config
# ───────────────────────────────
warnings.filterwarnings("ignore")
logging.set_verbosity_error()  # silence Hugging Face logs

MODEL_NAME = "prithivMLmods/Augmented-Waste-Classifier-SigLIP2"
CACHE_DIR = "./hf_cache"       # local cache folder reused between runs
DEVICE = torch.device("cpu")   # Azure App Service = CPU only

# ───────────────────────────────
#  Load model once and keep cached
# ───────────────────────────────
try:
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
    model = SiglipForImageClassification.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
    model.to(DEVICE)
    model.eval()
except Exception as e:
    print(json.dumps({"error": f"Model load failed: {str(e)}"}))
    sys.exit(1)

# Label mapping
LABELS = {
    "0": "Battery", "1": "Biological", "2": "Cardboard", "3": "Clothes",
    "4": "Glass", "5": "Metal", "6": "Paper", "7": "Plastic",
    "8": "Shoes", "9": "Trash"
}

# ───────────────────────────────
#  Classification function
# ───────────────────────────────
def classify(image_path: str):
    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        return {"error": f"Unable to open image: {str(e)}"}

    try:
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
        preds = {LABELS[str(i)]: round(probs[i], 3) for i in range(len(probs))}
        # Return only top 3 predictions
        top3 = dict(sorted(preds.items(), key=lambda x: x[1], reverse=True)[:3])
        return {"predictions": top3}
    except Exception as e:
        return {"error": f"Inference failed: {str(e)}"}

# ───────────────────────────────
#  Entry point
# ───────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    result = classify(image_path)
    print(json.dumps(result))
