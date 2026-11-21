/** Who is signed in (or a guest), shared across pages. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Creator, User } from '../core/types';
import { api } from './api';

interface SessionValue {
  user: User | null;
  creator: Creator | null;
  loading: boolean;
  tenant: string | null;
  google: 'mock' | 'google';
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ user: null, creator: null, loading: true, tenant: null, google: 'mock', refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<SessionValue, 'refresh'>>({ user: null, creator: null, loading: true, tenant: null, google: 'mock' });

  const refresh = useCallback(async () => {
    try {
      const [me, cfg] = await Promise.all([api.me(), api.config()]);
      setState({ user: me.user, creator: me.creator, loading: false, tenant: cfg.tenant, google: cfg.google });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
