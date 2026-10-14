# Geliştirme durumu

Tarih: 14 Ekim 2026. Güncel durum: katalog ve öneri ikinci aşaması eklendi; Gemini canlı yanıtı henüz doğrulanmadı. Ayrıntı: [ikinci aşama](ikinci-asama.md).

## Güncel öncelik

Kullanıcı kararı: gerçek katalog → genişletilmiş öneri → AI danışmanı. Hesap güvenliğinin e-posta/kurtarma gibi ek işleri sona bırakıldı. Kaynaklı iki program, sürümlü içe aktarma, sıra/burs/ücret ölçütleri, öneri geri bildirimi ve hibrit danışman kodu eklendi. Yerel anahtar gizli tutuluyor. Gemini servis hatası ve timeout nedeniyle başarılı canlı üretim doğrulanmadı; tekrar istekler durduruldu. Aşağıdaki bölümler ilk aşamanın tarihsel kaydıdır; güncel eksik listesi ikinci aşama belgesindedir.

## Başlangıç kararı

Kullanıcı eski kaynakların olmadığını ve önemli olmadığını belirtti. Sıfırdan, mevcut `maucak/uni` deposunda çalışıldı. Önceki sohbetin koduna bağımlılık yoktur. Kullanıcı basit bir prototiple projenin tamamlandı sayılmasını istemiyor; tam kapsam korunuyor.

## Gerçekleşen işler

- Node.js 24.12+, React/TypeScript/Vite ve PostgreSQL kurulumu.
- Yerel kalıcı PostgreSQL; migration kilidi/checksum ve idempotent örnek seed.
- Windows pg_ctl başlatma/durdurma akışı. Servis, kullanıcının normal PowerShell'inden başlatıldı.
- Ayrı ana sayfa, hesap, profil, katalog, program detayı, öneri, karşılaştırma, tercih listesi, topluluk, soru detayı ve yöntem sayfaları.
- JWT + veritabanı oturumu, scrypt parola hash'i, HttpOnly çerez, origin kontrolü, hız sınırı, sunucu doğrulaması.
- Kalıcı kullanıcı öncelikleri; özel listeler ve notlar; sıra değişikliği ve çakışma kontrolü.
- İlk TF-IDF/kosinüs + şehir/dil öneri yöntemi; gerekçeler, veri kapsamı ve eksik veri açıklaması.
- Genel topluluklar, soru/yanıt ve faydalı yanıt oylaması.
- Modüllere ayrılmış API ve ortak veri sözleşmeleri; kod biçimlendirmesi.

## Yapılan doğrulamalar

- TypeScript kontrolü ve üretim istemci derlemesi başarılı.
- 8 algoritma davranış testi başarılı.
- Gerçek PostgreSQL ve HTTP API üzerinde entegrasyon testi başarılı: kayıt/giriş, profil, katalog filtresi, öneri, kalıcı notlar, oturum iptali ve tekrar giriş.
- Başka kullanıcının listesine erişimin reddi, stale revision, geçersiz sıralama, farklı origin, kendi yanıtına oy ve yinelenen oy davranışları doğrulandı.
- Ana sayfa HTTP 200, API sağlık kontrolü başarılı.
- Dar önizleme alanında ana sayfa görsel olarak incelendi. Bütün ekranların kapsamlı mobil/masaüstü etkileşim incelemesi yapılmadı.
- Kullanıcı gereksiz test tekrarı istemediği için başarılı kontroller sebepsiz tekrarlanmadı.

## Eksikler — kapsamdan çıkarılmadı

1. Gerçek pilot katalog, sürümlü içe aktarma ve kaynak envanteri.
2. Hesap kurtarma, e-posta doğrulama, kısa erişim/refresh oturumu tasarımı, isteğe bağlı 2FA.
3. Sıralama bandı, bütçe/burs ölçütleri ve kariyer verilerinin kaynağa dayalı genişletilmesi.
4. Öneri geri bildirimi, değerlendirme ekranı ve akademik karşılaştırma.
5. AI sağlayıcı adaptörü, ortak arama durumu, yapılandırılmış değişiklik/onay/geri alma.
6. Üniversite/bölüm toplulukları, etiketler, üyelik, deneyim paylaşımları ve itibar.
7. Öğrenci/mezun doğrulaması ve özel belge depolama.
8. Gönüllü mentor profilleri ve talep durumları.
9. Bildirim, engelleme, şikâyet, toksisite desteği ve moderatör/yönetici paneli.
10. İncelenmiş protokol/kütüphane üzerinden uçtan uca şifreli mesajlaşma.
11. Üretim dağıtımı, yedek geri yükleme, gizlilik gereklilikleri ve gerçek kullanıcı çalışması.

## Sıradaki geliştirme

İlk temelin üzerine hesap güvenliği ve gerçek katalog içe aktarma altyapısı eklenmeli. Katalog veri sözlüğü ve akademik öneri değerlendirmesi hazırlanmalı. AI veya mesajlaşma eklenmeden önce ilgili sağlayıcı/protokol kararları kaydedilmeli.

## İşletim notu

Kullanıcının `npm run dev` terminali servisleri çalıştırıyor. Codex sandbox'ı PostgreSQL güvenlik belirteci oluşturamıyor; testler kullanıcı tarafından başlatılan gerçek servis üzerinden yapıldı. Bu Windows ortamı sınırlılığı gizlenmedi. Başlatıcının pg_ctl düzeltmesi sonrası kullanıcı servislerin açıldığını bildirdi ve sağlık/API testleri bunu doğruladı.

Değişiklikler yereldir. GitHub'a push veya haricî yayın yapılmadı.
