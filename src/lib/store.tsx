import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../../shared/contracts";
import { api, json } from "./api";
type State = {
  user: User | null;
  loading: boolean;
  error: string;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
  compare: string[];
  toggleCompare: (id: string) => void;
  notice: string;
  notify: (text: string) => void;
};
const Store = createContext<State>(null!);
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [compare, setCompare] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("compare") || "[]");
    } catch {
      return [];
    }
  });
  const [notice, notify] = useState("");
  useEffect(() => {
    api<User | null>("/me")
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    sessionStorage.setItem("compare", JSON.stringify(compare));
  }, [compare]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  async function logout() {
    await api("/auth/logout", json("POST", {}));
    setUser(null);
  }
  function toggleCompare(id: string) {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        notify("En fazla 4 programı karşılaştırabilirsin.");
        return prev;
      }
      return [...prev, id];
    });
  }
  return (
    <Store.Provider
      value={{
        user,
        loading,
        error,
        setUser,
        logout,
        compare,
        toggleCompare,
        notice,
        notify,
      }}
    >
      {children}
    </Store.Provider>
  );
}
export const useStore = () => useContext(Store);
