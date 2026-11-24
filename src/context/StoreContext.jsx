import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import * as model from '../lib/model.js';
import { loadState, resetStoredState, saveState } from '../lib/storage.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => loadState());
  const [storageOk, setStorageOk] = useState(true);
  const stateRef = useRef(state);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    const ok = saveState(next);
    if (!ok) setStorageOk(false);
  }, []);

  const actions = useMemo(
    () => ({
      registrarVenta(items) {
        const { state: next, sale } = model.registrarVenta(stateRef.current, items);
        commit(next);
        return sale;
      },
      crearHoja() {
        const { state: next, hoja } = model.crearHojaContingencia(stateRef.current);
        commit(next);
        return hoja;
      },
      aplicarContingencia(hojaId, items) {
        const resultado = model.aplicarContingencia(stateRef.current, hojaId, items);
        commit(resultado.state);
        return resultado;
      },
      addProduct(input) {
        const { state: next, product } = model.addProduct(stateRef.current, input);
        commit(next);
        return product;
      },
      updateProduct(codigo, input) {
        const { state: next, product } = model.updateProduct(stateRef.current, codigo, input);
        commit(next);
        return product;
      },
      removeProduct(codigo) {
        const next = model.removeProduct(stateRef.current, codigo);
        commit(next);
      },
      setNegocio(nombre) {
        const next = model.setNegocioNombre(stateRef.current, nombre);
        commit(next);
      },
      resetDemo() {
        const next = resetStoredState();
        stateRef.current = next;
        setState(next);
        saveState(next);
      },
    }),
    [commit],
  );

  const value = useMemo(
    () => ({ state, actions, storageOk }),
    [state, actions, storageOk],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore debe usarse dentro de StoreProvider');
  return context;
}
