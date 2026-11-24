import { SCHEMA_VERSION, STORAGE_KEY, STOCK_MINIMO_DEFECTO } from './constants.js';
import { createInitialState } from './seed.js';

function normalizeParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
  if (!Array.isArray(parsed.productos) || !Array.isArray(parsed.ventas) || !Array.isArray(parsed.hojas)) {
    return null;
  }

  const productos = parsed.productos
    .filter((p) => p && typeof p.codigo === 'string' && typeof p.nombre === 'string')
    .map((p) => ({
      ...p,
      precio: Number(p.precio) || 0,
      stock: Math.max(0, Math.trunc(Number(p.stock) || 0)),
      stockMinimo: Math.max(0, Math.trunc(Number(p.stockMinimo ?? STOCK_MINIMO_DEFECTO))),
      creadoEn: p.creadoEn || new Date().toISOString(),
    }));

  const hojas = parsed.hojas.map((hoja) => ({
    ...hoja,
    items: Array.isArray(hoja.items) ? hoja.items : [],
    estado: hoja.estado === 'procesada' ? 'procesada' : 'pendiente',
  }));

  return {
    ...parsed,
    schemaVersion: SCHEMA_VERSION,
    negocio: {
      nombre: parsed.negocio?.nombre || 'Mi emprendimiento',
    },
    productos,
    ventas: parsed.ventas,
    hojas,
    seq: {
      venta: Math.max(Number(parsed.seq?.venta) || 0, parsed.ventas.length),
      hoja: Math.max(Number(parsed.seq?.hoja) || 0, parsed.hojas.length),
    },
  };
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      saveState(initial);
      return initial;
    }
    const parsed = normalizeParsed(JSON.parse(raw));
    if (!parsed) {
      const initial = createInitialState();
      saveState(initial);
      return initial;
    }
    return parsed;
  } catch (error) {
    console.warn('No se pudo leer el almacenamiento local. Se usarán datos de ejemplo.', error);
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    const snapshot = { ...state, actualizadoEn: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.warn('No se pudo guardar en localStorage.', error);
    return false;
  }
}

export function resetStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('No se pudo limpiar el almacenamiento local.', error);
  }
  return createInitialState();
}
