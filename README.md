# Real-Time Object Detection
Flask + YOLO11n app with live camera detection and image upload.

## Run locally
pip install -r requirements.txt
python app.py

Open http://127.0.0.1:10000

The YOLO model is downloaded automatically on first startup.

## Render
Build: pip install -r requirements.txt
Start: gunicorn --bind 0.0.0.0:$PORT --timeout 120 app:app

Render provides HTTPS, which allows browser camera access.
