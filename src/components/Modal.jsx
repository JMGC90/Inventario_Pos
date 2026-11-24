import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';

export function Modal({ open, title, subtitle, icon, onClose, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocus.current = document.activeElement;
    document.body.classList.add('modal-open');
    const timer = window.setTimeout(() => panelRef.current?.focus(), 30);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal-panel modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="modal-head">
          <div className="modal-title-wrap">
            {icon ? (
              <span className="modal-icon">
                <Icon name={icon} size={20} />
              </span>
            ) : null}
            <div>
              <h2 id="modal-title">{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar ventana">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
