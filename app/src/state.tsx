import { createContext, useContext, useEffect, useReducer, useState, useSyncExternalStore, type ReactNode } from "react";
import { reducer, type Action } from "./domain/store";
import { seed } from "./domain/seed";
import type { State } from "./domain/types";

const KEY = "occ-demo-v2";

// Browser storage is a convenience for the demo; the page must work without it.
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* storage blocked or corrupt: start fresh */ }
  return seed();
}

interface Ctx { state: State; dispatch: (a: Action) => void; toast: (msg: string) => void }
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <StoreCtx.Provider value={{ state, dispatch, toast: setMsg }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

// Hash routing: #/cases/c-1042 etc. Only plain tokens survive in some hosts, so
// unknown hashes fall back to the dashboard.
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}
export const go = (path: string) => { window.location.hash = path; window.scrollTo(0, 0); };
