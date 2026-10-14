# Başlangıç planına uyum çalışması

14 Ekim 2026. Referans: 9 sayfalık başlangıç planı v0.1. Belgedeki açık kararlar kesinleşmiş kapsam sayılmaz.

## İlk uygulama: program toplulukları

- Kaynaklı programların ayrı toplulukları ve program detayından doğrudan geçiş.
- Yeni katalog içe aktarmalarında program topluluğunun aynı transaction içinde oluşturulması.
- Soru başlığı/gövdesinde arama; konu etiketi ile filtreleme.
- En fazla beş etiket; mevcut sorular için boş etiket listesi.
- Sorudan kendi topluluğuna dönüş. Okuma açık, katkı için gerçek oturum zorunlu.

Doğrulama: TypeScript ve üretim derlemesi geçti. Migration 004 uygulandı. Gerçek PostgreSQL/HTTP kontrolü program topluluklarını, soru oluşturmayı, metin/etiket aramasını ve program ayrımını doğruladı. Geçici soru kontrol sonunda silindi. Servisler 127.0.0.1:5173 üzerinde açık.

## Sonraki işler

1. Kaynaklı pilotu farklı program türleriyle genişletme; eksik resmi kod/ücret bilgisini doğrulama.
2. Çoklu akademik bağlantı ve doğrulama talep/onay/ret; moderatör yetkilerinin sunucuda kontrolü.
3. Şikâyet, moderasyon işlem izi, engelleme ve bildirimler.
4. Kesin koşullar ile puana etki eden öncelikleri açıkça ayırma.
5. A: ölçütler; B: ölçütler + TF-IDF; C: ölçütler + gömme modeli. Ortak veri/girdi sürümleriyle karşılaştırma.
6. Kör değerlendirme, ayrı ayar/test katılımcıları, NDCG@5 ve koşul ihlali ölçümü.

AI danışmanı bu yöntemlerin yerine geçmez. Mentorluk ve özel mesajlaşma kapsam kararları ayrı tutulur. Platformun tamamlandığı veya yüzde 80 seviyesine geldiği iddia edilmez.
