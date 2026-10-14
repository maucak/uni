import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  BookOpen,
  MessageCircle,
  SlidersHorizontal,
  MapPin,
  Check,
} from "lucide-react";
import { useStore } from "../lib/store";
import { useLoad } from "../lib/useLoad";
import { ProgramCard, SampleNotice } from "../components/ui";
import type { Program } from "../../shared/contracts";
export default function Home() {
  const { user } = useStore();
  const { data } = useLoad<{ items: Program[]; total: number }>(
    "/programs?limit=3",
  );
  return (
    <>
      <div className="welcome-row">
        <span className="eyebrow">BİR SONRAKİ ADIMIN</span>
        <span className="quiet">Tercih sürecinden kampüs yaşamına</span>
      </div>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tag">
            <Compass size={15} /> Senin önceliklerin, senin yolun.
          </span>
          <h1>
            {user ? `${user.profile.displayName.split(" ")[0]}, ` : ""}
            geleceğine giden
            <br />
            yolu <em>birlikte bulalım.</em>
          </h1>
          <p>
            Sadece sıralamana değil, ilgi alanlarına ve hayal ettiğin üniversite
            yaşamına uygun programları keşfet.
          </p>
          <div className="hero-actions">
            <Link className="button dark" to="/programlar">
              Programları keşfet <ArrowUpRight size={18} />
            </Link>
            <Link className="button ghost" to={user ? "/profil" : "/kayit"}>
              Tercih profilimi oluştur <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>
              <Check size={15} /> Açıklanabilir öneriler
            </span>
            <span>
              <Check size={15} /> Kişisel tercih listeleri
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="compass-art">
            <span>K</span>
            <div className="compass-cross" />
            <div className="compass-needle" />
            <small>KENDİ YOLUNU BUL</small>
          </div>
          <div className="floating-card float-top">
            <span className="mini-icon">
              <SlidersHorizontal size={17} />
            </span>
            <div>
              <strong>Önceliklerin belirleyici</strong>
              <small>İlgi · şehir · eğitim dili</small>
            </div>
          </div>
          <div className="floating-card float-bottom">
            <span className="mini-icon orange">
              <MapPin size={18} />
            </span>
            <div>
              <strong>Bir programdan fazlası</strong>
              <small>Yaşamak istediğin hayat</small>
            </div>
          </div>
          <span className="art-spark">✳</span>
        </div>
      </section>
      <div className="journey-header">
        <div>
          <span className="eyebrow">NEREDEN BAŞLAMALI?</span>
          <h2>Üç adımda daha bilinçli bir tercih.</h2>
        </div>
        <span className="quiet">Karar senin. Pusulan burada.</span>
      </div>
      <section className="journey-grid">
        {[
          [
            SlidersHorizontal,
            "01",
            "Kendini tanı",
            "İlgi alanlarını ve önceliklerini ekle. Sana uygun seçeneklerin temelini oluştur.",
            "/profil",
          ],
          [
            Compass,
            "02",
            "Seçeneklerini keşfet",
            "Programları araştır, karşılaştır ve neden önerildiklerini gör.",
            "/programlar",
          ],
          [
            MessageCircle,
            "03",
            "Deneyimlerden öğren",
            "Sorularını topluluğa taşı. Tercih yolculuğunu birlikte düşün.",
            "/topluluklar",
          ],
        ].map(([Icon, n, title, body, to]) => {
          const I = Icon as typeof Compass;
          return (
            <Link to={to as string} key={n as string} className="journey-card">
              <div>
                <span className="step-icon">
                  <I size={21} />
                </span>
                <span className="step-number">{n as string}</span>
              </div>
              <h3>{title as string}</h3>
              <p>{body as string}</p>
              <ArrowUpRight size={20} />
            </Link>
          );
        })}
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">KATALOĞA GÖZ AT</span>
          <h2>Farklı yollar, yeni olasılıklar.</h2>
        </div>
        <Link className="text-button" to="/programlar">
          Tüm programlar <ArrowRight size={17} />
        </Link>
      </div>
      <SampleNotice kind="real" />
      <div className="program-grid">
        {data?.items.map((p) => (
          <ProgramCard key={p.id} program={p} />
        ))}
      </div>
      <section className="continuity-banner">
        <div className="continuity-icon">
          <BookOpen size={28} />
        </div>
        <div>
          <h2>Yolculuk, yerleşince bitmez.</h2>
          <p>
            Bugün soru soran aday, yarın deneyimini paylaşan öğrenci olabilir.
          </p>
        </div>
        <Link className="button light" to="/topluluklar">
          Toplulukları keşfet <ArrowUpRight size={17} />
        </Link>
      </section>
    </>
  );
}
