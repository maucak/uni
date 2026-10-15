import { educationLanguages } from "../../shared/contracts";
import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import {
  PageHeading,
  ProgramCard,
  SampleNotice,
  Loading,
  ErrorBox,
  Empty,
} from "../components/ui";
import AdvisorPanel from "../components/AdvisorPanel";
import { searchFromParams, searchToParams } from "../../shared/search";
import type { Program } from "../../shared/contracts";
import type { AdvisorReply } from "../../shared/advisor";
export default function Programs() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const { user, notify } = useStore();
  const [advisorOpen, setAdvisorOpen] = useState(true),
    [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const state = useMemo(() => {
    try {
      return searchFromParams(params);
    } catch {
      return null;
    }
  }, [query]);
  const { data, error, loading, reload } = useLoad<{
    items: Program[];
    total: number;
    catalogVersion: string;
  }>(`/programs?${query}&limit=24`);
  const { data: filters } = useLoad<{
    cities: string[];
    count: number;
    realCount: number;
    sampleCount: number;
  }>("/catalog/filters");
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("offset");
    setParams(next, { replace: true });
  }
  function apply(reply: AdvisorReply) {
    if (reply.baseRevision !== query || !reply.proposedState) {
      notify("Filtreler değişti. Danışmandan yeniden öneri iste.");
      return;
    }
    const next = searchToParams(reply.proposedState);
    setUndo({ before: query, after: next.toString() });
    setParams(next);
    notify("Danışmanın önerdiği filtreler uygulandı.");
  }
  return (
    <>
      <PageHeading
        eyebrow="SEÇENEKLERİNİ TANI"
        title="Bir sonraki durağın neresi?"
        description="Kaynaklı programları araştır, filtrele ve aynı liste üzerinde danışmanla düşün."
        action={
          <button
            className="button light"
            onClick={() => setAdvisorOpen(!advisorOpen)}
          >
            <Sparkles size={16} />
            {advisorOpen ? "Danışmanı gizle" : "Danışmanı aç"}
          </button>
        }
      />
      <SampleNotice
        kind={
          params.get("dataKind") === "sample"
            ? "sample"
            : params.get("dataKind") === "all"
              ? "all"
              : "real"
        }
      />
      {undo && (
        <div className="undo-bar">
          <span>Son danışman değişikliği</span>
          <button
            className="text-button"
            disabled={query !== undo.after}
            onClick={() => {
              setParams(new URLSearchParams(undo.before));
              setUndo(null);
            }}
          >
            <Undo2 size={15} />
            Geri al
          </button>
          {query !== undo.after && (
            <small>Arama yeniden değişti; eski değişiklik geri alınamaz.</small>
          )}
        </div>
      )}
      <div className={`discovery-grid ${advisorOpen ? "with-advisor" : ""}`}>
        <aside className="filter-panel">
          <h3>
            <SlidersHorizontal size={18} /> Aramanı daralt
          </h3>
          <label>
            Veri kapsamı
            <select
              value={params.get("dataKind") || "real"}
              onChange={(e) => set("dataKind", e.target.value)}
            >
              <option value="real">
                Gerçek program verileri ({filters?.realCount ?? "…"})
              </option>
              <option value="sample">Örnek geliştirme verisi</option>
              <option value="all">İkisini birlikte göster</option>
            </select>
          </label>
          <label>
            Program veya üniversite
            <div className="search-input">
              <Search size={17} />
              <input
                value={params.get("search") || ""}
                onChange={(e) => set("search", e.target.value)}
                placeholder="Bilgisayar, yazılım…"
                maxLength={100}
              />
            </div>
          </label>
          <label>
            Puan türü
            <select
              value={params.get("scoreType") || ""}
              onChange={(e) => set("scoreType", e.target.value)}
            >
              <option value="">Tüm puan türleri</option>
              {["SAY", "EA", "SÖZ", "DİL", "TYT"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Şehir
            <select
              value={params.get("city") || ""}
              onChange={(e) => set("city", e.target.value)}
            >
              <option value="">Tüm şehirler</option>
              {filters?.cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Eğitim dili
            <select
              value={params.get("language") || ""}
              onChange={(e) => set("language", e.target.value)}
            >
              <option value="">Tüm diller</option>
              {educationLanguages.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label>
            Üniversite türü
            <select
              value={params.get("type") || ""}
              onChange={(e) => set("type", e.target.value)}
            >
              <option value="">Tüm türler</option>
              <option>Devlet</option>
              <option>Vakıf</option>
              <option>Yurt dışı</option>
            </select>
          </label>
          <details className="advanced-filters" open>
            <summary>Sıra, burs ve bütçe</summary>
            <label>
              En küçük geçmiş sıra
              <input
                type="number"
                min={1}
                max={5000000}
                value={params.get("rankMin") || ""}
                onChange={(e) => set("rankMin", e.target.value)}
                placeholder="Örn. 50000"
              />
            </label>
            <label>
              En büyük geçmiş sıra
              <input
                type="number"
                min={1}
                max={5000000}
                value={params.get("rankMax") || ""}
                onChange={(e) => set("rankMax", e.target.value)}
                placeholder="Örn. 150000"
              />
            </label>
            <small>Geçmiş yıl aralığıdır; yerleşme tahmini değildir.</small>
            <label>
              Yıllık öğrenim ücreti üst sınırı (TL)
              <input
                type="number"
                min={0}
                max={10000000}
                value={params.get("maxTuition") || ""}
                onChange={(e) => set("maxTuition", e.target.value)}
                placeholder="Örn. 100000"
              />
            </label>
            <label>
              En düşük burs oranı (%)
              <input
                type="number"
                min={0}
                max={100}
                value={params.get("minScholarship") || ""}
                onChange={(e) => set("minScholarship", e.target.value)}
                placeholder="Örn. 50"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={params.get("includeUnknown") !== "false"}
                onChange={(e) =>
                  set("includeUnknown", String(e.target.checked))
                }
              />
              <span>Filtreye ait verisi bilinmeyenleri de göster</span>
            </label>
            <small>Ücret bilinmiyorsa ücretsiz sayılmaz.</small>
          </details>
          <button className="text-button" onClick={() => setParams({})}>
            Filtreleri temizle
          </button>
          <div className="filter-tip">
            <h4>Önceliklerine göre sırala.</h4>
            <Link to="/profil">
              Profilini düzenle <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
        <section className="discovery-results">
          <div className="results-heading">
            <strong>{data?.total ?? "…"} program</strong>
            <label className="sort-control">
              <span className="sr-only">Sonuçları sırala</span>
              <select
                value={params.get("sort") || "name"}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="name">Üniversite adına göre</option>
                <option value="rank">Geçmiş sıralamaya göre</option>
                <option value="fit" disabled={!user}>
                  Profil uyumuna göre
                </option>
              </select>
            </label>
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorBox message={error} retry={reload} />
          ) : data?.items.length ? (
            <div className="program-grid two">
              {data.items.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          ) : (
            <Empty title="Bu filtrelere uygun program yok.">
              <p>
                Katalog seçilmiş üniversiteleri kapsar. Bir filtreyi
                kaldırabilir veya eksik verili programları dahil edebilirsin.
              </p>
            </Empty>
          )}
          {!!data?.total && (
            <nav className="section-heading" aria-label="Program sayfaları">
              <button
                className="button"
                disabled={loading || offset === 0}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("offset", String(Math.max(0, offset - 24)));
                  setParams(next);
                }}
              >
                Önceki
              </button>
              <span>
                {offset + 1}–{Math.min(offset + 24, data.total)} / {data.total}
              </span>
              <button
                className="button"
                disabled={loading || offset + 24 >= data.total}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("offset", String(offset + 24));
                  setParams(next);
                }}
              >
                Sonraki
              </button>
            </nav>
          )}
          <div className="catalog-version">
            Katalog sürümü: {data?.catalogVersion || "…"} ·{" "}
            <Link to="/veri-kaynaklari">Kaynakları incele</Link>
          </div>
        </section>
        {advisorOpen && (
          <AdvisorPanel state={state} revision={query} onApply={apply} />
        )}
      </div>
    </>
  );
}
