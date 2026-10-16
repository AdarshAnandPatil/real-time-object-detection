"""
Custom training helper for Real-Time Object Detection.
Dataset must contain YOLO-format bounding-box annotations for ALL 20 classes.
Run in Google Colab with a GPU for practical training.
"""
from pathlib import Path
import json
import shutil
import yaml
from ultralytics import YOLO

PROJECT_DIR = Path(__file__).resolve().parent
DATA_YAML = PROJECT_DIR / "dataset" / "data.yaml"
EXPECTED_CLASSES = [
    "person", "bird", "laptop", "cell phone", "book",
    "bench", "mouse", "bottle", "backpack", "apple",
    "banana", "orange", "dog", "cat", "horse", "bus",
    "car", "bicycle", "motorcycle", "pen"
]

if not DATA_YAML.exists():
    raise FileNotFoundError(
        "Missing dataset/data.yaml. Add a labeled YOLO-format dataset first. "
        "See PEN_TRAINING_GUIDE.md."
    )

with DATA_YAML.open("r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

names = config.get("names", [])
if isinstance(names, dict):
    names = [names[i] for i in sorted(names, key=lambda x: int(x))]
names = [str(n).strip().lower() for n in names]

if names != EXPECTED_CLASSES:
    raise ValueError(
        "Class names/order in dataset/data.yaml must match this exact list:\n"
        + json.dumps(EXPECTED_CLASSES, indent=2)
        + "\nYour list is:\n" + json.dumps(names, indent=2)
    )

model = YOLO("yolo11n.pt")
model.train(
    data=str(DATA_YAML),
    epochs=100,
    imgsz=320,
    batch=16,
    patience=20,
    workers=2,
    project=str(PROJECT_DIR / "runs"),
    name="pen_plus_19_objects",
    exist_ok=True
)

best_pt = PROJECT_DIR / "runs" / "pen_plus_19_objects" / "weights" / "best.pt"
if not best_pt.exists():
    raise FileNotFoundError(f"Training finished but best.pt was not found: {best_pt}")

trained = YOLO(str(best_pt))
exported = trained.export(format="onnx", imgsz=320, dynamic=False, simplify=True)
exported_path = Path(exported)
destination = PROJECT_DIR / "yolo11n.onnx"
shutil.copy2(exported_path, destination)

with (PROJECT_DIR / "classes.json").open("w", encoding="utf-8") as f:
    json.dump(EXPECTED_CLASSES, f, indent=2)

print("\nSUCCESS")
print(f"Custom ONNX model copied to: {destination}")
print(f"Class mapping saved to: {PROJECT_DIR / 'classes.json'}")
print("Commit both yolo11n.onnx and classes.json to your GitHub repo, then redeploy Render.")
