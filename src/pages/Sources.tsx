import { ExternalLink, Database } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { PageHeading, Loading, ErrorBox } from "../components/ui";
export default function Sources() {
  const { data, loading, error, reload } = useLoad<{
    sources: {
      id: string;
      title: string;
      url: string;
      publisher: string;
      retrieved_at: string;
      notes: string;
    }[];
    batches: { version: string; record_count: number; applied_at: string }[];
  }>("/catalog/sources");
  return (
    <>
      <PageHeading
        eyebrow="VERİNİN İZİNİ SÜR"
        title="Kaynaklar ve katalog sürümleri."
        description="Hangi bilginin nereden geldiğini, ne zaman kontrol edildiğini ve hangi sürümle aktarıldığını incele."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <>
          <div className="sources-grid">
            {data?.sources.map((s) => (
              <article className="panel" key={s.id}>
                <span className="badge">{s.publisher}</span>
                <h2>{s.title}</h2>
                <p>{s.notes}</p>
                <div className="source-bottom">
                  <small>
                    Kontrol:{" "}
                    {new Date(s.retrieved_at).toLocaleDateString("tr-TR")}
                  </small>
                  <a
                    className="text-button"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Resmî kaynağı aç <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>
              <Database size={20} /> İçe aktarma geçmişi
            </h2>
            {data?.batches.map((b) => (
              <div className="batch-row" key={b.version}>
                <strong>{b.version}</strong>
                <span>{b.record_count} program</span>
                <small>
                  {new Date(b.applied_at).toLocaleDateString("tr-TR")}
                </small>
              </div>
            ))}
            <p>
              Program sayısı ilgili dosyadaki kayıt sayısıdır; bütün Türkiye
              kataloğu değildir. Sürüm dosyaları önizleme ve doğrulama
              sonrasında işlem bütünlüğüyle uygulanır.
            </p>
          </section>
        </>
      )}
      <section className="panel">
        <h2>Veriyi nasıl yorumlamalı?</h2>
        <p>
          Pilot, resmî bölüm sayfalarından sınırlı elle derlenmiş alanlar
          içerir. Erişim tarihi veri yılı değildir. Yıllık sıralama ve ücretler
          kendi yıllarıyla gösterilir; eksik değerler boş bırakılır. YÖK Atlas
          için otomatik kullanım izni veya hazır API varsayılmadı.
        </p>
        <p>
          Program metinleri kısa editoryal özetlerdir. Ders ve kariyer alanı
          bilgileri istihdam oranı, staj kalitesi veya bölüm kalite puanı
          değildir. Örnek geliştirme verileri varsayılan gerçek katalogdan
          ayrıdır.
        </p>
      </section>
    </>
  );
}
