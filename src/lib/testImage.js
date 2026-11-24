import { formatDateTime, formatMoney } from './format.js';

const PATRON_CANTIDADES = [2, 1, 0, 3, 0, 1, 2, 0, 1, 0, 3, 1, 0, 2];

export function elegirCantidadesDemo(hoja) {
  const cantidades = {};
  const seq = Number(String(hoja?.id ?? '').slice(-3)) || 1;
  const desplazamiento = seq % 3;

  hoja.items.forEach((item, indice) => {
    if (item.stock <= 0) {
      cantidades[item.codigo] = 0;
      return;
    }
    const base = PATRON_CANTIDADES[(indice + desplazamiento) % PATRON_CANTIDADES.length];
    cantidades[item.codigo] = Math.min(base, item.stock);
  });

  const conVenta = Object.values(cantidades).filter((cantidad) => cantidad > 0).length;
  if (conVenta === 0) {
    const primero = hoja.items.find((item) => item.stock > 0);
    if (primero) cantidades[primero.codigo] = Math.min(1, primero.stock);
  }

  return cantidades;
}

/**
 * Dibuja una hoja de contingencia "diligenciada" en un canvas para probar el
 * OCR completo sin necesidad de imprimir y escanear.
 */
export function renderTestSheet(hoja, nombreNegocio, cantidades) {
  const ancho = 1400;
  const margen = 70;
  const tablaDerecha = ancho - margen;
  const tablaTop = 380;
  const altoEncabezado = 48;
  const altoFila = 62;
  const filas = Math.max(1, hoja.items.length);
  const tablaBottom = tablaTop + altoEncabezado + filas * altoFila;
  const alto = Math.max(1980, tablaBottom + 520);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'alphabetic';

  const columnas = {
    num: margen,
    codigo: 120,
    producto: 250,
    precio: 650,
    stock: 760,
    cantidad: 880,
    derecha: tablaDerecha,
  };

  // Encabezado
  ctx.fillStyle = '#047857';
  ctx.font = '700 15px "Segoe UI", Arial, sans-serif';
  ctx.fillText('P O S   R E S I L I E N T E   ·   C O N T I N G E N C I A', margen, 95);

  ctx.fillStyle = '#111827';
  ctx.font = '700 34px "Segoe UI", Arial, sans-serif';
  ctx.fillText(nombreNegocio, margen, 142);

  ctx.fillStyle = '#4b5563';
  ctx.font = '18px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Hoja de registro manual de ventas · sin luz o sin internet', margen, 172);

  // Caja del ID
  const cajaX = 1070;
  const cajaY = 62;
  const cajaAncho = 260;
  const cajaAlto = 100;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.strokeRect(cajaX, cajaY, cajaAncho, cajaAlto);
  ctx.fillStyle = '#4b5563';
  ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('HOJA N.º', cajaX + 14, cajaY + 24);
  ctx.fillStyle = '#111827';
  ctx.font = '700 26px Consolas, "Courier New", monospace';
  ctx.fillText(hoja.id, cajaX + 14, cajaY + 55);
  ctx.fillStyle = '#4b5563';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(formatDateTime(hoja.creadaEn), cajaX + 14, cajaY + 80);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margen, 205);
  ctx.lineTo(tablaDerecha, 205);
  ctx.stroke();

  // Instrucciones
  ctx.fillStyle = '#374151';
  ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Cómo usar esta hoja:', margen, 240);
  ctx.font = '16px "Segoe UI", Arial, sans-serif';
  ctx.fillText('1. Escribe la CANTIDAD VENDIDA de cada producto en la última columna.', margen, 268);
  ctx.fillText('2. Si un producto no se vendió, deja la casilla vacía o escribe 0.', margen, 294);
  ctx.fillText('3. Fotografía la hoja completa y súbela en la app para actualizar el inventario.', margen, 320);

  // Tabla
  const cabecera = [
    ['N.º', 'left', columnas.num + 8],
    ['Código', 'left', columnas.codigo + 10],
    ['Producto', 'left', columnas.producto + 10],
    ['Precio', 'right', columnas.stock - 15],
    ['Stock', 'right', columnas.cantidad - 15],
    ['Cantidad vendida', 'left', columnas.cantidad + 30],
  ];

  ctx.fillStyle = '#eef2f1';
  ctx.fillRect(margen, tablaTop, tablaDerecha - margen, altoEncabezado);
  ctx.fillStyle = '#111827';
  ctx.font = '700 15px "Segoe UI", Arial, sans-serif';
  for (const [texto, alineacion, x] of cabecera) {
    ctx.textAlign = alineacion;
    ctx.fillText(texto.toUpperCase(), x, tablaTop + 31);
  }
  ctx.textAlign = 'left';

  // Líneas de la tabla
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  for (let i = 0; i <= filas; i += 1) {
    const y = tablaTop + (i === 0 ? 0 : altoEncabezado + (i - 1) * altoFila);
    ctx.beginPath();
    ctx.moveTo(margen, y);
    ctx.lineTo(tablaDerecha, y);
    ctx.stroke();
    if (i < filas) {
      const yFin = y + (i === 0 ? altoEncabezado : altoFila);
      ctx.beginPath();
      ctx.moveTo(margen, yFin);
      ctx.lineTo(tablaDerecha, yFin);
      ctx.strokeStyle = '#d1d5db';
      ctx.stroke();
      ctx.strokeStyle = '#9ca3af';
    }
  }
  const tablaFin = tablaTop + altoEncabezado + filas * altoFila;
  for (const x of [
    margen,
    columnas.codigo,
    columnas.producto,
    columnas.precio,
    columnas.stock,
    columnas.cantidad,
    tablaDerecha,
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, tablaTop);
    ctx.lineTo(x, tablaFin);
    ctx.stroke();
  }

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(columnas.cantidad, tablaTop);
  ctx.lineTo(columnas.cantidad, tablaFin);
  ctx.stroke();

  hoja.items.forEach((item, indice) => {
    const filaTop = tablaTop + altoEncabezado + indice * altoFila;
    const base = filaTop + 39;

    ctx.fillStyle = '#6b7280';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(indice + 1), columnas.num + 22, base);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#111827';
    ctx.font = '700 18px Consolas, "Courier New", monospace';
    ctx.fillText(item.codigo, columnas.codigo + 10, base);

    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(item.nombre, columnas.producto + 10, base);

    ctx.textAlign = 'right';
    ctx.font = '17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(formatMoney(item.precio), columnas.stock - 15, base);
    ctx.fillStyle = '#4b5563';
    ctx.fillText(String(item.stock), columnas.cantidad - 15, base);
    ctx.textAlign = 'left';

    const cantidad = cantidades?.[item.codigo] ?? 0;
    if (cantidad > 0) {
      ctx.fillStyle = '#1e40af';
      ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText(String(cantidad), columnas.cantidad + 40, base + 3);
    }

    // Guía punteada de la casilla de cantidad
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(columnas.cantidad + 25, base + 12);
    ctx.lineTo(columnas.cantidad + 205, base + 12);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Observaciones y total
  const notasTop = tablaFin + 32;
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.strokeRect(margen, notasTop, 780, 115);
  ctx.fillStyle = '#4b5563';
  ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText('OBSERVACIONES', margen + 14, notasTop + 24);
  ctx.strokeStyle = '#d1d5db';
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(margen + 14, notasTop + 50 + i * 22);
    ctx.lineTo(margen + 760, notasTop + 50 + i * 22);
    ctx.stroke();
  }

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.strokeRect(880, notasTop, 380, 115);
  ctx.fillStyle = '#4b5563';
  ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('TOTAL VENDIDO EN CONTINGENCIA', 900, notasTop + 28);
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(900, notasTop + 82);
  ctx.lineTo(1240, notasTop + 82);
  ctx.stroke();

  // Pie con ID repetido (clave para el OCR)
  ctx.strokeStyle = '#d1d5db';
  ctx.beginPath();
  ctx.moveTo(margen, alto - 110);
  ctx.lineTo(tablaDerecha, alto - 110);
  ctx.stroke();
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Fotografía esta hoja completa al volver la luz o el internet.', margen, alto - 75);
  ctx.fillStyle = '#111827';
  ctx.font = '700 24px Consolas, "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`HOJA: ${hoja.id}`, tablaDerecha, alto - 70);
  ctx.textAlign = 'left';

  return canvas;
}
