import { PageHeading } from "../components/ui";
import { Link } from "react-router-dom";
export default function Method() {
  return (
    <>
      <PageHeading
        eyebrow="AÇIK VE ANLAŞILIR"
        title="Pusulan nasıl çalışıyor?"
        description="Önerinin gerekçesini, kullanılan veriyi ve sistemin sınırlarını bilerek karar ver."
      />
      <div className="method-grid">
        <section className="panel">
          <span className="section-number">01</span>
          <h2>Önce uygun aday havuzu</h2>
          <p>
            Puan türün ve seçtiysen üniversite türü, hangi programların
            değerlendirileceğini belirler. Keşif sayfasındaki filtreler kesin
            koşullardır; profilindeki şehir ve dil seçenekleri öneri
            öncelikleridir.
          </p>
        </section>
        <section className="panel">
          <span className="section-number">02</span>
          <h2>İlgi metniyle benzerlik</h2>
          <p>
            Program açıklamaları ve ilgi metnin aynı TF-IDF sözlüğüyle
            vektörleştirilir. Kosinüs benzerliği, örtüşen kavramları ölçer. İlk
            yöntem sözcük temellidir; eş anlamlı ifadeleri veya bütün kariyer
            hedeflerini anlayabildiği iddia edilmez.
          </p>
        </section>
        <section className="panel">
          <span className="section-number">03</span>
          <h2>Senin önceliklerin</h2>
          <p>
            Metinsel uyum, şehir, eğitim dili ve varsa kaynaklı öğrenim
            ücreti/burs eşleşmeleri belirttiğin ağırlıklarla birleştirilir.
            Eksik veri olumlu eşleşme sayılmaz. Veri kapsamı ve eksik alanlar
            öneriyle birlikte gösterilir.
          </p>
        </section>
        <section className="panel">
          <span className="section-number">04</span>
          <h2>Yerleşme tahmini değil</h2>
          <p>
            Uyum endeksi kişisel beklenti eşleşmesini temsil eder. Başarı sırası
            ayrı gösterilir. Geçmiş yıl verisi gelecek yıl için kesin sınır
            değildir. Sıralama bandı filtresini kendi araştırma aralığını
            daraltmak için kullanabilirsin. Bilinmeyen sıralamaların dahil
            edilmesi kullanıcı kontrolündedir.
          </p>
        </section>
      </div>
      <section className="panel source-panel">
        <h2>Mevcut veri kaynağı</h2>
        <p>
          Gerçek katalog, ÖSYM 2026 Tablo-3 ve Tablo-4'teki 21.493 program
          kaydını içerir; önlisans, lisans ve yurt dışı seçenekleri ayrıdır.
          2025 başarı sıraları ve 2026 genel kontenjanları ayrı yıllarda
          saklanır. Ücretler ve ayrıntılı ders içerikleri henüz tamamlanmadı.
          Kapsam bu iki resmî tabloda yer alan kayıtlardır. ISUBÜ programlarının
          önceki kaynaklı içerikleri korunur.
        </p>
        <p>
          Ayrı örnek katalogdaki 12 program sentetiktir. Varsayılan keşif gerçek
          kataloğu gösterir. Yeni dosyalar önizleme, alan doğrulama ve sürümlü
          içe aktarma ile eklenir. YÖK Atlas için hazır API veya otomatik
          kullanım izni varsayılmıyor.
        </p>
        <Link className="button light" to="/veri-kaynaklari">
          Kaynak ve sürüm kayıtları
        </Link>
        <h3>AI danışmanı nasıl çalışır?</h3>
        <p>
          Mesajını ve mevcut arama durumunu kullanarak yapılandırılmış filtre
          değişiklikleri önerir. Değişiklikler önizlenir, sen uygularsın ve geri
          alınabilir. Filtreler sonradan değiştiyse eski öneri uygulanmaz.
          Program kimlikleri katalog bağlamına göre doğrulanır; model yeni
          program veya sayısal veri kaynağı değildir.
        </p>
        <p>
          Gemini adaptörü hazırdır. Canlı yanıtlar için sunucunun .env dosyasına
          GEMINI_API_KEY ve yapılandırılmış JSON destekleyen bir GEMINI_MODEL
          eklenmelidir. Anahtar tarayıcıya gönderilmez. Mesaj ve tercih bağlamı
          sağlayıcıya gider; e-posta ve adın bağlama eklenmez. Günlük mesaj
          sınırı, zaman aşımı ve sağlayıcı hata davranışları bulunur.
        </p>
        <h3>Geliştirme durumu</h3>
        <p>
          E-posta doğrulaması, öğrenci belge doğrulaması, mentorluk,
          bildirimler, yönetim ve uçtan uca şifreli mesajlaşma henüz bu sürümde
          bulunmuyor. Bunlar proje kapsamındadır; mevcut ekranlar bu özellikler
          tamamlanmış gibi davranmaz.
        </p>
      </section>
    </>
  );
}
