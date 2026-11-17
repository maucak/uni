import { Link } from "react-router-dom";
import { ArrowRight, Compass, GraduationCap } from "lucide-react";
export default function Home() {
  return (
    <main className="home-simple">
      <header>
        <span className="eyebrow">KAMPÜSPUSULA</span>
        <h1>
          Üniversite yolculuğunda
          <br />
          bir sonraki adımın.
        </h1>
        <p>Tercihini planla ya da kampüs hayatını keşfet.</p>
      </header>
      <div className="home-choices">
        <Link to="/programlar" className="home-choice">
          <Compass size={28} />
          <span>TERCİH ÖNCESİ</span>
          <h2>Üniversitemi seçiyorum.</h2>
          <p>
            Programları araştır, karşılaştır ve tercihlerini bir araya getir.
          </p>
          <strong>
            Programları keşfet <ArrowRight size={17} />
          </strong>
        </Link>
        <Link to="/kampus" className="home-choice">
          <GraduationCap size={29} />
          <span>YERLEŞME SONRASI</span>
          <h2>Üniversite hayatındayım.</h2>
          <p>İlk günler, öğrenci işlemleri ve şehir yaşamı için yolunu bul.</p>
          <strong>
            Kampüs yaşamına geç <ArrowRight size={17} />
          </strong>
        </Link>
      </div>
      <div className="home-bottom">
        <span>Birlikte öğrenmek için</span>
        <Link to="/topluluklar">
          Topluluklara göz at <ArrowRight size={15} />
        </Link>
      </div>
    </main>
  );
}
