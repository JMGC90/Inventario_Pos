import { formatDateTime, formatMoney } from './format.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const SHEET_CSS = `
.sheet-doc {
  --sheet-ink: #111827;
  background: #ffffff;
  color: var(--sheet-ink);
  width: 210mm;
  min-height: 297mm;
  padding: 13mm 11mm;
  box-sizing: border-box;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.35;
  margin: 0 auto;
  position: relative;
}
.sheet-doc * { box-sizing: border-box; }
.sheet-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 10px; }
.sheet-kicker { display: block; font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: #065f46; font-weight: 700; margin-bottom: 4px; }
.sheet-brand h1 { font-size: 20pt; line-height: 1.1; margin: 0 0 2px; letter-spacing: -.02em; }
.sheet-brand p { margin: 0; color: #4b5563; font-size: 9.5pt; }
.sheet-idbox { border: 1.5px solid #111827; border-radius: 4px; padding: 6px 10px; min-width: 165px; text-align: center; }
.sheet-idbox span { display: block; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: #4b5563; }
.sheet-idbox strong { display: block; font-family: "Cascadia Mono", Consolas, monospace; font-size: 14pt; letter-spacing: .04em; margin: 2px 0; }
.sheet-idbox .sheet-date { font-size: 8pt; letter-spacing: 0; text-transform: none; }
.sheet-instructions { margin: 10px 0 12px; padding: 8px 10px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 4px; font-size: 8.6pt; color: #374151; }
.sheet-instructions strong { color: #111827; }
.sheet-instructions ol { margin: 3px 0 0 16px; padding: 0; }
.sheet-instructions li { margin: 1px 0; }
.sheet-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.3pt; }
.sheet-table th, .sheet-table td { border: 1px solid #6b7280; padding: 5px 6px; vertical-align: middle; }
.sheet-table thead { display: table-header-group; }
.sheet-table thead th { background: #eef2f1; font-size: 7.8pt; text-transform: uppercase; letter-spacing: .04em; text-align: left; color: #111827; }
.sheet-table tr { break-inside: avoid; page-break-inside: avoid; }
.sheet-table .col-num { width: 6%; text-align: center; color: #6b7280; }
.sheet-table .col-code { width: 11%; font-family: "Cascadia Mono", Consolas, monospace; font-weight: 700; font-size: 8.8pt; }
.sheet-table .col-name { width: 29%; }
.sheet-table .col-price { width: 13%; text-align: right; white-space: nowrap; }
.sheet-table .col-stock { width: 8%; text-align: right; color: #4b5563; }
.sheet-table .col-qty { width: 33%; text-align: left; }
.sheet-table tbody .col-qty { background: #fcfcfd; border-left: 1.5px solid #374151; height: 30px; }
.sheet-table tbody tr:nth-child(even) td { background: #fcfcfd; }
.sheet-table tbody tr:nth-child(even) .col-qty { background: #f8faf9; }
.sheet-qty-guide { display: block; height: 15px; border-bottom: 1px dotted #9ca3af; }
.sheet-notes { display: flex; gap: 16px; margin-top: 12px; align-items: stretch; }
.sheet-obs { flex: 1; border: 1px solid #9ca3af; border-radius: 3px; padding: 7px 9px; min-height: 74px; }
.sheet-obs h2 { font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 4px; color: #4b5563; }
.sheet-obs .line { border-bottom: 1px solid #d1d5db; height: 17px; }
.sheet-total { width: 34%; border: 1.5px solid #111827; border-radius: 3px; padding: 7px 9px; display: flex; flex-direction: column; justify-content: space-between; }
.sheet-total span { font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: #4b5563; }
.sheet-total strong { font-size: 9.5pt; border-bottom: 1px solid #9ca3af; padding: 8px 0 3px; }
.sheet-foot { margin-top: 12px; border-top: 1px solid #d1d5db; padding-top: 7px; display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; }
.sheet-foot p { margin: 0; font-size: 7.8pt; color: #6b7280; max-width: 78%; }
.sheet-foot-id { font-family: "Cascadia Mono", Consolas, monospace; font-size: 12pt; font-weight: 700; white-space: nowrap; }
.sheet-empty { padding: 24px; border: 1px dashed #9ca3af; text-align: center; color: #6b7280; }
@media screen and (max-width: 820px) {
  .sheet-doc { width: 100%; min-height: 0; padding: 18px; font-size: 10px; }
  .sheet-brand h1 { font-size: 19px; }
  .sheet-table { font-size: 9px; }
  .sheet-head { flex-direction: column; }
  .sheet-notes { flex-direction: column; }
  .sheet-total { width: 100%; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background: #fff !important; }
  .sheet-doc { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  .no-print { display: none !important; }
}
`;

const SHEET_STANDALONE_CSS = `
html, body { margin: 0; padding: 0; background: #e5e7eb; }
body { padding: 22px 14px 60px; }
.sheet-toolbar { max-width: 210mm; margin: 0 auto 14px; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 12px 16px; background: #0f2f2c; color: #fff; border-radius: 10px; font-family: "Segoe UI", Arial, sans-serif; font-size: 13px; }
.sheet-toolbar strong { display: block; font-size: 14px; }
.sheet-toolbar span { color: #a7f3d0; font-size: 12px; }
.sheet-toolbar .actions { display: flex; gap: 8px; }
.sheet-toolbar button { border: 0; border-radius: 7px; padding: 9px 14px; font-weight: 700; cursor: pointer; background: #10b981; color: #052e24; font-family: inherit; }
.sheet-toolbar button.secondary { background: #ffffff22; color: #fff; }
.sheet-doc { box-shadow: 0 18px 50px #00000024; }
@media (max-width: 700px) { .sheet-toolbar { flex-direction: column; align-items: flex-start; } }
`;

export function buildSheetBody(hoja, nombreNegocio) {
  const negocio = esc(hoja?.negocio || nombreNegocio || 'Mi emprendimiento');
  const items = hoja?.items ?? [];
  const filas = items.length
    ? items
        .map(
          (item, index) => `
        <tr>
          <td class="col-num">${index + 1}</td>
          <td class="col-code">${esc(item.codigo)}</td>
          <td class="col-name">${esc(item.nombre)}</td>
          <td class="col-price">${esc(formatMoney(item.precio))}</td>
          <td class="col-stock">${esc(item.stock)}</td>
          <td class="col-qty"><span class="sheet-qty-guide"></span></td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="sheet-empty">Esta hoja no tiene productos registrados.</td></tr>';

  return `
  <main class="sheet-doc" id="hoja-contingencia">
    <header class="sheet-head">
      <div class="sheet-brand">
        <span class="sheet-kicker">POS Resiliente · Contingencia</span>
        <h1>${negocio}</h1>
        <p>Hoja de registro manual de ventas · sin luz o sin internet</p>
      </div>
      <div class="sheet-idbox">
        <span>Hoja n.º</span>
        <strong>${esc(hoja?.id ?? '—')}</strong>
        <span class="sheet-date">${esc(formatDateTime(hoja?.creadaEn))}</span>
      </div>
    </header>

    <section class="sheet-instructions">
      <strong>Cómo usar esta hoja:</strong>
      <ol>
        <li>Escribe en la última columna la <strong>cantidad vendida</strong> de cada producto durante el corte.</li>
        <li>Si un producto no se vendió, deja la casilla vacía o escribe 0.</li>
        <li>Al volver la luz o el internet, fotografía la hoja completa y súbela en la app.</li>
        <li>Confirma las cantidades detectadas una sola vez. No repitas el procesamiento de esta hoja.</li>
      </ol>
    </section>

    <table class="sheet-table">
      <thead>
        <tr>
          <th class="col-num">N.º</th>
          <th class="col-code">Código</th>
          <th class="col-name">Producto</th>
          <th class="col-price">Precio</th>
          <th class="col-stock">Stock ref.</th>
          <th class="col-qty">Cantidad vendida</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="sheet-notes">
      <section class="sheet-obs">
        <h2>Observaciones</h2>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
      </section>
      <section class="sheet-total">
        <span>Total vendido en contingencia</span>
        <strong>$ ________________________</strong>
      </section>
    </div>

    <footer class="sheet-foot">
      <p>Esta hoja es el respaldo físico de la venta. Procesarla en la app actualiza el inventario y crea una venta de contingencia en el historial.</p>
      <div class="sheet-foot-id">HOJA: ${esc(hoja?.id ?? '—')}</div>
    </footer>
  </main>`;
}

export function buildStandaloneHtml(hoja, nombreNegocio) {
  const body = buildSheetBody(hoja, nombreNegocio);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hoja de contingencia ${esc(hoja?.id ?? '')}</title>
  <style>${SHEET_CSS}${SHEET_STANDALONE_CSS}</style>
</head>
<body>
  <div class="sheet-toolbar no-print">
    <div>
      <strong>Hoja de contingencia ${esc(hoja?.id ?? '')}</strong>
      <span>Imprímela o guárdala como PDF · tabla con espacio para escribir a mano</span>
    </div>
    <div class="actions">
      <button id="btn-imprimir" type="button">Imprimir / Guardar PDF</button>
      <button class="secondary" type="button" onclick="window.close()">Cerrar</button>
    </div>
  </div>
  ${body}
  <script>
    document.getElementById('btn-imprimir').addEventListener('click', function () { window.print(); });
  </script>
</body>
</html>`;
}

export function downloadSheetHtml(hoja, nombreNegocio) {
  const html = buildStandaloneHtml(hoja, nombreNegocio);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hoja-contingencia-${String(hoja?.id ?? 'sin-id').replace(/[^a-zA-Z0-9-]/g, '')}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
