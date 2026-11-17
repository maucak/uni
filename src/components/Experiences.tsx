import { useState, type FormEvent } from "react";
import { AuthorMeta } from "./AuthorMeta";
import { EyeOff } from "lucide-react";
import { isModerator } from "../lib/roles";
import { Link } from "react-router-dom";
import { ThumbsUp, Pencil, Trash2, X } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { api, json } from "../lib/api";
import { Loading, ErrorBox, Empty } from "./ui";
import {
  experienceLabel,
  experienceTopicLabels,
  experienceTopics,
  type Community,
  type Experience,
  type ExperienceTopic,
} from "../../shared/contracts";
type Draft = Pick<Experience, "topic" | "experienceYear" | "title" | "body">;
function ExperienceForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Draft;
  busy: boolean;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  const thisYear = new Date().getFullYear();
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          topic: f.get("topic") as ExperienceTopic,
          experienceYear: Number(f.get("experienceYear")),
          title: String(f.get("title")),
          body: String(f.get("body")),
        });
      }}
    >
      <div className="form-grid">
        <label>
          Konu
          <select name="topic" defaultValue={initial?.topic || "ders"}>
            {experienceTopics.map((t) => (
              <option key={t} value={t}>
                {experienceTopicLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Deneyim yılı
          <input
            name="experienceYear"
            type="number"
            min={1990}
            max={thisYear}
            required
            defaultValue={initial?.experienceYear || thisYear}
          />
        </label>
      </div>
      <label>
        Başlık
        <input
          name="title"
          required
          minLength={5}
          maxLength={180}
          defaultValue={initial?.title}
          placeholder="Örneğin: Hazırlık yılında seviye sınavı"
        />
      </label>
      <label>
        Deneyimin
        <textarea
          name="body"
          required
          minLength={30}
          maxLength={8000}
          rows={6}
          defaultValue={initial?.body}
          placeholder="Ne yaşadın, ne zaman ve hangi koşullarda? Kendi deneyimini anlat; resmi bilgi için kaynağı göster."
        />
      </label>
      <p className="form-hint">
        Deneyimin "öğrenci deneyimi · yıl" etiketiyle, resmi bilgiden ayrı
        gösterilir.
      </p>
      <div className="hero-actions">
        <button className="button dark" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
export default function Experiences({ community }: { community: Community }) {
  const { user } = useStore();
  const { data, loading, error, reload } = useLoad<Experience[]>(
    `/experiences?communityId=${community.id}`,
  );
  const [compose, setCompose] = useState(false),
    [editing, setEditing] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const canWrite =
    user?.profile.role === "student" || user?.profile.role === "graduate";
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError("");
    try {
      await action();
      reload();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Deneyimler</h2>
        {!user ? (
          <Link className="text-button" to="/giris">
            Deneyim yazmak için giriş yap
          </Link>
        ) : canWrite ? (
          <button className="button" onClick={() => setCompose(!compose)}>
            Deneyim yaz
          </button>
        ) : (
          <Link className="text-button" to="/profil">
            Deneyim yazmak için profilinde öğrenci veya mezun olduğunu belirt
          </Link>
        )}
      </div>
      {actionError && <ErrorBox message={actionError} />}
      {compose && (
        <section className="panel compose-panel">
          <div className="section-heading">
            <h2>{community.name} için deneyimini paylaş.</h2>
            <button
              className="icon-button"
              aria-label="Deneyim formunu kapat"
              onClick={() => setCompose(false)}
            >
              <X size={20} />
            </button>
          </div>
          <ExperienceForm
            busy={busy}
            onCancel={() => setCompose(false)}
            onSubmit={async (d) => {
              if (
                await run(() =>
                  api(
                    "/experiences",
                    json("POST", { ...d, communityId: community.id }),
                  ),
                )
              )
                setCompose(false);
            }}
          />
        </section>
      )}
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !data?.length ? (
        <Empty title="Henüz deneyim paylaşılmadı.">
          <p>
            Burada yalnızca gerçek öğrenci ve mezunların yazdığı deneyimler
            görünür.
          </p>
        </Empty>
      ) : (
        <div className="answer-list">
          {data.map((e) => (
            <article className="panel" key={e.id}>
              <div className="tags">
                <span className="data-badge sample">
                  {experienceLabel(e.authorStatus, e.experienceYear)}
                </span>
                <span>{experienceTopicLabels[e.topic]}</span>
              </div>
              {editing === e.id ? (
                <ExperienceForm
                  initial={e}
                  busy={busy}
                  onCancel={() => setEditing("")}
                  onSubmit={async (d) => {
                    if (
                      await run(() =>
                        api(`/experiences/${e.id}`, json("PUT", d)),
                      )
                    )
                      setEditing("");
                  }}
                />
              ) : (
                <>
                  <h3>{e.title}</h3>
                  <p className="user-content">{e.body}</p>
                  <p className="quiet">
                    {e.author} <AuthorMeta meta={e} /> ·{" "}
                    {new Date(e.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                  <div className="hero-actions">
                    <button
                      className={`text-button ${e.voted ? "selected" : ""}`}
                      disabled={!user || e.mine || busy}
                      onClick={() =>
                        run(() =>
                          api(`/experiences/${e.id}/vote`, {
                            method: e.voted ? "DELETE" : "PUT",
                          }),
                        )
                      }
                    >
                      <ThumbsUp size={16} /> Faydalı ({e.votes})
                    </button>
                    {e.mine && (
                      <>
                        <button
                          className="text-button"
                          onClick={() => setEditing(e.id)}
                        >
                          <Pencil size={16} /> Düzenle
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            confirm("Deneyim silinsin mi?") &&
                            run(() =>
                              api(`/experiences/${e.id}`, {
                                method: "DELETE",
                              }),
                            )
                          }
                        >
                          <Trash2 size={16} /> Sil
                        </button>
                      </>
                    )}
                    {!e.mine && isModerator(user) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          confirm("Deneyim gizlensin mi?") &&
                          run(() =>
                            api(
                              `/moderation/experiences/${e.id}`,
                              json("PUT", { status: "hidden" }),
                            ),
                          )
                        }
                      >
                        <EyeOff size={16} /> Gizle
                      </button>
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="aside-note">
        Deneyimler kişisel beyandır; resmi bilgi yerine geçmez. Kesin bilgi için
        üniversitenin ve ÖSYM'nin kaynaklarına bakın.
      </div>
    </>
  );
}
