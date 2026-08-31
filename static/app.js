const camera = document.getElementById("camera");
const msg = document.getElementById("msg");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const upload = document.getElementById("upload");

const resultImage = document.getElementById("result");
const count = document.getElementById("count");
const items = document.getElementById("items");
const statusText = document.getElementById("status");

let stream = null;

// ===============================
// START CAMERA
// ===============================

startBtn.addEventListener("click", async () => {
    try {
        statusText.textContent = "Starting camera...";

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        camera.srcObject = stream;

        msg.style.display = "none";

        startBtn.disabled = true;
        stopBtn.disabled = false;

        statusText.textContent =
            "Camera started. Point it at an object.";

    } catch (error) {
        console.error("Camera error:", error);

        statusText.textContent =
            "❌ Camera access denied. Please allow camera permission.";
    }
});


// ===============================
// STOP CAMERA
// ===============================

stopBtn.addEventListener("click", () => {

    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

        stream = null;
    }

    camera.srcObject = null;

    msg.style.display = "block";

    startBtn.disabled = false;
    stopBtn.disabled = true;

    statusText.textContent =
        "Camera stopped.";
});


// ===============================
// IMAGE UPLOAD
// ===============================

upload.addEventListener("change", async () => {

    const file = upload.files[0];

    if (!file) {
        return;
    }

    statusText.textContent =
        "⏳ Analyzing image... Please wait.";

    count.textContent =
        "Analyzing...";

    items.innerHTML = "";

    resultImage.style.display = "none";

    const formData = new FormData();

    formData.append("file", file);

    try {

        const response = await fetch("/detect", {
            method: "POST",
            body: formData
        });

        // Check server response
        if (!response.ok) {

            const errorText = await response.text();

            console.error(
                "Server error:",
                response.status,
                errorText
            );

            throw new Error(
                "Server returned HTTP " + response.status
            );
        }

        const data = await response.json();

        console.log("Detection response:", data);

        if (!data.success) {

            throw new Error(
                data.error || "Detection failed"
            );
        }

        // ===============================
        // SHOW RESULT IMAGE
        // ===============================

        if (data.image) {

            resultImage.src = data.image;
            resultImage.style.display = "block";
        }

        // ===============================
        // SHOW COUNT
        // ===============================

        count.textContent =
            "✅ Detected " +
            data.count +
            " object(s)";


        // ===============================
        // SHOW OBJECTS
        // ===============================

        items.innerHTML = "";

        if (data.detections && data.detections.length > 0) {

            data.detections.forEach((object) => {

                const div = document.createElement("div");

                div.className = "detection-item";

                div.textContent =
                    "🔹 " +
                    object.name +
                    " — " +
                    object.confidence +
                    "%";

                items.appendChild(div);
            });

        } else {

            items.innerHTML =
                "<p>⚠️ No recognizable objects detected.</p>";
        }

        statusText.textContent =
            "✅ Detection completed.";

    } catch (error) {

        console.error(
            "Detection error:",
            error
        );

        statusText.textContent =
            "❌ Could not analyze image.";

        count.textContent =
            "❌ " + error.message;

        items.innerHTML = "";
    }

    // Allow selecting the same image again
    upload.value = "";
});
