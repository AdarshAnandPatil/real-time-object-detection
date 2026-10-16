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

const dashboard = document.getElementById("objectDashboard");

let stream = null;


// =====================================================
// START CAMERA
// =====================================================

startBtn.addEventListener("click", async () => {

    try {

        statusText.textContent = "⏳ Starting camera...";

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
        captureBtn.disabled = false;
        stopBtn.disabled = false;

        statusText.textContent =
            "✅ Camera started. Point at an object and click Capture Photo.";

    } catch (error) {

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

    if (camera.videoWidth === 0 || camera.videoHeight === 0) {

        statusText.textContent =
            "⏳ Camera is not ready. Try again.";

        return;
    }

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    const context = canvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        canvas.width,
        canvas.height
    );

    statusText.textContent =
        "⏳ Photo captured. Sending to AI...";

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
            track => track.stop()
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
// UPLOAD IMAGE
// =====================================================

upload.addEventListener("change", () => {

    const file = upload.files[0];

    if (!file) {
        return;
    }

    detectImage(file);

    upload.value = "";
});


// =====================================================
// DETECT IMAGE
// =====================================================

async function detectImage(file) {

    statusText.textContent =
        "⏳ Analyzing image... Please wait.";

    count.textContent =
        "Analyzing...";

    items.innerHTML = "";

    resultImage.style.display = "none";


    const formData = new FormData();

    formData.append("file", file);


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
        // SHOW DETECTION RESULTS
        // =================================================

        items.innerHTML = "";


        if (
            data.detections &&
            data.detections.length > 0
        ) {

            data.detections.forEach(
                object => {

                    const div =
                        document.createElement("div");

                    div.className = "item";

                    div.textContent =
                        "🔹 " +
                        formatObjectName(object.name) +
                        " — " +
                        object.confidence +
                        "%";

                    items.appendChild(div);
                }
            );


            // =================================================
            // VOICE
            // =================================================

            speakDetections(
                data.detections
            );


            // =================================================
            // UPDATE DASHBOARD
            // =================================================

            updateDashboard(
                data.detections
            );

        } else {

            items.innerHTML =
                "<p>⚠️ No recognizable supported objects detected.</p>";

            statusText.textContent =
                "⚠️ No supported object detected.";
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
            "❌ " +
            error.message;

        items.innerHTML = "";
    }
}


// =====================================================
// VOICE OUTPUT
// =====================================================

function speakDetections(detections) {

    if (!("speechSynthesis" in window)) {

        console.log(
            "Voice output is not supported."
        );

        return;
    }

    window.speechSynthesis.cancel();


    const uniqueNames = [];

    detections.forEach(object => {

        const name =
            formatObjectName(object.name);

        if (!uniqueNames.includes(name)) {

            uniqueNames.push(name);
        }
    });


    let message;

    if (uniqueNames.length === 1) {

        message =
            uniqueNames[0] +
            " detected.";

    } else {

        message =
            uniqueNames.join(", ") +
            " detected.";
    }


    const speech =
        new SpeechSynthesisUtterance(
            message
        );


    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;


    const voices =
        window.speechSynthesis.getVoices();


    const englishVoice =
        voices.find(
            voice =>
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
// UPDATE DASHBOARD
// =====================================================

function updateDashboard(detections) {

    if (!dashboard) {
        return;
    }


    // Count detected objects

    const counts = {};


    detections.forEach(object => {

        const name =
            formatObjectName(object.name);

        counts[name] =
            (counts[name] || 0) + 1;
    });


    // Find dashboard items

    const dashboardItems =
        dashboard.querySelectorAll(".item");


    dashboardItems.forEach(item => {

        const originalText =
            item.dataset.originalText ||
            item.textContent.trim();


        item.dataset.originalText =
            originalText;


        // Extract object name after number

        const objectName =
            originalText
                .replace(/^\d+\.\s*/, "")
                .trim();


        const detectedCount =
            counts[objectName] || 0;


        if (detectedCount > 0) {

            item.innerHTML =
                "<b>" +
                originalText.split(".")[0] +
                ".</b> " +
                objectName +
                " <strong>✅ Detected: " +
                detectedCount +
                "</strong>";

        } else {

            item.innerHTML =
                "<b>" +
                originalText.split(".")[0] +
                ".</b> " +
                objectName +
                " <span>— Not detected</span>";
        }

    });
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
        .replace(/\b\w/g, letter =>
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
