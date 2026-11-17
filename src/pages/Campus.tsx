import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search, MessageCircle, Check } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { api, json } from "../lib/api";
import { PageHeading, ErrorBox, Loading } from "../components/ui";
import { lifeSteps } from "../../shared/life-steps";
import type { LifeArticle } from "../../shared/life";
import type { User } from "../../shared/contracts";
type Guide = {
  campus: { name: string };
  items: LifeArticle[];
  knowledge: { chunks: number; sources: number };
};
export default function Campus() {
  const { user, setUser } = useStore();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState(""),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, error, loading } = useLoad<Guide>(
    `/life/guide?q=${encodeURIComponent(query)}&topic=${encodeURIComponent(topic)}`,
  );
  const completed = user?.profile.lifeSteps || [];
  async function toggle(id: (typeof lifeSteps)[number]["id"]) {
    if (!user || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      setUser(
        await api<User>(
          "/me/life-progress",
          json("PUT", {
            steps: completed.includes(id)
              ? completed.filter((s) => s !== id)
              : [...completed, id],
          }),
        ),
      );
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const different =
    !!user?.profile.university &&
    !/isparta uygulamalı|isub/i.test(user.profile.university);
  return (
    <>
      <PageHeading
        eyebrow="KAMPÜS YAŞAMI"
        title="Üniversite hayatına yer aç."
        description="İlk günlerinden günlük ihtiyaçlarına, aradığın bilgiye ulaş."
        action={
          <Link className="button light" to="/danisman">
            <MessageCircle size={17} /> Danışmana sor
          </Link>
        }
      />
      <div className="campus-context">
        <span>İSUBÜ · Isparta</span>
        <p>
          {different
            ? "Profilindeki üniversite için henüz rehber yok. İSUBÜ rehberini inceliyorsun."
            : "Üniversiteye özel bilgiler İSUBÜ kapsamındadır. Barınma kaynakları Türkiye genelini kapsar."}
        </p>
      </div>
      <section className="start-panel">
        <details>
          <summary>
            <span>
              <Check size={18} /> İlk günler kontrol listem
            </span>
            <small>
              {completed.length} / {lifeSteps.length}
            </small>
          </summary>
          <p>
            Bu liste kişisel hazırlığın içindir; resmî kayıt durumunu
            doğrulamaz.
          </p>
          {saveError && <ErrorBox message={saveError} />}
          <div className="start-checklist">
            {lifeSteps.map((step) => (
              <div key={step.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={completed.includes(step.id)}
                    disabled={!user || saving}
                    onChange={() => void toggle(step.id)}
                  />
                  {step.title}
                </label>
                <a
                  href={step.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${step.title} için resmî sayfa`}
                >
                  <ArrowUpRight size={16} />
                </a>
              </div>
            ))}
          </div>
          {!user && (
            <p>
              <Link to="/giris">İlerlemeni kaydetmek için giriş yap.</Link>
            </p>
          )}
        </details>
      </section>
      <section className="guide-library">
        <div className="section-heading">
          <div>
            <h2>Yaşam rehberi</h2>
            <p className="quiet">Resmî kaynaklar, açık bilgiler.</p>
          </div>
        </div>
        <div className="guide-search">
          <label>
            <Search size={18} />
            <input
              aria-label="Yaşam rehberinde ara"
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Örneğin yurt başvurusu veya yemekhane"
            />
          </label>
          <select
            aria-label="Konu seç"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">Bütün konular</option>
            {[
              "İlk günler",
              "Hazırlık",
              "Barınma",
              "Yemek ve destek",
              "Ulaşım",
              "Kampüs yaşamı",
              "Öğrenci işlemleri",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {!loading && data && (
          <div className="guide-list">
            {data.items.map((a) => (
              <details key={a.id} className="guide-item">
                <summary>
                  <span>
                    <small>{a.topic}</small>
                    {a.title}
                  </span>
                </summary>
                <div>
                  <p>{a.text}</p>
                  {a.period && <p className="life-period">{a.period}</p>}
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.sourceTitle} <ArrowUpRight size={14} />
                  </a>
                  <small>
                    Kontrol: {a.checkedAt} ·{" "}
                    {a.scope === "national" ? "Türkiye geneli" : "İSUBÜ"} ·{" "}
                    {a.period || "Kaynakta dönem belirtilmiyor"}
                  </small>
                </div>
              </details>
            ))}
            {!data.items.length && (
              <p className="empty">
                Bu konuda kaynak bulunamadı. Başka bir kelimeyle arayabilirsin.
              </p>
            )}
          </div>
        )}
      </section>
      <div className="campus-help" id="danisman">
        <MessageCircle size={22} />
        <div>
          <h3>Aradığın cevabı bulamadın mı?</h3>
          <p>Sorunu yaz, rehberdeki kaynakları birlikte inceleyelim.</p>
        </div>
        <Link className="button light" to="/danisman">
          Danışmana sor <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
