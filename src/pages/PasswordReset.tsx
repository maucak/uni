import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { ErrorBox } from "../components/ui";

export default function PasswordReset() {
  const token = useSearchParams()[0].get("token");
  const { setUser } = useStore();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const d = new FormData(e.currentTarget);
    try {
      if (token) {
        if (d.get("password") !== d.get("confirm"))
          throw new Error("Parolalar eşleşmiyor.");
        const r = await api<{ message: string }>(
          "/auth/password/reset",
          json("POST", { token, password: d.get("password") }),
        );
        setUser(null);
        setMessage(r.message);
      } else {
        const r = await api<{ message: string }>(
          "/auth/password/forgot",
          json("POST", { email: d.get("email") }),
        );
        setMessage(r.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-form">
      <h2>{token ? "Yeni parolanı belirle." : "Parolamı unuttum"}</h2>
      <p>
        {token
          ? "Parolan değişince açık olan bütün oturumların kapatılır."
          : "E-posta adresini yaz; kayıtlıysa 30 dakika geçerli bir sıfırlama bağlantısı gönderelim."}
      </p>
      {error && <ErrorBox message={error} />}
      {message ? (
        <p role="status">{message}</p>
      ) : (
        <form onSubmit={submit}>
          {token ? (
            <>
              <label>
                Yeni parolan
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  placeholder="En az 10 karakter"
                />
              </label>
              <label>
                Yeni parolan (tekrar)
                <input
                  name="confirm"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          ) : (
            <label>
              E-posta adresin
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="ornek@eposta.com"
              />
            </label>
          )}
          <button className="button dark full" disabled={busy}>
            {busy
              ? "İşlem yapılıyor…"
              : token
                ? "Parolayı değiştir"
                : "Bağlantı gönder"}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/giris">Giriş sayfasına dön</Link>
      </p>
    </section>
  );
}
