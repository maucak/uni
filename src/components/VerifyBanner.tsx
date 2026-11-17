import { useState } from "react";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";

export function VerifyBanner() {
  const { user } = useStore();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;
  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ message: string }>(
        "/auth/verify-email/resend",
        json("POST", {}),
      );
      setMessage(r.message);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sample-notice" role="status">
      <span className="dot" />
      <span>
        E-posta adresin ({user.email}) henüz doğrulanmadı. Gelen kutundaki
        bağlantıyı aç.
      </span>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={resend}
      >
        {busy ? "Gönderiliyor…" : "Bağlantıyı tekrar gönder"}
      </button>
      {message && <span>{message}</span>}
    </div>
  );
}
