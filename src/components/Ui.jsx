import { Icon } from './Icon.jsx';
import { nivelStock } from '../lib/model.js';

export function StockBadge({ producto, compact = false }) {
  const nivel = nivelStock(producto);
  const texto =
    nivel === 'agotado'
      ? 'Agotado'
      : nivel === 'bajo'
        ? compact
          ? `Bajo · ${producto.stock}`
          : `Stock bajo · ${producto.stock}`
        : compact
          ? `Stock ${producto.stock}`
          : `${producto.stock} disponibles`;

  return (
    <span className={`badge stock-${nivel}`}>
      <span className="badge-dot" aria-hidden="true" />
      {texto}
    </span>
  );
}

export function TypeBadge({ tipo }) {
  const contingencia = tipo === 'contingencia';
  return (
    <span className={`badge ${contingencia ? 'type-contingencia' : 'type-normal'}`}>
      <Icon name={contingencia ? 'wifiOff' : 'cart'} size={12} strokeWidth={2.2} />
      {contingencia ? 'Contingencia' : 'Normal'}
    </span>
  );
}

export function StatusBadge({ estado }) {
  const procesada = estado === 'procesada';
  return (
    <span className={`badge ${procesada ? 'status-processed' : 'status-pending'}`}>
      <Icon name={procesada ? 'checkCircle' : 'clock'} size={12} strokeWidth={2.2} />
      {procesada ? 'Procesada' : 'Pendiente'}
    </span>
  );
}

export function ConfidenceBadge({ confianza }) {
  const labels = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  return (
    <span className={`confidence confidence-${confianza}`} title={`Confianza ${labels[confianza] ?? 'baja'} de la lectura OCR`}>
      {labels[confianza] ?? 'Baja'}
    </span>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'neutral' }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint ? <span className="stat-hint">{hint}</span> : null}
      </div>
    </article>
  );
}

export function EmptyState({ icon = 'box', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return (
    <span className="field-error" role="alert">
      <Icon name="alert" size={13} strokeWidth={2.2} />
      {children}
    </span>
  );
}
