import { SCHEMA_VERSION, STOCK_MINIMO_DEFECTO } from './constants.js';

const DIA = 24 * 60 * 60 * 1000;

function haceDias(dias) {
  return new Date(Date.now() - dias * DIA).toISOString();
}

const PRODUCTOS_DEMO = [
  { codigo: 'P-001', nombre: 'Café americano', precio: 3500, stock: 24, stockMinimo: 5 },
  { codigo: 'P-002', nombre: 'Capuchino', precio: 4800, stock: 18, stockMinimo: 5 },
  { codigo: 'P-003', nombre: 'Pan artesanal', precio: 2500, stock: 12, stockMinimo: 4 },
  { codigo: 'P-004', nombre: 'Jugo natural', precio: 4500, stock: 9, stockMinimo: 3 },
  { codigo: 'P-005', nombre: 'Agua sin gas', precio: 2000, stock: 40, stockMinimo: 8 },
  { codigo: 'P-006', nombre: 'Empanada de carne', precio: 1800, stock: 30, stockMinimo: 6 },
  { codigo: 'P-007', nombre: 'Arepa con queso', precio: 4000, stock: 15, stockMinimo: 5 },
  { codigo: 'P-008', nombre: 'Brownie de chocolate', precio: 3000, stock: 4, stockMinimo: 4 },
  { codigo: 'P-009', nombre: 'Sándwich de pollo', precio: 6500, stock: 5, stockMinimo: 3 },
  { codigo: 'P-010', nombre: 'Galleta de avena', precio: 1500, stock: 3, stockMinimo: 5 },
];

function itemVenta(producto, cantidad) {
  return {
    codigo: producto.codigo,
    nombre: producto.nombre,
    precio: producto.precio,
    cantidad,
    subtotal: producto.precio * cantidad,
  };
}

export function createInitialState() {
  const productos = PRODUCTOS_DEMO.map((producto, index) => ({
    ...producto,
    stockMinimo: producto.stockMinimo ?? STOCK_MINIMO_DEFECTO,
    creadoEn: haceDias(45 - index),
  }));

  const porCodigo = Object.fromEntries(productos.map((p) => [p.codigo, p]));

  const ventas = [
    {
      id: 'V-0001',
      tipo: 'normal',
      fecha: haceDias(1),
      items: [itemVenta(porCodigo['P-001'], 2), itemVenta(porCodigo['P-002'], 1)],
      total: 2 * porCodigo['P-001'].precio + porCodigo['P-002'].precio,
    },
    {
      id: 'V-0002',
      tipo: 'normal',
      fecha: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      items: [itemVenta(porCodigo['P-006'], 1), itemVenta(porCodigo['P-005'], 1)],
      total: porCodigo['P-006'].precio + porCodigo['P-005'].precio,
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    negocio: { nombre: 'Café & Pan Doña Rosa' },
    productos,
    ventas,
    hojas: [],
    seq: { venta: ventas.length, hoja: 0 },
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
}

export const DEMO_PRODUCTOS = PRODUCTOS_DEMO;
