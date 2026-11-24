import { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, StockBadge } from '../components/Ui.jsx';
import { formatMoney, formatNumber, formatTime, normalizeText } from '../lib/format.js';
import { nivelStock } from '../lib/model.js';

export function CajaPage({ navigate }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState({});
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [registrando, setRegistrando] = useState(false);

  const productosFiltrados = useMemo(() => {
    const termino = normalizeText(busqueda);
    return state.productos
      .filter((producto) => {
        if (!termino) return true;
        return (
          normalizeText(producto.nombre).includes(termino) ||
          normalizeText(producto.codigo).includes(termino)
        );
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [state.productos, busqueda]);

  const items = useMemo(() => {
    return Object.entries(carrito)
      .map(([codigo, cantidad]) => {
        const producto = state.productos.find((p) => p.codigo === codigo);
        return producto ? { producto, cantidad } : null;
      })
      .filter(Boolean);
  }, [carrito, state.productos]);

  const total = items.reduce((acc, item) => acc + item.producto.precio * item.cantidad, 0);
  const unidades = items.reduce((acc, item) => acc + item.cantidad, 0);
  const productosBajosDespues = ultimaVenta
    ? state.productos.filter((producto) => {
        const vendido = ultimaVenta.items.find((item) => item.codigo === producto.codigo);
        return vendido && nivelStock(producto) !== 'ok';
      })
    : [];

  const agregar = (producto) => {
    if (producto.stock <= 0) {
      toast.warning(`${producto.nombre} no tiene stock disponible.`);
      return;
    }
    const actual = carrito[producto.codigo] ?? 0;
    if (actual >= producto.stock) {
      toast.warning(`Solo hay ${producto.stock} unidades de ${producto.nombre}.`);
      return;
    }
    setCarrito((prev) => ({ ...prev, [producto.codigo]: Math.min((prev[producto.codigo] ?? 0) + 1, producto.stock) }));
    setUltimaVenta(null);
  };

  const cambiarCantidad = (producto, valor) => {
    const numero = Math.trunc(Number(valor) || 1);
    const cantidad = Math.max(1, Math.min(producto.stock, numero));
    setCarrito((prev) => ({ ...prev, [producto.codigo]: cantidad }));
    setUltimaVenta(null);
  };

  const quitar = (codigo) => {
    setCarrito((prev) => {
      const copia = { ...prev };
      delete copia[codigo];
      return copia;
    });
  };

  const vaciar = () => {
    setCarrito({});
    setUltimaVenta(null);
  };

  const registrar = () => {
    if (!items.length) return;
    setRegistrando(true);
    try {
      const venta = actions.registrarVenta(
        items.map((item) => ({ codigo: item.producto.codigo, cantidad: item.cantidad })),
      );
      const unidadesVendidas = venta.items.reduce((acc, item) => acc + item.cantidad, 0);
      setUltimaVenta(venta);
      setCarrito({});
      toast.success(
        `Venta ${venta.id} registrada: ${unidadesVendidas} unidad(es) por ${formatMoney(venta.total)}. El stock ya fue actualizado.`,
        'Venta completada',
      );
    } catch (error) {
      toast.error(error.message, 'No se pudo registrar la venta');
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="page">
      {ultimaVenta ? (
        <section className="sale-success" data-testid="sale-success">
          <span className="sale-success-icon">
            <Icon name="checkCircle" size={24} />
          </span>
          <div className="sale-success-body">
            <strong>Venta {ultimaVenta.id} registrada</strong>
            <span>
              {formatTime(ultimaVenta.fecha)} · {ultimaVenta.items.reduce((acc, item) => acc + item.cantidad, 0)}{' '}
              unidad(es) · Total {formatMoney(ultimaVenta.total)}
            </span>
            {productosBajosDespues.length ? (
              <span className="sale-warning">
                <Icon name="alert" size={14} />
                Quedó stock bajo en: {productosBajosDespues.map((producto) => producto.nombre).join(', ')}.
              </span>
            ) : null}
          </div>
          <div className="sale-success-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('historial')}>
              Ver historial
              <Icon name="arrowRight" size={15} />
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setUltimaVenta(null)}>
              Seguir vendiendo
            </button>
          </div>
        </section>
      ) : null}

      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="catalog-toolbar">
            <div className="search-wrap">
              <Icon name="search" size={17} />
              <input
                className="input search-input"
                type="search"
                placeholder="Buscar por nombre o código…"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                aria-label="Buscar productos"
              />
              {busqueda ? (
                <button type="button" className="search-clear" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </div>
            <span className="catalog-count">
              {formatNumber(productosFiltrados.length)} de {formatNumber(state.productos.length)} productos
            </span>
          </div>

          {state.productos.length === 0 ? (
            <div className="card card-pad">
              <EmptyState
                icon="box"
                title="Tu inventario está vacío"
                text="Agrega productos o restaura los datos de ejemplo para empezar a vender."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => navigate('productos')}>
                    Ir a productos
                    <Icon name="arrowRight" size={16} />
                  </button>
                }
              />
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="card card-pad">
              <EmptyState
                icon="search"
                title="Sin resultados"
                text={`No encontramos productos que coincidan con “${busqueda}”.`}
                action={
                  <button type="button" className="btn btn-outline" onClick={() => setBusqueda('')}>
                    Ver todos
                  </button>
                }
              />
            </div>
          ) : (
            <div className="product-grid">
              {productosFiltrados.map((producto) => {
                const agotado = producto.stock <= 0;
                const cantidadEnCarrito = carrito[producto.codigo] ?? 0;
                return (
                  <button
                    key={producto.codigo}
                    type="button"
                    className={`product-tile ${agotado ? 'is-out' : ''} ${cantidadEnCarrito ? 'in-cart' : ''}`}
                    onClick={() => agregar(producto)}
                    disabled={agotado}
                    data-testid={`product-tile-${producto.codigo}`}
                  >
                    <span className="tile-top">
                      <span className="tile-code">{producto.codigo}</span>
                      {cantidadEnCarrito ? <span className="tile-qty">{cantidadEnCarrito}</span> : null}
                    </span>
                    <span className="tile-name">{producto.nombre}</span>
                    <span className="tile-bottom">
                      <span className="tile-price">{formatMoney(producto.precio)}</span>
                      <StockBadge producto={producto} compact />
                    </span>
                    {!agotado && !cantidadEnCarrito ? (
                      <span className="tile-add" aria-hidden="true">
                        <Icon name="plus" size={14} strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <p className="catalog-hint">
            <Icon name="cart" size={14} />
            Haz clic en un producto para agregarlo a la venta. El stock se descuenta al confirmar.
          </p>
        </section>

        <aside className="card cart-card">
          <header className="cart-head">
            <div>
              <span className="cart-kicker">Venta actual</span>
              <h2>Carrito</h2>
            </div>
            <span className="count-pill">
              {formatNumber(unidades)} {unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          </header>

          {items.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty-icon">
                <Icon name="cart" size={24} />
              </span>
              <strong>El carrito está vacío</strong>
              <p>Selecciona productos del catálogo para registrar una venta.</p>
            </div>
          ) : (
            <ul className="cart-items">
              {items.map(({ producto, cantidad }) => (
                <li key={producto.codigo} className="cart-item">
                  <div className="cart-item-top">
                    <div>
                      <strong>{producto.nombre}</strong>
                      <span>
                        {producto.codigo} · {formatMoney(producto.precio)} c/u
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => quitar(producto.codigo)}
                      aria-label={`Quitar ${producto.nombre} del carrito`}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                  <div className="cart-item-bottom">
                    <div className="stepper">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(producto, cantidad - 1)}
                        disabled={cantidad <= 1}
                        aria-label={`Disminuir cantidad de ${producto.nombre}`}
                      >
                        <Icon name="minus" size={14} strokeWidth={2.4} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={producto.stock}
                        value={cantidad}
                        onChange={(event) => cambiarCantidad(producto, event.target.value)}
                        aria-label={`Cantidad de ${producto.nombre}`}
                      />
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(producto, cantidad + 1)}
                        disabled={cantidad >= producto.stock}
                        aria-label={`Aumentar cantidad de ${producto.nombre}`}
                      >
                        <Icon name="plus" size={14} strokeWidth={2.4} />
                      </button>
                    </div>
                    <strong className="cart-subtotal">{formatMoney(producto.precio * cantidad)}</strong>
                  </div>
                  {producto.stock <= producto.stockMinimo ? (
                    <span className="cart-item-warning">
                      <Icon name="alert" size={12} />
                      Stock bajo: quedan {producto.stock}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="cart-summary">
            <div className="cart-summary-row">
              <span>Unidades</span>
              <strong>{formatNumber(unidades)}</strong>
            </div>
            <div className="cart-summary-row cart-total-row">
              <span>Total a cobrar</span>
              <strong data-testid="cart-total">{formatMoney(total)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            disabled={!items.length || registrando}
            onClick={registrar}
            data-testid="register-sale"
          >
            <Icon name="check" size={18} strokeWidth={2.2} />
            {registrando ? 'Registrando…' : 'Registrar venta'}
          </button>

          {items.length ? (
            <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={vaciar}>
              Vaciar carrito
            </button>
          ) : null}

          <p className="cart-footnote">
            <Icon name="checkCircle" size={13} />
            Al registrar se descuenta el stock y se guarda la venta en el historial.
          </p>
        </aside>
      </div>
    </div>
  );
}
