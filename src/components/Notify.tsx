import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Sev = 'success' | 'error' | 'info' | 'warning';
const Ctx = createContext<(msg: string, sev?: Sev) => void>(() => undefined);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; sev: Sev; key: number } | null>(null);
  const notify = useCallback((msg: string, sev: Sev = 'success') => setState({ msg, sev, key: Date.now() }), []);
  return (
    <Ctx.Provider value={notify}>
      {children}
      <Snackbar
        key={state?.key}
        open={!!state}
        autoHideDuration={4500}
        onClose={() => setState(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={state?.sev ?? 'info'} variant="filled" onClose={() => setState(null)}>
          {state?.msg}
        </Alert>
      </Snackbar>
    </Ctx.Provider>
  );
}

export const useNotify = () => useContext(Ctx);
