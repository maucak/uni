import { useState } from "react";
import { Link } from "react-router-dom";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { ErrorBox, Loading, PageHeading } from "../components/ui";
import type { MentorProfile, MentorshipRequest } from "../../shared/mentorship";

const statusLabels = {
  pending: "Yanıt bekliyor",
  accepted: "Kabul edildi",
  declined: "Reddedildi",
  cancelled: "İptal edildi",
  completed: "Tamamlandı",
};
function ProfileForm({
  value,
  onSaved,
}: {
  value: MentorProfile;
  onSaved: () => void;
}) {
  const [bio, setBio] = useState(value.profile?.bio ?? "");
  const [topics, setTopics] = useState(value.profile?.topics.join(", ") ?? "");
  const [universityId, setUniversityId] = useState(
    value.profile?.universityId ?? value.universities[0]?.id ?? "",
  );
  const [accepting, setAccepting] = useState(value.profile?.accepting ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!value.eligible && !value.profile)
    return (
      <p>
        Mentor profili için{" "}
        <Link to="/dogrulama">öğrenci veya mezun doğrulamanı</Link> tamamla.
      </p>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
          await api(
            "/mentor-profile",
            json("PUT", {
              bio,
              topics: topics
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              universityId: universityId || null,
              accepting,
            }),
          );
          setNotice("Profilin kaydedildi.");
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorBox message={error} />}
      {notice && <p role="status">{notice}</p>}
      {!value.eligible && (
        <p>Doğrulaman aktif değil. Profilini talep alımına kapatabilirsin.</p>
      )}
      <label>
        Üniversite
        <select
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
          disabled={!value.eligible}
        >
          <option value="">Seçiniz</option>
          {value.universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kısa tanıtım
        <textarea
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label>
        Konular (virgülle ayır)
        <input value={topics} onChange={(e) => setTopics(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={accepting}
          disabled={!value.eligible && !accepting}
          onChange={(e) => setAccepting(e.target.checked)}
        />{" "}
        Yeni talep kabul ediyorum
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Kaydediliyor…" : "Profili kaydet"}
      </button>
    </form>
  );
}
export default function Mentorship() {
  const [box, setBox] = useState<"incoming" | "outgoing">("incoming");
  const profile = useLoad<MentorProfile>("/mentor-profile/me");
  const requests = useLoad<MentorshipRequest[]>(
    `/mentorship-requests?box=${box}`,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(id: string, action: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/mentorship-requests/${id}`, json("PUT", { action }));
      requests.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MENTORLUK"
        title="Mentorluk alanım"
        description="Profilini ve destek taleplerini yönet."
      />
      <p>
        <Link to="/mentorlar">Mentorları keşfet</Link>
      </p>
      <section className="mentorship-card">
        <h2>Mentor profilim</h2>
        {profile.loading ? (
          <Loading />
        ) : profile.error ? (
          <ErrorBox message={profile.error} retry={profile.reload} />
        ) : (
          profile.data && (
            <ProfileForm value={profile.data} onSaved={profile.reload} />
          )
        )}
      </section>
      <label>
        Talepler
        <select
          value={box}
          onChange={(e) => setBox(e.target.value as typeof box)}
        >
          <option value="incoming">Gelen talepler</option>
          <option value="outgoing">Gönderdiğim talepler</option>
        </select>
      </label>
      {error && <ErrorBox message={error} />}
      {requests.loading ? (
        <Loading />
      ) : requests.error ? (
        <ErrorBox message={requests.error} retry={requests.reload} />
      ) : (
        <div className="mentorship-grid">
          {!requests.data?.length && (
            <p className="empty">Bu kutuda talep yok.</p>
          )}
          {requests.data?.map((r) => (
            <article className="mentorship-card" key={r.id}>
              <h2>{r.topic}</h2>
              <p>
                {r.other.displayName} · {statusLabels[r.status]}
              </p>
              <p>{r.message}</p>
              <small>{new Date(r.createdAt).toLocaleString("tr-TR")}</small>
              <div className="mentorship-actions">
                {r.status === "pending" &&
                  (box === "incoming" ? (
                    <>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => act(r.id, "accept")}
                      >
                        Kabul et
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => act(r.id, "decline")}
                      >
                        Reddet
                      </button>
                    </>
                  ) : (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => act(r.id, "cancel")}
                    >
                      İptal et
                    </button>
                  ))}
                {r.status === "accepted" && (
                  <>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => act(r.id, "complete")}
                    >
                      Tamamlandı olarak işaretle
                    </button>
                    <span>Mesajlaşma yakında</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
