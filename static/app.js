const video=document.getElementById("camera"),start=document.getElementById("start"),stop=document.getElementById("stop"),upload=document.getElementById("upload"),status=document.getElementById("status"),result=document.getElementById("result"),count=document.getElementById("count"),items=document.getElementById("items"),msg=document.getElementById("msg");
const canvas=document.createElement("canvas");let stream=null,running=false,busy=false;

start.onclick=async()=>{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});video.srcObject=stream;running=true;start.disabled=true;stop.disabled=false;msg.style.display="none";status.textContent="Camera running — detecting objects...";loop()}catch(e){status.textContent="❌ Camera permission denied or unavailable."}};
stop.onclick=()=>{running=false;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;start.disabled=false;stop.disabled=true;msg.style.display="flex";status.textContent="Camera stopped."};

async function loop(){while(running){await detectFrame();await new Promise(r=>setTimeout(r,700))}}
async function detectFrame(){if(!video.videoWidth||busy)return;busy=true;canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext("2d").drawImage(video,0,0);const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.72));await send(blob);busy=false}
upload.onchange=()=>{if(upload.files[0])send(upload.files[0])};

async function send(file){status.textContent="Analyzing...";const fd=new FormData();fd.append("file",file,"image.jpg");try{const r=await fetch("/detect",{method:"POST",body:fd});const d=await r.json();if(!r.ok||!d.success)throw Error(d.error||"Detection failed");result.src=d.image;result.style.display="block";count.textContent=d.count?`${d.count} object(s) detected`:"No objects detected.";items.innerHTML=d.detections.map(x=>`<div class="item"><b>${x.name}</b><br>${x.confidence}% confidence</div>`).join("");status.textContent=running?"Live detection active":"Image detection completed."}catch(e){console.error(e);status.textContent="❌ "+e.message}}
