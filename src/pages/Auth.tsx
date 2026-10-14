import { DevLogin } from "../components/DevLogin";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { ErrorBox } from "../components/ui";
import type { User } from "../../shared/contracts";
export default function Auth() {
  const register = useLocation().pathname === "/kayit";
  const { setUser } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const d = new FormData(e.currentTarget);
    try {
      const user = await api<User>(
        `/auth/${register ? "register" : "login"}`,
        json("POST", {
          email: d.get("email"),
          password: d.get("password"),
          ...(register ? { displayName: d.get("name") } : {}),
        }),
      );
      setUser(user);
      navigate(register ? "/profil" : "/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Compass size={45} />
        <span className="eyebrow">KENDİ YOLUNU BUL</span>
        <h1>
          Bir tercih listesinden
          <br />
          daha fazlası.
        </h1>
        <p>
          İlgi alanlarını keşfet, seçeneklerini karşılaştır ve üniversite
          yolculuğuna kendi önceliklerinle başla.
        </p>
        <div className="auth-quote">
          “Aynı sıralama, aynı hayaller demek değildir.”
        </div>
      </div>
      <section className="auth-form">
        <h2>{register ? "Yolculuğuna başla." : "Tekrar hoş geldin."}</h2>
        <p>
          {register
            ? "Kişisel çalışma alanını oluştur."
            : "Tercih listelerin ve önceliklerin seni bekliyor."}
        </p>
        <DevLogin />
        {error && <ErrorBox message={error} />}
        <form onSubmit={submit}>
          {register && (
            <label>
              Adın ve soyadın
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                placeholder="Ad Soyad"
              />
            </label>
          )}
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
          <label>
            Parolan
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              required
              placeholder="En az 10 karakter"
            />
          </label>
          <button className="button dark full" disabled={busy}>
            {busy
              ? "İşlem yapılıyor…"
              : register
                ? "Hesap oluştur"
                : "Giriş yap"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Zaten hesabın var mı?" : "İlk kez mi buradasın?"}{" "}
          <Link to={register ? "/giris" : "/kayit"}>
            {register ? "Giriş yap" : "Hesap oluştur"}
          </Link>
        </p>
        <small className="quiet">
          Geliştirme sürümü: e-posta doğrulama ve hesap kurtarma henüz
          eklenmedi. Gerçek öğrenci belgelerini bu sürüme yükleme.
        </small>
      </section>
    </div>
  );
}
