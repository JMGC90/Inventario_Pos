import { useEffect } from 'react';
import { StoreProvider } from './context/StoreContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Layout } from './components/Layout.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { CajaPage } from './pages/CajaPage.jsx';
import { ProductosPage } from './pages/ProductosPage.jsx';
import { ContingenciaPage } from './pages/ContingenciaPage.jsx';
import { HistorialPage } from './pages/HistorialPage.jsx';

const TITULOS = {
  caja: 'Caja',
  productos: 'Productos e inventario',
  contingencia: 'Modo contingencia',
  historial: 'Historial y sincronización',
};

function Aplicacion() {
  const [route, navigate] = useHashRoute();

  useEffect(() => {
    document.title = `${TITULOS[route] ?? 'POS'} · POS Resiliente`;
  }, [route]);

  return (
    <Layout route={route} navigate={navigate}>
      {route === 'caja' ? <CajaPage navigate={navigate} /> : null}
      {route === 'productos' ? <ProductosPage /> : null}
      {route === 'contingencia' ? <ContingenciaPage navigate={navigate} /> : null}
      {route === 'historial' ? <HistorialPage navigate={navigate} /> : null}
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Aplicacion />
      </ToastProvider>
    </StoreProvider>
  );
}
