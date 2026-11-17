import { useState } from "react";
import { Download } from "lucide-react";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { hasRole, isReviewer } from "../lib/roles";
import { ErrorBox, Loading, PageHeading } from "../components/ui";
import { claimText, methodText, statusText } from "./Verification";
import type { User } from "../../shared/contracts";

type Item = {
  id: string;
  claim: "student" | "graduate";
  method: "institution_email" | "document";
  university: string;
  program: string | null;
  institutionEmail: string | null;
  hasDocument: boolean;
  documentMime: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  decisionNote: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  mine: boolean;
};
const statuses = ["pending", "approved", "rejected", "revoked"] as const;

function ReviewCard({ item, onChange }: { item: Item; onChange: () => void }) {
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(action: "approve" | "reject" | "revoke") {
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/verifications/${item.id}`,
        json("PUT", { action, note }),
      );
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel verification-item">
      <span className={`status-pill ${item.status}`}>
        {statusText[item.status]}
      </span>
      <strong>
        {item.userName} ({item.userEmail})
      </strong>
      <span>
        {claimText[item.claim]} · {item.university}
        {item.program ? ` · ${item.program}` : ""}
      </span>
      <small className="quiet">
        {methodText[item.method]}
        {item.institutionEmail ? ` (${item.institutionEmail})` : ""} ·{" "}
        {new Date(item.createdAt).toLocaleString("tr-TR")}
      </small>
      {item.decisionNote && <p>Not: {item.decisionNote}</p>}
      {item.hasDocument && (
        <a
          className="text-button"
          href={`/api/v1/admin/verifications/${item.id}/document`}
          download
        >
          <Download size={16} /> Belgeyi indir
        </a>
      )}
      {item.mine ? (
        <p className="quiet">Kendi başvurunu inceleyemezsin.</p>
      ) : (
        (item.status === "pending" || item.status === "approved") && (
          <>
            <label>
              Not (ret ve kaldırmada zorunlu)
              <input
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="hero-actions">
              {item.status === "pending" && item.method === "document" && (
                <button
                  className="button dark"
                  disabled={busy}
                  onClick={() => decide("approve")}
                >
                  Onayla
                </button>
              )}
              {item.status === "pending" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => decide("reject")}
                >
                  Reddet
                </button>
              )}
              {item.status === "approved" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => decide("revoke")}
                >
                  Doğrulamayı kaldır
                </button>
              )}
            </div>
          </>
        )
      )}
      {error && <ErrorBox message={error} />}
    </article>
  );
}

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: User["roles"];
};
const roleText = {
  reviewer: "İnceleyici",
  moderator: "Moderatör",
  admin: "Yönetici",
} as const;
function RoleManager() {
  const [q, setQ] = useState("");
  const users = useLoad<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}`);
  const [error, setError] = useState("");
  async function toggle(u: AdminUser, role: keyof typeof roleText) {
    setError("");
    const roles = u.roles.includes(role)
      ? u.roles.filter((r) => r !== role)
      : [...u.roles, role];
    try {
      await api(`/admin/users/${u.id}/roles`, json("PUT", { roles }));
      users.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <h2>Yetki rolleri</h2>
      <label>
        Kullanıcı ara (e-posta veya ad)
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {error && <ErrorBox message={error} />}
      {users.loading && <Loading />}
      <div className="verification-list">
        {users.data?.map((u) => (
          <div className="verification-item" key={u.id}>
            <strong>
              {u.displayName} ({u.email})
            </strong>
            <div className="hero-actions">
              {(Object.keys(roleText) as (keyof typeof roleText)[]).map((r) => (
                <label className="checkbox-label" key={r}>
                  <input
                    type="checkbox"
                    checked={u.roles.includes(r)}
                    onChange={() => toggle(u, r)}
                  />
                  {roleText[r]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminVerification() {
  const { user } = useStore();
  const [status, setStatus] = useState<(typeof statuses)[number]>("pending");
  const reviewer = isReviewer(user);
  const queue = useLoad<Item[]>(`/admin/verifications?status=${status}`);
  if (!reviewer && !hasRole(user, "admin"))
    return (
      <ErrorBox message="Bu sayfa için inceleyici veya yönetici rolü gerekir." />
    );
  return (
    <div className="reading-width">
      <PageHeading
        eyebrow="Yönetim"
        title="Doğrulama inceleme kuyruğu"
        description="Belgeyi indirip kontrol et, kararını kısa bir notla kaydet. Belgeler karardan 30 gün sonra silinir."
      />
      <div className="list-tabs">
        {statuses.map((s) => (
          <button
            key={s}
            className={`text-button ${s === status ? "selected" : ""}`}
            onClick={() => setStatus(s)}
          >
            {statusText[s]}
          </button>
        ))}
      </div>
      {queue.loading && <Loading />}
      {queue.error && <ErrorBox message={queue.error} retry={queue.reload} />}
      {!queue.loading && !queue.data?.length && (
        <p className="quiet">Bu durumda başvuru yok.</p>
      )}
      <div className="verification-list">
        {queue.data?.map((item) => (
          <ReviewCard key={item.id} item={item} onChange={queue.reload} />
        ))}
      </div>
      {hasRole(user, "admin") && <RoleManager />}
    </div>
  );
}
