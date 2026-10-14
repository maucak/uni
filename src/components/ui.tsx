import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  MapPin,
  Scale,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import type { Program, PreferenceList } from "../../shared/contracts";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
export const number = (n: number | null) =>
  n === null ? "Veri yok" : new Intl.NumberFormat("tr-TR").format(n);
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Tekrar dene
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} /> Yükleniyor…
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Bookmark size={24} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function SampleNotice({
  kind = "sample",
}: {
  kind?: "sample" | "real" | "all";
}) {
  return (
    <div className="sample-notice">
      <span className="dot" />
      {kind === "sample"
        ? "Örnek geliştirme verisi"
        : kind === "all"
          ? "Karışık katalog"
          : "Kaynaklı pilot katalog"}{" "}
      <span>
        {kind === "sample"
          ? "Üniversite adları ve sayısal değerler sentetiktir; resmî tercih verisi değildir."
          : kind === "all"
            ? "Kaynaklı ve örnek programlar birlikte gösteriliyor. Her kaydın türünü kontrol et."
            : "Pilot kapsamı sınırlıdır. Eksik ücret ve sıralamalar bilinmiyor olarak gösterilir."}
      </span>
    </div>
  );
}
export function ProgramCard({
  program,
  extra,
}: {
  program: Program;
  extra?: ReactNode;
}) {
  const { user, compare, toggleCompare, notify } = useStore();
  const navigate = useNavigate();
  async function save() {
    if (!user) {
      navigate("/giris");
      return;
    }
    try {
      let lists = await api<PreferenceList[]>("/preference-lists");
      if (!lists.length)
        lists = [
          await api<PreferenceList>(
            "/preference-lists",
            json("POST", { name: "İlk tercih listem" }),
          ),
        ];
      await api(
        `/preference-lists/${lists[0].id}/items`,
        json("POST", { programId: program.id }),
      );
      notify(`“${lists[0].name}” listesine eklendi.`);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <article className="program-card">
      <div className="card-top">
        <span className="school-mark">
          {program.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="badge">{program.universityType}</span>
        <span className={`data-badge ${program.isSample ? "sample" : ""}`}>
          {program.isSample ? "Örnek" : "Kaynaklı"}
        </span>
        <button
          className="icon-button"
          aria-label={`${program.name} programını tercih listeme ekle`}
          title="Tercih listeme ekle"
          onClick={save}
        >
          <Bookmark size={19} />
        </button>
      </div>
      <p className="university-name">{program.university}</p>
      <h3>
        <Link to={`/programlar/${program.id}`}>{program.name}</Link>
      </h3>
      <div className="location">
        <MapPin size={14} />
        {program.city}
        <span>·</span>
        {program.language}
      </div>
      <div className="program-data">
        <div>
          <small>
            {program.isSample
              ? "Örnek sıra"
              : `${program.year ?? "—"} başarı sırası`}
          </small>
          <strong>{number(program.rank)}</strong>
        </div>
        <div>
          <small>Puan türü</small>
          <strong>{program.scoreType}</strong>
        </div>
        <div>
          <small>Burs / ücret</small>
          <strong title={program.scholarship}>
            {program.isSample
              ? program.scholarship
              : program.scholarshipPercent != null
                ? `%${program.scholarshipPercent}`
                : "Bilinmiyor"}
          </strong>
        </div>
      </div>
      {extra}
      <div className="card-footer">
        <button
          className={`text-button ${compare.includes(program.id) ? "selected" : ""}`}
          onClick={() => toggleCompare(program.id)}
        >
          {compare.includes(program.id) ? (
            <Check size={16} />
          ) : (
            <Scale size={16} />
          )}
          Karşılaştır
        </button>
        <Link className="detail-link" to={`/programlar/${program.id}`}>
          İncele <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}
