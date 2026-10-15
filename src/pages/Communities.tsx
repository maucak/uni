import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Users, MessageCircle, ArrowUpRight, Plus, X } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { api, json } from "../lib/api";
import { PageHeading, Loading, ErrorBox, Empty } from "../components/ui";
import type { Community, Question } from "../../shared/contracts";
export default function Communities() {
  const { user } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const programId = params.get("programId") || "";
  const search = params.get("search") || "";
  const tag = params.get("tag") || "";
  const [communitySearch, setCommunitySearch] = useState("");
  const [communityLimit, setCommunityLimit] = useState(12);
  const { data: communities, error: communityError } = useLoad<Community[]>(
    `/communities?${new URLSearchParams({ ...(programId ? { programId } : {}), ...(params.get("communityId") ? { communityId: params.get("communityId")! } : {}), search: communitySearch, limit: String(communityLimit) })}`,
  );
  const visibleCommunities = communities;
  const communityId =
    params.get("communityId") ||
    (programId ? communities?.[0]?.id || programId : "");
  const {
    data: questions,
    loading,
    error,
    reload,
  } = useLoad<Question[]>(
    `/questions?${new URLSearchParams({ ...(communityId ? { communityId } : {}), ...(search ? { search } : {}), ...(tag ? { tag } : {}) })}`,
  );
  const [compose, setCompose] = useState(false),
    [submitError, setSubmitError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const q = await api<{ id: string }>(
        "/questions",
        json("POST", {
          communityId: form.get("communityId"),
          title: form.get("title"),
          body: form.get("body"),
          tags: String(form.get("tags") || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      );
      navigate(`/sorular/${q.id}`);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BİRLİKTE ÖĞREN"
        title="Bir soru, yeni bir bakış açısı."
        description="Tercih döneminde ve kampüs yaşamında sorularını paylaş. Deneyimlerinle başkasının yoluna ışık tut."
        action={
          <button
            className="button dark"
            onClick={() => (user ? setCompose(!compose) : navigate("/giris"))}
          >
            <Plus size={17} /> Soru sor
          </button>
        }
      />
      {communityError && <ErrorBox message={communityError} />}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = new URLSearchParams(params);
          for (const key of ["search", "tag"]) {
            const value = String(f.get(key) || "").trim();
            if (value) next.set(key, value);
            else next.delete(key);
          }
          setParams(next);
        }}
      >
        <label>
          Sorularda ara
          <input
            name="search"
            defaultValue={search}
            maxLength={100}
            placeholder="Hazırlık, dersler, ulaşım…"
          />
        </label>
        <label>
          Konu etiketi
          <input
            name="tag"
            defaultValue={tag}
            maxLength={40}
            placeholder="Örneğin staj"
          />
        </label>
        <button className="button" type="submit">
          Ara
        </button>
        {programId && <Link to="/topluluklar">Tüm toplulukları aç</Link>}
      </form>
      <label>
        Topluluk bul
        <input
          value={communitySearch}
          onChange={(e) => {
            setCommunitySearch(e.target.value);
            setCommunityLimit(12);
          }}
          placeholder="Üniversite veya bölüm adı"
        />
      </label>
      <div className="community-grid">
        {visibleCommunities?.slice(0, communityLimit).map((c, i) => (
          <button
            className={`community-card ${c.id === communityId ? "active" : ""}`}
            key={c.id}
            onClick={() =>
              setParams({
                ...(programId ? { programId } : {}),
                ...(c.id === communityId ? {} : { communityId: c.id }),
              })
            }
          >
            <span className={`community-icon tone-${i}`}>
              <Users size={23} />
            </span>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <div>
              <span>{c.questionCount} soru</span>
              <ArrowUpRight size={18} />
            </div>
          </button>
        ))}
      </div>
      {(visibleCommunities?.length ?? 0) === communityLimit &&
        communityLimit < 500 && (
          <button
            className="button"
            onClick={() => setCommunityLimit((n) => Math.min(500, n + 12))}
          >
            Daha fazla topluluk göster
          </button>
        )}
      {compose && (
        <section className="panel compose-panel">
          <div className="section-heading">
            <h2>Topluluğa sor.</h2>
            <button
              className="icon-button"
              aria-label="Soru formunu kapat"
              onClick={() => setCompose(false)}
            >
              <X size={20} />
            </button>
          </div>
          {submitError && <ErrorBox message={submitError} />}
          <form onSubmit={submit}>
            <label>
              Topluluk
              <select
                key={communityId}
                name="communityId"
                defaultValue={communityId || communities?.[0]?.id}
                required
              >
                {communities?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sorunun başlığı
              <input
                name="title"
                required
                minLength={10}
                maxLength={180}
                placeholder="Sorunu kısa ve açık biçimde yaz."
              />
            </label>
            <label>
              Ayrıntılar
              <textarea
                name="body"
                required
                minLength={20}
                maxLength={5000}
                rows={5}
                placeholder="Hangi konuda yardım istiyorsun? Şimdiye kadar neleri araştırdın?"
              />
            </label>
            <label>
              Konu etiketleri
              <input
                name="tags"
                maxLength={204}
                placeholder="staj, hazırlık, ulaşım (en fazla 5)"
              />
            </label>
            <button
              className="button dark"
              disabled={busy || !communities?.length}
            >
              {busy ? "Paylaşılıyor…" : "Soruyu paylaş"}
            </button>
          </form>
        </section>
      )}
      <div className="section-heading">
        <h2>{communityId ? "Topluluğun soruları" : "Son sorular"}</h2>
        {communityId && (
          <button className="text-button" onClick={() => setParams({})}>
            Tümünü göster
          </button>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !questions?.length ? (
        <Empty title="İlk soruyu sen sorabilirsin.">
          <p>
            Burada gerçek kullanıcıların içerikleri gösterilecek; sahte öğrenci
            deneyimleri bulunmuyor.
          </p>
        </Empty>
      ) : (
        <div className="question-list">
          {questions.map((q) => (
            <Link className="question-card" key={q.id} to={`/sorular/${q.id}`}>
              <div className="question-count">
                <MessageCircle size={20} />
                <strong>{q.answerCount}</strong>
                <small>yanıt</small>
              </div>
              <div>
                <span className="badge">{q.communityName}</span>
                <div className="tags">
                  {q.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <h3>{q.title}</h3>
                <p>
                  {q.body.slice(0, 150)}
                  {q.body.length > 150 ? "…" : ""}
                </p>
                <small>
                  {q.author} ·{" "}
                  {new Date(q.createdAt).toLocaleDateString("tr-TR")}
                </small>
              </div>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      )}
      <div className="aside-note">
        Program toplulukları kaynaklı katalog kayıtlarına bağlıdır. İçerikler
        kullanıcı beyanıdır; öğrenci/mezun doğrulaması ve moderasyon henüz
        tamamlanmadı.
      </div>
    </>
  );
}
