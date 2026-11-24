import { STOCK_MINIMO_DEFECTO } from './constants.js';
import { createInitialState } from './seed.js';

export class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppError';
  }
}

const CODIGO_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,11}$/;
const MAX_UNIDADES = 1_000_000;

function copy(state) {
  return {
    ...state,
    negocio: { ...state.negocio },
    productos: state.productos.map((p) => ({ ...p })),
    ventas: state.ventas.map((v) => ({ ...v, items: v.items.map((i) => ({ ...i })) })),
    hojas: state.hojas.map((h) => ({ ...h, items: h.items.map((i) => ({ ...i })) })),
    seq: { ...state.seq },
  };
}

function enteroNoNegativo(value, campo) {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
    throw new AppError(`${campo} debe ser un número entero mayor o igual a 0.`);
  }
  if (number > MAX_UNIDADES) {
    throw new AppError(`${campo} es demasiado grande.`);
  }
  return number;
}

function validarProducto(input) {
  const codigo = String(input?.codigo ?? '').trim().toUpperCase();
  if (!CODIGO_REGEX.test(codigo)) {
    throw new AppError('El código debe tener entre 2 y 12 caracteres: letras, números, guion o guion bajo.');
  }

  const nombre = String(input?.nombre ?? '').trim();
  if (nombre.length < 2 || nombre.length > 70) {
    throw new AppError('El nombre del producto debe tener entre 2 y 70 caracteres.');
  }

  const precio = Number(input?.precio);
  if (!Number.isFinite(precio) || precio <= 0 || !Number.isInteger(precio)) {
    throw new AppError('El precio debe ser un número entero mayor que 0 (pesos sin centavos).');
  }

  const stock = enteroNoNegativo(input?.stock, 'El stock');
  const stockMinimo =
    input?.stockMinimo === undefined || input?.stockMinimo === ''
      ? STOCK_MINIMO_DEFECTO
      : enteroNoNegativo(input?.stockMinimo, 'El stock mínimo');

  return { codigo, nombre, precio, stock, stockMinimo };
}

function normalizarItems(rawItems) {
  if (!Array.isArray(rawItems)) throw new AppError('No hay productos para registrar.');
  const agrupados = new Map();

  for (const raw of rawItems) {
    const codigo = String(raw?.codigo ?? '').trim().toUpperCase();
    const cantidad = Number(raw?.cantidad);
    if (!codigo) throw new AppError('Hay una línea sin código de producto.');
    if (!Number.isFinite(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
      throw new AppError('Las cantidades deben ser números enteros mayores que 0.');
    }
    agrupados.set(codigo, (agrupados.get(codigo) ?? 0) + cantidad);
  }

  return [...agrupados.entries()].map(([codigo, cantidad]) => ({ codigo, cantidad }));
}

function generarIdVenta(state) {
  let sequence = state.seq.venta;
  let id;
  do {
    sequence += 1;
    id = `V-${String(sequence).padStart(4, '0')}`;
  } while (state.ventas.some((venta) => venta.id === id));
  return { id, sequence };
}

function aplicarVenta(state, { tipo, hojaId = null, items }) {
  const next = copy(state);
  const saleItems = [];

  for (const { codigo, cantidad } of items) {
    const producto = next.productos.find((p) => p.codigo === codigo);
    if (!producto) {
      throw new AppError(`El producto ${codigo} ya no existe en el inventario.`);
    }
    if (producto.stock < cantidad) {
      throw new AppError(
        `Stock insuficiente de ${producto.nombre}: hay ${producto.stock} y se intentan descontar ${cantidad}.`,
      );
    }
  }

  for (const { codigo, cantidad } of items) {
    const producto = next.productos.find((p) => p.codigo === codigo);
    producto.stock -= cantidad;
    saleItems.push({
      codigo: producto.codigo,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad,
      subtotal: producto.precio * cantidad,
    });
  }

  const { id, sequence } = generarIdVenta(next);
  const sale = {
    id,
    tipo,
    hojaId: hojaId ?? undefined,
    fecha: new Date().toISOString(),
    items: saleItems,
    total: saleItems.reduce((acc, item) => acc + item.subtotal, 0),
  };

  next.ventas.push(sale);
  next.seq.venta = sequence;
  return { state: next, sale };
}

export function addProduct(state, input) {
  const datos = validarProducto(input);
  if (state.productos.some((p) => p.codigo === datos.codigo)) {
    throw new AppError(`Ya existe un producto con el código ${datos.codigo}.`);
  }

  const next = copy(state);
  const product = { ...datos, creadoEn: new Date().toISOString() };
  next.productos.push(product);
  next.productos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  return { state: next, product };
}

export function updateProduct(state, codigo, input) {
  const target = String(codigo ?? '').trim().toUpperCase();
  const index = state.productos.findIndex((p) => p.codigo === target);
  if (index === -1) throw new AppError('No se encontró el producto que quieres editar.');

  const datos = validarProducto({ ...input, codigo: target });
  const next = copy(state);
  const product = { ...next.productos[index], ...datos };
  next.productos[index] = product;
  next.productos.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  return { state: next, product };
}

export function removeProduct(state, codigo) {
  const target = String(codigo ?? '').trim().toUpperCase();
  if (!state.productos.some((p) => p.codigo === target)) {
    throw new AppError('No se encontró el producto que quieres eliminar.');
  }
  const next = copy(state);
  next.productos = next.productos.filter((p) => p.codigo !== target);
  return next;
}

export function setNegocioNombre(state, nombre) {
  const limpio = String(nombre ?? '').trim();
  if (limpio.length < 2 || limpio.length > 70) {
    throw new AppError('El nombre del negocio debe tener entre 2 y 70 caracteres.');
  }
  const next = copy(state);
  next.negocio.nombre = limpio;
  return next;
}

export function registrarVenta(state, items) {
  const normalizados = normalizarItems(items);
  if (!normalizados.length) throw new AppError('Agrega al menos un producto a la venta.');
  return aplicarVenta(state, { tipo: 'normal', items: normalizados });
}

export function crearHojaContingencia(state) {
  if (!state.productos.length) {
    throw new AppError('Agrega al menos un producto antes de generar una hoja de contingencia.');
  }

  const year = new Date().getFullYear();
  let sequence = state.seq.hoja;
  let id;
  do {
    sequence += 1;
    id = `HC-${year}-${String(sequence).padStart(3, '0')}`;
  } while (state.hojas.some((hoja) => hoja.id === id));

  const hoja = {
    id,
    creadaEn: new Date().toISOString(),
    estado: 'pendiente',
    negocio: state.negocio.nombre,
    items: state.productos.map(({ codigo, nombre, precio, stock }) => ({
      codigo,
      nombre,
      precio,
      stock,
    })),
  };

  const next = copy(state);
  next.seq.hoja = sequence;
  next.hojas.push(hoja);
  return { state: next, hoja };
}

export function aplicarContingencia(state, hojaId, items) {
  const id = String(hojaId ?? '').trim();
  const hoja = state.hojas.find((h) => h.id === id);
  if (!hoja) throw new AppError('Selecciona una hoja de contingencia válida.');
  if (hoja.estado === 'procesada') {
    throw new AppError(
      `La hoja ${hoja.id} ya fue procesada${
        hoja.procesadaEn ? ` el ${new Date(hoja.procesadaEn).toLocaleString('es-CO')}` : ''
      }. No se puede aplicar dos veces.`,
    );
  }

  const normalizados = normalizarItems(items);
  if (!normalizados.length) {
    throw new AppError('Ingresa al menos una cantidad vendida antes de aplicar los cambios.');
  }

  const resultado = aplicarVenta(state, {
    tipo: 'contingencia',
    hojaId: hoja.id,
    items: normalizados,
  });

  const next = resultado.state;
  const indice = next.hojas.findIndex((h) => h.id === hoja.id);
  const hojaActualizada = {
    ...next.hojas[indice],
    estado: 'procesada',
    procesadaEn: resultado.sale.fecha,
    ventaId: resultado.sale.id,
  };
  next.hojas[indice] = hojaActualizada;

  return { state: next, sale: resultado.sale, hoja: hojaActualizada };
}

export function nextProductCode(productos) {
  let maximo = 0;
  for (const producto of productos) {
    const match = /^P-(\d+)$/i.exec(producto.codigo);
    if (match) maximo = Math.max(maximo, Number(match[1]));
  }
  return `P-${String(maximo + 1).padStart(3, '0')}`;
}

export function nivelStock(producto) {
  if (!producto || producto.stock <= 0) return 'agotado';
  if (producto.stock <= producto.stockMinimo) return 'bajo';
  return 'ok';
}

export function resumenVentas(ventas) {
  return ventas.reduce(
    (acc, venta) => {
      acc.total += venta.total;
      acc.ventas += 1;
      acc.unidades += venta.items.reduce((sum, item) => sum + item.cantidad, 0);
      return acc;
    },
    { total: 0, ventas: 0, unidades: 0 },
  );
}

export function buscarProducto(productos, codigo) {
  return productos.find((p) => p.codigo === codigo) ?? null;
}

export function resetDemoState() {
  return createInitialState();
}
