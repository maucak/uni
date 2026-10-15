import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, BookOpen, Scale, Users } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import {
  Loading,
  ErrorBox,
  SampleNotice,
  number,
  ProgramCard,
} from "../components/ui";
import type { Program } from "../../shared/contracts";
export default function ProgramDetail() {
  const { id } = useParams();
  const {
    data: p,
    error,
    loading,
    reload,
  } = useLoad<Program>(`/programs/${id}`);
  const { toggleCompare, compare } = useStore();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!p) return null;
  return (
    <>
      <Link className="back-link" to="/programlar">
        <ArrowLeft size={16} /> Programlara dön
      </Link>
      {p.isSample && <SampleNotice />}
      <section className="detail-hero">
        <div>
          <span className="eyebrow">{p.university}</span>
          <h1>{p.name}</h1>
          <p>
            <MapPin size={17} /> {p.city} <span>·</span> {p.language}{" "}
            <span>·</span> {p.universityType}
          </p>
          <div className="tags">
            {p.subjects.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
        <button className="button light" onClick={() => toggleCompare(p.id)}>
          <Scale size={17} />
          {compare.includes(p.id)
            ? "Karşılaştırmadan çıkar"
            : "Karşılaştırmaya ekle"}
        </button>
      </section>
      <div className="detail-layout">
        <div>
          <section className="panel">
            <h2>
              <BookOpen size={22} /> Program hakkında
            </h2>
            <p className="body-copy">{p.description}</p>
            <div className="detail-stats">
              <div>
                <small>Son başarı sırası yılı</small>
                <strong>{p.year ?? "Bilinmiyor"}</strong>
              </div>
              <div>
                <small>
                  {p.isSample ? "Örnek başarı sırası" : "Başarı sırası"}
                </small>
                <strong>{number(p.rank)}</strong>
              </div>
              <div>
                <small>
                  {p.isSample
                    ? "Örnek kontenjan"
                    : `${p.quotaYear ?? ""} genel kontenjanı`}
                </small>
                <strong>{number(p.quota)}</strong>
              </div>
              <div>
                <small>Puan türü</small>
                <strong>{p.scoreType}</strong>
              </div>
            </div>
          </section>
          {!!p.history?.length && (
            <section className="panel">
              <h2>Yıllara göre yerleştirme verileri</h2>
              <div className="table-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Yıl</th>
                      <th>Başarı sırası</th>
                      <th>Kontenjan</th>
                      <th>Öğrenim ücreti</th>
                      <th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.history.map((y) => (
                      <tr key={y.year}>
                        <td>{y.year}</td>
                        <td>{number(y.rank)}</td>
                        <td>{number(y.quota)}</td>
                        <td>
                          {y.tuition === null
                            ? "Bilinmiyor"
                            : `${number(y.tuition)} ${y.currency}`}
                        </td>
                        <td>
                          {y.sourceUrl ? (
                            <a
                              href={y.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Kaynağı aç
                            </a>
                          ) : (
                            y.source
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="quiet">
                Sıralama değeri küçüldükçe geçmiş yerleşme sırası yükselir. Bu
                değişim gelecek yıl için tahmin veya garanti değildir.
              </p>
            </section>
          )}
          {p.admissionData && (
            <section className="panel">
              <h2>ÖSYM kayıt ayrıntıları</h2>
              <p>
                {p.admissionData.year} kılavuzu · Tablo-{p.admissionData.table}{" "}
                · Kaynak satırı {p.admissionData.row}
              </p>
              <p className="quiet">
                Sütun başlıklarındaki yıl ve özel kontenjan koşulları
                geçerlidir. Boş alan bilinmiyor olarak gösterilir. Koşul
                numaralarının açıklamaları resmî kılavuzdadır.
              </p>
              <details>
                <summary>Tüm kaynak alanlarını göster</summary>
                <div className="table-scroll">
                  <table className="history-table">
                    <tbody>
                      {Object.entries(p.admissionData.columns).map(
                        ([label, value]) => (
                          <tr key={label}>
                            <th>{label}</th>
                            <td>
                              {value === "" || value == null
                                ? "Bilinmiyor"
                                : String(value)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
          <section className="panel">
            <h2>Verinin kaynağı ve sınırları</h2>
            <p>{p.source}</p>
            {p.sourceUrl && (
              <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                Kaynağı aç
              </a>
            )}
            {p.sources?.map((s) => (
              <div className="program-source" key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <small>
                  Kontrol: {s.retrievedAt} · {s.publisher}
                </small>
                <p>{s.notes}</p>
              </div>
            ))}
            <p className="quiet">
              Geçmiş yıl başarı sırası gelecek yıl yerleşmeyi garanti etmez.
              Kaynağı bulunmayan ücretler bilinmiyor olarak tutulur. Yaşam
              maliyeti, staj kalitesi veya istihdam oranı puanı üretilmez.
            </p>
          </section>
          <section className="panel community-call">
            <Users size={27} />
            <div>
              <h2>Sorularını topluluğa taşı.</h2>
              <p>Dersler, hazırlık ve üniversite yaşamı hakkında konuş.</p>
            </div>
            <Link
              className="button light"
              to={
                p.isSample ? "/topluluklar" : `/topluluklar?programId=${p.id}`
              }
            >
              Toplulukları aç
            </Link>
          </section>
        </div>
        <aside>
          <ProgramCard program={p} />
          <div className="aside-note">
            Bu programı listene ekleyerek kişisel notlar yazabilir ve diğer
            seçeneklerinle birlikte sıralayabilirsin.
          </div>
        </aside>
      </div>
    </>
  );
}
