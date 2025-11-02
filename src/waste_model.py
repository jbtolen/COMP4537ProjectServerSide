import sys, json
import warnings
warnings.filterwarnings("ignore")

from transformers import AutoImageProcessor, SiglipForImageClassification
from transformers.image_utils import load_image
from PIL import Image
import torch

MODEL_NAME = "prithivMLmods/Augmented-Waste-Classifier-SigLIP2"

# Load model only once
processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
model = SiglipForImageClassification.from_pretrained(MODEL_NAME)

labels = {
    "0": "Battery", "1": "Biological", "2": "Cardboard", "3": "Clothes",
    "4": "Glass", "5": "Metal", "6": "Paper", "7": "Plastic",
    "8": "Shoes", "9": "Trash"
}

def classify(image_path):
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
    preds = {labels[str(i)]: round(probs[i], 3) for i in range(len(probs))}
    return preds

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No image path provided"}))
            sys.exit(1)
        path = sys.argv[1]
        result = classify(path)
        print(json.dumps({"predictions": result}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
