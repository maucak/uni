import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../../shared/contracts";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";

export function DevLogin() {
  const { setUser } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!import.meta.env.DEV) return null;
  return (
    <div>
      <button
        type="button"
        className="button full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setUser(await api<User>("/auth/dev-login", json("POST", {})));
            navigate("/profil");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Açılıyor…" : "Geliştirme hesabıyla devam et"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
