import os

# Use a writable directory on Render before importing Ultralytics
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

        print("Received detection request")

        if "file" not in request.files:

            return jsonify({
                "success": False,
                "error": "No image file received."
            }), 400

        file = request.files["file"]

        if file.filename == "":

            return jsonify({
                "success": False,
                "error": "No image selected."
            }), 400

        print("Reading image...")

        image = Image.open(file.stream).convert("RGB")

        # Resize large images to reduce processing time
        image.thumbnail((1280, 1280))

        frame = np.array(image)

        frame = cv2.cvtColor(
            frame,
            cv2.COLOR_RGB2BGR
        )

        print("Running YOLO detection...")

        results = model.predict(
            source=frame,
            conf=0.30,
            imgsz=640,
            device="cpu",
            verbose=False
        )

        result = results[0]

        print("YOLO detection completed")

        annotated = result.plot()

        detections = []

        if result.boxes is not None:

            for box, confidence, cls in zip(
                result.boxes.xyxy.cpu().numpy(),
                result.boxes.conf.cpu().numpy(),
                result.boxes.cls.cpu().numpy()
            ):

                class_id = int(cls)

                object_name = result.names[class_id]

                confidence_value = round(
                    float(confidence) * 100,
                    2
                )

                detections.append({
                    "name": object_name,
                    "confidence": confidence_value
                })

        print(
            "Objects detected:",
            len(detections)
        )

        success, buffer = cv2.imencode(
            ".jpg",
            annotated,
            [
                int(cv2.IMWRITE_JPEG_QUALITY),
                70
            ]
        )

        if not success:

            raise RuntimeError(
                "Could not create result image."
            )

        encoded_image = base64.b64encode(
            buffer
        ).decode("utf-8")

        return jsonify({
            "success": True,
            "image": "data:image/jpeg;base64," + encoded_image,
            "detections": detections,
            "count": len(detections)
        })

    except Exception as error:

        print(
            "DETECTION ERROR:",
            repr(error)
        )

        return jsonify({
            "success": False,
            "error": str(error)
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
