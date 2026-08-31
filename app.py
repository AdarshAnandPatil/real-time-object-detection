import os
import cv2
import numpy as np
import onnxruntime as ort

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# =========================================================
# MODEL
# =========================================================

MODEL_PATH = "yolo11n.onnx"

print("Loading YOLO11n ONNX model...")

session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"]
)

input_name = session.get_inputs()[0].name

print("YOLO11n ONNX model loaded successfully!")
print("Input:", input_name)


# =========================================================
# COCO CLASS NAMES
# =========================================================

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


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# HEALTH
# =========================================================

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": "YOLO11n ONNX"
    })


# =========================================================
# DETECTION
# =========================================================

@app.route("/detect", methods=["POST"])
def detect():

    try:
        print("Detection request received")

        # -------------------------------------------------
        # Check file
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Read image
        # -------------------------------------------------

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

        original = image.copy()

        original_height, original_width = image.shape[:2]

        # -------------------------------------------------
        # YOLO input size
        # -------------------------------------------------

        INPUT_SIZE = 320

        resized = cv2.resize(
            image,
            (INPUT_SIZE, INPUT_SIZE)
        )

        # BGR -> RGB
        resized = cv2.cvtColor(
            resized,
            cv2.COLOR_BGR2RGB
        )

        # Normalize
        resized = resized.astype(
            np.float32
        ) / 255.0

        # HWC -> CHW
        resized = np.transpose(
            resized,
            (2, 0, 1)
        )

        # Add batch dimension
        resized = np.expand_dims(
            resized,
            axis=0
        )

        # -------------------------------------------------
        # YOLO inference
        # -------------------------------------------------

        print("Running ONNX detection...")

        outputs = session.run(
            None,
            {
                input_name: resized
            }
        )

        predictions = outputs[0]

        print(
            "Raw output shape:",
            predictions.shape
        )

        # -------------------------------------------------
        # Convert output shape
        # -------------------------------------------------

        predictions = np.squeeze(
            predictions
        )

        # YOLO output normally:
        # (84, 2100)
        # Convert to:
        # (2100, 84)

        if predictions.ndim != 2:
            raise RuntimeError(
                "Unexpected YOLO output shape"
            )

        if predictions.shape[0] < predictions.shape[1]:
            predictions = predictions.T

        print(
            "Processed output shape:",
            predictions.shape
        )

        # -------------------------------------------------
        # Detection settings
        # -------------------------------------------------

        CONFIDENCE_THRESHOLD = 0.20
        NMS_THRESHOLD = 0.45

        boxes = []
        scores = []
        class_ids = []

        # -------------------------------------------------
        # Process YOLO predictions
        # -------------------------------------------------

        for prediction in predictions:

            # First 4 values:
            # x, y, width, height

            x, y, w, h = prediction[:4]

            # Remaining values:
            # class probabilities

            class_scores = prediction[4:]

            if len(class_scores) == 0:
                continue

            class_id = int(
                np.argmax(class_scores)
            )

            confidence = float(
                class_scores[class_id]
            )

            if confidence < CONFIDENCE_THRESHOLD:
                continue

            # -------------------------------------------------
            # Convert YOLO coordinates
            # -------------------------------------------------

            x1 = int(
                (x - w / 2)
                * original_width
                / INPUT_SIZE
            )

            y1 = int(
                (y - h / 2)
                * original_height
                / INPUT_SIZE
            )

            x2 = int(
                (x + w / 2)
                * original_width
                / INPUT_SIZE
            )

            y2 = int(
                (y + h / 2)
                * original_height
                / INPUT_SIZE
            )

            # -------------------------------------------------
            # Clamp coordinates
            # -------------------------------------------------

            x1 = max(
                0,
                min(x1, original_width - 1)
            )

            y1 = max(
                0,
                min(y1, original_height - 1)
            )

            x2 = max(
                0,
                min(x2, original_width - 1)
            )

            y2 = max(
                0,
                min(y2, original_height - 1)
            )

            box_width = x2 - x1
            box_height = y2 - y1

            if box_width <= 0 or box_height <= 0:
                continue

            boxes.append([
                x1,
                y1,
                box_width,
                box_height
            ])

            scores.append(confidence)
            class_ids.append(class_id)

        # -------------------------------------------------
        # Non-Maximum Suppression
        # -------------------------------------------------

        selected = cv2.dnn.NMSBoxes(
            boxes,
            scores,
            CONFIDENCE_THRESHOLD,
            NMS_THRESHOLD
        )

        detections = []

        if len(selected) > 0:

            selected = np.array(
                selected
            ).reshape(-1)

            for index in selected:

                class_id = class_ids[index]

                x1 = boxes[index][0]
                y1 = boxes[index][1]
                box_width = boxes[index][2]
                box_height = boxes[index][3]

                x2 = x1 + box_width
                y2 = y1 + box_height

                confidence = scores[index]

                # Safety check
                if class_id < 0 or class_id >= len(CLASS_NAMES):
                    continue

                detections.append({
                    "name": CLASS_NAMES[class_id],
                    "confidence": round(
                        confidence * 100,
                        2
                    ),
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2)
                })

        # -------------------------------------------------
        # Draw boxes
        # -------------------------------------------------

        annotated = original.copy()

        for detection in detections:

            x1 = detection["x1"]
            y1 = detection["y1"]
            x2 = detection["x2"]
            y2 = detection["y2"]

            name = detection["name"]

            confidence = detection["confidence"]

            # Bounding box
            cv2.rectangle(
                annotated,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            label = (
                f"{name} "
                f"{confidence:.1f}%"
            )

            # Label background
            (text_width, text_height), baseline = (
                cv2.getTextSize(
                    label,
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    2
                )
            )

            label_y = max(
                y1,
                text_height + baseline
            )

            cv2.rectangle(
                annotated,
                (
                    x1,
                    label_y - text_height - baseline
                ),
                (
                    x1 + text_width,
                    label_y
                ),
                (0, 255, 0),
                -1
            )

            cv2.putText(
                annotated,
                label,
                (
                    x1,
                    label_y - baseline
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 0),
                2
            )

        # -------------------------------------------------
        # Encode image
        # -------------------------------------------------

        success, buffer = cv2.imencode(
            ".jpg",
            annotated,
            [
                int(cv2.IMWRITE_JPEG_QUALITY),
                65
            ]
        )

        if not success:
            raise RuntimeError(
                "Could not encode result image"
            )

        # -------------------------------------------------
        # Base64 image
        # -------------------------------------------------

        import base64

        encoded_image = base64.b64encode(
            buffer.tobytes()
        ).decode("utf-8")

        # -------------------------------------------------
        # Final response
        # -------------------------------------------------

        print(
            "Detection completed:",
            len(detections),
            "objects"
        )

        return jsonify({
            "success": True,
            "count": len(detections),
            "detections": detections,
            "image": (
                "data:image/jpeg;base64,"
                + encoded_image
            )
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


# =========================================================
# RUN
# =========================================================

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
