import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Icon } from '../components/Icon.jsx';
import { ReviewTable } from '../components/ReviewTable.jsx';
import { SheetOverlay } from '../components/SheetOverlay.jsx';
import { EmptyState, StatusBadge } from '../components/Ui.jsx';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../lib/format.js';
import { elegirCantidadesDemo, renderTestSheet } from '../lib/testImage.js';
import { enhanceCanvas, getOcrSnapshot, onOcrProgress, prepareImage, recognizeImage, warmUpOcr } from '../lib/ocr.js';
import { parseOcrOutput } from '../lib/parser.js';

function filasDesdeHoja(hoja, productos, deteccion) {
  const mapa = new Map((deteccion?.filas ?? []).map((fila) => [fila.codigo, fila]));
  return hoja.items.map((item) => {
    const producto = productos.find((p) => p.codigo === item.codigo);
    const detectada = mapa.get(item.codigo);
    return {
      codigo: item.codigo,
      nombre: producto?.nombre ?? item.nombre,
      precio: producto?.precio ?? item.precio,
      stock: producto ? producto.stock : null,
      eliminado: !producto,
      qty: detectada?.cantidad ?? 0,
      detectadaCantidad: detectada?.cantidad ?? null,
      confianza: detectada?.confianza ?? 'baja',
      metodo: detectada?.metodo ?? null,
      textoFila: detectada?.textoFila ?? '',
      manual: false,
    };
  });
}

function filaManual(producto, cantidad) {
  return {
    codigo: producto.codigo,
    nombre: producto.nombre,
    precio: producto.precio,
    stock: producto.stock,
    eliminado: false,
    qty: Math.min(cantidad, producto.stock),
    detectadaCantidad: null,
    confianza: 'baja',
    metodo: 'manual',
    textoFila: '',
    manual: true,
  };
}

export function ContingenciaPage({ navigate }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const inputRef = useRef(null);
  const reviewRef = useRef(null);
  const applyingRef = useRef(false);
  const previewUrlRef = useRef(null);
  const canvasRef = useRef(null);

  const [preview, setPreview] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [rotacion, setRotacion] = useState(0);
  const [mejorar, setMejorar] = useState(true);
  const [fase, setFase] = useState('idle');
  const [progreso, setProgreso] = useState(() => getOcrSnapshot());
  const [motorError, setMotorError] = useState('');
  const [errorOcr, setErrorOcr] = useState('');
  const [deteccion, setDeteccion] = useState(null);
  const [hojaSel, setHojaSel] = useState('');
  const [filas, setFilas] = useState([]);
  const [advertencias, setAdvertencias] = useState([]);
  const [aplicada, setAplicada] = useState(null);
  const [hojaAbierta, setHojaAbierta] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [generandoDemo, setGenerandoDemo] = useState(false);
  const [hayCanvas, setHayCanvas] = useState(false);

  const pendientes = useMemo(
    () =>
      state.hojas
        .filter((hoja) => hoja.estado === 'pendiente')
        .sort((a, b) => new Date(b.creadaEn) - new Date(a.creadaEn)),
    [state.hojas],
  );

  const hojaSelObj = state.hojas.find((hoja) => hoja.id === hojaSel) ?? null;
  const hojasOrdenadas = useMemo(
    () => [...state.hojas].sort((a, b) => new Date(b.creadaEn) - new Date(a.creadaEn)),
    [state.hojas],
  );

  useEffect(() => {
    const off = onOcrProgress(setProgreso);
    warmUpOcr().catch((error) => setMotorError(error.message));
    return off;
  }, []);

  useEffect(() => {
    if (!hojaSel && pendientes.length) setHojaSel(pendientes[0].id);
  }, [hojaSel, pendientes]);

  useEffect(
    () => () => {
      if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const liberarPreview = () => {
    if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };

  const fijarPreview = (url, nombre, origen) => {
    liberarPreview();
    previewUrlRef.current = url;
    setPreview({ url, nombre, origen });
  };

  const resetResultados = ({ limpiarPreview = false, mantenerHoja = false } = {}) => {
    if (limpiarPreview) {
      liberarPreview();
      setPreview(null);
      setArchivo(null);
      setRotacion(0);
      canvasRef.current = null;
      setHayCanvas(false);
    }
    setFase('idle');
    setDeteccion(null);
    setFilas([]);
    setAdvertencias([]);
    setErrorOcr('');
    setAplicada(null);
    if (!mantenerHoja) {
      setHojaSel(pendientes[0]?.id ?? '');
    }
  };

  const abrirSelector = () => inputRef.current?.click();

  const recibirArchivo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen JPG o PNG de la hoja.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('La imagen supera los 20 MB. Usa una foto más liviana.');
      return;
    }
    resetResultados({ limpiarPreview: true });
    canvasRef.current = null;
    setHayCanvas(false);
    setArchivo(file);
    const url = URL.createObjectURL(file);
    fijarPreview(url, file.name, 'archivo');
    setFase('idle');
  };

  const asociarHoja = (resultado, listaHojas = state.hojas, forzarId = null) => {
    let id = forzarId ?? resultado.hoja?.id ?? null;
    if (!id && hojaSel && listaHojas.some((hoja) => hoja.id === hojaSel)) id = hojaSel;
    if (!id) {
      id =
        listaHojas
          .filter((hoja) => hoja.estado === 'pendiente')
          .sort((a, b) => new Date(b.creadaEn) - new Date(a.creadaEn))[0]?.id ?? '';
    }

    setHojaSel(id);
    setDeteccion(resultado);
    const hoja = listaHojas.find((item) => item.id === id) ?? null;
    const avisos = [...(resultado.advertencias ?? [])];

    if (resultado.hojaId && !resultado.hoja) {
      avisos.unshift(
        `El OCR leyó el ID ${resultado.hojaId}, pero no coincide con ninguna hoja registrada. Verifica la hoja seleccionada.`,
      );
    }
    if (hoja) {
      setFilas(filasDesdeHoja(hoja, state.productos, resultado));
      const extras = (resultado.filas ?? []).filter(
        (fila) => !hoja.items.some((item) => item.codigo === fila.codigo),
      );
      if (extras.length) {
        avisos.push(
          `Se detectaron ${extras.length} producto(s) que no pertenecen a esta hoja. Revisa si escogiste la hoja correcta.`,
        );
      }
      if (hoja.estado === 'procesada') {
        avisos.unshift(`La hoja ${hoja.id} ya fue procesada. No se puede aplicar dos veces.`);
      }
    } else {
      setFilas([]);
    }

    setAdvertencias([...new Set(avisos)]);
  };

  const leerConOcr = async () => {
    if ((!archivo && !canvasRef.current) || fase === 'preparing' || fase === 'reading') return;
    setErrorOcr('');
    setAplicada(null);

    const hoja = hojaSelObj ?? pendientes[0] ?? null;
    setFase('preparing');
    try {
      const canvas = archivo
        ? await prepareImage(archivo, { rotation: rotacion, enhance: mejorar })
        : canvasRef.current;
      setFase('reading');
      const data = await recognizeImage(canvas);
      const resultado = parseOcrOutput(data, state.productos, state.hojas);
      asociarHoja(resultado);
      setFase('ready');
      const detectadas = resultado.filas.filter((fila) => fila.cantidad !== null).length;
      if (detectadas > 0) {
        toast.success(`${detectadas} cantidad(es) detectada(s). Revisa y confirma antes de aplicar.`, 'OCR finalizado');
      } else {
        toast.warning('No se leyeron cantidades. Puedes corregirlas en la tabla o ingresarlas manualmente.');
      }
    } catch (error) {
      setFase('error');
      setErrorOcr(error.message);
      if (hoja) {
        setFilas(filasDesdeHoja(hoja, state.productos, null));
        setHojaSel(hoja.id);
        setAdvertencias(['No se pudo leer la imagen. Ingresa las cantidades manualmente y revisa la tabla.']);
      }
      toast.error(error.message, 'No se pudo leer la hoja');
    }
  };

  const entrarManual = () => {
    const hoja = hojaSelObj ?? pendientes[0] ?? null;
    if (!hoja) {
      toast.warning('Primero genera una hoja de contingencia.');
      return;
    }
    resetResultados({ mantenerHoja: true });
    setHojaSel(hoja.id);
    setFilas(filasDesdeHoja(hoja, state.productos, null));
    setAdvertencias(['Modo de ingreso manual: escribe las cantidades anotadas en la hoja física.']);
    setFase('ready');
    window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const seleccionarHoja = (id) => {
    setHojaSel(id);
    setAplicada(null);
    const hoja = state.hojas.find((item) => item.id === id);
    if (!hoja) {
      setFilas([]);
      return;
    }
    if (!deteccion && !filas.length) {
      setFilas([]);
      return;
    }

    setFilas(filasDesdeHoja(hoja, state.productos, deteccion));
    const avisos = [...(deteccion.advertencias ?? [])];
    if (hoja.estado === 'procesada') {
      avisos.unshift(`La hoja ${hoja.id} ya fue procesada. No se puede aplicar dos veces.`);
    }
    setAdvertencias([...new Set(avisos)]);
  };

  const cambiarCantidad = (codigo, valor) => {
    setFilas((prev) =>
      prev.map((fila) => {
        if (fila.codigo !== codigo) return fila;
        if (valor === '') return { ...fila, qty: '' };
        const numero = Math.max(0, Math.min(9999, Math.trunc(Number(valor) || 0)));
        return { ...fila, qty: numero };
      }),
    );
  };

  const agregarProductoManual = (codigo, cantidad) => {
    const producto = state.productos.find((item) => item.codigo === codigo);
    if (!producto) return;
    if (filas.some((fila) => fila.codigo === codigo && !fila.eliminado)) {
      toast.info('Ese producto ya está en la revisión.');
      return;
    }
    if (producto.stock <= 0) {
      toast.warning(`${producto.nombre} no tiene stock disponible.`);
      return;
    }
    setFilas((prev) => [...prev, filaManual(producto, cantidad)]);
  };

  const quitarFila = (codigo) => {
    setFilas((prev) => prev.filter((fila) => fila.codigo !== codigo));
  };

  const aplicar = async () => {
    if (applyingRef.current) return;
    if (!hojaSelObj) {
      toast.error('Selecciona la hoja que vas a procesar.');
      return;
    }
    if (hojaSelObj.estado === 'procesada') {
      toast.error(`La hoja ${hojaSelObj.id} ya fue procesada. No se puede duplicar.`);
      return;
    }

    const seleccionadas = filas.filter((fila) => !fila.eliminado && Number(fila.qty) > 0);
    if (!seleccionadas.length) {
      toast.warning('Ingresa al menos una cantidad mayor que 0.');
      return;
    }
    const excedida = seleccionadas.find((fila) => Number(fila.qty) > Number(fila.stock ?? 0));
    if (excedida) {
      toast.error(`La cantidad de ${excedida.nombre} excede el stock disponible (${excedida.stock}).`);
      return;
    }

    applyingRef.current = true;
    setAplicando(true);
    try {
      const resultado = actions.aplicarContingencia(
        hojaSelObj.id,
        seleccionadas.map((fila) => ({ codigo: fila.codigo, cantidad: Number(fila.qty) })),
      );
      const unidades = resultado.sale.items.reduce((acc, item) => acc + item.cantidad, 0);
      setAplicada({
        sale: resultado.sale,
        hoja: resultado.hoja,
        filas: seleccionadas.map((fila) => ({ ...fila, qty: Number(fila.qty) })),
      });
      setFilas([]);
      setDeteccion(null);
      setAdvertencias([]);
      setFase('ready');
      toast.success(
        `Se descontaron ${unidades} unidades y se creó la venta ${resultado.sale.id} por ${formatMoney(resultado.sale.total)}.`,
        `Hoja ${resultado.hoja.id} procesada`,
      );
    } catch (error) {
      toast.error(error.message, 'No se pudo aplicar la hoja');
    } finally {
      applyingRef.current = false;
      setAplicando(false);
    }
  };

  const generarHoja = () => {
    try {
      const hoja = actions.crearHoja();
      resetResultados({ limpiarPreview: true });
      setHojaSel(hoja.id);
      setHojaAbierta(hoja);
      toast.info('Imprímela y anota las cantidades vendidas durante el corte.', `Hoja ${hoja.id} creada`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const generarImagenPrueba = async () => {
    if (generandoDemo || fase === 'reading' || fase === 'preparing') return;
    setGenerandoDemo(true);
    let hojaCreada = null;
    try {
      const hoja = actions.crearHoja();
      hojaCreada = hoja;
      resetResultados({ limpiarPreview: true });
      setHojaSel(hoja.id);
      const cantidades = elegirCantidadesDemo(hoja);
      const canvas = renderTestSheet(hoja, state.negocio.nombre, cantidades);
      const url = canvas.toDataURL('image/png');
      fijarPreview(url, `hoja-prueba-${hoja.id}.png`, 'demo');
      setArchivo(null);
      setRotacion(0);

      setFase('preparing');
      const listo = enhanceCanvas(canvas);
      canvasRef.current = listo;
      setHayCanvas(true);
      setFase('reading');
      const data = await recognizeImage(listo);
      const hojasActualizadas = [...state.hojas, hoja];
      const resultado = parseOcrOutput(data, state.productos, hojasActualizadas);
      asociarHoja(resultado, hojasActualizadas, hoja.id);
      setFase('ready');
      const detectadas = resultado.filas.filter((fila) => fila.cantidad !== null).length;
      toast.success(
        `Imagen de prueba generada y leída con OCR: ${detectadas} cantidad(es) detectada(s). Confirma o corrige.`,
        'Demo de escaneo',
      );
    } catch (error) {
      setFase('error');
      setErrorOcr(error.message);
      if (hojaCreada) {
        setHojaSel(hojaCreada.id);
        setFilas(filasDesdeHoja(hojaCreada, state.productos, null));
        setAdvertencias([
          'La lectura automática falló. Puedes completar las cantidades manualmente en la tabla y aplicar la hoja.',
        ]);
      }
      toast.error(error.message, 'No se pudo generar la prueba');
    } finally {
      setGenerandoDemo(false);
    }
  };

  const reiniciarFlujo = () => {
    if (fase === 'reading' || fase === 'preparing') return;
    resetResultados({ limpiarPreview: true });
    setFase('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const procesarPendiente = (hoja) => {
    resetResultados({ limpiarPreview: true, mantenerHoja: true });
    setHojaSel(hoja.id);
    setFilas(filasDesdeHoja(hoja, state.productos, null));
    setAdvertencias(['Ingresa las cantidades de la hoja física o sube una foto para leerlas con OCR.']);
    setFase('ready');
    inputRef.current?.closest('.process-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalUnidades = filas.reduce(
    (acc, fila) => acc + (fila.eliminado ? 0 : Number(fila.qty) || 0),
    0,
  );
  const totalDinero = filas.reduce(
    (acc, fila) =>
      acc + (fila.eliminado ? 0 : (Number(fila.qty) || 0) * (Number(fila.precio) || 0)),
    0,
  );
  const hayExceso = filas.some(
    (fila) => !fila.eliminado && Number(fila.qty) > Number(fila.stock ?? 0),
  );
  const motivoBloqueo = !hojaSelObj
    ? 'Selecciona una hoja registrada.'
    : hojaSelObj.estado === 'procesada'
      ? 'Esta hoja ya fue procesada.'
      : hayExceso
        ? 'Corrige las cantidades que exceden el stock.'
        : totalUnidades === 0
          ? 'Ingresa al menos una cantidad.'
          : '';

  const estadoMotor = motorError
    ? 'error'
    : progreso.mode && progreso.phase !== 'loading'
      ? 'listo'
      : progreso.phase === 'loading'
        ? 'cargando'
        : 'inactivo';
  const etiquetaMotor = motorError
    ? 'OCR no disponible'
    : progreso.phase === 'loading'
      ? `Cargando motor OCR · ${Math.round((progreso.progress || 0) * 100)}%`
      : progreso.mode
        ? `Motor OCR listo · ${progreso.mode === 'local' ? 'local' : 'en línea'}`
        : 'Preparando motor OCR…';
  const mostrarProgreso = fase === 'preparing' || fase === 'reading';

  return (
    <div className="page contingency-page">
      <section className="contingency-hero">
        <div className="hero-icon">
          <Icon name="wifiOff" size={26} />
        </div>
        <div>
          <span className="hero-kicker">El diferencial del proyecto</span>
          <h2>Cuando se va la luz, el negocio sigue vendiendo.</h2>
          <p>
            Imprime una hoja con tus productos, anota las ventas a mano y al volver la electricidad o el internet sube
            una foto. La app lee las cantidades, te deja confirmarlas y actualiza el stock y el historial.
          </p>
        </div>
        <div className="hero-steps">
          <span><strong>1</strong> Imprime</span>
          <span><strong>2</strong> Anota</span>
          <span><strong>3</strong> Fotografía</span>
          <span><strong>4</strong> Confirma</span>
        </div>
      </section>

      <div className="contingency-grid">
        <div className="contingency-left">
          <section className="card card-pad generation-card">
            <div className="card-step">
              <span className="step-number">1</span>
              <div>
                <span className="step-kicker">Antes del corte</span>
                <h2>Genera la hoja de contingencia</h2>
              </div>
            </div>
            <p className="card-lead">
              La hoja incluye el ID único <span className="mono strong">HC-AAAA-N.º</span>, la fecha, tus productos y
             una casilla grande para escribir la cantidad vendida.
            </p>

            <div className="feature-list">
              <span><Icon name="printer" size={15} /> Lista para imprimir o guardar como PDF</span>
              <span><Icon name="fileText" size={15} /> Funciona sin electricidad ni internet</span>
              <span><Icon name="checkCircle" size={15} /> Se marca como procesada al aplicarla</span>
            </div>

            <div className="generate-actions">
              <button type="button" className="btn btn-primary" onClick={generarHoja} data-testid="generate-sheet">
                <Icon name="printer" size={17} />
                Generar hoja imprimible
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={generarImagenPrueba}
                disabled={generandoDemo || mostrarProgreso}
                data-testid="generate-demo-image"
              >
                <Icon name="sparkles" size={17} />
                {generandoDemo ? 'Generando prueba…' : 'Generar imagen de prueba'}
              </button>
            </div>
            <p className="hint hint-icon">
              <Icon name="bolt" size={13} />
              La imagen de prueba dibuja cantidades sobre una hoja y las lee con el OCR real. Úsala para demostrar el
              flujo sin imprimir.
            </p>

            <div className="pending-block">
              <div className="pending-head">
                <h3>
                  Hojas pendientes
                  <span className="count-pill count-pill-soft">{pendientes.length}</span>
                </h3>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('historial')}
                  aria-label="Ver hojas procesadas en el historial"
                >
                  Ver procesadas
                  <Icon name="arrowRight" size={13} />
                </button>
              </div>

              {pendientes.length === 0 ? (
                <div className="pending-empty">
                  <Icon name="fileText" size={18} />
                  <span>No hay hojas pendientes. Genera una para el próximo corte.</span>
                </div>
              ) : (
                <ul className="pending-list">
                  {pendientes.map((hoja) => (
                    <li key={hoja.id} className="pending-item">
                      <div>
                        <strong className="mono">{hoja.id}</strong>
                        <span>
                          {formatDate(hoja.creadaEn)} · {hoja.items.length} productos
                        </span>
                      </div>
                      <div className="pending-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setHojaAbierta(hoja)}
                          title="Ver / imprimir hoja"
                          aria-label={`Ver hoja ${hoja.id}`}
                        >
                          <Icon name="eye" size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => procesarPendiente(hoja)}
                        >
                          Procesar
                          <Icon name="arrowRight" size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="contingency-right" ref={reviewRef}>
          {aplicada ? (
            <section className="card card-pad success-panel" data-testid="contingency-success">
              <span className="success-badge">
                <Icon name="checkCircle" size={30} />
              </span>
              <span className="step-kicker">Sincronización completada</span>
              <h2>Hoja {aplicada.hoja.id} procesada</h2>
              <p>
                El stock se descontó, la venta quedó en el historial y la hoja está marcada como procesada para evitar
                duplicados.
              </p>

              <div className="success-stats">
                <div>
                  <span>Venta generada</span>
                  <strong className="mono">{aplicada.sale.id}</strong>
                </div>
                <div>
                  <span>Unidades descontadas</span>
                  <strong>{formatNumber(aplicada.sale.items.reduce((acc, item) => acc + item.cantidad, 0))}</strong>
                </div>
                <div>
                  <span>Total registrado</span>
                  <strong>{formatMoney(aplicada.sale.total)}</strong>
                </div>
                <div>
                  <span>Procesada</span>
                  <strong>{formatDateTime(aplicada.hoja.procesadaEn)}</strong>
                </div>
              </div>

              <div className="success-adjustments">
                <h3>Ajustes de stock</h3>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Vendido</th>
                      <th className="num">Stock antes</th>
                      <th className="num">Stock ahora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aplicada.filas.map((fila) => (
                      <tr key={fila.codigo}>
                        <td>
                          <span className="mono">{fila.codigo}</span> {fila.nombre}
                        </td>
                        <td className="num">{fila.qty}</td>
                        <td className="num">{fila.stock}</td>
                        <td className="num strong">{Number(fila.stock) - Number(fila.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="success-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate('historial')}>
                  Ver historial
                  <Icon name="arrowRight" size={16} />
                </button>
                <button type="button" className="btn btn-outline" onClick={reiniciarFlujo}>
                  Procesar otra hoja
                </button>
              </div>
            </section>
          ) : (
            <section className="card card-pad process-card">
              <div className="process-head">
                <div className="card-step">
                  <span className="step-number step-amber">2</span>
                  <div>
                    <span className="step-kicker">Al volver la luz o el internet</span>
                    <h2>Sube la hoja diligenciada</h2>
                  </div>
                </div>
                <span className={`engine-pill engine-${estadoMotor}`} title={motorError || etiquetaMotor}>
                  <span className="engine-dot" />
                  {etiquetaMotor}
                </span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="visually-hidden"
                onChange={(event) => {
                  recibirArchivo(event.target.files?.[0]);
                  event.target.value = '';
                }}
                data-testid="ocr-file-input"
              />

              {!preview ? (
                <div
                  className={`dropzone ${dragging ? 'is-dragging' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    recibirArchivo(event.dataTransfer.files?.[0]);
                  }}
                >
                  <span className="dropzone-icon">
                    <Icon name="upload" size={26} />
                  </span>
                  <strong>Arrastra la foto o el escaneo de la hoja</strong>
                  <span>JPG o PNG · La imagen se procesa en tu navegador, no se sube a internet.</span>
                  <div className="dropzone-actions">
                    <button type="button" className="btn btn-outline" onClick={abrirSelector}>
                      <Icon name="image" size={16} />
                      Elegir imagen
                    </button>
                    <span className="hint">o usa “Generar imagen de prueba”</span>
                  </div>
                </div>
              ) : (
                <div className="upload-preview">
                  <div className="preview-frame">
                    <img
                      src={preview.url}
                      alt="Vista previa de la hoja de contingencia"
                      style={{ transform: `rotate(${rotacion}deg)` }}
                    />
                    {preview.origen === 'demo' ? <span className="preview-tag">Imagen de prueba</span> : null}
                  </div>
                  <div className="preview-controls">
                    <div className="preview-name">
                      <Icon name="image" size={16} />
                      <div>
                        <strong>{preview.nombre}</strong>
                        <span>
                          {preview.origen === 'demo'
                            ? 'Generada desde la hoja y leída con OCR real'
                            : 'Foto cargada desde tu dispositivo'}
                        </span>
                      </div>
                    </div>

                    <div className="preview-buttons">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setRotacion((prev) => (prev + 90) % 360)}
                        disabled={preview.origen === 'demo' || mostrarProgreso}
                        title="Girar la imagen 90 grados"
                      >
                        <Icon name="refresh" size={15} />
                        Rotar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={abrirSelector}
                        disabled={mostrarProgreso}
                      >
                        <Icon name="image" size={15} />
                        Cambiar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={reiniciarFlujo}
                        disabled={mostrarProgreso}
                      >
                        <Icon name="trash" size={15} />
                        Quitar
                      </button>
                    </div>

                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={mejorar}
                        onChange={(event) => setMejorar(event.target.checked)}
                        disabled={mostrarProgreso}
                      />
                      Mejorar contraste para el OCR
                    </label>

                    {preview.origen === 'archivo' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={leerConOcr}
                        disabled={mostrarProgreso}
                        data-testid="run-ocr"
                      >
                        <Icon name="scan" size={17} />
                        {fase === 'reading' ? 'Leyendo hoja…' : fase === 'preparing' ? 'Preparando imagen…' : 'Leer hoja con OCR'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-block"
                        onClick={leerConOcr}
                        disabled={!hayCanvas || mostrarProgreso}
                        title={!hayCanvas ? 'La imagen de prueba ya fue procesada automáticamente' : undefined}
                      >
                        <Icon name="scan" size={17} />
                        Volver a leer con OCR
                      </button>
                    )}

                    {motorError ? (
                      <div className="inline-alert inline-alert-warning">
                        <Icon name="alert" size={15} />
                        <span>{motorError}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {mostrarProgreso ? (
                <div className="ocr-progress" aria-live="polite">
                  <div className="ocr-progress-top">
                    <span>
                      {fase === 'preparing' ? 'Mejorando la imagen…' : progreso.status || 'Leyendo la hoja…'}
                    </span>
                    <span>{Math.round((progreso.progress || 0) * 100)}%</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${Math.max(6, Math.round((progreso.progress || 0) * 100))}%` }} />
                  </div>
                </div>
              ) : null}

              {errorOcr ? (
                <div className="alert-banner alert-error">
                  <Icon name="alert" size={16} />
                  <div>
                    <strong>No se pudo completar el OCR.</strong>
                    <span>{errorOcr}</span>
                  </div>
                </div>
              ) : null}

              <div className="manual-row">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={entrarManual}
                  disabled={!pendientes.length || mostrarProgreso}
                >
                  <Icon name="edit" size={15} />
                  Ingresar cantidades manualmente
                </button>
                <span className="hint">Si el OCR falla, la revisión manual mantiene el flujo completo.</span>
              </div>

              {!pendientes.length ? (
                <div className="alert-banner alert-warning">
                  <Icon name="alert" size={16} />
                  <span>
                    No tienes hojas pendientes. Genera una hoja primero para poder asociarla a la imagen y evitar
                    duplicados.
                  </span>
                </div>
              ) : null}

              {filas.length ? (
                <div className="detection-block">
                  <div className="assoc-card">
                    <div className="assoc-header">
                      <span className="assoc-icon">
                        <Icon name="scan" size={18} />
                      </span>
                      <div>
                        <h3>Asociación y lectura</h3>
                        <p>
                          {deteccion
                            ? `ID leído por OCR: ${deteccion.hojaId ?? 'no detectado'} · ${deteccion.palabras} palabras analizadas`
                            : 'Ingreso manual de cantidades'}
                        </p>
                      </div>
                      {hojaSelObj ? <StatusBadge estado={hojaSelObj.estado} /> : null}
                    </div>

                    <div className="assoc-grid">
                      <div className="detected-id">
                        <span>ID detectado</span>
                        <strong className="mono">{deteccion?.hojaId ?? '—'}</strong>
                        {deteccion?.hojaId ? (
                          <span className={`mini-status ${deteccion.hoja ? 'mini-ok' : 'mini-warn'}`}>
                            <Icon name={deteccion.hoja ? 'checkCircle' : 'alert'} size={12} />
                            {deteccion.hoja ? 'Coincide con una hoja registrada' : 'No registrado'}
                          </span>
                        ) : (
                          <span className="mini-status mini-warn">
                            <Icon name="alert" size={12} />
                            Selecciona la hoja manualmente
                          </span>
                        )}
                      </div>

                      <div className="field">
                        <label htmlFor="hoja-select">Hoja a procesar</label>
                        <select
                          id="hoja-select"
                          className="input select"
                          value={hojaSel}
                          onChange={(event) => seleccionarHoja(event.target.value)}
                          data-testid="sheet-select"
                        >
                          <option value="">Selecciona una hoja…</option>
                          {hojasOrdenadas.map((hoja) => (
                            <option
                              key={hoja.id}
                              value={hoja.id}
                              disabled={hoja.estado === 'procesada'}
                            >
                              {hoja.id} · {formatDate(hoja.creadaEn)} · {hoja.estado === 'procesada' ? 'ya procesada' : 'pendiente'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {hojaSelObj?.estado === 'procesada' ? (
                      <div className="alert-banner alert-error">
                        <Icon name="alert" size={16} />
                        <span>
                          Esta hoja ya fue procesada el {formatDateTime(hojaSelObj.procesadaEn)}. El sistema bloquea el
                          doble descuento de stock.
                        </span>
                      </div>
                    ) : null}

                    {advertencias.length ? (
                      <ul className="warn-list">
                        {advertencias.map((aviso) => (
                          <li key={aviso}>
                            <Icon name="alert" size={14} />
                            <span>{aviso}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <ReviewTable
                    rows={filas}
                    productos={state.productos}
                    onQtyChange={cambiarCantidad}
                    onAddProduct={agregarProductoManual}
                    onRemoveRow={quitarFila}
                    disabled={aplicando}
                  />

                  <div className="apply-bar">
                    <div className="apply-summary">
                      <span>Al aplicar se descontarán</span>
                      <strong>
                        {formatNumber(totalUnidades)} unidades · {formatMoney(totalDinero)}
                      </strong>
                      {motivoBloqueo ? <span className="apply-block-reason">{motivoBloqueo}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={aplicar}
                      disabled={Boolean(motivoBloqueo) || aplicando}
                      data-testid="apply-contingency"
                    >
                      <Icon name="check" size={18} strokeWidth={2.2} />
                      {aplicando ? 'Aplicando…' : 'Aplicar actualización al inventario'}
                    </button>
                  </div>
                </div>
              ) : null}

              {!filas.length && pendingEmptyHint(pendientes, preview, fase) ? (
                <div className="process-empty">
                  <EmptyState
                    icon="clipboard"
                    title="La revisión aparecerá aquí"
                    text="Sube una foto y ejecuta el OCR, o ingresa las cantidades manualmente. Siempre podrás corregir antes de aplicar."
                  />
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>

      <SheetOverlay
        hoja={hojaAbierta}
        negocioNombre={state.negocio.nombre}
        onClose={() => setHojaAbierta(null)}
      />
    </div>
  );
}

function pendingEmptyHint(pendientes, preview, fase) {
  if (pendientes.length === 0) return false;
  if (preview && fase === 'idle') return false;
  return !preview;
}
