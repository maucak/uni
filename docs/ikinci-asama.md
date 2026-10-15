# Katalog, genişletilmiş öneri ve hibrit danışman

14 Ekim 2026. Kullanıcı 2 → 3 → 4 ile ilerlemeyi, hesap güvenliğinin ek modüllerini sona bırakmayı seçti. Temel oturum ve sahiplik kontrolleri korundu.

## Eklenenler

- JSON manifest doğrulama/önizleme, hata ve eksik veri raporu; atomik içe aktarma, checksum ve immutable sürüm kayıtları.
- Program anahtarı/kodu, kaynaklar, kontrol tarihleri, yıllık sıralama/kontenjan/ücret modeli. İçe aktarma önceki yıl kayıtlarını silmez; tercih listelerindeki program kimliklerini korur.
- İki gerçek ISUBÜ programı; 12 örnek program ayrı kapsamda. Gerçek pilot varsayılandır.
- Program detayında yıllık geçmiş ve kaynak bağlantıları; kaynak/sürüm sayfası.
- Sıra aralığı, en düşük burs ve yıllık öğrenim ücreti filtreleri. Bilinmeyen değerler kullanıcı seçimine göre tutulur/elenir; ücret eksikliği 0 sayılmaz.
- TF-IDF/kosinüs + şehir/dil/ücret/burs bileşenleri, kullanıcı ağırlıkları, eksik veri kapsamı, bileşen açıklamaları.
- Katalog sürümünün tutarlı snapshot üzerinde okunması ve öneri kaydına yazılması. Uygunluk geri bildirimi kullanıcı/run/program ilişkisiyle kalıcıdır.
- Aynı URL/arama durumunda filtreler, liste ve Gemini paneli. Yapılandırılmış plan, izinli alan doğrulama, katalog kimlik kontrolü, değişiklik önizlemesi/onayı ve undo.
- Filtreler değiştiğinde eski öneri uygulanmaz. Konuşma sahipliği, geçmiş sırası, silme, günlük sınır, timeout ve başarılı isteğin idempotent önbelleği.

## Gerçek veri sınırı

Türkçe ISUBÜ programı için 2023: 93.384/60, 2024: 125.316/65, 2025: 134.782/65 sıralama/kontenjan bilgileri bölümün [resmî SSS sayfasından](https://teknoloji.isparta.edu.tr/bilmuh/tr/sss) elle aktarılmıştır. Eğitim dili ve program içeriği [AKTS bilgi paketine](https://akts.isparta.edu.tr/Public/EctsShowProgramDetails.aspx?BirimNo=27&BolumNo=2721), İngilizce program [resmî aday portalına](https://aday.isparta.edu.tr/tr/bolumDetay/2731/bilgisayar-m%C3%BChendisli%C4%9Fi-%C4%B0ngilizce-7-d%C3%B6nem-okulda-1-d%C3%B6nem-i%C5%9Fletmede-e%C4%9Fitim) dayanır.

Ücret/burs ve İngilizce programın yıllık verileri doğrulanmadı; null bırakıldı. Resmî program kodları ayrıca doğrulanmadan doldurulmadı. Bu sınırlı katalog bütün Türkiye pilotunun tamamlandığı anlamına gelmez. Öncelik/filtre farklarını geniş kapsamda ölçmek için daha fazla kaynaklı program gerekir. Toplu YÖK Atlas scraping veya API izni varsayılmadı.

## Gemini'nin gerçek durumu

Kullanıcı anahtarı yerel .env dosyasına ekledi; anahtar hiçbir araç çıktısında gösterilmedi. Model listesi okunabildi. Kullanıcının yazdığı 1.5 modeli bulunmadı; 2.5 modeli listede olsa da üretim endpoint'i yeni hesaba kapalı olduğunu bildirdi ve 3.8 önerdi. Yerel ayar buna göre 3.8 oldu.

Güncel GenerateContent `responseFormat.text` JSON şeması ve düşük düşünme düzeyi kullanılıyor. Anahtar sunucuda kalır. Başarılı içerik üretimi doğrulanamadı: geçici sağlayıcı 503'ü ve ardından 30 saniyelik zaman aşımı alındı. Kullanıcının gereksiz test/harcama istememesi nedeniyle tekrarlar durduruldu. Bu nedenle “canlı AI tamamlandı” iddiası yoktur. Durum göstergesi ayarların mevcut olduğunu ifade eder; sağlayıcı sağlık onayı değildir.

Kaynak: [Gemini GenerateContent API](https://ai.google.dev/api/generate-content), [yapılandırılmış çıktı](https://ai.google.dev/gemini-api/docs/structured-output).

## Doğrulama

Üretim istemci derlemesi ve TypeScript kontrolü başarılı. Toplam 14 davranış testi geçti. İkinci aşamanın gerçek PostgreSQL/HTTP kontrolü; kaynak tarihleri, yıllık geçmiş, gerçek/örnek ayrımı, filtre eksik veri politikası, bütçe açıklaması ve geri bildirim kalıcılığı için geçti. Aynı pilot dosyası yeniden uygulanınca applied=false döndü; kayıt çoğalmadı.

Canlı AI kontrolü PASS değildir. Tüm ekranların kapsamlı browser etkileşim testi yapılmadı. Eski başarılı suite sebepsiz tekrarlanmadı; yeni değişikliklere yönelik kontroller yapıldı.

## Kalan işler

Gemini başarılı canlı yanıtı, onay/undo'nun gerçek cevapla UI kontrolü; katalog çeşitliliği ve kaynaklı ücret verisi; öneri temel filtre karşılaştırma çalışması; öğrenci topluluğu/mentorluk/şifreleme modülleri. Proje tam sürüm olarak işaretlenmedi.

## 14 Ekim 2026 — kullanıcının istediği canlı tekrar

GenerateContent ve güncel Interactions API üzerinden yapılan iki deneme de sağlayıcıdan HTTP 503 aldı. Gemini 3.x için Interactions bağlantısı eklendi; yapılandırılmış JSON çıktı ve store:false kullanılıyor. Son değişikliğin TypeScript kontrolü geçti. Başarılı canlı yanıt hâlâ doğrulanmadı; daha fazla ücretli istek gönderilmedi.

## 15 Ekim 2026 — canlı Gemini doğrulaması başarılı
Mobil ağda DNS erişimi sağlandı. Interactions API yanıtındaki steps/model_output/content metinleri okunacak şekilde ayrıştırıcı düzeltildi. Gerçek uçtan uca kontrol PASS: Gemini 3.8 Flash İngilizce dil filtresi önerdi; önbellek tekrarı, konuşma sırası ve konuşma silme doğrulandı. TypeScript geçti. Önceki başarısızlık kayıtları tarihsel durumdur; ağ erişimine bağlı hizmet sürekliliği garanti edilmez.
