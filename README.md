# KampüsPusula

Kişiselleştirilmiş Üniversite Tercih Öneri Sistemi ve Danışma Platformu.
React + TypeScript, Node.js API ve PostgreSQL ile geliştirilen bitirme projesi.

Bu depo devam eden uygulamadır. Tam ürün kapsamı [proje planında](docs/proje-plani.md), gerçek geliştirme durumu [durum raporunda](docs/durum.md) bulunur.

## Yerel kurulum

Gereksinim: **Node.js 24.12 veya üzeri** ve npm. Windows'ta yönetici olarak açılmamış normal PowerShell kullanın.

```powershell
cd C:\Users\ucakm\Downloads\repos\uni
npm install
npm run dev
```

Uygulama: **http://127.0.0.1:5173**

`npm run dev`, dış `DATABASE_URL` yoksa yerel PostgreSQL'i kurar, migration'ları uygular, örnek kataloğu ve kaynaklı pilot dosyasını yükler. Varsayılan keşif yalnızca kaynaklı pilotu gösterir. Yerel şifreler ve veri `var/` altında saklanır; Git'e girmez. Terminali açık tutun. Ctrl+C servisleri kapatır, veriyi korur. İlk açılışta bir hesap oluşturun; hazır kullanıcı veya paylaşılan demo parolası yoktur.

Windows başlatıcısı PostgreSQL'in `pg_ctl` aracını kullanır. Codex'in kısıtlı Windows çalıştırma ortamı, PostgreSQL'in gerekli güvenlik belirtecini oluşturamayabilir. Bu durumda komutu normal kullanıcı PowerShell'inde çalıştırın; güvenlik kontrollerini kapatmayın.

`var/postgres` dizinini silmek hesapları ve listeleri kaybettirir. Veri temizliği yerine migration kullanın. Port çakışmasında önce çalışan kendi geliştirme terminalinizi kontrol edin. Gerektiğinde `LOCAL_PG_PORT` ile yerel PostgreSQL portunu değiştirebilirsiniz.

## Haricî PostgreSQL

`.env.example` dosyasını `.env` olarak kopyalayın; `DATABASE_URL` ve en az 32 karakterlik `JWT_SECRET` tanımlayın. Gerçek bağlantı bilgilerini commit etmeyin.

```powershell
npm run db:migrate
# Yalnızca geliştirme veritabanına örnek veri eklemek için:
npm run db:seed
npm run dev
```

Dış veritabanına otomatik örnek veri yüklenmez. Başlatıcı `.env` içindeki `DATABASE_URL` değerini kullanır. Bu ilk sürümün varsayılan portları API 3001, web 5173 ve yerel PostgreSQL 55432'dir. API'yi internetten erişilebilir hâle getirmeden önce üretim dağıtım tasarımını tamamlayın.

## Mevcut işlevler

- Ayrı sayfalar, responsive ortak düzen ve mobil menü.
- Kayıt/giriş/çıkış; scrypt parola hash'i, HttpOnly oturum çerezi, JWT ve iptal edilebilir veritabanı oturumu.
- Kalıcı profil, ilgi alanları, şehir/dil öncelikleri ve ağırlıklar.
- Program keşfi, filtrelerin URL'de saklanması, program ayrıntısı ve dört programa kadar karşılaştırma.
- Birden fazla özel tercih listesi, kalıcı notlar, sıra değiştirme ve revision çakışması kontrolü.
- TF-IDF/kosinüs ve yapılandırılmış şehir/dil eşleşmesini birleştiren ilk açıklanabilir öneri yöntemi.
- Genel konu toplulukları, soru sorma, yanıt verme ve tekrar oyu önleyen faydalı yanıt oylaması.

Kaynaklı pilot **iki gerçek ISUBÜ programı** içerir. Türkçe programın 2023–2025 sıralama/kontenjan verileri resmî bölüm sayfasından aktarılmıştır; İngilizce programın bu sayısal alanları ve her iki programın ücretleri bilinmiyor olarak bırakılmıştır. Kaynaklar, kontrol tarihleri ve içe aktarma sürümleri `/veri-kaynaklari` sayfasındadır.

Ayrı örnek katalog **12 sentetik program** içerir; filtreyle açıkça seçilir. Kaynaklı ve örnek kayıtlar listelerde de işaretlenir. Sahte öğrenci deneyimi oluşturulmamıştır.

Sıra aralığı, öğrenim ücreti ve burs filtreleri; bilinmeyen veriyi dahil etme seçimi; ücret/burs öncelikleri; öneri bileşenleri ve kalıcı uygunluk geri bildirimi eklendi. Danışman aynı arama durumunu kullanır, değişiklik önizlemesi/onayı ve geri alma sağlar.

Gemini adaptörü yapılandırıldı ancak başarılı canlı yanıt henüz doğrulanmadı: sağlayıcı model erişim kısıtı, geçici 503 ve zaman aşımı döndürdü. Hesap kurtarma/e-posta doğrulama kullanıcı kararıyla sona bırakıldı. Üniversite/bölüm üyelikleri, deneyim, mentorluk, doğrulama, itibar, yönetim ve şifreli mesajlaşma sonraki modüllerdir.

## Veri ve Gemini ayarları

```powershell
# JSON dosyasını doğrula; veri tabanını değiştirme:
npm run catalog:import -- data/pilot-isubu-2026-10.json
# Doğrulanmış dosyayı atomik ve sürümlü aktar:
npm run catalog:import -- data/pilot-isubu-2026-10.json --apply
# Çalışan mevcut yerel DB'ye yeni migration uygula:
npm run db:update-local
```

Dosya şeması `server/services/catalog-import.ts` içinde; kaynak URL, erişim tarihi, program anahtarı ve yıllık veriler gereklidir. Eksik sayılar null olur. Aynı sürüm değiştirilemez; yeni içerik yeni sürüm adı alır. Aynı dosyanın tekrarı çift kayıt oluşturmaz.

Gemini anahtarı yalnızca yerel `.env` dosyasına eklenir; sohbet, GitHub veya istemci koduna yazılmaz:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=yerel_anahtarin
GEMINI_MODEL=gemini-3.8-flash
AI_DAILY_LIMIT=10
```

Modelin listede bulunması, o anahtarla içerik üretiminin mutlaka açık olduğunu göstermez. `/api/v1/advisor/status` yalnızca yapılandırma durumudur. `.env` AI ayarları sonraki istekte okunur; danışman panelindeki Yenile ayar göstergesini günceller. Başarılı canlı yanıt alınmadan entegrasyon tamamlandı sayılmaz. Anahtar çıktıya yazılmaz ve `.env` Git dışında tutulur.

Danışman mesajı ve sınırlı tercih/program bağlamı Gemini'ye gider; ad/e-posta bağlama eklenmez. Konuşmalar kullanıcıya özeldir. Silme, mesajları ve önbellekteki konuşma içeriğini de temizler. Günlük sınır ve timeout vardır. Yeniden gönderilen aynı istek kimliği başarılı cevabı önbellekten alır; tekrar sağlayıcı çağrısı yapmaz.

## Komutlar

| Komut | Amaç |
|---|---|
| `npm run dev` | PostgreSQL + migration + API + Vite |
| `npm run build` | TypeScript kontrolü ve istemci üretim derlemesi |
| `npm run typecheck` | TypeScript kontrolü |
| `npm test` | Öneri algoritması davranış testleri |
| `npm run test:integration` | Çalışan yerel servislerde kritik API akışları |
| `npm run db:migrate` | DATABASE_URL üzerinde migration |
| `npm run db:seed` | Sentetik geliştirme kataloğu |

Entegrasyon testi geçici `example.test` hesapları oluşturur ve kendi kayıtlarını temizler. Varsayılan olarak yerel 5173 adresini hedefler; üretim ortamında çalıştırmayın.

## Depo düzeni

```text
src/components/       Ortak düzen ve arayüz bileşenleri
src/pages/            Ayrı ürün sayfaları
src/lib/              API istemcisi ve kullanıcı/karşılaştırma durumu
server/routes/        Hesap, katalog, tercihler ve topluluk modülleri
server/services/      Öneri iş mantığı
server/migrations/    Sürümlü PostgreSQL şeması
shared/               Veri sözleşmeleri ve Zod şemaları
scripts/              Kurulum, migration, seed ve entegrasyon doğrulaması
tests/                Davranış testleri
docs/                 Kapsam, durum, mimari ve yöntem
```

Uygulanmış migration dosyasını değiştirmeyin; yeni migration ekleyin. Çalışma ortamı, veri tabanı dosyaları ve gizli anahtarlar depoya yüklenmez.

### Geliştirmede hızlı giriş

npm run dev sırasında giriş sayfasındaki veya sol menüdeki **Geliştirme hesabıyla devam et** düğmesi, kalıcı deneme hesabıyla gerçek oturum açar. Profil ve tercih listeleri sonraki girişlerde korunur. Üretim istemcisinde düğme görünmez; sunucu yolu yalnızca dev:api başlatıcısında veya --dev-login bayrağıyla, NODE_ENV production değilken açılır.
