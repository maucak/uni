import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Compass,
  MapPin,
  BookOpen,
  Users,
  MessageCircle,
  GraduationCap,
} from "lucide-react";
import { useStore } from "../lib/store";
export default function Home() {
  const { user } = useStore();
  return (
    <>
      <div className="welcome-row">
        <span className="eyebrow">KAMPÜSPUSULA</span>
        <span className="quiet">Tercihinden kampüs hayatına</span>
      </div>
      <section className="life-intro">
        <span className="hero-tag">
          <Compass size={15} /> Üniversite yolculuğunda yanında.
        </span>
        <h1>
          {user ? `${user.profile.displayName.split(" ")[0]}, ` : ""}yolun
          nereden
          <br />
          başlıyorsa <em>oradayız.</em>
        </h1>
        <p>
          Bir bölüm seçerken de yeni bir şehre alışırken de bilgiye, insanlara
          ve kendi yoluna ulaş.
        </p>
      </section>
      <section
        className="journey-choice"
        aria-label="Üniversite yolculuğunu seç"
      >
        <article className="path-card path-candidate">
          <span className="path-icon">
            <Compass size={28} />
          </span>
          <span className="eyebrow">TERCİH ÖNCESİ</span>
          <h2>Tercihimi planlıyorum.</h2>
          <p>
            İlgi alanlarını keşfet, programları karşılaştır ve seçeneklerini bir
            araya getir.
          </p>
          <ul>
            <li>Program ve üniversite araştırması</li>
            <li>Önceliklerine göre öneriler</li>
            <li>Karşılaştırma ve tercih listeleri</li>
          </ul>
          <Link className="button dark" to="/programlar">
            Programları keşfet <ArrowUpRight size={18} />
          </Link>
          <Link className="text-button" to={user ? "/oneriler" : "/giris"}>
            Bana uygun programlar
          </Link>
        </article>
        <article className="path-card path-student">
          <span className="path-icon">
            <GraduationCap size={28} />
          </span>
          <span className="eyebrow">YERLEŞME SONRASI</span>
          <h2>Kampüs hayatına geçiyorum.</h2>
          <p>
            İlk kayıtlarından hazırlığa, kampüsünden şehir yaşamına ihtiyaç
            duyduğun bilgiyi bul.
          </p>
          <ul>
            <li>Kaynaklı başlangıç rehberi</li>
            <li>Hazırlık, öğrenci işlemleri ve ulaşım</li>
            <li>Topluluklar ve birlikte öğrenme</li>
          </ul>
          <Link className="button dark" to="/kampus">
            Kampüs yaşamını keşfet <ArrowUpRight size={18} />
          </Link>
          <Link className="text-button" to="/kampus#danisman">
            Rehbere bir soru sor
          </Link>
        </article>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">SANA GÖRE BİR SONRAKİ ADIM</span>
          <h2>Keşfet, sor, birlikte ilerle.</h2>
        </div>
      </div>
      <section className="journey-grid">
        {[
          {
            Icon: MapPin,
            title: "İlk günlerini kolaylaştır",
            text: "İSUBÜ için hazırladığımız kaynaklı başlangıç rehberine göz at.",
            to: "/kampus",
          },
          {
            Icon: Users,
            title: "Topluluğa katıl",
            text: "Adaylarla ve öğrencilerle sorularını, deneyimlerini paylaş.",
            to: "/topluluklar",
          },
          {
            Icon: MessageCircle,
            title: "Kendine bir alan aç",
            text: "Üniversite yolculuğundaki aşamanı ve ilgi alanlarını profiline ekle.",
            to: user ? "/profil" : "/kayit",
          },
        ].map(({ Icon, title, text, to }) => (
          <Link className="journey-card" key={to} to={to}>
            <span className="step-icon">
              <Icon size={22} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </section>
      <section className="continuity-banner">
        <div className="continuity-icon">
          <BookOpen size={28} />
        </div>
        <div>
          <h2>Bilginin kaynağını da gör.</h2>
          <p>
            Rehberde resmî kaynakları ve kontrol tarihlerini birlikte sunuyoruz.
          </p>
        </div>
        <Link className="button light" to="/kampus">
          Rehberi incele <ArrowUpRight size={17} />
        </Link>
      </section>
    </>
  );
}
