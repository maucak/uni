# Öğrenci yaşamı ilk paketi

Güncel hibrit arama mimarisi ve işletim komutları için [RAG notlarına](rag.md) bakın. Aşağıdaki 15 Ekim açıklamaları önceki uygulamayı belgeler.

## Önceki durum — 15 Ekim 2026

Ana sayfa kısa bir giriş ve iki seçenekle sadeleştirildi. Renkler kırık beyaz, taş grisi ve yumuşak maviye geçirildi. Tercih araçları açılır menü altında toplandı.

`/kampus` konu filtreli ve aramalı kaynak rehberidir. Altı maddelik kişisel başlangıç listesi kullanıcı profilinde saklanır; resmî kayıt doğrulaması değildir. `/danisman` oturum sahibine ait konuşmaları saklar, önceki konuşmaya devam eder ve silmeye izin verir. Konuşmalar başka kullanıcılar tarafından okunamaz, sürdürülemez veya silinemez.

### Kaynak akışı

`npm run life:sync` yalnızca kodda tanımlı üç resmî SSS sayfasını (İSUBÜ öğrenci rehberi, İSUBÜ SKS, GSB yurt SSS) getirir. Soruları ve cevapları başlık sınırlarından çıkarır; yarım cevap oluşturmamak için çok uzun cevapları atlar. Son başarılı veri dosyası, bütün kaynaklar başarıyla alındıktan sonra atomik olarak değiştirilir. Kaynak URL ve SHA-256 bilgileri veri dosyasında tutulur. Beklenen başlık yapısı kaybolursa komut hata verir. Otomatik zamanlama veya bütün webi tarama yoktur. Başlık sınırının anlamsal doğruluğu ve kaynaktaki eski bilgilerin güncellenmesi ayrıca kontrol gerektirir.

Bu çalıştırmada 75 resmî kaynak parçası alındı. On adet kısa rehber kartıyla birlikte arama havuzu 85 parça ve 6 kaynak sayfasıdır. Belirtilen kontrol tarihi, bilginin o tarihte yürürlükte olduğunun garantisi değildir. Kaynakta dönem yoksa arayüz bunu belirtir.

### RAG tasarımı

Akış: soru ve yakın konuşma konusu → Türkçe karakter normalizasyonu → BM25 sözcük araması → en fazla dört kanıt → mevcut AI sağlayıcısı → kaynak işaretli cevap. Önceki mesajlara bağlı kısa sorularda önceki arama konusu korunur. Bu yöntem her konuşmayı doğru yorumlama garantisi vermez. Kaynaklar üniversiteye özel veya Türkiye geneli olarak etiketlidir. Üretim sağlayıcısı değişmeden kaynak deposu ve arama kullanılabilir.

Mevcut sürümde anlamsal embedding ve vektör veritabanı yoktur. BM25 ilk uygulanabilir erişim katmanıdır. Kaynak seçimi ve yanıt oluşturma ayrı tutulduğundan daha sonra anlamsal arama eklenebilir. Güncel yanıt içindeki S1–S4 işaretleri yalnızca o yanıta ait kaynaklara referans verir; işaret denetimi olgusal doğruluk denetimi değildir.

Sağlayıcı ayarı eksik veya üretim başarısızsa kaynak parçaları gösterilir. Modelin çalışmadığı durumda arayüz “Kaynak araması” yazar. Gizli API anahtarları tarayıcıya gitmez. Gerçek sağlayıcıyla yeni bir yanıt bu geliştirme turunda test edilmedi; mevcut yapılandırma etkin değildir.

### Saklama ve sınırlar

Migration 006, kullanıcıya bağlı `life_conversations` ve `life_messages` tablolarını ekler. Sayısal mesaj sırası kullanılır. Aynı konuşmada eş zamanlı üretim engellenir. Mesajlar diğer kullanıcıların RAG havuzuna girmez. Üretim çağrıları tercih danışmanıyla aynı günlük kotayı paylaşır; kaynak araması için harici modele ihtiyaç yoktur. Konuşma silme, ilgili mesajları da siler.

Kontroller: üretim derlemesi; dört odaklı birim kontrolü; `node scripts/life-check.ts` ile kaynak arama, kontrol listesi kaydı, takip sorusu, geçmiş, kullanıcılar arası erişim engeli ve konuşma silme. Entegrasyon kontrolü kendi geçici hesaplarını oluşturup temizler. Yapılandırılmış sağlayıcı varsa canlı çağrı için `--live` gerektirir.

## İlk paket notları (tarihsel)

15 Ekim 2026

Ana sayfada tercih öncesi ve yerleşme sonrası eşit görünürlükte iki giriş vardır. `/kampus`, giriş gerektirmeyen İSUBÜ başlangıç rehberidir. Öğrenci profili şehir, kampüs ve eğitim aşamasını saklar. Eski JSON profilleri Zod varsayılanlarıyla okunur; veritabanı şeması değiştirilmez. Öğrenci rolünde tercih ayarları silinmez, formda gizlenir.

İçerik `server/services/life-content.ts` içinde kaynak, kontrol tarihi ve dönemle tutulur. Resmî İSUBÜ öğrenci rehberi, yönergeler, ulaşım sayfası ve Bilgisayar Mühendisliği hazırlık duyurusu 15 Ekim 2026'da incelendi. Hazırlık duyurusunun geçmiş başvuru olduğu açıkça işaretlidir. Bu içerik manuel doğrulanmış özetlerden oluşur; otomatik tüm üniversiteler veri toplama işlemi değildir. Canlı ulaşım/yurt ücreti veya anlaşmalı kupon verisi yoktur.

`GET /api/v1/life/guide?q=` küçük korpusta sözcük tabanlı arama yapar. `POST /api/v1/life/ask` oturum gerektirir; bulunan en fazla üç rehber parçasını mevcut sunucu tarafı AI sağlayıcısına gönderir. Ayrı sağlayıcıya geçiş, yeni model bağımlılığı veya vektör veritabanı eklenmedi. Mevcut danışmanla günlük istek kotası ortak; başarısız üretim de kotaya dahildir. Aynı istek kimliği yeniden sağlayıcı çağrısı üretmez. Yanıt yalnızca bulunan kaynakların S1–S3 işaretlerini içerebilir; işaret doğrulaması, cümlelerin kaynak tarafından anlamsal olarak doğrulandığı anlamına gelmez.

Sağlayıcı ayarı yoksa veya üretim başarısızsa kullanıcıya model cevabı yerine bulunan rehber parçaları gösterilir. Kaynak bulunmazsa sağlayıcı çağrılmaz. Bu ilk RAG denemesinde embedding, hibrit arama, otomatik belge güncellemesi ve konuşma geçmişi yoktur. Bunlar sonraki kararlarla eklenebilir.

Doğrulama: `npm run build`; `node --test tests/life.test.ts`. Gerçek sağlayıcı yanıtı ayrıca canlı kontrol edilmediyse çalışıyor sayılmaz.

