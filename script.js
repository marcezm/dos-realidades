// ============================================================================
// FRAGMENTOS — Experiencia Interactiva de Visión Artificial, Memoria y Arte
//
// OPTIMIZADO PARA ALTO RENDIMIENTO (60 FPS FLUIDOS)
// - MediaPipe Hand Landmarker limitado a ~30 FPS para evitar saturación de CPU/GPU.
// - Reutilización de matrices cv.Mat estáticas en OpenCV para evitar fugas y GC.
// - Eliminación de filtros CSS pesados y bucles intensivos en el canvas.
// - Galería organizada cuadro por cuadro (Hoja de contactos fotográfica).
// - Interfaz puramente tipográfica y técnica (sin emojis).
// ============================================================================

// ---------------------------------------------------------------------------
// 1. CONFIGURACIÓN Y CONSTANTES
// ---------------------------------------------------------------------------

const VISION_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const OPENCV_CDN_PRIMARY = "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@5.0.0-release.1/dist/opencv.js";
const OPENCV_CDN_FALLBACK = "https://docs.opencv.org/4.10.0/opencv.js";

const CAPTURE_COOLDOWN_MS = 1400; // Cooldown entre capturas (ms)
const PINCH_THRESHOLD = 0.44;     // Sensibilidad de pinza índice-pulgar
const HAND_THROTTLE_MS = 33;      // MediaPipe corre a máx 30 FPS para alto rendimiento

// Paleta analógica experimental
const PALETTE = {
  bgDark: "#08070a",
  amber: "#e6a147",
  orangeBurn: "#c85a17",
  orangeBright: "#e86d26",
  redDark: "#8b1e1e",
  cream: "#f8f6f0",
  gridDark: "rgba(223, 216, 202, 0.08)"
};

// Filtros de película antigua
const FILM_PRESETS = {
  kodachrome: { name: "KODACHROME 64", sepia: 0.15, contrast: 1.25, saturation: 1.35, warmth: [18, 6, -8] },
  polaroid:   { name: "POLAROID 600", sepia: 0.08, contrast: 0.95, saturation: 1.05, tintCyan: true },
  trix:       { name: "TRI-X 400", grayscale: true, contrast: 1.45, grainHeavy: true },
  cinestill:  { name: "CINESTILL 800T", contrast: 1.2, halation: true, warmth: [-8, 4, 22] },
  sepia:      { name: "DAGUERROTIPO", sepia: 0.85, contrast: 1.15, vignette: true }
};

let currentFilm = "kodachrome";

// Conexiones de la mano
const HAND_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

// ---------------------------------------------------------------------------
// 2. REFERENCIAS DOM
// ---------------------------------------------------------------------------

const video = document.getElementById("video");
const flashOverlay = document.getElementById("flashOverlay");
const landingOverlay = document.getElementById("landingOverlay");
const btnStartExperience = document.getElementById("btnStartExperience");

// Visor A (MediaPipe)
const viewfinderCanvas = document.getElementById("viewfinderCanvas");
const ctxView = viewfinderCanvas.getContext("2d", { alpha: false });
const statusViewfinder = document.getElementById("statusViewfinder");
const hudHandHint = document.getElementById("hudHandHint");
const hudInstruction = document.getElementById("hudInstruction");
const hudCooldownFill = document.getElementById("hudCooldownFill");
const hudFrameDim = document.getElementById("hudFrameDim");

// Visor B (OpenCV - Larga Exposición)
const motionCanvas = document.getElementById("motionCanvas");
const ctxMotion = motionCanvas.getContext("2d", { alpha: false });
const statusMotion = document.getElementById("statusMotion");
const hudMotionRate = document.getElementById("hudMotionRate");
const hudTrailsCount = document.getElementById("hudTrailsCount");

// Galería Cuadro por Cuadro
const gallerySpace = document.getElementById("gallerySpace");
const galleryEmptyHint = document.getElementById("galleryEmptyHint");
const framesGrid = document.getElementById("framesGrid");
const collageCounterTag = document.getElementById("collageCounterTag");
const btnClearCollage = document.getElementById("btnClearCollage");
const btnDownloadBoard = document.getElementById("btnDownloadBoard");

// Controles superiores
const filmSelector = document.getElementById("filmSelector");
const btnManualShutter = document.getElementById("btnManualShutter");
const btnToggleSound = document.getElementById("btnToggleSound");
const soundText = document.getElementById("soundText");
const btnViewExhibition = document.getElementById("btnViewExhibition");

// Modal de Exposición
const exhibitionModal = document.getElementById("exhibitionModal");
const exhibitionGallery = document.getElementById("exhibitionGallery");
const btnCloseExhibition = document.getElementById("btnCloseExhibition");
const btnExportHighRes = document.getElementById("btnExportHighRes");
const btnClearInModal = document.getElementById("btnClearInModal");

// Canvas auxiliares optimizados
const photoCanvas = document.createElement("canvas");
const photoCtx = photoCanvas.getContext("2d");

const cvCanvas = document.createElement("canvas");
cvCanvas.width = 160;
cvCanvas.height = 120;
const cvCtx = cvCanvas.getContext("2d", { willReadFrequently: true });

// Acumulador de larga exposición
const motionBufferCanvas = document.createElement("canvas");
const motionBufferCtx = motionBufferCanvas.getContext("2d");

const exportCanvas = document.getElementById("exportCanvas") || document.createElement("canvas");
const ctxExport = exportCanvas.getContext("2d");

// ---------------------------------------------------------------------------
// 3. ESTADO GLOBAL
// ---------------------------------------------------------------------------

let handLandmarker = null;
let isRunning = false;
let soundEnabled = true;

// Estado del marco y captura
let currentRect = null;
let wasBothPinching = false;
let lastCaptureTime = 0;
let captureCount = 0;
const capturedFrames = [];

// Optimización de throttling
let lastHandDetectTime = 0;
let lastHandResult = null;
let lastHandTimestamp = -1;

// Matrices OpenCV reutilizables para cero fugas y alto rendimiento
let cvReady = false;
let cvMats = null;
let prevNativeFrame = null;
let motionActivity = 0;
let motionTrails = [];

let audioCtx = null;

// ---------------------------------------------------------------------------
// 4. ARRANQUE Y EVENTOS
// ---------------------------------------------------------------------------

btnStartExperience.addEventListener("click", startExperience);
btnClearCollage.addEventListener("click", clearAllCollage);
btnClearInModal.addEventListener("click", clearAllCollage);
btnViewExhibition.addEventListener("click", openExhibitionModal);
btnCloseExhibition.addEventListener("click", closeExhibitionModal);
btnDownloadBoard.addEventListener("click", exportCollageImage);
btnExportHighRes.addEventListener("click", exportCollageImage);

// Selector de películas analógicas
if (filmSelector) {
  filmSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".film-pill");
    if (!btn) return;
    document.querySelectorAll(".film-pill").forEach(p => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentFilm = btn.dataset.film || "kodachrome";
  });
}

btnToggleSound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundText.textContent = soundEnabled ? "AUDIO: ON" : "AUDIO: OFF";
  btnToggleSound.classList.toggle("accent", soundEnabled);
});

if (btnManualShutter) {
  btnManualShutter.addEventListener("click", () => {
    if (isRunning) triggerShutterWithFallback();
  });
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && isRunning) {
    e.preventDefault();
    triggerShutterWithFallback();
  }
});

function triggerShutterWithFallback() {
  const now = performance.now();
  if (now - lastCaptureTime >= CAPTURE_COOLDOWN_MS) {
    const w = viewfinderCanvas.width || 640;
    const h = viewfinderCanvas.height || 480;
    const rectToCapture = currentRect || { x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 };
    triggerPhotoCapture(rectToCapture, w, h);
    lastCaptureTime = now;
  }
}

async function startExperience() {
  if (window.location.protocol === "file:") {
    alert("AVISO:\n\nEstás abriendo la página directamente como archivo local (file:///index.html).\nPor seguridad, los navegadores bloquean la cámara web en este modo.\n\nPara activarla:\n1. Ejecuta 'iniciar.bat' en la carpeta del proyecto.\nO BIEN:\n2. En VS Code, haz clic derecho en index.html y elige 'Open with Live Server'.");
    return;
  }

  btnStartExperience.disabled = true;
  initAudio();
  landingOverlay.classList.add("is-hidden");

  statusViewfinder.textContent = "Conectando cámara…";

  try {
    await initCamera();
    statusViewfinder.textContent = "Cámara lista · Cargando MediaPipe…";
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara. Por favor concede permisos y recarga.");
    landingOverlay.classList.remove("is-hidden");
    btnStartExperience.disabled = false;
    return;
  }

  isRunning = true;
  requestAnimationFrame(mainRenderLoop);

  // Inicializar Sistema A (MediaPipe Hand Landmarker para 2 manos)
  initMediaPipeHands().catch((err) => {
    console.error("MediaPipe Hands no disponible:", err);
    statusViewfinder.textContent = "Error al cargar MediaPipe";
  });

  // Inicializar Sistema B (OpenCV.js)
  loadOpenCV();
}

// ---------------------------------------------------------------------------
// 5. CÁMARA WEB
// ---------------------------------------------------------------------------

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: "user"
    },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  await new Promise((resolve) => {
    if (video.readyState >= 2) return resolve();
    video.onloadedmetadata = () => resolve();
  });

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  viewfinderCanvas.width = vw;
  viewfinderCanvas.height = vh;
  motionCanvas.width = vw;
  motionCanvas.height = vh;

  motionBufferCanvas.width = vw;
  motionBufferCanvas.height = vh;
  motionBufferCtx.fillStyle = "#000000";
  motionBufferCtx.fillRect(0, 0, vw, vh);
}

// ---------------------------------------------------------------------------
// 6. MEDIAPIPE HANDS (2 MANOS CON CONTROL DE FRECUENCIA)
// ---------------------------------------------------------------------------

async function initMediaPipeHands() {
  statusViewfinder.textContent = "Cargando modelo de manos…";
  try {
    const { HandLandmarker, FilesetResolver } = await import(VISION_BUNDLE_URL);
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.42,
        minHandPresenceConfidence: 0.42,
        minTrackingConfidence: 0.42
      });
    } catch (gpuErr) {
      console.warn("Fallo GPU en MediaPipe, usando CPU:", gpuErr);
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.42,
        minHandPresenceConfidence: 0.42,
        minTrackingConfidence: 0.42
      });
    }

    statusViewfinder.textContent = "2 Manos activas";
  } catch (err) {
    console.error("Error cargando MediaPipe:", err);
    statusViewfinder.textContent = "Error MediaPipe";
  }
}

// ---------------------------------------------------------------------------
// 7. OPENCV.JS (CON MATRICES ESTÁTICAS REUTILIZABLES)
// ---------------------------------------------------------------------------

function loadOpenCV() {
  if (window.cv && window.cv.Mat) {
    initStaticCvMats();
    return;
  }

  statusMotion.textContent = "Cargando OpenCV…";

  window.Module = window.Module || {};
  window.Module.onRuntimeInitialized = () => {
    initStaticCvMats();
  };

  const script = document.createElement("script");
  script.src = OPENCV_CDN_PRIMARY;
  script.async = true;

  script.onload = () => {
    if (window.cv && window.cv.Mat) {
      initStaticCvMats();
    }
  };

  script.onerror = () => {
    const fbScript = document.createElement("script");
    fbScript.src = OPENCV_CDN_FALLBACK;
    fbScript.async = true;
    fbScript.onload = () => {
      if (window.cv && window.cv.Mat) initStaticCvMats();
    };
    fbScript.onerror = () => {
      statusMotion.textContent = "Larga Exposición (Nativo)";
    };
    document.head.appendChild(fbScript);
  };

  document.head.appendChild(script);
}

function initStaticCvMats() {
  const cv = window.cv;
  try {
    const pw = 160, ph = 120;
    cvMats = {
      pw, ph,
      gray: new cv.Mat(ph, pw, cv.CV_8UC1),
      blurred: new cv.Mat(ph, pw, cv.CV_8UC1),
      prev: new cv.Mat(ph, pw, cv.CV_8UC1),
      diff: new cv.Mat(ph, pw, cv.CV_8UC1),
      thresh: new cv.Mat(ph, pw, cv.CV_8UC1),
      hasPrev: false
    };
    cvReady = true;
    statusMotion.textContent = "Larga Exposición (OpenCV)";
  } catch (err) {
    console.warn("Error creando matrices OpenCV:", err);
  }
}

// ---------------------------------------------------------------------------
// 8. AUDIO SINTETIZADO (WEB AUDIO API)
// ---------------------------------------------------------------------------

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playShutterSound() {
  if (!soundEnabled || !audioCtx) return;

  const now = audioCtx.currentTime;

  const clickOsc = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  clickOsc.type = "triangle";
  clickOsc.frequency.setValueAtTime(1300, now);
  clickOsc.frequency.exponentialRampToValueAtTime(110, now + 0.04);
  clickGain.gain.setValueAtTime(0.7, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  clickOsc.connect(clickGain);
  clickGain.connect(audioCtx.destination);
  clickOsc.start(now);
  clickOsc.stop(now + 0.05);

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.06);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.02));
  }
  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.7, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noiseSource.start(now);
}

// ---------------------------------------------------------------------------
// 9. LOOP PRINCIPAL DE RENDERIZADO (ALTO RENDIMIENTO)
// ---------------------------------------------------------------------------

function mainRenderLoop(timestampMs) {
  if (!isRunning) return;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const now = performance.now();

  // Throttling inteligente: MediaPipe se ejecuta como máximo cada ~33ms (30 FPS)
  // Esto libera el hilo principal y duplica los FPS del navegador
  if (handLandmarker && video.readyState >= 2 && (now - lastHandDetectTime >= HAND_THROTTLE_MS)) {
    lastHandDetectTime = now;
    try {
      let currentTs = timestampMs || now;
      if (currentTs <= lastHandTimestamp) {
        currentTs = lastHandTimestamp + 1;
      }
      lastHandTimestamp = currentTs;
      lastHandResult = handLandmarker.detectForVideo(video, currentTs);
    } catch (err) {
      console.warn("Fallo momentáneo detectForVideo:", err);
    }
  }

  // 1. Renderizar Sistema A: Visor con marco controlado por índice y pulgar
  processSystemA(lastHandResult, vw, vh);

  // 2. Renderizar Sistema B: Larga exposición analógica ultra-optimizada
  processSystemB(vw, vh);

  // 3. Barra de recarga
  updateCooldownBar(now);

  requestAnimationFrame(mainRenderLoop);
}

function updateCooldownBar(now) {
  const elapsed = now - lastCaptureTime;
  const progress = Math.min(1, elapsed / CAPTURE_COOLDOWN_MS);
  hudCooldownFill.style.width = `${progress * 100}%`;
  hudCooldownFill.style.background = progress < 1 ? PALETTE.orangeBurn : "#00ff88";
}

// ---------------------------------------------------------------------------
// 10. SISTEMA A: ENCUADRE MODULADO POR ÍNDICE Y PULGAR
// ---------------------------------------------------------------------------

function processSystemA(handResult, w, h) {
  ctxView.save();
  ctxView.translate(w, 0);
  ctxView.scale(-1, 1);
  if (video.readyState >= 2) {
    ctxView.drawImage(video, 0, 0, w, h);
  }
  ctxView.restore();

  ctxView.fillStyle = "rgba(8, 7, 12, 0.18)";
  ctxView.fillRect(0, 0, w, h);

  drawViewfinderGrid(ctxView, w, h);

  const landmarksList = handResult ? handResult.landmarks : [];
  const handCount = landmarksList ? landmarksList.length : 0;

  if (handCount < 2) {
    currentRect = null;
    wasBothPinching = false;
    hudFrameDim.textContent = "MARCO: -- × --";

    if (handCount === 0) {
      hudHandHint.textContent = "BUSCANDO MANOS";
      hudInstruction.textContent = "Coloca ambas manos en el visor.";
      drawSearchingPulse(ctxView, w, h);
    } else {
      hudHandHint.textContent = "1 MANO DETECTADA";
      hudInstruction.textContent = "Falta la otra mano para formar el encuadre.";
      drawHandSkeleton(ctxView, landmarksList[0], w, h, false, 1);
    }
    return;
  }

  hudHandHint.textContent = "2 MANOS ACTIVAS";

  const handA = landmarksList[0];
  const handB = landmarksList[1];

  const pIdxA = { x: (1 - handA[8].x) * w, y: handA[8].y * h };
  const pThmA = { x: (1 - handA[4].x) * w, y: handA[4].y * h };

  const pIdxB = { x: (1 - handB[8].x) * w, y: handB[8].y * h };
  const pThmB = { x: (1 - handB[4].x) * w, y: handB[4].y * h };

  const pinchA = calculatePinch(handA);
  const pinchB = calculatePinch(handB);
  const bothPinching = pinchA.isPinch && pinchB.isPinch;

  drawHandSkeleton(ctxView, handA, w, h, pinchA.isPinch, pinchA.ratio);
  drawHandSkeleton(ctxView, handB, w, h, pinchB.isPinch, pinchB.ratio);

  // =========================================================================
  // EL TAMAÑO DEL MARCO DEPENDE DE LA SEPARACIÓN ENTRE ÍNDICE Y PULGAR
  // Bounding box dinámico entre los 4 puntos activos
  // =========================================================================
  const allX = [pIdxA.x, pThmA.x, pIdxB.x, pThmB.x];
  const allY = [pIdxA.y, pThmA.y, pIdxB.y, pThmB.y];

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const rectW = Math.max(30, maxX - minX);
  const rectH = Math.max(30, maxY - minY);

  currentRect = { x: minX, y: minY, w: rectW, h: rectH };
  hudFrameDim.textContent = `MARCO: ${Math.round(rectW)} × ${Math.round(rectH)} px`;

  const isValidSize = rectW >= 40 && rectH >= 40;

  drawFramingRect(ctxView, currentRect, bothPinching, isValidSize, pIdxA, pThmA, pIdxB, pThmB);

  if (bothPinching) {
    hudInstruction.textContent = "[!] GESTO DETECTADO · CAPTURANDO...";
  } else if (isValidSize) {
    hudInstruction.textContent = "Junta índice y pulgar de ambas manos para capturar.";
  } else {
    hudInstruction.textContent = "Separa índice y pulgar para ampliar el marco.";
  }

  const now = performance.now();
  const canCapture = (now - lastCaptureTime) >= CAPTURE_COOLDOWN_MS;

  if (bothPinching && !wasBothPinching && canCapture && isValidSize) {
    triggerPhotoCapture(currentRect, w, h);
    lastCaptureTime = now;
  }

  wasBothPinching = bothPinching;
}

function calculatePinch(hand) {
  const thumb = hand[4];
  const index = hand[8];
  const wrist = hand[0];
  const middleMcp = hand[9];

  const rawDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const palmScale = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y) || 0.18;
  const ratio = rawDist / palmScale;

  return {
    isPinch: ratio < PINCH_THRESHOLD,
    ratio: Math.min(1, Math.max(0, ratio))
  };
}

function drawFramingRect(ctx, rect, isReady, isValid, idxA, thmA, idxB, thmB) {
  const { x, y, w, h } = rect;

  ctx.save();
  const frameColor = isReady ? PALETTE.orangeBright : (isValid ? PALETTE.amber : "rgba(223, 216, 202, 0.4)");

  // Máscara oscura exterior
  ctx.fillStyle = "rgba(4, 3, 6, 0.45)";
  ctx.fillRect(0, 0, ctx.canvas.width, y);
  ctx.fillRect(0, y + h, ctx.canvas.width, ctx.canvas.height - (y + h));
  ctx.fillRect(0, y, x, h);
  ctx.fillRect(x + w, y, ctx.canvas.width - (x + w), h);

  // Marco delimitador
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = isReady ? 2.5 : 1.5;
  ctx.strokeRect(x, y, w, h);

  // Esquinas tipo visor telemétrico
  const cornerLen = Math.min(20, Math.min(w, h) * 0.2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = isReady ? "#ffffff" : PALETTE.orangeBright;

  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
  ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
  ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
  ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  // Cruz central
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.strokeStyle = "rgba(247, 244, 237, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
  ctx.stroke();

  // Conexiones visuales a los dedos
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = "rgba(200, 90, 23, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(idxA.x, idxA.y); ctx.lineTo(thmA.x, thmA.y);
  ctx.moveTo(idxB.x, idxB.y); ctx.lineTo(thmB.x, thmB.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "500 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = frameColor;
  ctx.fillText(`FRG [${Math.round(w)}×${Math.round(h)}]`, x + 6, y - 6 > 14 ? y - 6 : y + 15);

  ctx.restore();
}

function drawHandSkeleton(ctx, hand, w, h, isPinching, pinchRatio = 1) {
  ctx.save();
  ctx.strokeStyle = "rgba(235, 228, 216, 0.16)";
  ctx.lineWidth = 1.2;

  HAND_EDGES.forEach(([i1, i2]) => {
    const p1 = hand[i1];
    const p2 = hand[i2];
    ctx.beginPath();
    ctx.moveTo((1 - p1.x) * w, p1.y * h);
    ctx.lineTo((1 - p2.x) * w, p2.y * h);
    ctx.stroke();
  });

  const idx = hand[8];
  const thm = hand[4];
  const idxX = (1 - idx.x) * w;
  const idxY = idx.y * h;
  const thmX = (1 - thm.x) * w;
  const thmY = thm.y * h;

  const pinchColor = isPinching ? PALETTE.orangeBright : PALETTE.amber;

  ctx.strokeStyle = pinchColor;
  ctx.lineWidth = isPinching ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.moveTo(idxX, idxY);
  ctx.lineTo(thmX, thmY);
  ctx.stroke();

  [ [idxX, idxY], [thmX, thmY] ].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.fillStyle = pinchColor;
    ctx.arc(px, py, isPinching ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = pinchColor;
    ctx.lineWidth = 1;
    ctx.arc(px, py, 7 + (1 - pinchRatio) * 5, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawSearchingPulse(ctx, w, h) {
  const t = performance.now() / 1000;
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 2; i++) {
    const phase = (t * 0.8 + i * 0.5) % 1;
    const r = 25 + phase * 65;
    const alpha = (1 - phase) * 0.25;
    ctx.strokeStyle = `rgba(200, 90, 23, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawViewfinderGrid(ctx, w, h) {
  ctx.strokeStyle = PALETTE.gridDark;
  ctx.lineWidth = 1;
  const x1 = w / 3, x2 = (w * 2) / 3;
  const y1 = h / 3, y2 = (h * 2) / 3;
  ctx.beginPath();
  ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
  ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
  ctx.moveTo(0, y1); ctx.lineTo(w, y1);
  ctx.moveTo(0, y2); ctx.lineTo(w, y2);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 11. SISTEMA B: LARGA EXPOSICIÓN ANALÓGICA ULTRA-OPTIMIZADA
// ---------------------------------------------------------------------------

function processSystemB(w, h) {
  if (motionBufferCanvas.width !== w || motionBufferCanvas.height !== h) {
    motionBufferCanvas.width = w;
    motionBufferCanvas.height = h;
  }

  // Desvanecimiento suave en el acumulador de exposición
  motionBufferCtx.fillStyle = "rgba(7, 6, 10, 0.08)";
  motionBufferCtx.fillRect(0, 0, w, h);

  // Análisis de movimiento eficiente
  if (cvReady && cvMats && video.readyState >= 2) {
    runOptimizedOpenCVMotion(w, h);
  } else if (video.readyState >= 2) {
    runOptimizedNativeMotion(w, h);
  }

  // 1. Dibujar imagen de la cámara con sombreado de cuarto oscuro
  ctxMotion.save();
  ctxMotion.translate(w, 0);
  ctxMotion.scale(-1, 1);
  if (video.readyState >= 2) {
    ctxMotion.drawImage(video, 0, 0, w, h);
  }
  ctxMotion.restore();

  // Tinte monocromático analógico de alto rendimiento (sin ctx.filter que ralentiza la CPU)
  ctxMotion.fillStyle = "rgba(10, 8, 14, 0.45)";
  ctxMotion.fillRect(0, 0, w, h);

  // 2. Componer estelas de larga exposición con modo screen
  ctxMotion.save();
  ctxMotion.globalCompositeOperation = "screen";
  ctxMotion.drawImage(motionBufferCanvas, 0, 0, w, h);
  renderTrails(ctxMotion, w, h);
  ctxMotion.restore();
}

function runOptimizedOpenCVMotion(w, h) {
  const cv = window.cv;
  const { pw, ph, gray, blurred, prev, diff, thresh } = cvMats;

  try {
    cvCtx.drawImage(video, 0, 0, pw, ph);
    const src = cv.imread(cvCanvas);

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 0);

    if (!cvMats.hasPrev) {
      blurred.copyTo(prev);
      cvMats.hasPrev = true;
      src.delete();
      return;
    }

    cv.absdiff(prev, blurred, diff);
    cv.threshold(diff, thresh, 18, 255, cv.THRESH_BINARY);

    const nonZero = cv.countNonZero(thresh);
    const activity = nonZero / (pw * ph);
    motionActivity = motionActivity * 0.85 + activity * 0.15;
    hudMotionRate.textContent = `ACTIVIDAD: ${Math.round(motionActivity * 100)}%`;

    blurred.copyTo(prev);

    // Muestreo optimizado: pintar en bloques en vez de miles de arcos individuales
    const threshData = thresh.data;
    const diffData = diff.data;
    const scaleX = w / pw;
    const scaleY = h / ph;

    motionBufferCtx.fillStyle = "rgba(235, 115, 35, 0.55)";
    for (let y = 0; y < ph; y += 4) {
      for (let x = 0; x < pw; x += 4) {
        const idx = y * pw + x;
        if (threshData[idx] > 0) {
          const sx = (pw - x) * scaleX;
          const sy = y * scaleY;
          motionBufferCtx.fillRect(sx - 3, sy - 3, 6, 6);

          if (Math.random() < 0.08) {
            spawnTrail(sx, sy, diffData[idx]);
          }
        }
      }
    }

    src.delete();
  } catch (err) {
    console.warn("Fallo OpenCV loop:", err);
  }
}

function runOptimizedNativeMotion(w, h) {
  const cols = 40, rows = 30;
  cvCtx.drawImage(video, 0, 0, cols, rows);
  const frame = cvCtx.getImageData(0, 0, cols, rows).data;
  const count = cols * rows;

  if (!prevNativeFrame) prevNativeFrame = new Float32Array(count);

  let activeCount = 0;
  const scaleX = w / cols;
  const scaleY = h / rows;

  motionBufferCtx.fillStyle = "rgba(235, 115, 35, 0.55)";
  for (let i = 0; i < count; i += 2) {
    const px = i * 4;
    const luma = 0.299 * frame[px] + 0.587 * frame[px + 1] + 0.114 * frame[px + 2];
    const diff = Math.abs(luma - prevNativeFrame[i]);
    prevNativeFrame[i] = luma;

    if (diff > 12) {
      activeCount++;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = (cols - col) * scaleX;
      const sy = row * scaleY;

      motionBufferCtx.fillRect(sx - 4, sy - 4, 8, 8);
      if (Math.random() < 0.1) spawnTrail(sx, sy, diff * 2);
    }
  }

  motionActivity = motionActivity * 0.85 + (activeCount / (count / 2)) * 0.15;
  hudMotionRate.textContent = `ACTIVIDAD: ${Math.round(motionActivity * 100)}%`;
}

function spawnTrail(x, y, magnitude) {
  if (motionTrails.length > 35) return;
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.4 + Math.min(1.8, magnitude / 40);
  const life = 20 + Math.random() * 25;

  motionTrails.push({
    x: x + (Math.random() - 0.5) * 6,
    y: y + (Math.random() - 0.5) * 6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    mag: magnitude,
    life,
    maxLife: life
  });
}

function renderTrails(ctx, w, h) {
  motionTrails = motionTrails.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    if (p.life <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) return false;

    const alpha = p.life / p.maxLife;
    const r = Math.min(5, 1.5 + (p.mag / 30));

    ctx.beginPath();
    ctx.fillStyle = `rgba(235, 120, 38, ${alpha * 0.75})`;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    return true;
  });

  hudTrailsCount.textContent = `ESTELAS: ${motionTrails.length > 0 ? "ACTIVAS" : "REPOSO"}`;
}

// ---------------------------------------------------------------------------
// 12. CAPTURA Y APLICACIÓN DE FILTROS ANALÓGICOS
// ---------------------------------------------------------------------------

function triggerPhotoCapture(rect, canvasW, canvasH) {
  flashOverlay.classList.remove("flash-active");
  void flashOverlay.offsetWidth;
  flashOverlay.classList.add("flash-active");
  setTimeout(() => flashOverlay.classList.remove("flash-active"), 160);

  playShutterSound();

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  const normX = Math.max(0, Math.min(1, rect.x / canvasW));
  const normY = Math.max(0, Math.min(1, rect.y / canvasH));
  const normW = Math.max(0.02, Math.min(1 - normX, rect.w / canvasW));
  const normH = Math.max(0.02, Math.min(1 - normY, rect.h / canvasH));

  const srcX = Math.round((1 - (normX + normW)) * vw);
  const srcY = Math.round(normY * vh);
  const srcW = Math.round(normW * vw);
  const srcH = Math.round(normH * vh);

  const clX = Math.max(0, Math.min(vw - 1, srcX));
  const clY = Math.max(0, Math.min(vh - 1, srcY));
  const clW = Math.max(10, Math.min(vw - clX, srcW));
  const clH = Math.max(10, Math.min(vh - clY, srcH));

  photoCanvas.width = clW;
  photoCanvas.height = clH;

  photoCtx.save();
  photoCtx.translate(clW, 0);
  photoCtx.scale(-1, 1);
  photoCtx.drawImage(video, clX, clY, clW, clH, 0, 0, clW, clH);
  photoCtx.restore();

  applyVintageFilter(photoCtx, clW, clH, currentFilm);

  const dataUrl = photoCanvas.toDataURL("image/jpeg", 0.90);

  captureCount++;
  const dateStr = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const filmName = (FILM_PRESETS[currentFilm] && FILM_PRESETS[currentFilm].name) || "POLAROID";
  const photoTag = `CUADRO ${String(captureCount).padStart(2, "0")}`;

  const frame = {
    id: `frag_${Date.now()}`,
    dataUrl,
    tag: photoTag,
    filmName,
    time: dateStr,
    width: clW,
    height: clH
  };

  capturedFrames.push(frame);
  collageCounterTag.textContent = `${capturedFrames.length} CAPTURAS`;

  addFrameToGrid(frame);
}

function applyVintageFilter(ctx, w, h, filmKey) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const len = d.length;

  const preset = FILM_PRESETS[filmKey] || FILM_PRESETS.kodachrome;

  for (let i = 0; i < len; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    if (preset.grayscale) {
      let luma = 0.299 * r + 0.587 * g + 0.114 * b;
      luma = ((luma / 255 - 0.5) * preset.contrast + 0.5) * 255;
      r = g = b = luma;
    } else if (preset.sepia) {
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = tr * preset.sepia + r * (1 - preset.sepia);
      g = tg * preset.sepia + g * (1 - preset.sepia);
      b = tb * preset.sepia + b * (1 - preset.sepia);
    } else if (preset.tintCyan) {
      g = g * 1.04;
      b = b * 1.08;
      r = r * 0.96;
    }

    if (preset.warmth) {
      r += preset.warmth[0];
      g += preset.warmth[1];
      b += preset.warmth[2];
    }

    const grain = (Math.random() - 0.5) * (preset.grainHeavy ? 24 : 12);
    d[i] = Math.min(255, Math.max(0, r + grain));
    d[i + 1] = Math.min(255, Math.max(0, g + grain));
    d[i + 2] = Math.min(255, Math.max(0, b + grain));
  }

  ctx.putImageData(imgData, 0, 0);

  if (preset.vignette) {
    const radGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
    radGrad.addColorStop(0, "rgba(0,0,0,0)");
    radGrad.addColorStop(1, "rgba(20,10,5,0.45)");
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---------------------------------------------------------------------------
// 13. GALERÍA CUADRO POR CUADRO (HOJA DE CONTACTOS)
// ---------------------------------------------------------------------------

function addFrameToGrid(frame) {
  galleryEmptyHint.classList.add("is-hidden");

  const card = document.createElement("div");
  card.className = "frame-card";
  card.id = frame.id;

  card.innerHTML = `
    <div class="frame-photo">
      <img class="frame-img" src="${frame.dataUrl}" alt="${frame.tag}">
    </div>
    <div class="frame-footer">
      <span class="frame-tag">${frame.tag}</span>
      <span class="frame-film">${frame.filmName}</span>
    </div>
  `;

  // Al hacer clic en un cuadro, abrirlo ampliado en la exposición
  card.addEventListener("click", () => {
    openExhibitionModal();
  });

  framesGrid.appendChild(card);

  // Auto-scroll suave hacia el último cuadro agregado
  gallerySpace.scrollTop = gallerySpace.scrollHeight;
}

function clearAllCollage() {
  if (capturedFrames.length === 0) return;
  if (!confirm("¿Deseas vaciar la galería de cuadros y comenzar de nuevo?")) return;

  capturedFrames.length = 0;
  framesGrid.innerHTML = "";
  galleryEmptyHint.classList.remove("is-hidden");
  collageCounterTag.textContent = "0 CAPTURAS";
  exhibitionGallery.innerHTML = "";
}

// ---------------------------------------------------------------------------
// 14. EXPOSICIÓN COMPLETA Y DESCARGA PNG
// ---------------------------------------------------------------------------

function openExhibitionModal() {
  exhibitionGallery.innerHTML = "";

  if (capturedFrames.length === 0) {
    exhibitionGallery.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 50px;">
        <p style="font-size: 1.1rem; font-family: var(--font-serif); margin-bottom: 6px;">No hay cuadros capturados aún.</p>
        <p style="font-size: 0.8rem; font-family: var(--font-mono);">Encuadra y junta índice y pulgar frente a la cámara para tomar fotografías.</p>
      </div>
    `;
  } else {
    capturedFrames.forEach((frame) => {
      const card = document.createElement("div");
      card.className = "exhibition-item";
      card.innerHTML = `
        <div class="exhibition-img-wrap">
          <img class="exhibition-img" src="${frame.dataUrl}" alt="${frame.tag}">
        </div>
        <div class="exhibition-caption">
          <span style="font-family: var(--font-serif); font-weight: 700; color: #1e1c1a; font-size: 0.82rem;">${frame.tag}</span>
          <span style="font-family: var(--font-mono); font-size: 0.65rem; color: #666;">${frame.filmName} · ${frame.time}</span>
        </div>
      `;
      exhibitionGallery.appendChild(card);
    });
  }

  exhibitionModal.classList.add("is-open");
}

function closeExhibitionModal() {
  exhibitionModal.classList.remove("is-open");
}

function exportCollageImage() {
  if (capturedFrames.length === 0) {
    alert("Aún no tienes cuadros capturados para exportar.");
    return;
  }

  const canvasW = 1600;
  const canvasH = 1000;
  exportCanvas.width = canvasW;
  exportCanvas.height = canvasH;

  ctxExport.fillStyle = "#08070a";
  ctxExport.fillRect(0, 0, canvasW, canvasH);

  ctxExport.strokeStyle = "rgba(223, 216, 202, 0.12)";
  ctxExport.lineWidth = 1;
  ctxExport.strokeRect(32, 32, canvasW - 64, canvasH - 64);

  ctxExport.font = "bold 30px 'Playfair Display', Georgia, serif";
  ctxExport.fillStyle = "#f8f6f0";
  ctxExport.fillText("FRAGMENTOS", 54, 84);

  ctxExport.font = "italic 15px 'Playfair Display', Georgia, serif";
  ctxExport.fillStyle = "#e6a147";
  ctxExport.fillText('"No todo lo que vemos permanece. Elegimos qué conservar."', 54, 110);

  ctxExport.font = "500 12px 'JetBrains Mono', monospace";
  ctxExport.fillStyle = "#9a93a4";
  const nowStr = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  ctxExport.fillText(`HOJA DE CONTACTOS · ${capturedFrames.length} CUADROS · ${nowStr}`, 54, 134);

  const count = capturedFrames.length;
  const cols = Math.min(5, Math.ceil(Math.sqrt(count * 1.5)));
  const rows = Math.ceil(count / cols);

  const startX = 60;
  const startY = 165;
  const areaW = canvasW - 120;
  const areaH = canvasH - 210;

  const cellW = areaW / cols;
  const cellH = areaH / rows;

  let loadedImages = 0;

  capturedFrames.forEach((frame, idx) => {
    const img = new Image();
    img.onload = () => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const targetX = startX + col * cellW + (cellW - 200) / 2;
      const targetY = startY + row * cellH + (cellH - 240) / 2;

      ctxExport.save();
      ctxExport.translate(targetX + 100, targetY + 120);

      ctxExport.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctxExport.fillRect(-96, -116, 192, 232);

      ctxExport.fillStyle = "#f7f4ec";
      ctxExport.fillRect(-100, -120, 200, 240);

      ctxExport.drawImage(img, -88, -108, 176, 176);

      ctxExport.font = "bold 11px 'Playfair Display', Georgia, serif";
      ctxExport.fillStyle = "#1e1c1a";
      ctxExport.fillText(frame.tag, -88, 96);

      ctxExport.font = "9px 'JetBrains Mono', monospace";
      ctxExport.fillStyle = "#666";
      ctxExport.fillText(`${frame.filmName} · ${frame.time}`, -88, 110);

      ctxExport.restore();

      loadedImages++;
      if (loadedImages === count) {
        downloadCanvasAsImage(exportCanvas, "fragmentos-hoja-de-contactos.png");
      }
    };
    img.src = frame.dataUrl;
  });
}

function downloadCanvasAsImage(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
