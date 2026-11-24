import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/';
const CANDIDATOS_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const EDGE = CANDIDATOS_NAVEGADOR.find((ruta) => fs.existsSync(ruta));
if (!EDGE) {
  console.error('No se encontró Microsoft Edge ni Google Chrome. Instala uno o define EDGE_PATH.');
  process.exit(1);
}
const OUT = path.resolve('.screenshots');
fs.mkdirSync(OUT, { recursive: true });

const KEY = 'pos_inventario_resiliente_v1';
const consola = [];
const erroresPagina = [];

function log(ok, nombre, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}${extra ? ` :: ${extra}` : ''}`);
}

async function estado(page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), KEY);
}

async function irA(page, label) {
  await page.locator('.nav-item', { hasText: label }).click();
  await page.waitForTimeout(250);
}

async function cerrarToasts(page) {
  for (let i = 0; i < 8; i += 1) {
    const cerrar = page.locator('.toast-close').first();
    if (!(await cerrar.count())) break;
    await cerrar.click().catch(() => {});
    await page.waitForTimeout(60);
  }
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
console.log(`Navegador: ${EDGE}`);
console.log(`URL: ${BASE}`);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
});
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') consola.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (error) => erroresPagina.push(error.stack ?? error.message));

let fallos = 0;
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.product-tile');

  // ---------- 1. Venta normal ----------
  {
    const inicio = await estado(page);
    const tiles = await page.locator('.product-tile').count();
    const stockP1 = inicio.productos.find((p) => p.codigo === 'P-001').stock;
    const stockP2 = inicio.productos.find((p) => p.codigo === 'P-002').stock;
    log(tiles === 10, 'Caja: 10 productos visibles', `tiles=${tiles}`);
    await page.screenshot({ path: path.join(OUT, '01-caja.png') });

    await page.locator('[data-testid="product-tile-P-001"]').click();
    await page.locator('[data-testid="product-tile-P-001"]').click();
    await page.locator('[data-testid="product-tile-P-002"]').click();
    await page.waitForTimeout(150);

    const total = (await page.locator('[data-testid="cart-total"]').innerText()).replace(/\s/g, ' ');
    log(/11[.\s]?800/.test(total), 'Caja: total del carrito correcto', total);
    await page.screenshot({ path: path.join(OUT, '02-caja-carrito.png') });

    await page.locator('[data-testid="register-sale"]').click();
    await page.waitForSelector('[data-testid="sale-success"]');
    const exito = await page.locator('[data-testid="sale-success"]').innerText();
    log(/V-0003/.test(exito), 'Caja: venta V-0003 registrada');

    const despues = await estado(page);
    const p1 = despues.productos.find((p) => p.codigo === 'P-001');
    const p2 = despues.productos.find((p) => p.codigo === 'P-002');
    log(despues.ventas.length === 3, 'Caja: historial con 3 ventas', `ventas=${despues.ventas.length}`);
    log(p1.stock === stockP1 - 2 && p2.stock === stockP2 - 1, 'Caja: stock descontado', `P-001 ${stockP1}->${p1.stock}, P-002 ${stockP2}->${p2.stock}`);
    await page.screenshot({ path: path.join(OUT, '03-caja-venta.png') });
  }

  // ---------- 2. Productos ----------
  {
    await irA(page, 'Productos');
    await page.waitForSelector('.products-table');
    await page.locator('[data-testid="new-product"]').click();
    await page.waitForSelector('#producto-codigo');
    await page.fill('#producto-codigo', 'P-011');
    await page.fill('#producto-nombre', 'Tostada de queso');
    await page.fill('#producto-precio', '3200');
    await page.fill('#producto-stock', '9');
    await page.fill('#producto-minimo', '2');
    await page.screenshot({ path: path.join(OUT, '04-producto-form.png') });
    await page.locator('button[form="form-producto"]').click();
    await page.waitForTimeout(400);

    const despues = await estado(page);
    const creado = despues.productos.find((p) => p.codigo === 'P-011');
    log(despues.productos.length === 11 && creado?.stock === 9, 'Productos: P-011 creado con stock 9');
    const fila = page.locator('.products-table tbody tr', { hasText: 'P-011' });
    log((await fila.count()) === 1, 'Productos: P-011 aparece en la tabla');

    await page.locator('.chip', { hasText: 'Stock bajo' }).click();
    await page.waitForTimeout(200);
    const bajos = await page.locator('.products-table tbody tr').count();
    log(bajos === 2, 'Productos: filtro de stock bajo muestra 2', `filas=${bajos}`);
    await page.screenshot({ path: path.join(OUT, '05-productos.png') });
    await page.locator('.chip', { hasText: 'Todos' }).click();
  }

  // ---------- 3. Hoja de contingencia + OCR + aplicar ----------
  {
    await irA(page, 'Contingencia');
    await page.waitForSelector('.generation-card');
    await page.locator('[data-testid="generate-sheet"]').click();
    await page.waitForSelector('.sheet-overlay');
    const idHoja = (await page.locator('.sheet-toolbar-info strong').innerText()).replace('Hoja ', '').trim();
    log(/^HC-\d{4}-001$/.test(idHoja), 'Contingencia: hoja imprimible generada', idHoja);
    const botones = await page.locator('.sheet-toolbar-actions button').allInnerTexts();
    log(botones.some((b) => /Imprimir/.test(b)) && botones.some((b) => /Descargar/.test(b)), 'Contingencia: acciones de imprimir/descargar', botones.join(' | '));
    await cerrarToasts(page);
    const [descargaHoja] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.sheet-toolbar-actions button', { hasText: 'Descargar HTML' }).click(),
    ]);
    log(/^hoja-contingencia-HC-\d{4}-\d+\.html$/.test(descargaHoja.suggestedFilename()), 'Contingencia: descarga HTML de la hoja', descargaHoja.suggestedFilename());
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, '06-hoja-imprimible.png') });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, '06b-hoja-impresion.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    await page.locator('.toolbar-close').click();
    await page.waitForSelector('.sheet-overlay', { state: 'detached' });

    await page.locator('[data-testid="generate-demo-image"]').click();
    await page.waitForSelector('.review-table, .alert-error', { timeout: 300000 });

    const alerta = await page.locator('.alert-error').count();
    if (alerta) {
      const texto = await page.locator('.alert-error').first().innerText();
      throw new Error(`OCR falló en el navegador: ${texto}`);
    }

    await page.waitForSelector('[data-testid="apply-contingency"]');
    const motor = await page.locator('.engine-pill').innerText();
    log(/local/i.test(motor), 'OCR: motor local activo', motor.replace(/\s+/g, ' '));

    const filasOcr = await page.locator('.review-table tbody tr').count();
    const cantidades = await page.locator('.review-table .qty-input').evaluateAll((inputs) =>
      inputs.map((input) => ({ label: input.getAttribute('aria-label'), qty: Number(input.value) || 0 })),
    );
    const detectadas = cantidades.filter((c) => c.qty > 0);
    log(detectadas.length >= 3, 'OCR: cantidades detectadas en la revisión', `${detectadas.length} de ${filasOcr} filas · ${detectadas.map((d) => d.qty).join(',')}`);
    await cerrarToasts(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '07-revision-ocr.png'), fullPage: true });

    const anchoTabla = await page.locator('.review-table').evaluate((tabla) => tabla.scrollWidth);
    const anchoContenedor = await page.locator('.review-table').evaluate((tabla) => tabla.parentElement.clientWidth);
    log(anchoTabla <= anchoContenedor + 1, 'Revisión: tabla completa visible sin desplazamiento horizontal', `${anchoTabla}px de ${anchoContenedor}px`);

    const antes = await estado(page);
    const hojaDemo = antes.hojas.find((h) => h.estado === 'pendiente' && h.id !== idHoja);
    log(Boolean(hojaDemo), 'OCR: hoja demo asociada y pendiente', hojaDemo?.id ?? 'sin hoja');

    await page.locator('[data-testid="apply-contingency"]').click();
    await page.waitForSelector('[data-testid="contingency-success"]', { timeout: 30000 });
    const exito = await page.locator('[data-testid="contingency-success"]').innerText();
    log(/procesada/.test(exito) && /V-0004/.test(exito), 'Contingencia: hoja aplicada y venta V-0004 creada');
    await cerrarToasts(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, '08-contingencia-aplicada.png'), fullPage: true });

    const despues = await estado(page);
    const hojaProc = despues.hojas.find((h) => h.id === hojaDemo.id);
    const ventaCont = despues.ventas.find((v) => v.id === 'V-0004');
    const descuadre = detectadas.filter(({ label, qty }) => {
      const nombre = label.replace('Cantidad vendida de ', '');
      const producto = antes.productos.find((p) => p.nombre === nombre);
      const ahora = despues.productos.find((p) => p.codigo === producto?.codigo);
      return !producto || !ahora || ahora.stock !== producto.stock - qty;
    });
    log(hojaProc?.estado === 'procesada' && hojaProc?.ventaId === 'V-0004', 'Contingencia: hoja marcada como procesada', hojaProc?.estado ?? 'sin hoja');
    log(ventaCont?.tipo === 'contingencia' && Boolean(ventaCont?.hojaId), 'Contingencia: venta de tipo contingencia vinculada', ventaCont?.hojaId ?? 'sin vínculo');
    log(descuadre.length === 0, 'Contingencia: stock descontado según la revisión', `${detectadas.length - descuadre.length}/${detectadas.length} coinciden`);
  }

  // ---------- 4. Historial ----------
  {
    await page.locator('[data-testid="contingency-success"] .btn-primary').click();
    await page.waitForSelector('.history-table');
    const historial = await page.locator('.history-table').innerText();
    log(/V-0004/.test(historial) && /Contingencia/.test(historial), 'Historial: venta de contingencia visible');
    const textoHojas = await page.locator('.sheets-table').innerText();
    log(/HC-\d{4}-002/.test(textoHojas), 'Historial: hoja procesada visible en su tabla');
    const kpis = await page.locator('.stat-grid .stat-card').allInnerTexts();
    log(kpis.length === 4, 'Historial: 4 indicadores', kpis.map((k) => k.split('\n')[0]).join(' | '));
    const [descargaCsv] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="export-csv"]').click(),
    ]);
    log(/^ventas-pos-resiliente-\d{4}-\d{2}-\d{2}\.csv$/.test(descargaCsv.suggestedFilename()), 'Historial: exportación CSV', descargaCsv.suggestedFilename());
    await cerrarToasts(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '09-historial.png'), fullPage: true });
  }

  // ---------- 5. Protección de duplicados (opción deshabilitada) ----------
  {
    await irA(page, 'Contingencia');
    await page.locator('[data-testid="generate-sheet"]').click();
    await page.waitForSelector('.sheet-overlay');
    await page.locator('.toolbar-close').click();
    await page.waitForSelector('.sheet-overlay', { state: 'detached' });
    await page.locator('.btn-ghost', { hasText: 'Ingresar cantidades manualmente' }).click();
    await page.waitForSelector('[data-testid="sheet-select"]');
    const opciones = await page.locator('[data-testid="sheet-select"] option').evaluateAll((opts) =>
      opts.map((o) => ({ texto: o.textContent, disabled: o.disabled })),
    );
    const procesada = opciones.find((o) => /HC-\d{4}-002/.test(o.texto));
    log(procesada?.disabled === true, 'Duplicados: hoja procesada deshabilitada en el selector', procesada?.texto?.trim() ?? 'no encontrada');
    await page.screenshot({ path: path.join(OUT, '10-duplicado-bloqueado.png') });

    // Flujo de respaldo: ingreso manual de cantidades y aplicación.
    await page.locator('.review-table .qty-input').first().fill('1');
    await page.waitForTimeout(200);
    const aplicable = await page.locator('[data-testid="apply-contingency"]').isEnabled();
    log(aplicable, 'Manual: el botón de aplicar se habilita al ingresar una cantidad');
    await page.locator('[data-testid="apply-contingency"]').click();
    await page.waitForSelector('[data-testid="contingency-success"]', { timeout: 30000 });
    const manual = await page.locator('[data-testid="contingency-success"]').innerText();
    log(/HC-\d{4}-003/.test(manual) && /V-0005/.test(manual), 'Manual: hoja aplicada y venta V-0005 creada');
    const estadoManual = await estado(page);
    const hojaManual = estadoManual.hojas.find((h) => h.id === 'HC-2026-003');
    log(hojaManual?.estado === 'procesada' && hojaManual?.ventaId === 'V-0005', 'Manual: hoja marcada como procesada');
    await cerrarToasts(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '10b-manual-aplicada.png'), fullPage: true });
  }

  // ---------- 6. Móvil ----------
  {
    const movil = await context.newPage();
    await movil.setViewportSize({ width: 390, height: 844 });
    await movil.goto(BASE, { waitUntil: 'networkidle' });
    await movil.waitForSelector('.product-tile');
    const desborde = await movil.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(desborde <= 1, 'Móvil: sin desbordamiento horizontal en caja', `${desborde}px`);
    await movil.screenshot({ path: path.join(OUT, '11-movil-caja.png'), fullPage: true });
    await movil.locator('.nav-item', { hasText: 'Contingencia' }).click();
    await movil.waitForTimeout(500);
    const desborde2 = await movil.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(desborde2 <= 1, 'Móvil: sin desbordamiento horizontal en contingencia', `${desborde2}px`);
    await movil.screenshot({ path: path.join(OUT, '12-movil-contingencia.png'), fullPage: true });
    await movil.close();
  }

  // ---------- 7. Restaurar demo ----------
  {
    await irA(page, 'Productos');
    await page.locator('.btn-outline-danger', { hasText: 'Restaurar datos demo' }).click();
    await page.waitForSelector('.modal-panel');
    await page.locator('.modal-panel button', { hasText: 'Restaurar demo' }).click();
    await page.waitForTimeout(500);
    const reinicio = await estado(page);
    log(
      reinicio.productos.length === 10 && reinicio.ventas.length === 2 && reinicio.hojas.length === 0,
      'Demo: restauración completa',
      `${reinicio.productos.length} productos · ${reinicio.ventas.length} ventas · ${reinicio.hojas.length} hojas`,
    );
    await page.screenshot({ path: path.join(OUT, '13-demo-restaurada.png') });
  }
} catch (error) {
  fallos += 1;
  console.error(`\nFALLO GENERAL: ${error.stack ?? error.message}`);
} finally {
  console.log('\n--- Consola del navegador (errores/advertencias) ---');
  if (!consola.length) console.log('sin errores de consola');
  else consola.slice(0, 30).forEach((linea) => console.log(linea));
  console.log('\n--- Errores de página ---');
  if (!erroresPagina.length) console.log('sin errores de página');
  else erroresPagina.slice(0, 10).forEach((linea) => console.log(linea));
  await browser.close();
}

if (fallos || erroresPagina.length) process.exitCode = 1;
