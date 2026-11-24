import { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, StatCard, StatusBadge, TypeBadge } from '../components/Ui.jsx';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../lib/format.js';
import { resumenVentas } from '../lib/model.js';
import { downloadCsv, salesToCsv } from '../lib/csv.js';

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'normal', label: 'Normales' },
  { id: 'contingencia', label: 'Contingencia' },
];

export function HistorialPage({ navigate }) {
  const { state } = useStore();
  const toast = useToast();
  const [filtro, setFiltro] = useState('todas');
  const [expandida, setExpandida] = useState(null);

  const resumen = useMemo(() => resumenVentas(state.ventas), [state.ventas]);
  const ventasOrdenadas = useMemo(
    () => [...state.ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [state.ventas],
  );
  const filtradas = useMemo(
    () => ventasOrdenadas.filter((venta) => filtro === 'todas' || venta.tipo === filtro),
    [ventasOrdenadas, filtro],
  );
  const hojasProcesadas = useMemo(
    () =>
      state.hojas
        .filter((hoja) => hoja.estado === 'procesada')
        .sort((a, b) => new Date(b.procesadaEn) - new Date(a.procesadaEn)),
    [state.hojas],
  );
  const hojasPendientes = state.hojas.filter((hoja) => hoja.estado === 'pendiente').length;
  const ventasDeHoy = state.ventas.filter(
    (venta) => new Date(venta.fecha).toDateString() === new Date().toDateString(),
  );
  const totalHoy = ventasDeHoy.reduce((acc, venta) => acc + venta.total, 0);

  const exportar = () => {
    if (!filtradas.length) {
      toast.warning('No hay ventas para exportar.');
      return;
    }
    const fecha = new Date().toISOString().slice(0, 10);
    downloadCsv(salesToCsv(filtradas), `ventas-pos-resiliente-${fecha}.csv`);
    toast.success(`${filtradas.length} venta(s) exportadas en CSV.`);
  };

  return (
    <div className="page">
      <div className="stat-grid stat-grid-4">
        <StatCard
          label="Total vendido"
          value={formatMoney(resumen.total)}
          hint={`${formatMoney(totalHoy)} registrado hoy`}
          icon="bolt"
          tone="success"
        />
        <StatCard
          label="Ventas registradas"
          value={formatNumber(resumen.ventas)}
          hint={`${ventasDeHoy.length} venta(s) hoy`}
          icon="cart"
          tone="neutral"
        />
        <StatCard
          label="Unidades vendidas"
          value={formatNumber(resumen.unidades)}
          hint="Suma de todos los ítems"
          icon="box"
          tone="neutral"
        />
        <StatCard
          label="Hojas procesadas"
          value={formatNumber(hojasProcesadas.length)}
          hint={`${hojasPendientes} pendiente(s) por procesar`}
          icon="clipboard"
          tone={hojasPendientes ? 'warning' : 'success'}
        />
      </div>

      <section className="card">
        <div className="history-toolbar">
          <div>
            <h2 className="section-title">
              <Icon name="history" size={19} />
              Ventas
            </h2>
            <p className="section-sub">Ventas normales y de contingencia, en orden cronológico inverso.</p>
          </div>
          <div className="history-toolbar-actions">
            <div className="filter-chips" role="group" aria-label="Filtrar ventas por tipo">
              {FILTROS.map((item) => {
                const cantidad =
                  item.id === 'todas'
                    ? state.ventas.length
                    : state.ventas.filter((venta) => venta.tipo === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${filtro === item.id ? 'is-active' : ''}`}
                    onClick={() => setFiltro(item.id)}
                  >
                    {item.label}
                    <span className="chip-count">{cantidad}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportar} data-testid="export-csv">
              <Icon name="download" size={15} />
              Exportar CSV
            </button>
          </div>
        </div>

        {state.ventas.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon="cart"
              title="Todavía no hay ventas"
              text="Las ventas normales y las de contingencia aparecerán aquí con su detalle y total."
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('caja')}>
                  Ir a la caja
                  <Icon name="arrowRight" size={16} />
                </button>
              }
            />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon="search"
              title="No hay ventas de este tipo"
              text="Cambia el filtro para ver el resto del historial."
              action={
                <button type="button" className="btn btn-outline" onClick={() => setFiltro('todas')}>
                  Ver todas
                </button>
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Venta</th>
                  <th>Tipo</th>
                  <th>Hoja</th>
                  <th className="num">Ítems</th>
                  <th className="num">Total</th>
                  <th aria-label="Detalle" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((venta) => {
                  const abierta = expandida === venta.id;
                  const unidades = venta.items.reduce((acc, item) => acc + item.cantidad, 0);
                  return (
                    <VentaRows
                      key={venta.id}
                      venta={venta}
                      abierta={abierta}
                      unidades={unidades}
                      onToggle={() => setExpandida(abierta ? null : venta.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="hojas-toolbar">
          <div>
            <h2 className="section-title">
              <Icon name="clipboard" size={19} />
              Hojas de contingencia
            </h2>
            <p className="section-sub">
              Cada hoja procesada queda vinculada a su venta para evitar dobles descuentos de stock.
            </p>
          </div>
          <div className="hojas-summary">
            <span className="badge status-processed">
              <Icon name="checkCircle" size={12} />
              {hojasProcesadas.length} procesadas
            </span>
            <span className="badge status-pending">
              <Icon name="clock" size={12} />
              {hojasPendientes} pendientes
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('contingencia')}>
              Ir a contingencia
              <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </div>

        {hojasProcesadas.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon="fileText"
              title="Aún no has procesado hojas"
              text="Genera una hoja, anota las ventas del corte y súbela para que el inventario se sincronice."
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('contingencia')}>
                  Generar hoja de contingencia
                  <Icon name="printer" size={16} />
                </button>
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table sheets-table">
              <thead>
                <tr>
                  <th>Hoja</th>
                  <th>Creada</th>
                  <th>Procesada</th>
                  <th>Venta vinculada</th>
                  <th className="num">Unidades</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {hojasProcesadas.map((hoja) => {
                  const venta = state.ventas.find((item) => item.id === hoja.ventaId);
                  const unidades = venta ? venta.items.reduce((acc, item) => acc + item.cantidad, 0) : 0;
                  return (
                    <tr key={hoja.id}>
                      <td className="mono strong">{hoja.id}</td>
                      <td>{formatDate(hoja.creadaEn)}</td>
                      <td>{formatDateTime(hoja.procesadaEn)}</td>
                      <td className="mono">{hoja.ventaId ?? '—'}</td>
                      <td className="num">{formatNumber(unidades)}</td>
                      <td className="num strong">{formatMoney(venta?.total ?? 0)}</td>
                      <td>
                        <StatusBadge estado="procesada" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function VentaRows({ venta, abierta, unidades, onToggle }) {
  return (
    <>
      <tr className={abierta ? 'row-open' : ''}>
        <td className="nowrap">{formatDateTime(venta.fecha)}</td>
        <td className="mono strong">{venta.id}</td>
        <td>
          <TypeBadge tipo={venta.tipo} />
        </td>
        <td className="mono muted">{venta.hojaId ?? '—'}</td>
        <td className="num">
          {formatNumber(unidades)}
          <span className="cell-sub-inline">en {venta.items.length} línea(s)</span>
        </td>
        <td className="num strong">{formatMoney(venta.total)}</td>
        <td>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggle}
            aria-expanded={abierta}
            aria-label={`${abierta ? 'Ocultar' : 'Ver'} detalle de ${venta.id}`}
            title="Ver detalle"
          >
            <Icon
              name="chevronDown"
              size={17}
              className={`chevron ${abierta ? 'is-open' : ''}`}
            />
          </button>
        </td>
      </tr>
      {abierta ? (
        <tr className="detail-row">
          <td colSpan={7}>
            <div className="sale-detail" data-testid={`sale-detail-${venta.id}`}>
              <div className="sale-detail-head">
                <div>
                  <strong>Detalle de la venta {venta.id}</strong>
                  <span>
                    {venta.tipo === 'contingencia'
                      ? `Registrada desde la hoja ${venta.hojaId}`
                      : 'Venta registrada en la caja'}
                  </span>
                </div>
                <span>{formatDateTime(venta.fecha)}</span>
              </div>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Precio unit.</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {venta.items.map((item) => (
                    <tr key={`${venta.id}-${item.codigo}`}>
                      <td className="mono">{item.codigo}</td>
                      <td>{item.nombre}</td>
                      <td className="num">{item.cantidad}</td>
                      <td className="num">{formatMoney(item.precio)}</td>
                      <td className="num">{formatMoney(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sale-detail-total">
                <span>Total de la venta</span>
                <strong>{formatMoney(venta.total)}</strong>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
