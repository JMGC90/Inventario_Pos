import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { FieldError } from './Ui.jsx';
import { formatMoney } from '../lib/format.js';

const FORM_ID = 'form-producto';

function valoresIniciales(producto, codigoSugerido) {
  return {
    codigo: producto?.codigo ?? codigoSugerido ?? '',
    nombre: producto?.nombre ?? '',
    precio: producto ? String(producto.precio) : '',
    stock: producto ? String(producto.stock) : '0',
    stockMinimo: producto ? String(producto.stockMinimo) : '5',
  };
}

export function ProductForm({ open, producto, codigoSugerido, onSubmit, onClose }) {
  const [valores, setValores] = useState(() => valoresIniciales(producto, codigoSugerido));
  const [error, setError] = useState('');
  const esEdicion = Boolean(producto);

  useEffect(() => {
    if (!open) return;
    setValores(valoresIniciales(producto, codigoSugerido));
    setError('');
  }, [open, producto, codigoSugerido]);

  const actualizar = (campo, valor) => {
    setValores((prev) => ({ ...prev, [campo]: valor }));
    if (error) setError('');
  };

  const enviar = (event) => {
    event.preventDefault();
    setError('');
    try {
      onSubmit({
        codigo: valores.codigo,
        nombre: valores.nombre,
        precio: valores.precio,
        stock: valores.stock,
        stockMinimo: valores.stockMinimo,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el producto.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={esEdicion ? 'edit' : 'plus'}
      title={esEdicion ? 'Editar producto' : 'Nuevo producto'}
      subtitle={esEdicion ? `Código ${producto.codigo}` : 'Agrega un producto a tu inventario'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form={FORM_ID} className="btn btn-primary">
            {esEdicion ? 'Guardar cambios' : 'Agregar producto'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} className="form" onSubmit={enviar}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="producto-codigo">Código / ID corto</label>
            <input
              id="producto-codigo"
              className="input mono-input"
              value={valores.codigo}
              onChange={(event) => actualizar('codigo', event.target.value.toUpperCase())}
              placeholder="P-011"
              maxLength={12}
              autoComplete="off"
              disabled={esEdicion}
              required
              autoFocus={!esEdicion}
            />
            <span className="hint">
              {esEdicion
                ? 'El código no se puede cambiar para no romper el historial.'
                : '2 a 12 caracteres: letras, números, guion o guion bajo.'}
            </span>
          </div>

          <div className="field">
            <label htmlFor="producto-nombre">Nombre</label>
            <input
              id="producto-nombre"
              className="input"
              value={valores.nombre}
              onChange={(event) => actualizar('nombre', event.target.value)}
              placeholder="Ej. Café americano"
              maxLength={70}
              required
              autoFocus={esEdicion}
            />
          </div>
        </div>

        <div className="form-row form-row-3">
          <div className="field">
            <label htmlFor="producto-precio">Precio unitario</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                id="producto-precio"
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={valores.precio}
                onChange={(event) => actualizar('precio', event.target.value)}
                placeholder="3500"
                required
              />
            </div>
            {valores.precio ? <span className="hint">{formatMoney(Number(valores.precio))} por unidad</span> : null}
          </div>

          <div className="field">
            <label htmlFor="producto-stock">{esEdicion ? 'Stock actual' : 'Stock inicial'}</label>
            <input
              id="producto-stock"
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={valores.stock}
              onChange={(event) => actualizar('stock', event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="producto-minimo">Alerta de stock mínimo</label>
            <input
              id="producto-minimo"
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={valores.stockMinimo}
              onChange={(event) => actualizar('stockMinimo', event.target.value)}
              required
            />
            <span className="hint">Se resalta cuando el stock llegue a este valor.</span>
          </div>
        </div>

        <FieldError>{error}</FieldError>
      </form>
    </Modal>
  );
}
