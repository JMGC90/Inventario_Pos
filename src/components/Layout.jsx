import { Icon } from './Icon.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { nivelStock } from '../lib/model.js';
import { todayLong } from '../lib/format.js';

const NAVEGACION = [
  {
    id: 'caja',
    label: 'Caja',
    icon: 'cart',
    kicker: 'Venta rápida',
    title: 'Caja',
    description: 'Selecciona productos, ajusta cantidades y registra la venta descontando el stock.',
  },
  {
    id: 'productos',
    label: 'Productos',
    icon: 'box',
    kicker: 'Inventario',
    title: 'Productos e inventario',
    description: 'Administra precios, stock y alertas de reposición de tu negocio.',
  },
  {
    id: 'contingencia',
    label: 'Contingencia',
    icon: 'bolt',
    kicker: 'Resiliencia',
    title: 'Modo contingencia',
    description: 'Imprime una hoja para vender sin luz ni internet y recupérala luego con OCR.',
  },
  {
    id: 'historial',
    label: 'Historial',
    icon: 'history',
    kicker: 'Registro',
    title: 'Historial y sincronización',
    description: 'Consulta todas las ventas, los totales y las hojas de contingencia procesadas.',
  },
];

export function Layout({ route, navigate, children }) {
  const { state, storageOk } = useStore();
  const actual = NAVEGACION.find((item) => item.id === route) ?? NAVEGACION[0];
  const pendientes = state.hojas.filter((hoja) => hoja.estado === 'pendiente').length;
  const alertas = state.productos.filter((producto) => nivelStock(producto) !== 'ok').length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="30" height="30">
              <path d="M18 22h28l-2.5 24a4 4 0 0 1-4 3.5H24.5a4 4 0 0 1-4-3.5L18 22Z" fill="currentColor" />
              <path d="M25 26v-4a7 7 0 0 1 14 0v4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".55" />
              <path d="M26 34h12M26 41h8" stroke="#0f2f2c" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>POS Resiliente</strong>
            <span>Caja + inventario</span>
          </span>
        </div>

        <nav className="nav" aria-label="Secciones principales">
          {NAVEGACION.map((item) => {
            const badge = item.id === 'contingencia' ? pendientes : item.id === 'productos' ? alertas : 0;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${route === item.id ? 'is-active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={route === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                {badge > 0 ? (
                  <span className={`nav-badge ${item.id === 'productos' ? 'nav-badge-alert' : ''}`}>{badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="local-card">
            <span className="local-dot" aria-hidden="true" />
            <div>
              <strong>{storageOk ? 'Datos guardados aquí' : 'Almacenamiento no disponible'}</strong>
              <span>
                {storageOk
                  ? 'LocalStorage de este navegador. Sin servidores ni claves.'
                  : 'Los cambios no se conservarán al recargar.'}
              </span>
            </div>
          </div>
          <span className="sidebar-version">Prototipo v1.0 · Modo local</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-kicker">{actual.kicker}</span>
            <h1>{actual.title}</h1>
            <p>{actual.description}</p>
          </div>
          <div className="topbar-meta">
            <span className="meta-pill meta-date">
              <Icon name="calendar" size={15} />
              {todayLong()}
            </span>
            <span className="meta-pill meta-business">
              <Icon name="store" size={15} />
              {state.negocio.nombre}
            </span>
          </div>
        </header>

        {!storageOk ? (
          <div className="alert-banner alert-error" role="alert">
            <Icon name="alert" size={17} />
            <span>
              Tu navegador está bloqueando el almacenamiento local. Puedes usar la app, pero los datos se perderán al
              recargar la página.
            </span>
          </div>
        ) : null}

        <main className="content">{children}</main>

        <footer className="app-footer">
          <span>POS e Inventario Resiliente · Funciona sin luz y sin internet</span>
          <span>Hecho para emprendedores · Datos 100% locales</span>
        </footer>
      </div>
    </div>
  );
}
