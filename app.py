import os

# Use writable directory on Render
os.environ["YOLO_CONFIG_DIR"] = "/tmp/Ultralytics"

from flask import Flask, render_template, request, jsonify, send_file
from ultralytics import YOLO
from PIL import Image
import io
import numpy as np
import cv2

app = Flask(__name__)

print("Loading YOLO object detection model...")

model = YOLO("yolo11n.pt")

print("YOLO model loaded successfully!")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": "YOLO11n"
    })


@app.route("/detect", methods=["POST"])
def detect():

    try:
        print("Detection request received")

        if "file" not in request.files:
            return jsonify({
                "success": False,
                "error": "No image received."
            }), 400

        file = request.files["file"]

        if not file:
            return jsonify({
                "success": False,
                "error": "Invalid image."
            }), 400

        # Read image
        image = Image.open(file.stream).convert("RGB")

        # Keep image small to reduce RAM usage
        image.thumbnail((800, 800))

        frame = np.array(image)

        frame = cv2.cvtColor(
            frame,
            cv2.COLOR_RGB2BGR
        )

        print("Running YOLO...")

        # Lightweight CPU prediction
        results = model.predict(
            source=frame,
            imgsz=416,
            conf=0.35,
            device="cpu",
            verbose=False
        )

        result = results[0]

        detections = []

        if result.boxes is not None:

            for confidence, cls in zip(
                result.boxes.conf.cpu().numpy(),
                result.boxes.cls.cpu().numpy()
            ):

                class_id = int(cls)

                detections.append({
                    "name": result.names[class_id],
                    "confidence": round(
                        float(confidence) * 100,
                        2
                    )
                })

        print(
            "Detection completed:",
            len(detections),
            "objects"
        )

        # Create annotated image
        annotated = result.plot()

        # Compress output image
        success, buffer = cv2.imencode(
            ".jpg",
            annotated,
            [
                int(cv2.IMWRITE_JPEG_QUALITY),
                60
            ]
        )

        if not success:
            raise RuntimeError(
                "Could not create result image."
            )

        # Return image directly as a small binary response
        return send_file(
            io.BytesIO(buffer.tobytes()),
            mimetype="image/jpeg",
            as_attachment=False,
            download_name="result.jpg"
        )

    except Exception as e:

        print(
            "DETECTION ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port
    )
