import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import {
  PageHeading,
  Loading,
  Empty,
  ErrorBox,
  SampleNotice,
  number,
} from "../components/ui";
import type { Program } from "../../shared/contracts";
export default function Compare() {
  const { compare, toggleCompare } = useStore();
  const [programs, setPrograms] = useState<Program[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(compare.map((id) => api<Program>(`/programs/${id}`)))
      .then((p) => {
        if (active) {
          setPrograms(p);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [compare]);
  return (
    <>
      <PageHeading
        eyebrow="YAN YANA BAK"
        title="Karar vermeden karşılaştır."
        description="En fazla dört programı aynı ölçütler üzerinden incele."
      />
      <SampleNotice kind={programs.some((p) => p.isSample) ? "all" : "real"} />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !programs.length ? (
        <Empty title="Henüz program seçmedin.">
          <p>Program kartlarındaki “Karşılaştır” düğmesini kullan.</p>
          <Link className="button dark" to="/programlar">
            Programları keşfet
          </Link>
        </Empty>
      ) : (
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Ölçüt</th>
                {programs.map((p) => (
                  <th key={p.id}>
                    <button
                      className="icon-button"
                      onClick={() => toggleCompare(p.id)}
                      aria-label={`${p.name} programını çıkar`}
                    >
                      <X size={16} />
                    </button>
                    <Link to={`/programlar/${p.id}`}>{p.name}</Link>
                    <small>{p.university}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Şehir", (p: Program) => p.city],
                ["Eğitim dili", (p: Program) => p.language],
                ["Üniversite türü", (p: Program) => p.universityType],
                ["Puan türü", (p: Program) => p.scoreType],
                ["Burs / ücret", (p: Program) => p.scholarship],
                [
                  "Başarı sırası",
                  (p: Program) =>
                    `${number(p.rank)} (${p.rankYear ?? p.year ?? "yıl bilinmiyor"})`,
                ],
                [
                  "Genel kontenjan",
                  (p: Program) =>
                    `${number(p.quota)} (${p.quotaYear ?? "yıl bilinmiyor"})`,
                ],
                [
                  "Başarı sırası yılı",
                  (p: Program) =>
                    p.year === null ? "Bilinmiyor" : String(p.year),
                ],
                [
                  "Yıllık öğrenim ücreti",
                  (p: Program) =>
                    p.tuition == null
                      ? "Bilinmiyor"
                      : `${number(p.tuition)} TL (${p.feeYear})`,
                ],
                [
                  "Kayıt türü",
                  (p: Program) =>
                    p.isSample ? "Sentetik örnek" : "Gerçek program verileri",
                ],
                ["İlgi alanları", (p: Program) => p.subjects.join(", ")],
                ["Kaynak", (p: Program) => p.source],
              ].map(([label, get]) => (
                <tr key={label as string}>
                  <th>{label as string}</th>
                  {programs.map((p) => (
                    <td key={p.id}>{(get as (p: Program) => string)(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
