import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { ErrorBox, Loading } from "../components/ui";
import type { User } from "../../shared/contracts";

export default function VerifyEmail() {
  const token = useSearchParams()[0].get("token") || "";
  const { setUser } = useStore();
  const [state, setState] = useState<"busy" | "done" | "error">("busy"),
    [message, setMessage] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ message: string }>("/auth/verify-email", json("POST", { token }))
      .then(async (r) => {
        setMessage(r.message);
        setState("done");
        setUser(await api<User | null>("/me"));
      })
      .catch((e) => {
        setMessage((e as Error).message);
        setState("error");
      });
  }, [token, setUser]);
  return (
    <section className="auth-form">
      <h2>E-posta doğrulama</h2>
      {state === "busy" && <Loading />}
      {state === "error" && <ErrorBox message={message} />}
      {state === "done" && <p role="status">{message}</p>}
      {state !== "busy" && (
        <p className="auth-switch">
          {state === "error"
            ? "Giriş yaptıktan sonra üstteki banttan yeni bağlantı isteyebilirsin. "
            : ""}
          <Link to="/profil">Profiline git</Link>
        </p>
      )}
    </section>
  );
}
