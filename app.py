from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
from PIL import Image
import numpy as np
import cv2
import base64
import os

app = Flask(__name__)

print("Loading YOLO object detection model...")
model = YOLO("yolo11n.pt")
print("YOLO model loaded successfully!")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    try:
        if "file" not in request.files:
            return jsonify(success=False, error="No image received."), 400
        file = request.files["file"]
        image = Image.open(file.stream).convert("RGB")
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        result = model.predict(source=frame, conf=0.35, verbose=False)[0]
        annotated = result.plot()

        detections = []
        if result.boxes is not None:
            for box, conf, cls in zip(result.boxes.xyxy.cpu().numpy(),
                                      result.boxes.conf.cpu().numpy(),
                                      result.boxes.cls.cpu().numpy()):
                cid = int(cls)
                detections.append({
                    "name": result.names[cid],
                    "confidence": round(float(conf) * 100, 2)
                })

        ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
        if not ok:
            raise RuntimeError("Could not encode result image.")

        encoded = base64.b64encode(buf).decode("utf-8")
        return jsonify(success=True,
                       image="data:image/jpeg;base64," + encoded,
                       detections=detections,
                       count=len(detections))
    except Exception as e:
        print("Detection error:", repr(e))
        return jsonify(success=False, error=str(e)), 500

@app.route("/health")
def health():
    return jsonify(status="ok", model="YOLO11n")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
