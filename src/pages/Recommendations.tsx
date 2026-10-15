import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, RefreshCw } from "lucide-react";
import { api, json } from "../lib/api";
import {
  PageHeading,
  ProgramCard,
  Loading,
  ErrorBox,
  Empty,
  SampleNotice,
} from "../components/ui";
import type { Recommendation } from "../../shared/contracts";
import { useStore } from "../lib/store";
function Feedback({ runId, programId }: { runId: string; programId: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useStore();
  async function rate(value: number) {
    setBusy(true);
    try {
      await api(
        `/recommendations/${runId}/feedback`,
        json("POST", { programId, rating: value }),
      );
      setRating(value);
      notify("Uygunluk değerlendirmen kaydedildi.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recommendation-feedback">
      <span>Bu öneri sana ne kadar uygun?</span>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            className={rating === n ? "active" : ""}
            disabled={busy}
            key={n}
            aria-label={`Uygunluk: ${n} / 5`}
            onClick={() => rate(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <small>1: uygun değil · 5: çok uygun</small>
    </div>
  );
}
export default function Recommendations() {
  const [items, setItems] = useState<Recommendation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [kind, setKind] = useState("real"),
    [runId, setRunId] = useState(""),
    [version, setVersion] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api<{
        items: Recommendation[];
        id: string;
        catalogVersion: string;
      }>("/recommendations", json("POST", { filters: { dataKind: kind } }));
      setItems(r.items);
      setRunId(r.id);
      setVersion(r.catalogVersion);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [kind]);
  return (
    <>
      <PageHeading
        eyebrow="ÖNCELİKLERİNE GÖRE"
        title="Sana uygun yollar."
        description="İlgi metnin, şehir ve dil önceliklerin birlikte değerlendirilir. Her önerinin nedenini görebilirsin."
        action={
          <Link className="button light" to="/profil">
            <SlidersHorizontal size={17} /> Öncelikleri düzenle
          </Link>
        }
      />
      <SampleNotice kind={kind === "sample" ? "sample" : "real"} />
      <div className="recommendation-toolbar">
        <label>
          Öneri veri kapsamı
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="real">Gerçek program verileri</option>
            <option value="sample">Örnek geliştirme verisi</option>
          </select>
        </label>
        <small>Katalog: {version || "…"}</small>
      </div>
      <div className="recommendation-info">
        <p>
          Uyum endeksi yerleşme olasılığı değildir. Geçmiş yıl sıralamaları
          öneri puanına katılmaz.
        </p>
        <button className="text-button" onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Yenile
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={load} />
      ) : !items.length ? (
        <Empty title="Bu profile uygun program bulunamadı.">
          <Link to="/profil">Puan türünü ve üniversite türünü kontrol et.</Link>
        </Empty>
      ) : (
        <div className="program-grid">
          {items.map((r) => (
            <ProgramCard
              key={r.program.id}
              program={r.program}
              extra={
                <div className="recommendation-details">
                  <div className="score-row">
                    <strong>
                      {r.score === null
                        ? "Profilini tamamla"
                        : `${r.score} / 100`}
                    </strong>
                    <span>Uyum endeksi</span>
                  </div>
                  <ul>
                    {r.reasons.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <details>
                    <summary>Veri kapsamı ve sınırlar</summary>
                    <p>
                      Ağırlıklandırılan ölçütlerde veri kapsamı: %
                      {Math.round(r.coverage * 100)}
                    </p>
                    {r.missing.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                    {r.components?.map((c) => (
                      <p key={c.name}>
                        {c.name}:{" "}
                        {c.value === null
                          ? "veri bilinmiyor"
                          : `${Math.round(c.value * 100)} / 100`}{" "}
                        · ağırlık {c.weight}
                      </p>
                    ))}
                  </details>
                  <Feedback
                    key={runId}
                    runId={runId}
                    programId={r.program.id}
                  />
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
