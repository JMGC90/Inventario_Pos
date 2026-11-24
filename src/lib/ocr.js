import { createWorker, PSM } from 'tesseract.js';

const BASE = import.meta.env.BASE_URL || '/';
const LOCAL_WORKER = `${BASE}tesseract/worker.min.js`;
const LOCAL_CORE = `${BASE}tesseract/core/tesseract-core-simd-lstm.wasm.js`;
const LOCAL_CORE_FALLBACK = `${BASE}tesseract/core/tesseract-core-lstm.wasm.js`;
const LOCAL_LANG = `${BASE}tesseract/lang`;
const CDN_LANG = 'https://tessdata.projectnaptha.com/4.0.0_fast';

const ESTADOS_OCR = {
  'loading tesseract core': 'Cargando motor OCR',
  'initializing tesseract': 'Inicializando motor OCR',
  'loading language traineddata': 'Cargando diccionario en español',
  'initializing api': 'Preparando el lector',
  'recognizing text': 'Leyendo la hoja',
};

let workerPromise = null;
let worker = null;
let engineMode = null;
let ultimaEmision = { status: 'inactivo', progress: 0, mode: null, phase: 'idle' };
const listeners = new Set();

function snapshot(extra = {}) {
  return { ...ultimaEmision, ...extra };
}

function emit(status, progress, extra = {}) {
  const progreso = Math.max(0, Math.min(1, Number(progress) || 0));
  if (
    status === ultimaEmision.status &&
    Math.abs(progreso - ultimaEmision.progress) < 0.02 &&
    !Object.keys(extra).length
  ) {
    return;
  }
  ultimaEmision = { ...ultimaEmision, status, progress: progreso, ...extra };
  for (const listener of listeners) {
    try {
      listener(ultimaEmision);
    } catch (error) {
      console.warn('Listener de OCR con error', error);
    }
  }
}

export function getOcrSnapshot() {
  return snapshot();
}

export function onOcrProgress(callback) {
  listeners.add(callback);
  callback(ultimaEmision);
  return () => listeners.delete(callback);
}

function traducirEstado(status) {
  return ESTADOS_OCR[status] ?? status ?? 'Procesando imagen';
}

function logger(mensaje) {
  if (!mensaje || typeof mensaje.progress !== 'number') return;
  const progreso = mensaje.progress <= 1 ? mensaje.progress : mensaje.progress / 100;
  emit(traducirEstado(mensaje.status), progreso);
}

async function crearWorkerLocal(corePath) {
  return createWorker('spa', 1, {
    workerPath: LOCAL_WORKER,
    corePath,
    langPath: LOCAL_LANG,
    gzip: true,
    logger,
  });
}

/**
 * La API de Tesseract usa por defecto el modo "bloque único" (PSM 6), que en
 * una hoja con tabla pierde filas completas. El modo automático (PSM 3)
 * conserva la estructura de la tabla y permite ubicar la columna de cantidades.
 */
async function configurarWorker(activo) {
  await activo.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
  });
  return activo;
}

async function inicializar() {
  emit('Cargando motor OCR local', 0.02, { mode: 'local', phase: 'loading' });

  try {
    const local = await configurarWorker(await crearWorkerLocal(LOCAL_CORE));
    worker = local;
    engineMode = 'local';
    emit('Motor OCR local listo', 1, { mode: 'local', phase: 'ready' });
    return local;
  } catch (errorLocal) {
    console.warn('No se pudo iniciar el OCR local; se intentará con el núcleo de respaldo.', errorLocal);
    try {
      const respaldo = await configurarWorker(await crearWorkerLocal(LOCAL_CORE_FALLBACK));
      worker = respaldo;
      engineMode = 'local';
      emit('Motor OCR local listo', 1, { mode: 'local', phase: 'ready' });
      return respaldo;
    } catch (errorRespaldo) {
      console.warn('El OCR local no está disponible. Se intentará desde CDN.', errorRespaldo);
    }
  }

  emit('Cargando OCR desde internet', 0.05, { mode: 'cdn', phase: 'loading' });
  try {
    const remoto = await configurarWorker(
      await createWorker('spa', 1, {
        langPath: CDN_LANG,
        gzip: true,
        logger,
      }),
    );
    worker = remoto;
    engineMode = 'cdn';
    emit('OCR en línea listo', 1, { mode: 'cdn', phase: 'ready' });
    return remoto;
  } catch (errorRemoto) {
    emit('El motor OCR no está disponible', 0, { mode: null, phase: 'error' });
    throw new Error(
      'No se pudo cargar el motor OCR. Revisa que los archivos de public/tesseract existan o ten conexión a internet. Puedes ingresar las cantidades manualmente.',
    );
  }
}

export async function warmUpOcr() {
  if (!workerPromise) {
    workerPromise = inicializar().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function recognizeImage(image) {
  const activo = await warmUpOcr();
  emit('Leyendo la hoja', 0.08, { phase: 'recognizing' });
  const { data } = await activo.recognize(image, {}, { text: true, tsv: true });
  emit('Lectura terminada', 1, { phase: 'done' });
  return { ...data, engineMode };
}

export async function terminateOcr() {
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      // sin acción
    }
  }
  worker = null;
  workerPromise = null;
  engineMode = null;
}

function cargarBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => cargarConElemento(file));
  }
  return cargarConElemento(file);
}

function cargarConElemento(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo abrir la imagen. Usa un archivo JPG o PNG válido.'));
    };
    image.src = url;
  });
}

function mejorarContraste(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const histograma = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const luminancia = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histograma[luminancia] += 1;
  }

  const total = width * height;
  const limiteBajo = total * 0.03;
  const limiteAlto = total * 0.985;
  let acumulado = 0;
  let bajo = 0;
  let alto = 255;

  for (let i = 0; i < 256; i += 1) {
    acumulado += histograma[i];
    if (acumulado >= limiteBajo) {
      bajo = i;
      break;
    }
  }

  acumulado = 0;
  for (let i = 0; i < 256; i += 1) {
    acumulado += histograma[i];
    if (acumulado >= limiteAlto) {
      alto = i;
      break;
    }
  }

  if (alto <= bajo) {
    bajo = 0;
    alto = 255;
  }

  const rango = Math.max(1, alto - bajo);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = Math.max(0, Math.min(255, Math.round(((i - bajo) * 255) / rango)));
  }

  for (let i = 0; i < data.length; i += 4) {
    const luminancia = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const valor = lut[luminancia];
    data[i] = valor;
    data[i + 1] = valor;
    data[i + 2] = valor;
    data[i + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Prepara una imagen para OCR: escala, rota y mejora el contraste.
 */
export async function prepareImage(file, { rotation = 0, enhance = true } = {}) {
  const fuente = await cargarBitmap(file);
  const anchoOriginal = fuente.width;
  const altoOriginal = fuente.height;
  if (!anchoOriginal || !altoOriginal) {
    throw new Error('La imagen no tiene dimensiones válidas.');
  }

  const dimensionMayor = Math.max(anchoOriginal, altoOriginal);
  let escala = 1;
  if (dimensionMayor > 2400) escala = 2400 / dimensionMayor;
  else if (dimensionMayor < 1200) escala = Math.min(2.4, 1600 / dimensionMayor);

  const anchoEscalado = Math.round(anchoOriginal * escala);
  const altoEscalado = Math.round(altoOriginal * escala);
  const rotada = rotation % 180 !== 0;

  const canvas = document.createElement('canvas');
  canvas.width = rotada ? altoEscalado : anchoEscalado;
  canvas.height = rotada ? anchoEscalado : altoEscalado;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(fuente, -anchoEscalado / 2, -altoEscalado / 2, anchoEscalado, altoEscalado);
  context.restore();

  if (typeof fuente.close === 'function') fuente.close();

  if (enhance) mejorarContraste(canvas);
  return canvas;
}

/** Genera una versión mejorada de un canvas ya existente (para la hoja de prueba). */
export function enhanceCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0);
  return mejorarContraste(canvas);
}
