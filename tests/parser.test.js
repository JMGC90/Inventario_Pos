import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorFilas, detectarIdHoja, parseOcrOutput, parseTsv } from '../src/lib/parser.js';

const PRODUCTOS = [
  { codigo: 'P-001', nombre: 'Café americano' },
  { codigo: 'P-002', nombre: 'Capuchino' },
  { codigo: 'P-003', nombre: 'Pan artesanal' },
];

const HOJAS = [{ id: 'HC-2026-001', estado: 'pendiente', items: [] }];

function filaTsv({ nivel = 5, pagina = 1, bloque = 1, parrafo = 1, linea = 1, palabra = 1, left, top, width, height, conf = 90, texto }) {
  return [nivel, pagina, bloque, parrafo, linea, palabra, left, top, width, height, conf, texto].join('\t');
}

function construirTsv(palabras) {
  const cabecera = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  return [cabecera, ...palabras.map(filaTsv)].join('\n');
}

const CABECERA = 'HC-2026-001';

function palabrasBase({ conCantidades = true } = {}) {
  const words = [
    { left: 60, top: 60, width: 60, height: 22, texto: 'HOJA:', linea: 1 },
    { left: 140, top: 60, width: 170, height: 22, texto: CABECERA, linea: 1 },
    { left: 880, top: 320, width: 80, height: 18, texto: 'Cantidad', linea: 2 },
    { left: 970, top: 320, width: 70, height: 18, texto: 'vendida', linea: 2 },
    { left: 90, top: 420, width: 60, height: 20, texto: 'P-001', linea: 3 },
    { left: 220, top: 420, width: 40, height: 20, texto: 'Café', linea: 3 },
    { left: 270, top: 420, width: 90, height: 20, texto: 'americano', linea: 3 },
    { left: 650, top: 420, width: 60, height: 20, texto: '$3.500', linea: 3 },
    { left: 800, top: 420, width: 30, height: 20, texto: '24', linea: 3 },
    { left: 90, top: 490, width: 60, height: 20, texto: 'P-OO2', linea: 4 },
    { left: 220, top: 490, width: 90, height: 20, texto: 'Capuchino', linea: 4 },
    { left: 650, top: 490, width: 60, height: 20, texto: '$4.800', linea: 4 },
    { left: 800, top: 490, width: 30, height: 20, texto: '18', linea: 4 },
  ];

  if (conCantidades) {
    words.push({ left: 930, top: 420, width: 20, height: 26, conf: 72, texto: '2', linea: 3 });
    words.push({ left: 934, top: 490, width: 18, height: 26, conf: 55, texto: '1', linea: 4 });
  }

  return words;
}

test('parsea el TSV de Tesseract en palabras con posición', () => {
  const words = parseTsv(construirTsv(palabrasBase()));
  assert.equal(words.length, 15);
  assert.equal(words[0].text, 'HOJA:');
  assert.equal(words[0].bbox.x0, 60);
});

test('detecta el ID de la hoja y los productos con cantidades', () => {
  const resultado = parseOcrOutput(
    { tsv: construirTsv(palabrasBase()), text: '' },
    PRODUCTOS,
    HOJAS,
  );

  assert.equal(resultado.hojaId, 'HC-2026-001');
  assert.equal(resultado.hoja?.id, 'HC-2026-001');
  assert.equal(resultado.filas.length, 2);
  const cafe = resultado.filas.find((fila) => fila.codigo === 'P-001');
  assert.equal(cafe.cantidad, 2);
  assert.equal(cafe.metodo, 'columna');
  assert.equal(cafe.confianza, 'alta');
  const capuchino = resultado.filas.find((fila) => fila.codigo === 'P-002');
  assert.equal(capuchino.cantidad, 1);
});

test('no confunde el stock con la cantidad vendida', () => {
  const resultado = parseOcrOutput(
    { tsv: construirTsv(palabrasBase({ conCantidades: false })), text: '' },
    PRODUCTOS,
    HOJAS,
  );
  assert.equal(resultado.filas.length, 2);
  assert.ok(resultado.filas.every((fila) => fila.cantidad === null));
});

test('detecta una hoja ya registrada y tolera el ID separado', () => {
  const words = parseTsv(
    construirTsv([
      { left: 60, top: 60, width: 30, height: 20, texto: 'HC-2026-', linea: 1 },
      { left: 100, top: 60, width: 30, height: 20, texto: '001', linea: 1 },
    ]),
  );
  const id = detectarIdHoja(words, HOJAS);
  assert.equal(id.crudo, 'HC-2026-001');
  assert.equal(id.hoja?.id, 'HC-2026-001');
});

test('tolera errores típicos del OCR en códigos', () => {
  const words = [
    { text: 'P-OO1', confidence: 80, bbox: { x0: 90, y0: 500, x1: 150, y1: 520 } },
    { text: 'CAFE', confidence: 80, bbox: { x0: 220, y0: 500, x1: 280, y1: 520 } },
    { text: 'AMERICANO', confidence: 80, bbox: { x0: 290, y0: 500, x1: 400, y1: 520 } },
    { text: '2', confidence: 70, bbox: { x0: 940, y0: 500, x1: 960, y1: 526 } },
  ];
  const tsv = construirTsv(
    words.map((word, index) => ({
      left: word.bbox.x0,
      top: word.bbox.y0,
      width: word.bbox.x1 - word.bbox.x0,
      height: word.bbox.y1 - word.bbox.y0,
      conf: word.confidence,
      texto: word.text,
      linea: index + 1,
    })),
  );

  const resultado = parseOcrOutput({ tsv, text: '' }, PRODUCTOS, HOJAS);
  assert.equal(resultado.filas.length, 1);
  assert.equal(resultado.filas[0].codigo, 'P-001');
  assert.equal(resultado.filas[0].cantidad, 2);
});

test('usa el texto plano cuando no hay TSV', () => {
  const resultado = parseOcrOutput(
    {
      text: 'HOJA: HC-2026-001\nP-001 Café americano $3.500 24 3\nP-002 Capuchino $4.800 18 1',
    },
    PRODUCTOS,
    HOJAS,
  );
  assert.equal(resultado.hoja?.id, 'HC-2026-001');
  assert.equal(resultado.filas.length, 2);
  assert.equal(resultado.filas.find((fila) => fila.codigo === 'P-001').cantidad, 3);
});

test('agrupa palabras en la misma fila visual', () => {
  const words = parseTsv(
    construirTsv([
      { left: 90, top: 400, width: 40, height: 20, texto: 'P-001', linea: 1 },
      { left: 200, top: 402, width: 80, height: 20, texto: 'Café', linea: 2 },
      { left: 300, top: 405, width: 80, height: 20, texto: 'americano', linea: 2 },
      { left: 200, top: 500, width: 80, height: 20, texto: 'Otra', linea: 3 },
    ]),
  );
  const filas = agruparPorFilas(words);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].palabras.length, 3);
});
