# Real-Time Object Detection — Pen-ready custom training

Flask + ONNX Runtime web app with camera capture and image upload. The selected dashboard list now replaces Chair with Pen.

## Important
The included `yolo11n.onnx` is still the original COCO-pretrained model. It **cannot genuinely detect pens** because Pen is not a COCO class. The app ZIP includes a custom training script and guide, but a real pen-capable model must be trained using labeled images. Read `PEN_TRAINING_GUIDE.md` before deploying this as pen detection.

## Run locally
```bash
pip install -r requirements.txt
python app.py
```
Open `http://127.0.0.1:10000`.

## Train a custom model
Prepare a YOLO-format dataset containing all 20 selected classes in the exact order shown in `PEN_TRAINING_GUIDE.md`, then run:
```bash
pip install ultralytics pyyaml
python train_pen_model.py
```
The script trains from YOLO11n, exports ONNX at 320x320, and writes `classes.json`. Replace/commit the resulting `yolo11n.onnx` and `classes.json` together. A pen-only dataset will not preserve the other 19 categories.

## Render
Build: `pip install -r requirements.txt`
Start: `gunicorn --bind 0.0.0.0:$PORT --timeout 120 app:app`
Render provides HTTPS, which allows browser camera access.

## Pen detection status (important)

The dashboard lists **Pen** instead of Chair, but the included `yolo11n.onnx` is still the original COCO-pretrained model and does **not** know the pen class. Actual pen detection requires training on a labeled dataset containing all 20 target classes (the 19 existing categories plus pen). Follow `PEN_TRAINING_GUIDE.md` and run `train_pen_model.py` in Google Colab with a GPU. Do not deploy this as a working pen detector until the trained ONNX model and matching `classes.json` have been installed and tested.

