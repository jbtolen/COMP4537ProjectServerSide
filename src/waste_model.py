# import os, sys, io, json, warnings, torch
# from transformers import AutoImageProcessor, SiglipForImageClassification, logging
# from PIL import Image

# class WasteClassifier:
#     def __init__(self):
#         # Silence logs and warnings
#         sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", write_through=True)
#         os.environ["TRANSFORMERS_VERBOSITY"] = "error"
#         os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
#         os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"
#         warnings.filterwarnings("ignore")
#         logging.set_verbosity_error()

#         # Model configuration
#         self.MODEL_NAME = "prithivMLmods/Augmented-Waste-Classifier-SigLIP2"
#         self.CACHE_DIR = "./hf_cache"
#         self.DEVICE = torch.device("cpu")

#         # Labels
#         self.LABELS = {
#             "0": "Battery", "1": "Biological", "2": "Cardboard", "3": "Clothes",
#             "4": "Glass", "5": "Metal", "6": "Paper", "7": "Plastic",
#             "8": "Shoes", "9": "Trash"
#         }

#         # Load model + processor
#         try:
#             self.processor = AutoImageProcessor.from_pretrained(self.MODEL_NAME, cache_dir=self.CACHE_DIR)
#             self.model = SiglipForImageClassification.from_pretrained(self.MODEL_NAME, cache_dir=self.CACHE_DIR)
#             self.model.to(self.DEVICE)
#             self.model.eval()
#         except Exception as e:
#             print(json.dumps({"error": f"Model load failed: {str(e)}"}))
#             sys.exit(1)

#     def classify(self, image_path: str):
#         """Run waste classification on a single image and return results."""
#         try:
#             image = Image.open(image_path).convert("RGB")
#         except Exception as e:
#             return {"error": f"Unable to open image: {str(e)}"}

#         try:
#             inputs = self.processor(images=image, return_tensors="pt")
#             inputs = {k: v.to(self.DEVICE) for k, v in inputs.items()}

#             with torch.no_grad():
#                 logits = self.model(**inputs).logits
#                 probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()

#             preds = {self.LABELS[str(i)]: round(probs[i], 3) for i in range(len(probs))}
#             top3 = dict(sorted(preds.items(), key=lambda x: x[1], reverse=True)[:3])

#             top_label, top_conf = next(iter(top3.items()))
#             return {"label": top_label, "confidence": top_conf, "predictions": top3}

#         except Exception as e:
#             return {"error": f"Inference failed: {str(e)}"}

# # ✅ Entry point (same CLI behavior as before)
# if __name__ == "__main__":
#     if len(sys.argv) < 2:
#         print(json.dumps({"error": "No image path provided"}))
#         sys.exit(1)

#     classifier = WasteClassifier()
#     image_path = sys.argv[1]
#     result = classifier.classify(image_path)
#     print(json.dumps(result))
#     sys.stdout.flush()
