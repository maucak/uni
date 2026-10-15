import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowUpRight, Send, Search, MapPin } from "lucide-react";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { DevLogin } from "../components/DevLogin";
import { PageHeading, ErrorBox, Loading } from "../components/ui";
import type { LifeArticle, LifeAnswer } from "../../shared/life";
type Guide = {
  campus: { id: string; name: string; city: string };
  items: LifeArticle[];
};
export default function Campus() {
  const { user } = useStore();
  const { data, error, loading } = useLoad<Guide>("/life/guide");
  const [topic, setTopic] = useState("Hepsi"),
    [search, setSearch] = useState("");
  const [message, setMessage] = useState(""),
    [answer, setAnswer] = useState<LifeAnswer | null>(null),
    [busy, setBusy] = useState(false),
    [askError, setAskError] = useState("");
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setAskError("");
    setAnswer(null);
    try {
      setAnswer(
        await api<LifeAnswer>(
          "/life/ask",
          json("POST", { message, requestId: crypto.randomUUID() }),
        ),
      );
    } catch (e) {
      setAskError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items =
    data?.items.filter(
      (a) =>
        (topic === "Hepsi" || a.topic === topic) &&
        `${a.title} ${a.text} ${a.keywords.join(" ")}`
          .toLocaleLowerCase("tr")
          .includes(search.toLocaleLowerCase("tr")),
    ) || [];
  const differentCampus =
    !!user?.profile.university &&
    !/isparta|isub/i.test(user.profile.university);
  return (
    <>
      <PageHeading
        eyebrow="ÜNİVERSİTE HAYATIN"
        title="Yeni bir başlangıca yer aç."
        description="Kayıt, hazırlık ve kampüs yaşamı hakkında kaynaklı bilgiler. Üniversiteye yerleştikten sonra da yanındayız."
        action={
          <Link className="button light" to={user ? "/profil" : "/giris"}>
            Öğrenci profilim <ArrowUpRight size={16} />
          </Link>
        }
      />
      <section className="campus-scope panel">
        <MapPin size={24} />
        <div>
          <span className="eyebrow">İLK REHBER</span>
          <h2>
            {data?.campus.name || "Isparta Uygulamalı Bilimler Üniversitesi"}
          </h2>
          <p>
            {differentCampus
              ? "Profilindeki üniversite için henüz rehber bulunmuyor. Şu an İSUBÜ rehberini görüntülüyorsun."
              : "İSUBÜ başlangıç rehberi. Birim ve kampüs koşulları farklılaşabilir; kaynakları kendi programına göre kontrol et."}
          </p>
        </div>
      </section>
      <div className="life-quicklinks">
        <a href="https://obs.isparta.edu.tr/" target="_blank" rel="noreferrer">
          Öğrenci bilgi sistemi <ArrowUpRight size={16} />
        </a>
        <a href="https://oidb.isparta.edu.tr/" target="_blank" rel="noreferrer">
          Öğrenci işleri ve takvim <ArrowUpRight size={16} />
        </a>
        <a href="https://ydyo.isparta.edu.tr/" target="_blank" rel="noreferrer">
          Yabancı diller <ArrowUpRight size={16} />
        </a>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">İLK ADIMLARIN</span>
          <h2>İhtiyacın olan bilgiyi bul.</h2>
        </div>
      </div>
      <div className="life-tools">
        <label>
          <Search size={17} />
          <input
            aria-label="Rehberde ara"
            placeholder="OBS, hazırlık, ulaşım…"
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="life-topics">
          {["Hepsi", "İlk günler", "Hazırlık", "Ulaşım", "Kampüs yaşamı"].map(
            (t) => (
              <button
                type="button"
                className={`button ${topic === t ? "dark" : "light"}`}
                key={t}
                onClick={() => setTopic(t)}
                aria-pressed={topic === t}
              >
                {t}
              </button>
            ),
          )}
        </div>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      <div className="life-guide-grid">
        {items.map((a) => (
          <article className="panel life-article" key={a.id}>
            <span className="eyebrow">{a.topic}</span>
            <h3>{a.title}</h3>
            <p>{a.text}</p>
            {a.period && <small className="life-period">{a.period}</small>}
            <a href={a.url} target="_blank" rel="noreferrer">
              Resmî kaynağı incele <ArrowUpRight size={15} />
            </a>
            <small>
              Kontrol: {a.checkedAt} · {a.sourceTitle}
            </small>
          </article>
        ))}
      </div>
      {data && !items.length && (
        <p className="empty">
          Bu aramada rehber bilgisi bulunamadı. Başka bir kelime deneyebilirsin.
        </p>
      )}
      <section className="panel life-advisor" id="danisman">
        <span className="eyebrow">KAYNAKLARA SOR</span>
        <h2>İSUBÜ rehberine bir sorun var mı?</h2>
        <p>
          Bu danışman yalnızca yukarıdaki küçük rehberde arama yapar. Kaynak
          yoksa bunu söyler; başka üniversitelerin koşullarını kapsamaz.
        </p>
        {user ? (
          <form onSubmit={ask}>
            <label>
              Sorun
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={3}
                maxLength={1000}
                rows={3}
                required
                placeholder="OBS şifremi unuttum, ne yapabilirim?"
              />
            </label>
            <button className="button dark" disabled={busy}>
              <Send size={16} />
              {busy ? "Kaynaklar inceleniyor…" : "Rehbere sor"}
            </button>
          </form>
        ) : (
          <div className="life-signin">
            <Link className="button dark" to="/giris">
              Soru sormak için giriş yap
            </Link>
            <DevLogin />
          </div>
        )}
        {askError && <ErrorBox message={askError} />}
        <div aria-live="polite">
          {answer && (
            <div className="life-answer">
              <strong>
                {answer.mode === "generated"
                  ? "Kaynaklı danışman yanıtı"
                  : answer.mode === "no-evidence"
                    ? "Yeterli kaynak bulunamadı"
                    : "Bulunan rehber bilgileri"}
              </strong>
              {answer.answer && (
                <p className="life-answer-text">{answer.answer}</p>
              )}
              <p className="quiet">{answer.notice}</p>
              {answer.sources.map((s, i) => (
                <article className="life-evidence" key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    [S{i + 1}] {s.title} <ArrowUpRight size={14} />
                  </a>
                  <p>{s.text}</p>
                  <small>
                    {s.period || "Kaynakta belirli dönem belirtilmiyor"} ·
                    Kontrol: {s.checkedAt}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="continuity-banner">
        <BookOpen size={30} />
        <div>
          <h2>Birlikte öğrenmek de yolculuğun parçası.</h2>
          <p>Öğrencilerin sorularına katıl, kendi sorunu topluluğa taşı.</p>
        </div>
        <Link className="button light" to="/topluluklar">
          Topluluklara git <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
