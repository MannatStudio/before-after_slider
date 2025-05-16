const beforeUpload = document.getElementById('before-upload');
const afterUpload = document.getElementById('after-upload');
const beforeWrapper = document.getElementById('before-wrapper');
const beforeImage = document.getElementById('before-image');
const afterImage = document.getElementById('after-image');
const slider = document.getElementById('slider');
const sliderHandle = document.getElementById('slider-handle');
const aspectRatioSelect = document.getElementById('aspect-ratio');
const exportGifBtn = document.getElementById('export-gif');
const exportMp4Btn = document.getElementById('export-mp4');
const status = document.getElementById('status');

let beforeImgLoaded = false;
let afterImgLoaded = false;

function updateSliderPosition(value) {
  beforeWrapper.style.width = value + '%';
  sliderHandle.style.left = value + '%';
  slider.value = value;
}

slider.addEventListener('input', (e) => {
  updateSliderPosition(e.target.value);
});

beforeUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  beforeImage.src = URL.createObjectURL(file);
  beforeImgLoaded = true;
  tryEnableSlider();
});

afterUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  afterImage.src = URL.createObjectURL(file);
  afterImgLoaded = true;
  tryEnableSlider();
});

aspectRatioSelect.addEventListener('change', () => {
  const ratio = parseFloat(aspectRatioSelect.value);
  const container = document.getElementById('slider-container');
  container.style.height = `${container.offsetWidth / ratio}px`;
});

function tryEnableSlider() {
  if (beforeImgLoaded && afterImgLoaded) {
    updateSliderPosition(50);
  }
}

window.addEventListener('resize', () => {
  const ratio = parseFloat(aspectRatioSelect.value);
  const container = document.getElementById('slider-container');
  container.style.height = `${container.offsetWidth / ratio}px`;
});

window.onload = () => {
  const ratio = parseFloat(aspectRatioSelect.value);
  const container = document.getElementById('slider-container');
  container.style.height = `${container.offsetWidth / ratio}px`;
};

// ------------------ Export GIF ------------------
exportGifBtn.addEventListener('click', async () => {
  if (!beforeImgLoaded || !afterImgLoaded) {
    alert('Please upload both images first!');
    return;
  }
  status.textContent = 'Generating GIF, please wait...';

  // We use gif.js to capture frames at different slider positions
  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: beforeImage.naturalWidth,
    height: beforeImage.naturalHeight,
  });

  // Create a canvas to draw frames
  const canvas = document.createElement('canvas');
  canvas.width = beforeImage.naturalWidth;
  canvas.height = beforeImage.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Capture 20 frames with slider moving from 0 to 100%
  for (let i = 0; i <= 20; i++) {
    const pct = (i / 20) * 100;

    // Draw 'after' image fully
    ctx.drawImage(afterImage, 0, 0, canvas.width, canvas.height);

    // Clip before image width according to pct
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, (pct / 100) * canvas.width, canvas.height);
    ctx.clip();
    ctx.drawImage(beforeImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    gif.addFrame(ctx, {copy: true, delay: 100});
  }

  gif.on('finished', (blob) => {
    status.textContent = '';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'before-after.gif';
    a.click();
    URL.revokeObjectURL(url);
  });

  gif.render();
});

// ------------------ Export MP4 ------------------
import { createFFmpeg, fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.5/dist/ffmpeg.min.js';

const ffmpeg = createFFmpeg({ log: true });
let ffmpegReady = false;

async function loadFFmpeg() {
  if (!ffmpegReady) {
    status.textContent = 'Loading FFmpeg-core (this may take a moment)...';
    await ffmpeg.load();
    ffmpegReady = true;
    status.textContent = '';
  }
}

exportMp4Btn.addEventListener('click', async () => {
  if (!beforeImgLoaded || !afterImgLoaded) {
    alert('Please upload both images first!');
    return;
  }
  await loadFFmpeg();

  status.textContent = 'Generating MP4 video, please wait...';

  // We'll generate 20 frames of slider animation like the GIF export

  const canvas = document.createElement('canvas');
  canvas.width = beforeImage.naturalWidth;
  canvas.height = beforeImage.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Save frames as PNG in ffmpeg FS
  for (let i = 0; i <= 20; i++) {
    const pct = (i / 20) * 100;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw 'after' image fully
    ctx.drawImage(afterImage, 0, 0, canvas.width, canvas.height);

    // Clip before image width according to pct
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, (pct / 100) * canvas.width, canvas.height);
    ctx.clip();
    ctx.drawImage(beforeImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Save frame to ffmpeg FS
    const dataUrl = canvas.toDataURL('image/png');
    const binary = await fetch(dataUrl).then(r => r.arrayBuffer());
    ffmpeg.FS('writeFile', `frame_${String(i).padStart(3, '0')}.png`, new Uint8Array(binary));
  }

  // Run ffmpeg to create MP4 from PNG frames (1 fps for demo, speed it up as needed)
  await ffmpeg.run(
    '-framerate', '10',
    '-i', 'frame_%03d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    'output.mp4'
  );

  const data = ffmpeg.FS('readFile', 'output.mp4');
  const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(videoBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'before-after.mp4';
  a.click();
  URL.revokeObjectURL(url);

  // Clean up FS
  for(let i=0; i<=20; i++){
    ffmpeg.FS('unlink', `frame_${String(i).padStart(3, '0')}.png`);
  }
  ffmpeg.FS('unlink', 'output.mp4');

  status.textContent = 'Export complete!';
});
