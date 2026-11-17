import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { ErrorBox, Loading, PageHeading } from "../components/ui";

type Request = {
  id: string;
  claim: "student" | "graduate";
  method: "institution_email" | "document";
  university: string;
  program: string | null;
  institutionEmail: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  decisionNote: string | null;
  createdAt: string;
};
type Options = {
  universities: { id: string; name: string; domains: string[] }[];
  programs: { id: string; name: string }[];
};
export const statusText: Record<Request["status"], string> = {
  pending: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  revoked: "Kaldırıldı",
};
export const claimText = { student: "Öğrenci", graduate: "Mezun" };
export const methodText = {
  institution_email: "Kurumsal e-posta",
  document: "Belge",
};

function Confirm({ token }: { token: string }) {
  const [state, setState] = useState<"busy" | "done" | "error">("busy"),
    [message, setMessage] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ message: string }>(
      `/verifications/confirm?token=${encodeURIComponent(token)}`,
    )
      .then((r) => {
        setMessage(r.message);
        setState("done");
      })
      .catch((e) => {
        setMessage((e as Error).message);
        setState("error");
      });
  }, [token]);
  return (
    <section className="panel">
      <h2>Kurumsal e-posta onayı</h2>
      {state === "busy" && <Loading />}
      {state === "error" && <ErrorBox message={message} />}
      {state === "done" && <p role="status">{message}</p>}
      <Link to="/dogrulama">Doğrulama sayfasına dön</Link>
    </section>
  );
}

function ApplyForm({ onDone }: { onDone: () => void }) {
  const [universityId, setUniversityId] = useState(""),
    [programId, setProgramId] = useState(""),
    [claim, setClaim] = useState<"student" | "graduate">("student"),
    [method, setMethod] = useState<"institution_email" | "document">(
      "institution_email",
    ),
    [email, setEmail] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const options = useLoad<Options>(
    `/verifications/options${universityId ? `?universityId=${universityId}` : ""}`,
  );
  const university = options.data?.universities.find(
    (u) => u.id === universityId,
  );
  const emailPossible = claim === "student" && !!university?.domains.length;
  const activeMethod = emailPossible ? method : "document";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (activeMethod === "institution_email") {
        await api(
          "/verifications",
          json("POST", {
            method: "institution_email",
            claim,
            universityId,
            institutionEmail: email,
          }),
        );
        setMessage(
          `${email} adresine bir onay bağlantısı gönderildi. Bağlantı 24 saat geçerli.`,
        );
      } else {
        if (!file) throw new Error("Bir belge seç.");
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Belge en fazla 5 MB olabilir.");
        const query = new URLSearchParams({ claim, universityId });
        if (programId) query.set("programId", programId);
        await api(`/verifications?${query}`, {
          method: "POST",
          body: file,
          headers: { "Content-Type": "application/octet-stream" },
        });
        setMessage("Belgen yüklendi. İnceleme sonucunu bu sayfada görürsün.");
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Yeni başvuru</h2>
      <form className="form-grid" onSubmit={submit}>
        <label>
          İddia
          <select
            value={claim}
            onChange={(e) => setClaim(e.target.value as typeof claim)}
          >
            <option value="student">Bu üniversitede öğrenciyim</option>
            <option value="graduate">Bu üniversiteden mezunum</option>
          </select>
        </label>
        <label>
          Üniversite
          <select
            value={universityId}
            required
            onChange={(e) => {
              setUniversityId(e.target.value);
              setProgramId("");
            }}
          >
            <option value="">Seç</option>
            {options.data?.universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Yöntem
          <select
            value={activeMethod}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            {emailPossible && (
              <option value="institution_email">Kurumsal e-posta</option>
            )}
            <option value="document">Belge yükle (PDF, JPEG, PNG)</option>
          </select>
        </label>
        {activeMethod === "institution_email" ? (
          <label>
            Kurumsal e-posta
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`ad@${university?.domains[0] || ""}`}
            />
          </label>
        ) : (
          <>
            <label>
              Bölüm (isteğe bağlı)
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={!universityId}
              >
                <option value="">Yalnızca üniversite</option>
                {options.data?.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Belge
              <input
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </>
        )}
        <p className="form-hint">
          Kurumsal e-posta yalnızca üniversite düzeyinde öğrencilik kanıtıdır;
          kayıtlı alan adı olmayan üniversiteler, bölüm ve mezuniyet için belge
          gerekir. Belgeni yalnızca inceleyiciler görür ve karardan 30 gün sonra
          silinir.
        </p>
        <button className="button dark" disabled={busy || !universityId}>
          {busy ? "Gönderiliyor…" : "Başvur"}
        </button>
      </form>
      {error && <ErrorBox message={error} />}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export default function Verification() {
  const token = useSearchParams()[0].get("token") || "";
  const { user } = useStore();
  const mine = useLoad<Request[]>("/verifications/mine");
  if (token) return <Confirm token={token} />;
  if (!user)
    return (
      <section className="panel">
        <h2>Öğrenci veya mezun doğrulaması</h2>
        <p>
          Başvurmak için <Link to="/giris">giriş yap</Link>.
        </p>
      </section>
    );
  const items = Array.isArray(mine.data) ? mine.data : [];
  return (
    <div className="reading-width">
      <PageHeading
        eyebrow="Doğrulama"
        title="Öğrenci veya mezun olduğunu doğrula."
        description="Onaylanan başvuru, yazdıklarında adının yanında kapsamı açık bir rozet olarak görünür. Profildeki beyan rozet vermez."
      />
      {!user.emailVerified ? (
        <ErrorBox message="Başvurmadan önce hesabının e-posta adresini doğrulamalısın." />
      ) : (
        <ApplyForm onDone={mine.reload} />
      )}
      <section className="panel">
        <h2>Başvurularım</h2>
        {mine.loading && <Loading />}
        {mine.error && <ErrorBox message={mine.error} retry={mine.reload} />}
        {!mine.loading && !items.length && (
          <p className="quiet">Henüz başvurun yok.</p>
        )}
        <div className="verification-list">
          {items.map((r) => (
            <article className="verification-item" key={r.id}>
              <span className={`status-pill ${r.status}`}>
                {statusText[r.status]}
              </span>
              <strong>
                {claimText[r.claim]} · {r.university}
                {r.program ? ` · ${r.program}` : ""}
              </strong>
              <small className="quiet">
                {methodText[r.method]}
                {r.institutionEmail ? ` (${r.institutionEmail})` : ""} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("tr-TR")}
              </small>
              {r.decisionNote && <p>Not: {r.decisionNote}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
