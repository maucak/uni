import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { PageHeading, Loading, ErrorBox } from "../components/ui";
type Source = {
  id: string;
  url: string;
  title: string;
  scope: string;
  interval_days: number;
  enabled: boolean;
  campaign_start: string | null;
  campaign_end: string | null;
  next_check_at: string;
  last_checked_at: string | null;
  last_successful_at: string | null;
  last_changed_at: string | null;
  last_error: string | null;
  job_state: string | null;
  job_phase: string | null;
  attempts: number | null;
  run_after: string | null;
  documents: number;
};
const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("tr-TR") : "Henüz yok";
function SourceCard({
  source: s,
  onChange,
}: {
  source: Source;
  onChange: () => void;
}) {
  const [days, setDays] = useState(s.interval_days),
    [enabled, setEnabled] = useState(s.enabled),
    [start, setStart] = useState(s.campaign_start?.slice(0, 10) || ""),
    [end, setEnd] = useState(s.campaign_end?.slice(0, 10) || "");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function act(save: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message?: string }>(
        `/source-management/${s.id}/${save ? "schedule" : "check"}`,
        json(
          save ? "PUT" : "POST",
          save
            ? {
                intervalDays: days,
                enabled,
                campaignStart: start || null,
                campaignEnd: end || null,
              }
            : {},
        ),
      );
      setMessage(result.message || "Kontrol düzeni kaydedildi.");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = s.job_state === "queued" || s.job_state === "running";
  const status =
    s.job_state === "running"
      ? s.job_phase === "publish"
        ? "Aramaya aktarılıyor"
        : "Kontrol ediliyor"
      : s.job_state === "queued"
        ? s.last_error
          ? "Tekrar denenecek"
          : "Sırada"
        : s.last_error
          ? "Kontrol başarısız"
          : s.last_successful_at
            ? "Kontrol tamamlandı"
            : "Henüz kontrol edilmedi";
  return (
    <article className="panel source-management-card">
      <div className="source-management-top">
        <div>
          <span className="badge">
            {s.scope === "national" ? "Türkiye geneli" : s.scope === "sdu" ? "SDÜ" : s.scope === "pau" ? "PAÜ" : s.scope === "akdeniz" ? "Akdeniz Üniversitesi" : "İSUBÜ"} · {status}
          </span>
          <h2>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
          </h2>
        </div>
        <button
          className="button secondary"
          disabled={busy || active}
          onClick={() => void act(false)}
        >
          Şimdi kontrol et
        </button>
      </div>
      <div className="source-management-dates">
        <span>Son kontrol: {date(s.last_checked_at)}</span>
        <span>Son başarılı işlem: {date(s.last_successful_at)}</span>
        <span>Son içerik değişikliği: {date(s.last_changed_at)}</span>
        <span>
          Sonraki kontrol:{" "}
          {enabled
            ? date(active && s.run_after ? s.run_after : s.next_check_at)
            : "Otomatik kontrol kapalı"}{" "}
          · {s.documents} belge
        </span>
      </div>
      {s.last_error && (
        <p className="source-management-warning">
          {s.last_error} Mevcut içerik korunur; aktarım hataları ayrıca yeniden
          denenir.
        </p>
      )}
      <details>
        <summary>Kontrol düzenini ayarla</summary>
        <div className="source-management-settings">
          <label>
            Normal kontrol aralığı
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[
                1,
                7,
                14,
                30,
                60,
                90,
                ...(![1, 7, 14, 30, 60, 90].includes(days) ? [days] : []),
              ].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Her gün" : `${n} günde bir`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sık kontrol başlangıcı
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Sık kontrol bitişi
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="source-management-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Otomatik kontrol açık
          </label>
          <p>
            Belirtilen tarih aralığında günde bir kontrol edilir. Tarihleri boş
            bırakırsan normal aralık uygulanır.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void act(true)}
          >
            Kaydet
          </button>
        </div>
      </details>
      {message && <p role="status">{message}</p>}
      {error && <ErrorBox message={error} />}
    </article>
  );
}
export default function SourceManagement() {
  const { data, error, loading, reload } = useLoad<{
    items: Source[];
    worker: { online: boolean; heartbeat_at: string | null };
  }>("/source-management");
  useEffect(() => {
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [reload]);
  return (
    <>
      <PageHeading
        eyebrow="KAYNAK YÖNETİMİ"
        title="Kaynakları güncel tut."
        description="Otomatik izlenen kaynakların kontrollerini, bekleyen işlerini ve güncelleme düzenini takip et."
        action={
          <Link className="text-button" to="/veri-kaynaklari">
            Tüm kaynaklar
          </Link>
        }
      />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        data && (
          <>
            <p className="source-worker-notice" role="status">
              {data.worker.online
                ? "Güncelleme işçisi çalışıyor."
                : "Güncelleme işçisi yakın zamanda sinyal vermedi. Kontroller sırada bekleyebilir."}{" "}
              Kontrol tarihi, belgenin güncel dönemde geçerli olduğunu tek
              başına göstermez.
            </p>
            <div className="source-management-list">
              {data.items.map((s) => (
                <SourceCard key={s.id} source={s} onChange={reload} />
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
