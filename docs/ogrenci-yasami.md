# Öğrenci yaşamı ilk paketi

15 Ekim 2026

Ana sayfada tercih öncesi ve yerleşme sonrası eşit görünürlükte iki giriş vardır. `/kampus`, giriş gerektirmeyen İSUBÜ başlangıç rehberidir. Öğrenci profili şehir, kampüs ve eğitim aşamasını saklar. Eski JSON profilleri Zod varsayılanlarıyla okunur; veritabanı şeması değiştirilmez. Öğrenci rolünde tercih ayarları silinmez, formda gizlenir.

İçerik `server/services/life-content.ts` içinde kaynak, kontrol tarihi ve dönemle tutulur. Resmî İSUBÜ öğrenci rehberi, yönergeler, ulaşım sayfası ve Bilgisayar Mühendisliği hazırlık duyurusu 15 Ekim 2026'da incelendi. Hazırlık duyurusunun geçmiş başvuru olduğu açıkça işaretlidir. Bu içerik manuel doğrulanmış özetlerden oluşur; otomatik tüm üniversiteler veri toplama işlemi değildir. Canlı ulaşım/yurt ücreti veya anlaşmalı kupon verisi yoktur.

`GET /api/v1/life/guide?q=` küçük korpusta sözcük tabanlı arama yapar. `POST /api/v1/life/ask` oturum gerektirir; bulunan en fazla üç rehber parçasını mevcut sunucu tarafı AI sağlayıcısına gönderir. Ayrı sağlayıcıya geçiş, yeni model bağımlılığı veya vektör veritabanı eklenmedi. Mevcut danışmanla günlük istek kotası ortak; başarısız üretim de kotaya dahildir. Aynı istek kimliği yeniden sağlayıcı çağrısı üretmez. Yanıt yalnızca bulunan kaynakların S1–S3 işaretlerini içerebilir; işaret doğrulaması, cümlelerin kaynak tarafından anlamsal olarak doğrulandığı anlamına gelmez.

Sağlayıcı ayarı yoksa veya üretim başarısızsa kullanıcıya model cevabı yerine bulunan rehber parçaları gösterilir. Kaynak bulunmazsa sağlayıcı çağrılmaz. Bu ilk RAG denemesinde embedding, hibrit arama, otomatik belge güncellemesi ve konuşma geçmişi yoktur. Bunlar sonraki kararlarla eklenebilir.

Doğrulama: `npm run build`; `node --test tests/life.test.ts`. Gerçek sağlayıcı yanıtı ayrıca canlı kontrol edilmediyse çalışıyor sayılmaz.
