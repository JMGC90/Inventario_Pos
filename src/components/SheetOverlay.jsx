import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';
import { SHEET_CSS, buildSheetBody, downloadSheetHtml } from '../lib/sheet.js';

export function SheetOverlay({ hoja, negocioNombre, onClose }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!hoja) return undefined;

    previousFocus.current = document.activeElement;
    document.body.classList.add('sheet-open');
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector('button')?.focus();
    }, 60);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('sheet-open');
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [hoja, onClose]);

  if (!hoja) return null;

  return createPortal(
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label={`Hoja de contingencia ${hoja.id}`}>
      <style>{SHEET_CSS}</style>
      <div className="sheet-toolbar-ui" ref={panelRef} tabIndex={-1}>
        <div className="sheet-toolbar-info">
          <span className="toolbar-kicker">
            <Icon name="fileText" size={15} />
            Vista imprimible
          </span>
          <strong>Hoja {hoja.id}</strong>
          <span className="toolbar-sub">{hoja.items.length} productos · Imprime o guarda como PDF</span>
        </div>
        <div className="sheet-toolbar-actions">
          <button type="button" className="btn btn-ghost btn-sm toolbar-close" onClick={onClose}>
            <Icon name="close" size={16} />
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => downloadSheetHtml(hoja, negocioNombre)}
          >
            <Icon name="download" size={16} />
            Descargar HTML
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Icon name="printer" size={16} />
            Imprimir / PDF
          </button>
        </div>
      </div>
      <div className="sheet-scroll">
        <div className="sheet-paper-wrap" dangerouslySetInnerHTML={{ __html: buildSheetBody(hoja, negocioNombre) }} />
      </div>
    </div>,
    document.body,
  );
}
