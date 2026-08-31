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


// ================================
// START CAMERA
// ================================

startButton.addEventListener("click", async function () {

    try {

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            },
            audio: false
        });

        video.srcObject = stream;

        detecting = true;

        startButton.disabled = true;
        stopButton.disabled = false;

        cameraMessage.style.display = "none";

        statusText.textContent =
            "Camera running...";

        detectCamera();

    } catch (error) {

        console.error(error);

        statusText.textContent =
            "❌ Camera access denied.";

    }

});


// ================================
// STOP CAMERA
// ================================

stopButton.addEventListener("click", function () {

    detecting = false;

    if (stream) {

        stream.getTracks().forEach(
            track => track.stop()
        );

    }

    stream = null;

    video.srcObject = null;

    startButton.disabled = false;
    stopButton.disabled = true;

    cameraMessage.style.display = "flex";

    statusText.textContent =
        "Camera stopped.";

});


// ================================
// UPLOAD IMAGE
// ================================

uploadInput.addEventListener(
    "change",
    function () {

        const file = this.files[0];

        if (!file) return;

        statusText.textContent =
            "Analyzing image...";

        detectImage(file);

    }
);


// ================================
// CAMERA LOOP
// ================================

async function detectCamera() {

    while (detecting) {

        if (
            !busy &&
            video.videoWidth > 0
        ) {

            canvas.width =
                640;

            canvas.height =
                360;

            const context =
                canvas.getContext("2d");

            context.drawImage(
                video,
                0,
                0,
                640,
                360
            );

            const blob =
                await new Promise(resolve => {

                    canvas.toBlob(
                        resolve,
                        "image/jpeg",
                        0.55
                    );

                });

            if (blob) {

                await detectImage(blob);

            }

        }

        // Important:
        // Wait before sending next frame.

        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );

    }

}


// ================================
// DETECT IMAGE
// ================================

async function detectImage(file) {

    if (busy) return;

    busy = true;

    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file,
            "image.jpg"
        );

        console.log(
            "Sending image to /detect"
        );

        const response =
            await fetch(
                "/detect",
                {
                    method: "POST",
                    body: formData
                }
            );

        const text =
            await response.text();

        let data;

        try {

            data =
                JSON.parse(text);

        } catch {

            console.error(
                "Server response:",
                text
            );

            throw new Error(
                "Server returned an invalid response."
            );

        }

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Detection failed."
            );

        }


        // ================================
        // RESULTS
        // ================================

        countText.textContent =
            data.count +
            " object(s) detected";

        itemsContainer.innerHTML = "";


        data.detections.forEach(
            object => {

                const item =
                    document.createElement("div");

                item.className =
                    "item";

                item.innerHTML =
                    "<b>" +
                    object.name +
                    "</b><br>" +
                    object.confidence +
                    "% confidence";

                itemsContainer.appendChild(
                    item
                );

            }
        );


        statusText.textContent =
            "✅ Detection completed.";


    } catch (error) {

        console.error(error);

        statusText.textContent =
            "❌ " + error.message;

    } finally {

        busy = false;

    }

}
