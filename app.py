import os

# Make Ultralytics use a writable directory on Render
os.environ["YOLO_CONFIG_DIR"] = "/tmp/Ultralytics"

from flask import Flask, render_template, request, jsonify
from ultralytics import YOLO
from PIL import Image
import numpy as np
import cv2
import base64

app = Flask(__name__)

print("Loading YOLO object detection model...")

model = YOLO("yolo11n.pt")

print("YOLO11n model loaded successfully!")


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

        if file.filename == "":
            return jsonify({
                "success": False,
                "error": "No image selected."
            }), 400

        # Open image
        image = Image.open(file.stream).convert("RGB")

        # Reduce image size to save RAM
        image.thumbnail((640, 640))

        frame = np.array(image)

        # RGB -> BGR
        frame = cv2.cvtColor(
            frame,
            cv2.COLOR_RGB2BGR
        )

        print("Running YOLO detection...")

        # Lightweight CPU detection
        results = model.predict(
            source=frame,
            imgsz=320,
            conf=0.25,
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

        # Draw bounding boxes
        annotated = result.plot()

        # Compress image
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

        # Convert image to Base64
        encoded_image = base64.b64encode(
            buffer.tobytes()
        ).decode("utf-8")

        print(
            "Detection completed:",
            len(detections),
            "objects"
        )

        return jsonify({
            "success": True,
            "detections": detections,
            "count": len(detections),
            "image": "data:image/jpeg;base64," + encoded_image
        })

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
            "10000"
        )
    )

    app.run(
        host="0.0.0.0",
        port=port
    )
