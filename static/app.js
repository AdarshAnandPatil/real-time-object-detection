const video = document.getElementById("camera");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const uploadInput = document.getElementById("upload");

const statusText = document.getElementById("status");
const resultImage = document.getElementById("result");
const countText = document.getElementById("count");
const itemsContainer = document.getElementById("items");
const cameraMessage = document.getElementById("msg");

let stream = null;
let detecting = false;
let busy = false;

const canvas = document.createElement("canvas");


// ============================================
// START CAMERA
// ============================================

startButton.addEventListener("click", async function () {

    try {

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            },
            audio: false
        });

        video.srcObject = stream;

        detecting = true;

        startButton.disabled = true;
        stopButton.disabled = false;

        cameraMessage.style.display = "none";

        statusText.textContent =
            "Camera running — detecting objects...";

        detectCamera();

    } catch (error) {

        console.error(error);

        statusText.textContent =
            "❌ Camera access denied or unavailable.";

    }

});


// ============================================
// STOP CAMERA
// ============================================

stopButton.addEventListener("click", function () {

    detecting = false;

    if (stream) {

        stream.getTracks().forEach(function (track) {
            track.stop();
        });

    }

    stream = null;

    video.srcObject = null;

    startButton.disabled = false;
    stopButton.disabled = true;

    cameraMessage.style.display = "flex";

    statusText.textContent =
        "Camera stopped.";

});


// ============================================
// UPLOAD IMAGE
// ============================================

uploadInput.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {
        return;
    }

    statusText.textContent =
        "Analyzing uploaded image...";

    detectImage(file);

});


// ============================================
// CAMERA DETECTION
// ============================================

async function detectCamera() {

    while (detecting) {

        if (!busy && video.videoWidth > 0) {

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext("2d");

            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const blob = await new Promise(function (resolve) {

                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.65
                );

            });

            if (blob) {

                await detectImage(blob);

            }

        }

        // Wait before sending another frame.
        // This prevents Render from being overloaded.

        await new Promise(function (resolve) {
            setTimeout(resolve, 1500);
        });

    }

}


// ============================================
// SEND IMAGE TO FLASK
// ============================================

async function detectImage(file) {

    if (busy) {
        return;
    }

    busy = true;

    try {

        const formData = new FormData();

        formData.append(
            "file",
            file,
            "image.jpg"
        );


        console.log("Sending image to /detect...");


        // IMPORTANT:
        // Flask app.py uses /detect

        const response = await fetch(
            "/detect",
            {
                method: "POST",
                body: formData
            }
        );


        console.log(
            "Server response:",
            response.status
        );


        // Read response as text first.
        // This prevents the <!DOCTYPE> JSON error.

        const responseText =
            await response.text();


        let data;

        try {

            data = JSON.parse(responseText);

        } catch (jsonError) {

            console.error(
                "Server returned:",
                responseText
            );

            throw new Error(
                "Server returned an invalid response."
            );

        }


        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Object detection failed."
            );

        }


        // ========================================
        // SHOW RESULT IMAGE
        // ========================================

        resultImage.src = data.image;

        resultImage.style.display = "block";


        // ========================================
        // SHOW COUNT
        // ========================================

        if (data.count > 0) {

            countText.textContent =
                data.count +
                " object(s) detected";

        } else {

            countText.textContent =
                "No objects detected.";

        }


        // ========================================
        // SHOW OBJECTS
        // ========================================

        itemsContainer.innerHTML = "";


        data.detections.forEach(function (object) {

            const item =
                document.createElement("div");

            item.className = "item";

            item.innerHTML =
                "<b>" +
                object.name +
                "</b><br>" +
                object.confidence +
                "% confidence";

            itemsContainer.appendChild(item);

        });


        if (detecting) {

            statusText.textContent =
                "Live detection active.";

        } else {

            statusText.textContent =
                "Image detection completed.";

        }


    } catch (error) {

        console.error(
            "Detection error:",
            error
        );


        statusText.textContent =
            "❌ " + error.message;


    } finally {

        busy = false;

    }

}
