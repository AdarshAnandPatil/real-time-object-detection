import os
import cv2
import numpy as np
import onnxruntime as ort

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# ==============================
# YOLO ONNX MODEL
# ==============================

MODEL_PATH = "yolo11n.onnx"

print("Loading YOLO ONNX model...")

session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"]
)

input_name = session.get_inputs()[0].name

print("YOLO ONNX model loaded successfully!")
print("Input name:", input_name)


# ==============================
# COCO CLASS NAMES
# ==============================

CLASS_NAMES = [
    "person", "bicycle", "car", "motorcycle", "airplane",
    "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep",
    "cow", "elephant", "bear", "zebra", "giraffe",
    "backpack", "umbrella", "handbag", "tie", "suitcase",
    "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard",
    "tennis racket", "bottle", "wine glass", "cup", "fork",
    "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog",
    "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv",
    "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator",
    "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush"
]


# ==============================
# HOME
# ==============================

@app.route("/")
def home():
    return render_template("index.html")


# ==============================
# HEALTH CHECK
# ==============================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": "YOLO11n ONNX"
    })


# ==============================
# OBJECT DETECTION
# ==============================

@app.route("/detect", methods=["POST"])
def detect():

    try:

        print("Detection request received")

        if "file" not in request.files:
            return jsonify({
                "success": False,
                "error": "No image received"
            }), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({
                "success": False,
                "error": "No image selected"
            }), 400

        # Read uploaded image
        data = np.frombuffer(
            file.read(),
            np.uint8
        )

        image = cv2.imdecode(
            data,
            cv2.IMREAD_COLOR
        )

        if image is None:
            return jsonify({
                "success": False,
                "error": "Invalid image"
            }), 400

        # ==============================
        # Resize image
        # ==============================

        original = image.copy()

        height, width = image.shape[:2]

        img = cv2.resize(
            image,
            (320, 320)
        )

        # BGR -> RGB
        img = cv2.cvtColor(
            img,
            cv2.COLOR_BGR2RGB
        )

        # Normalize
        img = img.astype(np.float32) / 255.0

        # HWC -> CHW
        img = np.transpose(
            img,
            (2, 0, 1)
        )

        # Add batch
        img = np.expand_dims(
            img,
            axis=0
        )

        # ==============================
        # YOLO inference
        # ==============================

        print("Running ONNX detection...")

        outputs = session.run(
            None,
            {
                input_name: img
            }
        )

        predictions = outputs[0]

        # YOLO11 output:
        # (1, 84, 2100)

        predictions = np.squeeze(
            predictions
        )

        if predictions.shape[0] < predictions.shape[1]:
            predictions = predictions.T

        detections = []

        # ==============================
        # Process detections
        # ==============================

        for prediction in predictions:

            x, y, w, h = prediction[:4]

            class_scores = prediction[4:]

            class_id = int(
                np.argmax(class_scores)
            )

            confidence = float(
                class_scores[class_id]
            )

            if confidence < 0.25:
                continue

            # Convert coordinates
            x1 = int(
                (x - w / 2) * width / 320
            )

            y1 = int(
                (y - h / 2) * height / 320
            )

            x2 = int(
                (x + w / 2) * width / 320
            )

            y2 = int(
                (y + h / 2) * height / 320
            )

            # Keep inside image
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width - 1))
            y2 = max(0, min(y2, height - 1))

            detections.append({
                "name": CLASS_NAMES[class_id],
                "confidence": round(
                    confidence * 100,
                    2
                ),
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            })

        # ==============================
        # Draw boxes
        # ==============================

        for detection in detections:

            x1 = detection["x1"]
            y1 =
