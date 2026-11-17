import { useState, type FormEvent } from "react";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { ErrorBox } from "./ui";

export function PasswordChange() {
  const { notify } = useStore();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = e.currentTarget;
    const d = new FormData(form);
    try {
      if (d.get("newPassword") !== d.get("confirm"))
        throw new Error("Yeni parolalar eşleşmiyor.");
      const r = await api<{ message: string }>(
        "/me/password",
        json("PUT", {
          currentPassword: d.get("currentPassword"),
          newPassword: d.get("newPassword"),
        }),
      );
      form.reset();
      notify(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Parola değiştir</h2>
          <p>Değişiklikten sonra diğer cihazlardaki oturumların kapatılır.</p>
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <form className="form-grid" onSubmit={submit}>
        <label>
          Mevcut parolan
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          Yeni parolan
          <input
            name="newPassword"
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
        <div>
          <button className="button dark" disabled={busy}>
            {busy ? "Kaydediliyor…" : "Parolayı değiştir"}
          </button>
        </div>
      </form>
    </section>
  );
}
