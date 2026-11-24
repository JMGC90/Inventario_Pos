import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/lib/seed.js';
import {
  addProduct,
  aplicarContingencia,
  crearHojaContingencia,
  registrarVenta,
  removeProduct,
  resetDemoState,
  setNegocioNombre,
  updateProduct,
} from '../src/lib/model.js';

function productoDemo(codigo = 'P-001') {
  return createInitialState().productos.find((producto) => producto.codigo === codigo);
}

test('el estado inicial trae productos, ventas y secuencias consistentes', () => {
  const state = createInitialState();
  assert.equal(state.productos.length, 10);
  assert.equal(state.ventas.length, 2);
  assert.equal(state.seq.venta, 2);
  assert.equal(state.seq.hoja, 0);
  assert.ok(state.ventas.every((venta) => venta.total > 0));
});

test('registrar una venta descuenta stock y crea un id consecutivo', () => {
  const state = createInitialState();
  const stockAntes = state.productos.find((producto) => producto.codigo === 'P-001').stock;
  const { state: next, sale } = registrarVenta(state, [{ codigo: 'P-001', cantidad: 2 }]);

  assert.equal(sale.id, 'V-0003');
  assert.equal(sale.total, productoDemo().precio * 2);
  assert.equal(next.productos.find((producto) => producto.codigo === 'P-001').stock, stockAntes - 2);
  assert.equal(next.ventas.length, 3);
  assert.equal(state.productos.find((producto) => producto.codigo === 'P-001').stock, stockAntes);
});

test('no permite vender más unidades que el stock disponible', () => {
  const state = createInitialState();
  const producto = productoDemo('P-010');
  assert.throws(
    () => registrarVenta(state, [{ codigo: producto.codigo, cantidad: producto.stock + 1 }]),
    /Stock insuficiente/,
  );
});

test('crear hoja congela productos y usa un id único', () => {
  const state = createInitialState();
  const { state: next, hoja } = crearHojaContingencia(state);
  const { hoja: segunda } = crearHojaContingencia(next);

  assert.match(hoja.id, /^HC-\d{4}-001$/);
  assert.equal(hoja.items.length, 10);
  assert.equal(hoja.estado, 'pendiente');
  assert.match(segunda.id, /^HC-\d{4}-002$/);
  assert.equal(next.hojas.length, 1);
});

test('aplicar contingencia descuenta stock, crea venta y marca la hoja', () => {
  const state = createInitialState();
  const { state: conHoja, hoja } = crearHojaContingencia(state);
  const stockAntes = conHoja.productos.find((producto) => producto.codigo === 'P-001').stock;

  const resultado = aplicarContingencia(conHoja, hoja.id, [
    { codigo: 'P-001', cantidad: 3 },
    { codigo: 'P-002', cantidad: 1 },
  ]);

  assert.equal(resultado.sale.tipo, 'contingencia');
  assert.equal(resultado.sale.hojaId, hoja.id);
  assert.equal(resultado.sale.total, productoDemo('P-001').precio * 3 + productoDemo('P-002').precio);
  assert.equal(resultado.state.productos.find((producto) => producto.codigo === 'P-001').stock, stockAntes - 3);
  assert.equal(resultado.hoja.estado, 'procesada');
  assert.equal(resultado.hoja.ventaId, resultado.sale.id);
  assert.ok(resultado.hoja.procesadaEn);
});

test('no permite aplicar dos veces la misma hoja', () => {
  const state = createInitialState();
  const { state: conHoja, hoja } = crearHojaContingencia(state);
  const primera = aplicarContingencia(conHoja, hoja.id, [{ codigo: 'P-001', cantidad: 1 }]);
  assert.throws(
    () => aplicarContingencia(primera.state, hoja.id, [{ codigo: 'P-001', cantidad: 1 }]),
    /ya fue procesada/,
  );
});

test('valida stock al aplicar la contingencia', () => {
  const state = createInitialState();
  const { state: conHoja, hoja } = crearHojaContingencia(state);
  assert.throws(
    () => aplicarContingencia(conHoja, hoja.id, [{ codigo: 'P-010', cantidad: 999 }]),
    /Stock insuficiente/,
  );
});

test('alta, edición y eliminación de productos', () => {
  const state = createInitialState();
  const { state: conProducto, product } = addProduct(state, {
    codigo: 'P-011',
    nombre: 'Tostada',
    precio: 2200,
    stock: 8,
    stockMinimo: 2,
  });
  assert.equal(product.codigo, 'P-011');
  assert.equal(conProducto.productos.length, 11);
  assert.throws(
    () => addProduct(conProducto, { codigo: 'p-011', nombre: 'Otra', precio: 1000, stock: 1 }),
    /Ya existe/,
  );

  const { state: editado } = updateProduct(conProducto, 'P-011', {
    nombre: 'Tostada integral',
    precio: 2500,
    stock: 4,
    stockMinimo: 3,
  });
  assert.equal(editado.productos.find((p) => p.codigo === 'P-011').nombre, 'Tostada integral');
  assert.equal(editado.productos.find((p) => p.codigo === 'P-011').stock, 4);

  const eliminado = removeProduct(editado, 'P-011');
  assert.equal(eliminado.productos.length, 10);
});

test('rechaza productos con datos inválidos', () => {
  const state = createInitialState();
  assert.throws(() => addProduct(state, { codigo: '', nombre: 'X', precio: 10, stock: 1 }), /código/);
  assert.throws(() => addProduct(state, { codigo: 'P-200', nombre: '', precio: 10, stock: 1 }), /nombre/);
  assert.throws(() => addProduct(state, { codigo: 'P-201', nombre: 'Ok', precio: 0, stock: 1 }), /precio/);
  assert.throws(() => addProduct(state, { codigo: 'P-202', nombre: 'Ok', precio: 10, stock: -1 }), /stock/);
});

test('cambia el nombre del negocio y restaura la demo', () => {
  const state = createInitialState();
  const nuevo = setNegocioNombre(state, '  Tienda Nueva  ');
  assert.equal(nuevo.negocio.nombre, 'Tienda Nueva');
  assert.throws(() => setNegocioNombre(state, 'a'), /nombre del negocio/);

  const reset = resetDemoState();
  assert.equal(reset.productos.length, 10);
  assert.equal(reset.ventas.length, 2);
});
