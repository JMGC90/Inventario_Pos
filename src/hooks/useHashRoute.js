import { useCallback, useEffect, useState } from 'react';
import { RUTAS } from '../lib/constants.js';

function leerRuta() {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  return RUTAS.includes(hash) ? hash : 'caja';
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => leerRuta());

  useEffect(() => {
    const onHashChange = () => setRoute(leerRuta());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/caja');
    }
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next) => {
    const ruta = RUTAS.includes(next) ? next : 'caja';
    if (window.location.hash === `#/${ruta}`) {
      setRoute(ruta);
    } else {
      window.location.hash = `#/${ruta}`;
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return [route, navigate];
}
