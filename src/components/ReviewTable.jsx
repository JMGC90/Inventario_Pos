import { useState } from 'react';
import { Icon } from './Icon.jsx';
import { ConfidenceBadge } from './Ui.jsx';
import { formatMoney, formatNumber } from '../lib/format.js';

export function ReviewTable({ rows, productos, onQtyChange, onAddProduct, onRemoveRow, disabled = false }) {
  const [codigoManual, setCodigoManual] = useState('');
  const [cantidadManual, setCantidadManual] = useState('1');

  const disponibles = productos.filter(
    (producto) => !rows.some((row) => row.codigo === producto.codigo && !row.eliminado),
  );
  const totalUnidades = rows.reduce((acc, row) => acc + (row.eliminado ? 0 : Number(row.qty) || 0), 0);
  const totalDinero = rows.reduce(
    (acc, row) => acc + (row.eliminado ? 0 : (Number(row.qty) || 0) * Number(row.precio || 0)),
    0,
  );

  const agregar = (event) => {
    event.preventDefault();
    if (!codigoManual) return;
    onAddProduct(codigoManual, Math.max(1, Number(cantidadManual) || 1));
    setCodigoManual('');
    setCantidadManual('1');
  };

  return (
    <div className="review">
      <div className="review-head">
        <div>
          <h3>Revisión de cantidades</h3>
          <p>Confirma o corrige lo leído por el OCR antes de actualizar el inventario.</p>
        </div>
        <span className="review-count">{formatNumber(rows.filter((r) => !r.eliminado).length)} productos</span>
      </div>

      <div className="table-scroll">
        <table className="data-table review-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th className="num">Stock</th>
              <th>Detectado OCR</th>
              <th title="Cantidad a descontar">Cantidad</th>
              <th className="num">Subtotal</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  Aún no hay productos en la revisión.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const excede = !row.eliminado && Number(row.qty) > Number(row.stock ?? 0);
              const corregido =
                !row.eliminado &&
                row.detectadaCantidad !== null &&
                row.detectadaCantidad !== undefined &&
                Number(row.qty) !== Number(row.detectadaCantidad);

              return (
                <tr key={row.codigo} className={row.eliminado ? 'row-muted' : ''}>
                  <td className="mono strong">{row.codigo}</td>
                  <td>
                    <div className="cell-product">
                      <strong>{row.nombre}</strong>
                      <span className="cell-tags">
                        {row.manual ? <span className="mini-tag">Agregado a mano</span> : null}
                        {corregido ? <span className="mini-tag tag-corrected">Corregido</span> : null}
                        {row.eliminado ? <span className="mini-tag tag-danger">Producto eliminado</span> : null}
                      </span>
                    </div>
                  </td>
                  <td className="num">{row.eliminado ? '—' : formatNumber(row.stock)}</td>
                  <td>
                    {row.eliminado ? (
                      <span className="muted">—</span>
                    ) : row.detectadaCantidad !== null && row.detectadaCantidad !== undefined ? (
                      <span
                        className="ocr-detected"
                        title={row.textoFila ? `Texto leído: ${row.textoFila}` : undefined}
                      >
                        <strong>{row.detectadaCantidad}</strong>
                        <ConfidenceBadge confianza={row.confianza ?? 'baja'} />
                      </span>
                    ) : (
                      <span className="muted">No leído</span>
                    )}
                  </td>
                  <td>
                    <div className="qty-cell-wrap">
                      <input
                        type="number"
                        inputMode="numeric"
                        className={`input qty-input ${excede ? 'input-invalid' : ''}`}
                        min="0"
                        max={row.eliminado ? 0 : row.stock}
                        step="1"
                        value={row.qty}
                        onChange={(event) => onQtyChange(row.codigo, event.target.value)}
                        disabled={disabled || row.eliminado}
                        aria-label={`Cantidad vendida de ${row.nombre}`}
                      />
                      {excede ? (
                        <span className="field-error">
                          <Icon name="alert" size={12} strokeWidth={2.2} />
                          Excede el stock
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="num strong">
                    {row.eliminado ? '—' : formatMoney((Number(row.qty) || 0) * (Number(row.precio) || 0))}
                  </td>
                  <td>
                    {row.manual && !disabled && !row.eliminado ? (
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        onClick={() => onRemoveRow(row.codigo)}
                        aria-label={`Quitar ${row.nombre} de la revisión`}
                        title="Quitar de la revisión"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!disabled && disponibles.length ? (
        <form className="manual-add" onSubmit={agregar}>
          <span className="manual-add-label">
            <Icon name="plus" size={15} />
            Agregar otro producto
          </span>
          <select
            className="input select"
            value={codigoManual}
            onChange={(event) => setCodigoManual(event.target.value)}
            aria-label="Producto para agregar a la revisión"
          >
            <option value="">Selecciona un producto…</option>
            {disponibles.map((producto) => (
              <option key={producto.codigo} value={producto.codigo}>
                {producto.codigo} · {producto.nombre} (stock {producto.stock})
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input qty-input"
            min="1"
            step="1"
            value={cantidadManual}
            onChange={(event) => setCantidadManual(event.target.value)}
            aria-label="Cantidad del producto manual"
          />
          <button type="submit" className="btn btn-outline btn-sm" disabled={!codigoManual}>
            Agregar
          </button>
        </form>
      ) : null}

      <div className="review-totals">
        <div>
          <span>Unidades a descontar</span>
          <strong>{formatNumber(totalUnidades)}</strong>
        </div>
        <div>
          <span>Total de la venta</span>
          <strong>{formatMoney(totalDinero)}</strong>
        </div>
      </div>
    </div>
  );
}
