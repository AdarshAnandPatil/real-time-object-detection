const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");

const msg = document.getElementById("msg");

const startBtn = document.getElementById("start");
const captureBtn = document.getElementById("capture");
const stopBtn = document.getElementById("stop");

const upload = document.getElementById("upload");

const resultImage = document.getElementById("result");
const count = document.getElementById("count");
const items = document.getElementById("items");
const statusText = document.getElementById("status");

let stream = null;


// =====================================================
// START CAMERA
// =====================================================

startBtn.addEventListener("click", async () => {

    try {

        statusText.textContent =
            "⏳ Starting camera...";

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "environment",
                width: {
                    ideal: 640
                },
                height: {
                    ideal: 480
                }
            },

            audio: false
        });

        camera.srcObject = stream;

        msg.style.display = "none";

        startBtn.disabled = true;
        captureBtn.disabled = false;
        stopBtn.disabled = false;

        statusText.textContent =
            "✅ Camera started. Point it at an object and capture.";

    }

    catch (error) {

        console.error("Camera error:", error);

        statusText.textContent =
            "❌ Camera access denied. Please allow camera permission.";

    }

});


// =====================================================
// CAPTURE PHOTO
// =====================================================

captureBtn.addEventListener("click", () => {

    if (!stream) {

        statusText.textContent =
            "❌ Camera is not running.";

        return;
    }


    // Make sure video has loaded

    if (camera.videoWidth === 0 || camera.videoHeight === 0) {

        statusText.textContent =
            "⏳ Camera is not ready yet. Try again.";

        return;
    }


    // Set canvas size to camera size

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;


    // Capture current frame

    const context = canvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        canvas.width,
        canvas.height
    );


    statusText.textContent =
        "⏳ Captured photo. Sending to AI...";


    // Convert canvas to JPEG

    canvas.toBlob(
        (blob) => {

            if (!blob) {

                statusText.textContent =
                    "❌ Could not capture image.";

                return;
            }


            const file = new File(
                [blob],
                "camera-capture.jpg",
                {
                    type: "image/jpeg"
                }
            );


            detectImage(file);

        },
        "image/jpeg",
        0.85
    );

});


// =====================================================
// STOP CAMERA
// =====================================================

stopBtn.addEventListener("click", stopCamera);


function stopCamera() {

    if (stream) {

        stream.getTracks().forEach(
            (track) => track.stop()
        );

        stream = null;
    }

    camera.srcObject = null;

    msg.style.display = "flex";

    startBtn.disabled = false;
    captureBtn.disabled = true;
    stopBtn.disabled = true;

    statusText.textContent =
        "Camera stopped.";

}


// =====================================================
// IMAGE UPLOAD
// =====================================================

upload.addEventListener("change", async () => {

    const file = upload.files[0];

    if (!file) {
        return;
    }

    detectImage(file);

    // Allow selecting same image again

    upload.value = "";

});


// =====================================================
// SEND IMAGE TO SERVER
// =====================================================

async function detectImage(file) {

    statusText.textContent =
        "⏳ Analyzing image... Please wait.";

    count.textContent =
        "Analyzing...";

    items.innerHTML = "";

    resultImage.style.display = "none";


    const formData = new FormData();

    formData.append(
        "file",
        file
    );


    try {

        const response = await fetch(
            "/detect",
            {
                method: "POST",
                body: formData
            }
        );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Server error:",
                response.status,
                errorText
            );

            throw new Error(
                "Server error: HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        console.log(
            "Detection response:",
            data
        );


        if (!data.success) {

            throw new Error(
                data.error ||
                "Detection failed"
            );
        }


        // =================================================
        // SHOW RESULT IMAGE
        // =================================================

        if (data.image) {

            resultImage.src =
                data.image;

            resultImage.style.display =
                "block";
        }


        // =================================================
        // SHOW COUNT
        // =================================================

        const detectionCount =
            data.count || 0;

        count.textContent =
            "✅ Detected " +
            detectionCount +
            " object(s)";


        // =================================================
        // SHOW OBJECTS
        // =================================================

        items.innerHTML = "";


        if (
            data.detections &&
            data.detections.length > 0
        ) {

            data.detections.forEach(
                (object) => {

                    const div =
                        document.createElement("div");

                    div.className =
                        "item";


                    div.textContent =
                        "🔹 " +
                        formatObjectName(
                            object.name
                        ) +
                        " — " +
                        object.confidence +
                        "%";


                    items.appendChild(div);

                }
            );


            // =================================================
            // VOICE OUTPUT
            // =================================================

            speakDetections(
                data.detections
            );

        }

        else {

            items.innerHTML =
                "<p>⚠️ No recognizable objects detected.</p>";

        }


        statusText.textContent =
            "✅ Detection completed.";

    }

    catch (error) {

        console.error(
            "Detection error:",
            error
        );


        statusText.textContent =
            "❌ Could not analyze image.";


        count.textContent =
            "❌ " +
            error.message;


        items.innerHTML = "";

    }

}


// =====================================================
// VOICE OUTPUT
// =====================================================

function speakDetections(detections) {

    // Check browser support

    if (!("speechSynthesis" in window)) {

        console.log(
            "Voice output is not supported."
        );

        return;
    }


    // Stop previous speech

    window.speechSynthesis.cancel();


    const names =
        detections.map(
            (object) =>
                formatObjectName(
                    object.name
                )
        );


    let message;


    if (names.length === 1) {

        message =
            names[0] +
            " detected.";

    }

    else {

        message =
            names.join(", ") +
            " detected.";

    }


    const speech =
        new SpeechSynthesisUtterance(
            message
        );


    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;


    // Try to use English voice

    const voices =
        window.speechSynthesis.getVoices();


    const englishVoice =
        voices.find(
            (voice) =>
                voice.lang &&
                voice.lang
                    .toLowerCase()
                    .startsWith("en")
        );


    if (englishVoice) {

        speech.voice =
            englishVoice;

    }


    window.speechSynthesis.speak(
        speech
    );

}


// =====================================================
// FORMAT OBJECT NAME
// =====================================================

function formatObjectName(name) {

    if (!name) {
        return "Unknown object";
    }


    return name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        );

}


// =====================================================
// LOAD VOICES
// =====================================================

if ("speechSynthesis" in window) {

    window.speechSynthesis.onvoiceschanged =
        () => {

            window.speechSynthesis.getVoices();

        };

}
