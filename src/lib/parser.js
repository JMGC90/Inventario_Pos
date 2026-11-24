import { normalizeCompact, normalizeText } from './format.js';

/**
 * Convierte la salida TSV de Tesseract en palabras con posición.
 * columnas: level page block par line word left top width height conf text
 */
export function parseTsv(tsv) {
  if (!tsv || typeof tsv !== 'string') return [];
  const words = [];

  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 12) continue;
    if (parts[0] !== '5') continue;

    const text = parts.slice(11).join('\t').trim();
    if (!text) continue;

    const left = Number(parts[6]);
    const top = Number(parts[7]);
    const width = Number(parts[8]);
    const height = Number(parts[9]);
    const confidence = Number(parts[10]);
    if (![left, top, width, height].every(Number.isFinite)) continue;

    words.push({
      text,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      bbox: { x0: left, y0: top, x1: left + width, y1: top + height },
    });
  }

  return words;
}

function centroY(word) {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function mediana(numeros) {
  if (!numeros.length) return 0;
  const ordenados = [...numeros].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
}

/** Agrupa palabras que están en la misma línea visual. */
export function agruparPorFilas(words) {
  if (!words.length) return [];
  const altura = mediana(words.map((w) => w.bbox.y1 - w.bbox.y0));
  const tolerancia = Math.max(7, altura * 0.65);
  const ordenadas = [...words].sort((a, b) => centroY(a) - centroY(b));
  const filas = [];

  for (const word of ordenadas) {
    const cy = centroY(word);
    let mejor = null;
    let mejorDistancia = Infinity;

    for (const fila of filas) {
      const distancia = Math.abs(fila.centro - cy);
      if (distancia <= tolerancia && distancia < mejorDistancia) {
        mejor = fila;
        mejorDistancia = distancia;
      }
    }

    if (mejor) {
      mejor.palabras.push(word);
      mejor.sumaCentros += cy;
      mejor.centro = mejor.sumaCentros / mejor.palabras.length;
    } else {
      filas.push({ centro: cy, sumaCentros: cy, palabras: [word] });
    }
  }

  return filas
    .map((fila) => ({
      ...fila,
      palabras: fila.palabras.sort((a, b) => a.bbox.x0 - b.bbox.x0),
    }))
    .sort((a, b) => a.centro - b.centro);
}

function limpiarCodigoOcr(value) {
  return normalizeCompact(value)
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/G/g, '6')
    .replace(/Q/g, '0');
}

function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;

  const anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = anterior[0];
    anterior[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = anterior[j];
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      anterior[j] = Math.min(anterior[j] + 1, anterior[j - 1] + 1, diagonal + costo);
      diagonal = temp;
    }
  }
  return anterior[b.length];
}

function construirIndices(productos) {
  const porCodigo = new Map();
  const porCodigoOcr = new Map();
  const nombres = [];

  for (const producto of productos) {
    if (!producto?.codigo) continue;
    porCodigo.set(normalizeCompact(producto.codigo), producto);
    porCodigoOcr.set(limpiarCodigoOcr(producto.codigo), producto);
    nombres.push({
      producto,
      nombreNormalizado: normalizeText(producto.nombre),
      tokens: normalizeText(producto.nombre)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2),
    });
  }

  return { porCodigo, porCodigoOcr, nombres };
}

function buscarProductoEnFila(fila, indices) {
  const textos = fila.palabras.map((p) => p.text);
  const textoFila = textos.join(' ');
  const tokensFila = new Set(
    normalizeText(textoFila)
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  let mejor = null;
  const anotar = (producto, puntaje, evidencia) => {
    if (!producto) return;
    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { producto, puntaje, evidencia };
    }
  };

  for (let i = 0; i < textos.length; i += 1) {
    const compacto = normalizeCompact(textos[i]);
    const compactoOcr = limpiarCodigoOcr(textos[i]);

    anotar(indices.porCodigo.get(compacto), 4, textos[i]);
    anotar(indices.porCodigoOcr.get(compactoOcr), 3.6, textos[i]);

    if (i + 1 < textos.length) {
      const juntos = normalizeCompact(textos[i] + textos[i + 1]);
      anotar(indices.porCodigo.get(juntos), 3.9, `${textos[i]} ${textos[i + 1]}`);
      anotar(indices.porCodigoOcr.get(limpiarCodigoOcr(textos[i] + textos[i + 1])), 3.4, `${textos[i]} ${textos[i + 1]}`);
    }
  }

  if (!mejor) {
    for (const palabra of fila.palabras) {
      const compacto = normalizeCompact(palabra.text);
      if (compacto.length < 3 || compacto.length > 7 || !/\d/.test(compacto)) continue;
      for (const [codigo, producto] of indices.porCodigoOcr.entries()) {
        if (Math.abs(codigo.length - compacto.length) > 1) continue;
        if (distanciaLevenshtein(codigo, limpiarCodigoOcr(palabra.text)) <= 1) {
          anotar(producto, 2.7, palabra.text);
          break;
        }
      }
    }
  }

  if (!mejor) {
    for (const candidato of indices.nombres) {
      if (!candidato.tokens.length) continue;
      if (textoFila && candidato.nombreNormalizado && normalizeText(textoFila).includes(candidato.nombreNormalizado)) {
        anotar(candidato.producto, 2.5, candidato.producto.nombre);
        continue;
      }
      const todos = candidato.tokens.every((token) => tokensFila.has(token));
      if (todos && candidato.tokens.length >= 1) {
        anotar(candidato.producto, 2.1, candidato.producto.nombre);
      }
    }
  }

  return mejor;
}

function extraerNumero(palabra) {
  const texto = String(palabra.text ?? '').trim();
  if (!texto || /[$€]/.test(texto)) return null;

  const soloDigitos = texto.replace(/[()[\].,:;|_\-–—\s]/g, '');
  if (!/^\d{1,3}$/.test(soloDigitos)) return null;

  const valor = Number(soloDigitos);
  if (!Number.isFinite(valor) || valor > 999) return null;
  return valor;
}

function detectarColumnaCantidad(words, anchoPagina, alturaMediana) {
  const anclas = words.filter((word) => {
    const texto = normalizeText(word.text);
    return texto === 'cantidad' || texto === 'vendida';
  });
  if (!anclas.length) return null;

  // Puede haber "cantidad" en las instrucciones (a la izquierda) y en el
  // encabezado de la tabla (a la derecha). Se agrupa por línea y se escoge
  // el grupo más a la derecha; dentro de ese grupo se usa el borde izquierdo
  // para no perder números escritos al inicio de la casilla.
  const filas = agruparPorFilas(anclas);
  const filaEncabezado = filas.reduce((mejor, actual) => {
    const promedio = (fila) =>
      fila.palabras.reduce((acc, palabra) => acc + palabra.bbox.x0, 0) / fila.palabras.length;
    return promedio(actual) > promedio(mejor) ? actual : mejor;
  });
  const bordeIzquierdo = Math.min(...filaEncabezado.palabras.map((palabra) => palabra.bbox.x0));
  const margen = Math.max(9, alturaMediana * 0.7);
  const estimado = bordeIzquierdo - margen;

  // Si el encabezado está muy a la izquierda (por ejemplo, instrucciones),
  // no se usa como referencia de columna.
  if (estimado < anchoPagina * 0.3) return null;
  return Math.max(0, estimado);
}

function elegirCantidad(candidatos) {
  if (!candidatos.length) return null;
  return candidatos.reduce((mejor, actual) => {
    if (actual.confidence > mejor.confidence + 2) return actual;
    if (Math.abs(actual.confidence - mejor.confidence) <= 2 && actual.palabra.bbox.x0 > mejor.palabra.bbox.x0) {
      return actual;
    }
    return mejor;
  });
}

function filaEsEncabezado(fila) {
  const texto = normalizeText(fila.palabras.map((p) => p.text).join(' '));
  return /cantidad\s+vendida|precio|stock|codigo|producto/.test(texto) && !/\d{2,}/.test(texto);
}

export function detectarIdHoja(words, hojas = []) {
  if (!words.length) {
    return { crudo: null, normalizado: null, hoja: null };
  }

  const unido = words.map((w) => w.text).join(' ');
  const compacto = limpiarCodigoOcr(unido).replace(/[^A-Z0-9]/g, '');
  const coincidencias = [];
  const regex = /HC(\d{4})(\d{1,4})/g;
  let match;

  while ((match = regex.exec(compacto)) !== null) {
    const year = match[1];
    const seq = match[2].padStart(3, '0');
    const normalizado = `HC-${year}-${seq}`;
    if (!coincidencias.includes(normalizado)) coincidencias.push(normalizado);
  }

  const normalizarHoja = (id) => limpiarCodigoOcr(String(id)).replace(/[^A-Z0-9]/g, '');
  const hojasNormalizadas = hojas.map((hoja) => ({ hoja, clave: normalizarHoja(hoja.id) }));

  let encontrada = null;
  let crudo = null;
  for (const candidato of coincidencias) {
    crudo ??= candidato;
    const clave = normalizarHoja(candidato);
    const exacta = hojasNormalizadas.find((item) => item.clave === clave);
    if (exacta) {
      encontrada = exacta.hoja;
      crudo = candidato;
      break;
    }
    if (!encontrada) {
      const parecida = hojasNormalizadas.find((item) => distanciaLevenshtein(item.clave, clave) <= 1);
      if (parecida) encontrada = parecida.hoja;
    }
  }

  return {
    crudo: crudo ?? coincidencias[0] ?? null,
    normalizado: coincidencias[0] ?? null,
    hoja: encontrada,
  };
}

function parsearTextoPlano(texto, productos, hojas) {
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  const indices = construirIndices(productos);
  const palabras = lineas.flatMap((linea, indiceLinea) =>
    linea.split(/\s+/).map((textoPalabra, indicePalabra) => ({
      text: textoPalabra,
      confidence: 50,
      bbox: { x0: indicePalabra * 10, y0: indiceLinea * 20, x1: indicePalabra * 10 + 8, y1: indiceLinea * 20 + 14 },
    })),
  );
  const id = detectarIdHoja(palabras, hojas);
  const filas = [];
  const advertencias = ['No se recibieron posiciones del OCR: las cantidades se estimaron desde el texto. Verifica la tabla.'];

  for (const linea of lineas) {
    const fila = {
      palabras: linea.split(/\s+/).map((textoPalabra, indicePalabra) => ({
        text: textoPalabra,
        bbox: { x0: indicePalabra * 10, y0: 0, x1: indicePalabra * 10 + 8, y1: 10 },
      })),
      centro: 0,
    };
    const match = buscarProductoEnFila(fila, indices);
    if (!match) continue;

    const numeros = fila.palabras
      .map((palabra) => ({ palabra, valor: extraerNumero(palabra), confidence: 50 }))
      .filter((n) => n.valor !== null);
    const cantidad = numeros.length ? numeros[numeros.length - 1].valor : null;

    filas.push({
      codigo: match.producto.codigo,
      nombre: match.producto.nombre,
      cantidad,
      metodo: cantidad === null ? 'sin-cantidad' : 'texto',
      confianza: cantidad === null ? 'baja' : 'media',
      puntaje: match.puntaje,
      evidencia: match.evidencia,
      textoFila: linea,
    });
  }

  return {
    hojaId: id.crudo,
    hojaIdNormalizado: id.normalizado,
    hoja: id.hoja,
    filas,
    texto: texto ?? '',
    palabras: palabras.length,
    columnaCantidad: null,
    advertencias,
    anchoPagina: 0,
    altoPagina: 0,
  };
}

/**
 * Extrae productos y cantidades de la salida de Tesseract.
 * @param {{text?:string, tsv?:string}} data
 * @param {Array} productos
 * @param {Array} hojas
 */
export function parseOcrOutput(data, productos = [], hojas = []) {
  const words = parseTsv(data?.tsv ?? '');
  if (!words.length) {
    return parsearTextoPlano(data?.text ?? '', productos, hojas);
  }

  const advertencias = [];
  const indices = construirIndices(productos);
  const filas = agruparPorFilas(words);
  const anchoPagina = Math.max(...words.map((w) => w.bbox.x1));
  const altoPagina = Math.max(...words.map((w) => w.bbox.y1));
  const alturaMediana = mediana(words.map((w) => w.bbox.y1 - w.bbox.y0));
  const columnaCantidad = detectarColumnaCantidad(words, anchoPagina, alturaMediana);
  const id = detectarIdHoja(words, hojas);

  if (!id.crudo) {
    advertencias.push('No se detectó el ID de la hoja. Selecciona manualmente la hoja que corresponde.');
  }

  const detectados = [];

  for (const fila of filas) {
    if (filaEsEncabezado(fila)) continue;
    const match = buscarProductoEnFila(fila, indices);
    if (!match) continue;

    const numeros = fila.palabras
      .map((palabra) => ({ palabra, valor: extraerNumero(palabra), confidence: palabra.confidence }))
      .filter((n) => n.valor !== null);

    const enColumna =
      columnaCantidad === null
        ? []
        : numeros.filter((n) => n.palabra.bbox.x0 >= columnaCantidad);

    let elegido = elegirCantidad(enColumna);
    let metodo = columnaCantidad === null ? 'sin-columna' : 'columna';

    if (!elegido && metodo === 'sin-columna' && numeros.length) {
      // Sin encabezado legible: se asume que la cantidad está en el extremo
      // derecho de la tabla (después de las columnas de precio y stock).
      const limite = anchoPagina * 0.65;
      const ultimos = numeros.filter((n) => n.palabra.bbox.x0 >= limite);
      if (ultimos.length) {
        elegido = elegirCantidad(ultimos);
        metodo = 'borde-derecho';
      }
    }

    const cantidad = elegido?.valor ?? null;
    if (!elegido && numeros.length && columnaCantidad !== null) {
      // Hay números en la fila, pero ninguno cae en la columna de cantidad.
      metodo = 'sin-cantidad';
    }

    let confianza = 'baja';
    if (cantidad !== null) {
      if (match.puntaje >= 3.5 && metodo === 'columna') confianza = 'alta';
      else if (match.puntaje >= 2.0 && (metodo === 'columna' || metodo === 'borde-derecho')) confianza = 'media';
    }

    detectados.push({
      codigo: match.producto.codigo,
      nombre: match.producto.nombre,
      cantidad,
      metodo,
      confianza,
      puntaje: match.puntaje,
      evidencia: match.evidencia,
      textoFila: fila.palabras.map((p) => p.text).join(' '),
      y: fila.centro,
    });
  }

  if (columnaCantidad === null) {
    advertencias.push(
      'No se ubicó la columna “Cantidad vendida”. Las cantidades detectadas son estimadas: revísalas antes de aplicar.',
    );
  }

  const sinCantidad = detectados.filter((fila) => fila.cantidad === null).length;
  if (sinCantidad > 0) {
    advertencias.push(
      `Se identificaron ${detectados.length} producto(s), pero ${sinCantidad} fila(s) no tienen una cantidad legible.`,
    );
  }

  if (!detectados.length) {
    advertencias.push(
      'No se reconocieron códigos ni nombres de productos. Verifica que la foto corresponda a una hoja generada por la app o ingresa las cantidades manualmente.',
    );
  }

  const porCodigo = new Map();
  for (const fila of detectados) {
    const previa = porCodigo.get(fila.codigo);
    if (!previa) {
      porCodigo.set(fila.codigo, fila);
      continue;
    }
    const mejor =
      (fila.cantidad !== null && previa.cantidad === null) ||
      fila.puntaje > previa.puntaje ||
      (fila.cantidad !== null && (fila.confianza === 'alta' && previa.confianza !== 'alta'))
        ? fila
        : previa;
    porCodigo.set(fila.codigo, mejor);
    advertencias.push(`El producto ${fila.codigo} apareció en varias filas. Revisa la cantidad detectada.`);
  }

  return {
    hojaId: id.crudo,
    hojaIdNormalizado: id.normalizado,
    hoja: id.hoja,
    filas: [...porCodigo.values()],
    texto: data?.text ?? '',
    palabras: words.length,
    columnaCantidad,
    advertencias,
    anchoPagina,
    altoPagina,
  };
}
