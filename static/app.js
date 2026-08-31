document.addEventListener("DOMContentLoaded", function () {

    const camera = document.getElementById("camera");
    const startButton = document.getElementById("start");
    const stopButton = document.getElementById("stop");
    const upload = document.getElementById("upload");

    const msg = document.getElementById("msg");
    const status = document.getElementById("status");

    const resultImage = document.getElementById("result");
    const count = document.getElementById("count");
    const items = document.getElementById("items");

    let stream = null;
    let detecting = false;
    let detectionTimer = null;


    // =====================================
    // START CAMERA
    // =====================================

    startButton.addEventListener("click", async function () {

        try {

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

            startButton.disabled = true;
            stopButton.disabled = false;

            status.textContent =
                "Camera started. Detecting objects...";

            // Start detection every 2 seconds
            detecting = true;

            detectCameraFrame();

            detectionTimer = setInterval(
                detectCameraFrame,
                2000
            );

        } catch (error) {

            console.error(error);

            status.textContent =
                "❌ Camera access denied or unavailable.";

            alert(
                "Please allow camera permission in your browser."
            );
        }

    });


    // =====================================
    // STOP CAMERA
    // =====================================

    stopButton.addEventListener("click", function () {

        detecting = false;

        if (detectionTimer) {
            clearInterval(detectionTimer);
            detectionTimer = null;
        }

        if (stream) {

            stream.getTracks().forEach(
                track => track.stop()
            );

            stream = null;
        }

        camera.srcObject = null;

        msg.style.display = "block";

        startButton.disabled = false;
        stopButton.disabled = true;

        status.textContent =
            "Camera stopped.";

    });


    // =====================================
    // CAMERA FRAME DETECTION
    // =====================================

    async function detectCameraFrame() {

        if (!detecting || !stream) {
            return;
        }

        if (camera.readyState < 2) {
            return;
        }

        // Don't send another request if one is already running
        if (detectCameraFrame.busy) {
            return;
        }

        detectCameraFrame.busy = true;

        try {

            const canvas =
                document.createElement("canvas");

            canvas.width = 640;
            canvas.height = 480;

            const context =
                canvas.getContext("2d");

            context.drawImage(
                camera,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const blob =
                await new Promise(resolve => {

                    canvas.toBlob(
                        resolve,
                        "image/jpeg",
                        0.65
                    );

                });

            const formData =
                new FormData();

            formData.append(
                "file",
                blob,
                "camera.jpg"
            );

            const response =
                await fetch("/detect", {
                    method: "POST",
                    body: formData
                });

            if (!response.ok) {

                throw new Error(
                    "Server returned HTTP " +
                    response.status
                );
            }

            const data =
                await response.json();

            if (!data.success) {

                throw new Error(
                    data.error ||
                    "Detection failed."
                );
            }

            showResults(data);

            status.textContent =
                "✅ Detection updated.";

        } catch (error) {

            console.error(
                "Camera detection error:",
                error
            );

            status.textContent =
                "⚠️ Detection temporarily unavailable.";

        } finally {

            detectCameraFrame.busy = false;

        }
    }


    // =====================================
    // UPLOAD IMAGE
    // =====================================

    upload.addEventListener(
        "change",
        async function () {

            const file =
                this.files[0];

            if (!file) {
                return;
            }

            status.textContent =
                "🔄 Analyzing uploaded image...";

            count.textContent =
                "Analyzing...";

            items.innerHTML = "";

            try {

                const formData =
                    new FormData();

                formData.append(
                    "file",
                    file
                );

                const response =
                    await fetch("/detect", {
                        method: "POST",
                        body: formData
                    });

                if (!response.ok) {

                    throw new Error(
                        "Server returned HTTP " +
                        response.status
                    );
                }

                const data =
                    await response.json();

                if (!data.success) {

                    throw new Error(
                        data.error ||
                        "Detection failed."
                    );
                }

                showResults(data);

                status.textContent =
                    "✅ Image analyzed successfully.";

            } catch (error) {

                console.error(
                    "Upload detection error:",
                    error
                );

                count.textContent =
                    "❌ " + error.message;

                status.textContent =
                    "❌ Could not analyze image.";

            }

        }
    );


    // =====================================
    // SHOW RESULTS
    // =====================================

    function showResults(data) {

        // Show annotated image
        if (data.image) {

            resultImage.src =
                data.image;

            resultImage.style.display =
                "block";
        }


        // Number of objects
        count.textContent =
            data.count +
            " object(s) detected";


        // Clear old results
        items.innerHTML = "";


        if (
            !data.detections ||
            data.detections.length === 0
        ) {

            items.innerHTML =
                "<p>No recognizable objects detected.</p>";

            return;
        }


        // Display objects
        data.detections.forEach(
            function (object) {

                const div =
                    document.createElement("div");

                div.className =
                    "detection-item";

                div.innerHTML =
                    "<strong>" +
                    object.name +
                    "</strong>" +
                    " — " +
                    object.confidence +
                    "%";

                items.appendChild(div);

            }
        );

    }

});
