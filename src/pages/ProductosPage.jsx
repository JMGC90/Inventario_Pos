import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { ProductForm } from '../components/ProductForm.jsx';
import { Modal } from '../components/Modal.jsx';
import { EmptyState, StatCard, StockBadge } from '../components/Ui.jsx';
import { formatMoney, formatNumber, normalizeText } from '../lib/format.js';
import { nivelStock, nextProductCode } from '../lib/model.js';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'bajo', label: 'Stock bajo' },
  { id: 'agotado', label: 'Agotados' },
];

export function ProductosPage() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [resetAbierto, setResetAbierto] = useState(false);
  const [nombreNegocio, setNombreNegocio] = useState(state.negocio.nombre);

  useEffect(() => {
    setNombreNegocio(state.negocio.nombre);
  }, [state.negocio.nombre]);

  const codigoSugerido = useMemo(() => nextProductCode(state.productos), [state.productos]);

  const filtrados = useMemo(() => {
    const termino = normalizeText(busqueda);
    return state.productos
      .filter((producto) => {
        if (filtro !== 'todos' && nivelStock(producto) !== filtro) return false;
        if (!termino) return true;
        return (
          normalizeText(producto.nombre).includes(termino) ||
          normalizeText(producto.codigo).includes(termino)
        );
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [state.productos, busqueda, filtro]);

  const totalUnidades = state.productos.reduce((acc, producto) => acc + producto.stock, 0);
  const alertas = state.productos.filter((producto) => nivelStock(producto) !== 'ok').length;
  const agotados = state.productos.filter((producto) => nivelStock(producto) === 'agotado').length;

  const abrirNuevo = () => {
    setEditando(null);
    setFormAbierto(true);
  };

  const abrirEditar = (producto) => {
    setEditando(producto);
    setFormAbierto(true);
  };

  const guardar = (datos) => {
    if (editando) {
      actions.updateProduct(editando.codigo, datos);
      toast.success(`Producto ${editando.codigo} actualizado.`, 'Cambios guardados');
    } else {
      const producto = actions.addProduct(datos);
      toast.success(`${producto.nombre} agregado con ${producto.stock} unidades.`, 'Producto creado');
    }
  };

  const confirmarEliminar = () => {
    if (!eliminando) return;
    try {
      actions.removeProduct(eliminando.codigo);
      toast.success(`${eliminando.nombre} salió del inventario. Las ventas anteriores conservan su registro.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setEliminando(null);
    }
  };

  const confirmarReset = () => {
    actions.resetDemo();
    setResetAbierto(false);
    setBusqueda('');
    setFiltro('todos');
    toast.success('Se restauraron los 10 productos y las 2 ventas de ejemplo.', 'Datos de demo restaurados');
  };

  const guardarNegocio = (event) => {
    event.preventDefault();
    try {
      actions.setNegocio(nombreNegocio);
      toast.success('El nombre se usará en las próximas hojas de contingencia.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="page">
      <div className="page-actions-row">
        <div className="stat-grid stat-grid-3">
          <StatCard
            label="Productos"
            value={formatNumber(state.productos.length)}
            hint={`${formatNumber(totalUnidades)} unidades en total`}
            icon="box"
            tone="neutral"
          />
          <StatCard
            label="Requieren atención"
            value={formatNumber(alertas)}
            hint={`${agotados} agotado(s) · alerta de stock`}
            icon="alert"
            tone={alertas ? 'warning' : 'success'}
          />
          <StatCard
            label="Valor del inventario"
            value={formatMoney(state.productos.reduce((acc, producto) => acc + producto.precio * producto.stock, 0))}
            hint="Precio de venta × stock actual"
            icon="bolt"
            tone="success"
          />
        </div>
        <button type="button" className="btn btn-primary btn-lg page-primary-action" onClick={abrirNuevo} data-testid="new-product">
          <Icon name="plus" size={18} strokeWidth={2.2} />
          Nuevo producto
        </button>
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="search-wrap">
            <Icon name="search" size={17} />
            <input
              className="input search-input"
              type="search"
              placeholder="Buscar producto o código…"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              aria-label="Buscar productos"
            />
          </div>
          <div className="filter-chips" role="group" aria-label="Filtrar por estado de stock">
            {FILTROS.map((item) => {
              const cantidad =
                item.id === 'todos'
                  ? state.productos.length
                  : state.productos.filter((producto) => nivelStock(producto) === item.id).length;
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
        </div>

        {state.productos.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon="box"
              title="Todavía no hay productos"
              text="Crea tu primer producto o restaura los datos de ejemplo para probar el sistema."
              action={
                <div className="inline-actions">
                  <button type="button" className="btn btn-primary" onClick={abrirNuevo}>
                    Crear producto
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setResetAbierto(true)}>
                    Restaurar demo
                  </button>
                </div>
              }
            />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              icon="search"
              title="Sin coincidencias"
              text="Prueba con otro término o cambia el filtro de stock."
              action={
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setBusqueda('');
                    setFiltro('todos');
                  }}
                >
                  Limpiar filtros
                </button>
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table products-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="num">Precio</th>
                  <th className="num">Stock</th>
                  <th className="num">Alerta desde</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((producto) => {
                  const nivel = nivelStock(producto);
                  return (
                    <tr key={producto.codigo} className={nivel !== 'ok' ? `row-${nivel}` : ''}>
                      <td className="mono strong">{producto.codigo}</td>
                      <td>
                        <div className="cell-product">
                          <strong>{producto.nombre}</strong>
                          <span className="cell-sub">
                            {formatMoney(producto.precio * producto.stock)} en inventario
                          </span>
                        </div>
                      </td>
                      <td className="num">{formatMoney(producto.precio)}</td>
                      <td className="num strong">{formatNumber(producto.stock)}</td>
                      <td className="num muted">{formatNumber(producto.stockMinimo)}</td>
                      <td>
                        <StockBadge producto={producto} compact />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => abrirEditar(producto)}
                            aria-label={`Editar ${producto.nombre}`}
                            title="Editar producto"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            onClick={() => setEliminando(producto)}
                            aria-label={`Eliminar ${producto.nombre}`}
                            title="Eliminar producto"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="settings-grid">
        <section className="card card-pad">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="store" size={18} />
                Datos del negocio
              </h2>
              <p>El nombre aparece en la cabecera de las hojas de contingencia.</p>
            </div>
          </div>
          <form className="business-form" onSubmit={guardarNegocio}>
            <div className="field">
              <label htmlFor="nombre-negocio">Nombre del negocio</label>
              <input
                id="nombre-negocio"
                className="input"
                value={nombreNegocio}
                onChange={(event) => setNombreNegocio(event.target.value)}
                maxLength={70}
                required
              />
            </div>
            <button type="submit" className="btn btn-outline">
              Guardar nombre
            </button>
          </form>
        </section>

        <section className="card card-pad danger-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                <Icon name="refresh" size={18} />
                Datos de demostración
              </h2>
              <p>
                Restaura los 10 productos y las 2 ventas de ejemplo. Se borran las ventas, productos y hojas creadas en
                este navegador.
              </p>
            </div>
          </div>
          <div className="danger-actions">
            <button type="button" className="btn btn-outline-danger" onClick={() => setResetAbierto(true)}>
              <Icon name="refresh" size={16} />
              Restaurar datos demo
            </button>
            <span className="hint">Ideal para reiniciar el recorrido de la demo.</span>
          </div>
        </section>
      </div>

      <ProductForm
        open={formAbierto}
        producto={editando}
        codigoSugerido={codigoSugerido}
        onSubmit={guardar}
        onClose={() => {
          setFormAbierto(false);
          setEditando(null);
        }}
      />

      <Modal
        open={Boolean(eliminando)}
        onClose={() => setEliminando(null)}
        title="Eliminar producto"
        subtitle={eliminando ? `${eliminando.codigo} · ${eliminando.nombre}` : ''}
        icon="trash"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEliminando(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmarEliminar}>
              Sí, eliminar
            </button>
          </>
        }
      >
        <p className="modal-text">
          El producto saldrá del inventario y de la caja. Las ventas anteriores y las hojas ya generadas conservarán su
          nombre como referencia histórica.
        </p>
        {eliminando && nivelStock(eliminando) !== 'ok' ? (
          <div className="alert-banner alert-warning">
            <Icon name="alert" size={16} />
            <span>Este producto tiene {eliminando.stock} unidades en stock.</span>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={resetAbierto}
        onClose={() => setResetAbierto(false)}
        title="Restaurar datos de demostración"
        subtitle="Esta acción no se puede deshacer"
        icon="refresh"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResetAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmarReset}>
              Restaurar demo
            </button>
          </>
        }
      >
        <p className="modal-text">
          Se eliminarán todos los productos, ventas y hojas de contingencia guardadas en este navegador y se cargarán
          nuevamente los datos de ejemplo.
        </p>
        <div className="alert-banner alert-warning">
          <Icon name="alert" size={16} />
          <span>Si solo quieres probar, exporta el historial antes de continuar.</span>
        </div>
      </Modal>
    </div>
  );
}
