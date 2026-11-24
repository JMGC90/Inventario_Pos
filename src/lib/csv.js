export function salesToCsv(ventas) {
  const headers = [
    'Fecha',
    'ID venta',
    'Tipo',
    'Hoja contingencia',
    'Código',
    'Producto',
    'Cantidad',
    'Precio unitario',
    'Subtotal',
    'Total venta',
  ];

  const escape = (value) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = [];
  for (const venta of ventas) {
    for (const item of venta.items) {
      rows.push([
        new Date(venta.fecha).toLocaleString('es-CO'),
        venta.id,
        venta.tipo === 'contingencia' ? 'Contingencia' : 'Normal',
        venta.hojaId ?? '',
        item.codigo,
        item.nombre,
        item.cantidad,
        item.precio,
        item.subtotal,
        venta.total,
      ]);
    }
  }

  return `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')}`;
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
