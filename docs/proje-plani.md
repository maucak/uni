# KampüsPusula — Kapsamlı Proje Planı ve Devir Belgesi

Sürüm: 1.0 · Tarih: 14 Ekim 2026 · Belge dili ve varsayılan ürün dili: Türkçe

Bu belge, önceki sohbetleri okumamış bir geliştiricinin, proje ortağının veya yapay zekâ ajanının projeyi anlayıp aşamalar hâlinde geliştirebilmesi için hazırlanmıştır. Ürün gereksinimlerini, önerilen teknik tasarımı, araştırma planını ve tamamlanma ölçütlerini birlikte içerir. Bir yazılımın tamamlandığına dair rapor değildir.

## 1. Projenin kimliği ve amacı

**Çalışma adı:** KampüsPusula.

**Onaylı tez başlığı:** Kişiselleştirilmiş Üniversite Tercih Öneri Sistemi ve Danışma Platformu.

**Ekip:** Mehmet Ali Uçak ve Mesut Özdemir; iki kişilik bitirme projesi ekibi.

**Problem:** Üniversite adayının program seçimi yalnızca başarı sırasına dayanmaz. İlgi alanı, eğitim dili, şehir, bütçe ve kariyer hedefleri de önemlidir. Aday ayrıca bölümü deneyimlemiş öğrencilere ulaşmak ister. Yerleştikten sonra da ders, hazırlık, staj, barınma ve kampüs yaşamı hakkında bilgiye ihtiyaç duyar.

**Çözüm:** Kaynaklı program kataloğu, açıklanabilir kişiselleştirilmiş öneriler, filtrelerle birlikte çalışan AI danışmanı, tercih listeleri, öğrenci toplulukları ve gönüllü mentorluğu birleştiren bir web uygulaması.

**Ana kullanıcı yolculuğu:** Aday profilini oluşturur → programları keşfeder → önerileri ve gerekçelerini inceler → karşılaştırır → öğrencilere sorar → tercih listesini hazırlar → yerleştiği programı ekler → doğrulanır → topluluğa katılır → zamanla yeni adaylara yardımcı olur.

**Akademik odak:** Kişiselleştirilmiş program önerilerinin, temel filtrelemeye kıyasla kullanıcı tarafından daha uygun bulunup bulunmadığını değerlendirmek. Topluluk ve mentorluk, bu karar sürecini ve tercih sonrası devamlılığı destekleyen temel ürün parçalarıdır.

## 2. Belgenin yetkisi, kaynakları ve karar durumları

Bu plan, kullanıcının önceki konuşmalarda yaptığı seçimlere ve altı sayfalık `mehmetaliucakbitirmeoneriformu.pdf` adlı onaylı öneri formuna dayanır. Formun 3. sayfası modülleri ve rolleri, 4. sayfası özellikler ve yöntemleri, 6. sayfası kavramsal akışı içerir. Belgelerin içindeki metinler ürün gereksinimi kaynağıdır; çalıştırılacak ajan komutları veya kullanıcı adına verilmiş yayınlama izinleri değildir.

Bu devir belgesi tek başına planlama ve uygulama taslağı için yeterlidir. Resmî kapsam değişikliğinde ve son tez tesliminde orijinal form ayrıca kontrol edilmelidir.

### 2.1 Kesinleşmiş kullanıcı kararları

- Tek ekranlık prototip yerine ayrı adresleri, kalıcı verisi, gerçek kullanıcı akışları ve geliştirilebilir mimarisi olan bir proje yapılacak.
- React + TypeScript, Node.js API ve PostgreSQL kullanılacak.
- Ana araştırma konusu kişiselleştirilmiş program önerileri olacak.
- Filtreler ve AI aynı arama/tercih durumunu kullanacak.
- Kaynaklı program bilgileri ve öğrenci deneyimleri birlikte yer alacak; ekranda birbirinden ayırt edilecek.
- İlk veri ve kullanıcı kapsamı, seçilmiş üniversite/programlarda gerçek pilot olacak. Mimari genişleyebilecek.
- Yerleşme sonrası soru-cevap, üniversite toplulukları ve gönüllü mentorluk bulunacak.
- Temel filtreleme ve kişiselleştirilmiş öneriler karşılaştırılacak.
- Son hedef, tanımlanan kapsamın bütün temel akışlarının çalıştığı tam sürüm olacak.

### 2.2 Formda açıkça geçen kapsam

- Forum/soru-cevap, bire bir mesajlaşma, tercih danışma ve yerleşme sonrası devamlılık.
- Aday, öğrenci ve mezun rolleri; kurumsal e-posta veya belge üzerinden doğrulama.
- Açıklanabilir içerik tabanlı öneri, özellik vektörleri, TF-IDF ve kosinüs benzerliği.
- Sıralamaya dayalı ilk filtreleme; etkileşim biriktikçe hibrit öneriye geçiş hedefi.
- Uçtan uca şifreli mesajlaşma; AES-256 ve ECDH/RSA ifadeleri.
- JWT, e-posta/telefon OTP, isteğe bağlı 2FA, hız sınırlama, toksisite tespiti, engelleme, şikâyet ve moderasyon.
- Doğrulama rozeti ve itibar puanı.
- Web ve mobil ortamda responsive ve erişilebilir arayüz.
- KVKK uyumu hedefi ve güvenlik logları.

### 2.3 Bu belgenin önerdiği varsayılanlar

Bunlar uygulanabilir başlangıç kararlarıdır; eski projede iyi çalışan eşdeğerleri varsa gerekçesiz değiştirilmemelidir.

- Tek depo, modüler Node.js sunucusu, React/Vite istemcisi ve REST API.
- Mobil uyumlu web; kurulabilir PWA ikinci adım olabilir. Ayrı native mobil uygulama şu an kesin kapsam değildir.
- E-posta doğrulaması başlangıç kanalı; SMS ihtiyacı ve sağlayıcısı ayrıca seçilir.
- AI ve şifreleme sağlayıcılarına bağımlılığı sınırlandıran servis arayüzleri.
- Güncellenen katalog için sürümlü veri içe aktarma; yerel geliştirmede açıkça etiketlenmiş örnek veri.
- Bütçe uygunsa yönetilen PostgreSQL ve uygulama barındırma; kesin sağlayıcı henüz seçilmedi.

### 2.4 Açık kararlar ve ne zaman çözülecekleri

| Karar | Varsayılan yaklaşım | En geç çözüm aşaması |
|---|---|---|
| Eski kaynak kodu kurtarılabilir mi? | Önce mevcut depo/ZIP/klasörü incele | Aşama 0 |
| Pilot üniversite ve programlar | Ulaşılabilir gönüllüleri olan sınırlı gerçek katalog | Veri edinme başlamadan |
| Resmî verinin edinme yöntemi | Kaynak ve kullanım koşulları doğrulanmış içe aktarma | Gerçek katalog yüklenmeden |
| Sıralama filtresi | Puan türü kesin; geçmiş sıralama bandı kullanıcı kontrollü | Öneri motoru tasarımında |
| Mobil teslim biçimi | Responsive web; form yorumunu danışmanla teyit | Mimari kapanışında |
| AI sağlayıcısı ve harcama sınırı | Değiştirilebilir adaptör; AI olmadan çekirdek çalışır | AI entegrasyonundan önce |
| Uçtan uca şifreleme protokolü | İncelenmiş kütüphane/protokol, özel kriptografi yazılmaz | Mesajlaşma kodlanmadan |
| Mezun doğrulama belgesi | Mezuniyeti kanıtlayabilen inceleme akışı | Doğrulama modülünde |
| OTP kanalı, 2FA yöntemi | E-posta OTP; isteğe bağlı TOTP önerisi | Hesap güvenliğinde |
| Veri saklama süreleri ve hukuki metinler | Veri envanteri ve güncel gerekliliklere göre belirleme | Gerçek kullanıcı pilotundan önce |
| Katılımcı sayısı ve araştırma izinleri | Danışmanla çalışma tasarımı ve gerekli izinler | Kullanıcı değerlendirmesinden önce |

Teslim tarihi ve haftalık kapasite bilinmiyor. Bu nedenle takvim, uydurma tarih yerine bağımlılık ve kabul ölçütleriyle kurulmuştur. Kapsam değişiklikleri karar kaydına yazılmalıdır.

## 3. Başlangıç durumunun doğru anlaşılması

Eski sohbetin bulut ortamı silinmiş ve devam ettirilemiyor. Önceki asistan aşağıdaki parçaları geliştirdiğini bildirmiştir: ayrı sayfalar, hesaplar, profil, PostgreSQL, program kataloğu, açıklamalı öneriler, tercih listesi ve karşılaştırma. Ancak bu belgede bu iddialar doğrulanmış kabul edilmez.

Bilinen dosya adları:

```text
scripts/dev.ts
scripts/migrate.ts
scripts/seed.ts
server/migrations/001_initial.sql
server/services/recommendation.ts
server/auth.ts
server/catalog.ts
server/db.ts
server/index.ts
shared/contracts.ts
src/components/Layout.tsx
src/components/ui.tsx
src/lib/api.ts
src/lib/store.tsx
src/lib/useLoad.ts
src/pages/Auth.tsx
src/pages/Compare.tsx
src/pages/Home.tsx
src/pages/Method.tsx
src/pages/Preferences.tsx
src/pages/Profile.tsx
src/pages/ProgramDetail.tsx
src/pages/Programs.tsx
src/main.tsx
vite.config.ts
```

Yalnızca `scripts/dev.ts` içeriği bu devirde görüldü. Diğer dosyaların varlığı veya kalitesi kaynak depo üzerinden doğrulanmalıdır. Eski `/workspace/uni` yolu, mevcut makinede erişilebilir bir proje yolu sayılmaz.

Görülen başlatıcı, `DATABASE_URL` yoksa embedded PostgreSQL açıyor; yerel şifreyi `var/local-database.json` içinde, verileri `var/postgres` altında saklıyor; migration ve yerel seed çalıştırıp servisleri başlatıyor. Başlatıcıda oluşturulan bağlantı adresi `process.env.DATABASE_URL` içine atanmıyor. `server/db.ts` görülmeden bunun kesin hata olduğu söylenemez; ilk denetimde kontrol edilmelidir.

Ek kontrol listesi: Windows'ta alt süreçlerin kapanması, başlatma hatasında kaynak temizliği, port çakışması, migration hatası, seed tekrar çalıştırma güvenliği, `var/` ve gizli bilgilerin Git dışında tutulması. Yerel embedded PostgreSQL üretim veritabanı stratejisi değildir.

## 4. Ürün sınırları ve tam sürüm tanımı

Tam sürüm; aşağıdaki işlevlerin gerçek sunucu/veri tabanı üzerinden çalışması, kritik akışların test edilmesi ve pilot gerçek verinin bulunması anlamına gelir. Türkiye'deki bütün programların eklenmiş olması veya çok sayıda aktif kullanıcı bulunması şart değildir.

### Dahil

1. Hesap, oturum, profil, rol geçişleri ve hesap kurtarma.
2. Kaynaklı ve yıllara göre ayrılmış program kataloğu.
3. Arama, filtreleme, karşılaştırma ve tercih listeleri.
4. Açıklanabilir öneri motoru ve değerlendirme altyapısı.
5. Aynı arama üzerinde çalışan AI danışmanı.
6. Üniversite/bölüm toplulukları, soru-cevap ve deneyim paylaşımı.
7. Öğrenci/mezun doğrulaması ve itibar.
8. Gönüllü mentorluk talepleri.
9. Uçtan uca şifreli bire bir mesajlaşma.
10. Bildirim, engelleme, şikâyet ve yönetim.
11. Dağıtım, yedekleme, dokümantasyon ve tez değerlendirmesi.

### Şimdilik kapsam dışı

- Ücretli mentorluk, ödeme, görüntülü görüşme ve karmaşık randevu sistemi.
- Ayrı native mobil uygulamalar; ancak danışmanın zorunlu tuttuğu doğrulanırsa plan güncellenir.
- Tam teşekküllü etkinlik biletleme, kulüp yönetimi ve barınma ilan pazarı.
- Otomatik mentor eşleştirmeyi ikinci araştırma projesine dönüştürmek.
- Kesin yerleşme tahmini veya kabul garantisi.
- Veri yokken bölüm kalitesi, istihdam, staj veya yaşam maliyeti puanı üretmek.

## 5. Roller ve erişim kuralları

| Rol/durum | Yapabilecekleri |
|---|---|
| Ziyaretçi | Açık katalog ve izin verilen topluluk içeriklerini okuma |
| Aday | Profil, öneri, liste, soru/yanıt, mentor talebi, izinli mesajlaşma |
| Öğrenci | Aday özellikleri + üniversite/program bağlantısı ve deneyim paylaşımı |
| Mezun | Mezuniyet ve kariyer deneyimi, gönüllü destek |
| Doğrulanmış kullanıcı | Doğrulanmış bağlantı rozeti; doğrulama türü ve kapsamı görünür |
| Mentor | Ayrı yetki rolünden ziyade, uygun kullanıcının açıp kapatabildiği gönüllü destek profili |
| Moderatör | Yetkisi kapsamındaki şikâyet ve içerik işlemleri |
| Yönetici | Katalog, doğrulama, rol yönetimi ve sistem işlemleri |

Rol ile doğrulama durumu ayrı tutulur. Kullanıcının kendini öğrenci olarak tanımlaması otomatik doğrulanmış rozet vermez. Kurumsal e-posta her durumda bölüm, güncel öğrencilik veya mezuniyetin tamamını kanıtlamaz; rozet yalnızca gerçekten doğrulanan iddiayı göstermelidir. İstemciden gelen rol ve sahiplik iddialarına güvenilmez; tüm kontroller sunucudadır.

## 6. Sayfa haritası ve kullanıcı deneyimi

Önerilen adresler aşağıdadır; eski projede eşdeğer tutarlı adresler varsa korunabilir.

| Adres | Amaç ve temel içerik |
|---|---|
| `/` | Ürünün amacı, program keşfine ve hesaba giriş |
| `/kayit`, `/giris` | Hesap oluşturma ve oturum |
| `/sifremi-unuttum`, `/sifre-yenile` | Güvenli hesap kurtarma |
| `/baslangic` | Puan türü, sıra, ilgi ve önceliklerle yönlendirmeli profil |
| `/profil`, `/ayarlar` | Profil, rol geçişi, güvenlik ve gizlilik |
| `/programlar` | Filtreler, sonuçlar, sıralama ve bağlamsal AI paneli |
| `/programlar/:id` | Yıllık veriler, kaynaklar, açıklamalar, topluluk bağlantısı |
| `/karsilastir` | Seçilen programların aynı alanlarda karşılaştırılması |
| `/tercihler`, `/tercihler/:id` | Listeler, sıralama, kişisel notlar |
| `/topluluklar` | Üniversite ve bölüm topluluklarını keşfetme |
| `/topluluklar/:slug` | Sorular, deneyimler, etiketler ve üyelik |
| `/sorular/:id` | Soru, yanıtlar, oy ve şikâyet |
| `/deneyimler/:id` | Yapılandırılmış deneyim ve bağlamı |
| `/mentorlar`, `/mentorlar/:id` | Destek konuları ve talep gönderme |
| `/mentorluk-talepleri` | Gelen/giden talepler |
| `/mesajlar`, `/mesajlar/:id` | İletişim istekleri ve şifreli görüşmeler |
| `/bildirimler` | Okundu durumu ve ilgili içeriğe geçiş |
| `/yontem`, `/veri-kaynaklari` | Öneri yöntemi, sınırlar ve kaynaklar |
| `/yonetim/*` | Katalog, doğrulama, şikâyet ve denetim |

### Tasarım ilkeleri

- Sade, güven veren, Türkçe bir arayüz. Tutarlı renk, tipografi, boşluk ve bileşen sistemi.
- Mobilde filtre ve AI panelleri erişilebilir çekmece/sekme düzenine dönüşür; masaüstü ekran sıkıştırılmaz.
- Her veri ekranında yüklenme, boş sonuç, hata, yeniden deneme ve yetkisiz erişim durumları tasarlanır.
- Klavye ile kullanım, görünür odak, alan etiketleri, okunur kontrast ve ekran okuyucu anlamları gözetilir.
- Resmî/kaynaklı veri, kullanıcı deneyimi ve AI özeti farklı etiketlenir.
- Eksik değer `0` olarak gösterilmez; “veri bulunmuyor” denir.
- Program kartında program kimliği, üniversite, şehir, dil, puan türü, veri yılı ve listeye ekleme bulunur.
- Uyum puanı yüzde biçimindeyse dahi olasılık değildir; arayüz bunu açıklar. Tercihen “uyum endeksi” adı kullanılır.
- Tercih sıralaması sürükle-bırak yanında klavye/düğme ile de değiştirilebilir.

## 7. Modül gereksinimleri ve kabul ölçütleri

### 7.1 Hesap ve profil

Kayıt, e-posta doğrulama, giriş, çıkış, parola yenileme, oturum iptali; aday/öğrenci/mezun profilleri. Profilde puan türü, gerçek/tahmini sıra, sınav yılı, ilgi alanları, şehirler, eğitim dili, üniversite/öğretim türü, bütçe ve öncelikler bulunur. Gereksiz kişisel veri toplanmaz. Net bilgileri formda vardır; kullanılacaksa sınav yılıyla ve isteğe bağlı saklanır, bunlardan doğrulanmamış başarı sırası tahmini yapılmaz.

**Kabul:** Yeniden girişte profil korunur; başka kullanıcının profili değiştirilemez; rol değişikliği doğrulamayı atlatmaz; şifre sıfırlama belirteci süreli ve tek kullanımlıktır.

### 7.2 Katalog ve karşılaştırma

Üniversite, bölüm kavramı ve belirli program ayrılır. Dil, burs, öğretim türü gibi farklılıklar ayrı program kimliğinde temsil edilir. Yıllık kontenjan, başarı sırası, puan ve ücret bilgileri tarihsel kayıtlardır. Kaynak URL'si/belgesi, erişim tarihi, veri yılı ve son kontrol zamanı tutulur. Filtreler URL'ye yansıtılır; listeleme sayfalanır.

**Kabul:** Filtreler birlikte doğru çalışır; program detayındaki değerler kaynak/yılla eşleşir; karşılaştırmada eksik değerler görünür; doğrudan sayfa adresi açılabilir.

### 7.3 Tercih çalışma alanı

Bir kullanıcının birden fazla adlı listesi olabilir. Listeye program ekleme/çıkarma, sıra değiştirme ve kişisel not vardır. Aynı program aynı listede tekrarlanmaz. Karşılaştırma seçimi listeyle karıştırılmaz. Bunlar kişisel çalışma listeleridir; resmî tercih başvurusu yapmaz.

**Kabul:** Liste ve notlar kalıcıdır; sıralama işlemi atomiktir; eşzamanlı değişiklik sessiz veri kaybına neden olmaz; listeler varsayılan olarak özeldir.

### 7.4 Topluluk ve deneyimler

Üniversite ve bölüm toplulukları; sorular, yanıtlar, kategori/etiket, arama, faydalı yanıt oyu ve kabul edilen yanıt. Deneyim kaydı serbest metnin yanında konu, ilgili program, deneyim yılı ve yazarın o dönemdeki durumunu içerir. Ders, hazırlık, staj, kampüs ve barınma başlangıç konularıdır. Üniversite gündemi ve etkinlik konuşmaları paylaşım kategorisi olarak sunulabilir.

**Kabul:** Soru doğru topluluğa bağlanır; oy tekrarlanamaz; kendi içeriğine oy kuralları tanımlıdır; silinen/gizlenen içerik normal akıştan çıkar; resmi bilgi ile deneyim karışmaz.

### 7.5 Doğrulama ve itibar

Başvuru durumları: `pending`, `approved`, `rejected`, `revoked`. E-posta alan adı ve/veya belge incelemesi; ret gerekçesi ve inceleyen kaydı. Belgeler herkese açık dosya deposunda tutulmaz. Boyut/tür kontrolleri ve saklama/silme politikası uygulanır. İtibar, sürümlenen kurallarla katkı olaylarından hesaplanır; rozetle aynı şey değildir. Kendine oy, tekrar olay ve karşılıklı puan şişirme dikkate alınır.

**Kabul:** Kullanıcı kendini onaylayamaz; yalnızca yetkili inceleyici belgeye erişebilir; doğrulama kaldırıldığında rozet güncellenir; puan değişiminin nedeni izlenebilir.

### 7.6 Mentorluk

Gönüllü profil; program bağlantısı, destek konuları, kısa tanıtım ve yeni talep kabul etme ayarı. Talepler `pending`, `accepted`, `declined`, `cancelled`, `completed` durumlarındadır. Mentor keşfi başlangıçta konu/program filtresiyle yapılır; karmaşık otomatik eşleştirme şart değildir.

**Kabul:** Yalnızca alıcı kabul/ret yapabilir; yinelenen açık talepler önlenir; kabul edilen talep uygun iletişim akışını açar; engellenen kullanıcı yeni talep gönderemez.

### 7.7 Bildirim ve yönetim

Yanıt, mentorluk, doğrulama ve iletişim isteği bildirimleri. Şifreli mesaj içeriği bildirimlere veya loglara yazılmaz. Yönetimde katalog içe aktarma, doğrulama inceleme, içerik şikâyeti, kullanıcı yaptırımı ve denetim kayıtları bulunur. Otomatik toksisite tespiti moderatör kararını destekler; eşik, model sürümü ve yanlış pozitifler izlenir.

**Kabul:** Bildirim sahibinden başkasına açılmaz; yönetim işlemleri denetlenir; engelleme ve yaptırımlar bütün ilgili API'lerde uygulanır.

## 8. Öneri motorunun uygulanabilir tasarımı

### 8.1 Girdi ve çıktı

Girdi: Profil sürümü, puan türü, isteğe bağlı sıra/yıl, kesin filtreler, esnek öncelikler, ilgi metni/etiketleri, katalog sürümü.

Çıktı: Sıralı program listesi, uyum endeksi, bileşen katkıları, eşleşmeyen tercihler, eksik veriler, kaynak kimlikleri ve algoritma sürümü. Kullanıcının sıra bilgisi yoksa diğer özelliklerle keşif yapılabilir; sıra karşılaştırması gösterilmez.

### 8.2 Kesin filtre ile tercih ağırlığını ayırma

“Sadece Ankara” kesin filtre; “Ankara öncelikli” ağırlıklı tercihtir. Puan türü gibi kategorik uygunluk ile geçmiş yıl başarı sırası birbirinden ayrılır. Formdaki sıralama sert filtresi sessizce kaldırılmaz: yapılandırılabilir sıra bandıyla uygulanması önerilir, danışmanla karara bağlanır. Geçmiş yıl sınırı gelecekteki yerleşmenin kesin sınırı değildir. Kullanıcı filtre yüzünden kaç program elendiğini görebilmeli ve bandı değiştirebilmelidir.

### 8.3 Ortak özellik uzayı

Profildeki one-hot/sayısal vektör ile programın TF-IDF vektörü doğrudan aynı uzayda değildir. İki ayrı eşleşme kanalı kurulur:

1. **Yapılandırılmış uyum:** Şehir, dil, tür, burs/bütçe ve mevcut diğer ortak alanlar için açık eşleşme fonksiyonları. Kategorik alanlarda çoklu seçim/one-hot kullanılabilir. Sayısal alanlarda min-max dönüşümünün hangi veri üzerinde öğrenildiği kaydedilir; sabit aralıkta sıfıra bölme önlenir.
2. **Metinsel ilgi uyumu:** Programın kaynaklı ders/açıklama metni ile kullanıcının ilgi/hedef metni aynı TF-IDF sözlüğü ve dönüşümü kullanır. Kullanıcı metni sabitlenmiş program korpusu üzerine dönüştürülür. Türkçe metin temizleme, durak sözcükler ve alan terimleri sürümlenir. İki metin vektörü arasında kosinüs benzerliği hesaplanır.

Net, sıra ve ücret gibi sayısal alanlar TF-IDF metnine rastgele eklenmez; uygun yapılandırılmış kanalda ele alınır. Boş metin veya sıfır vektör açık bir eksik veri durumudur.

### 8.4 Başlangıç puanlama yaklaşımı

Her bileşen için `s_j ∈ [0,1]`, kullanıcı önceliği için `w_j ≥ 0`, veri mevcutsa `a_j=1` tanımlanır.

```text
gözlenen_uyum = Σ(w_j × a_j × s_j) / Σ(w_j × a_j)
veri_kapsamı = Σ(w_j × a_j) / Σ(w_j)
```

Payda sıfırsa skor üretilmez. Eksik alanlar olumlu eşleşme sayılmaz. Yalnızca tek bilinen alanla yüksek skor alan programların yanıltıcı biçimde öne çıkmasını önlemek için başlangıçta `sıralama_skoru = gözlenen_uyum × veri_kapsamı` kullanılabilir. Bu bir **başlangıç hipotezidir**; eksik veriye ceza miktarı değerlendirmede incelenmeli, hem uyum hem kapsam ayrı gösterilmelidir. Eşitlikler sabit program kimliğiyle çözülerek sonuç tekrarlanabilir tutulur.

Ağırlıklar yapılandırma dosyasında, kullanıcı ayarları sınırlar içinde saklanır. Sonuçlara bakarak test kümesi üzerinde ağırlık ayarlamak yapılmaz. Başarı sırası kişisel ilgi uyumu yüzdesine dönüştürülmez; tarihsel karşılaştırma ayrı alandır.

### 8.5 Açıklamalar

Gerekçeler skor bileşenlerinden deterministik üretilir: “Seçtiğin şehirde”, “İngilizce eğitim önceliğinle eşleşiyor”, “İlgi metnin ile ders açıklamalarında şu konular örtüşüyor”. Eksikler de gösterilir: “Bu yıl için ücret verisi bulunmuyor”. AI bunları sadeleştirebilir ama yeni gerekçe icat edemez.

### 8.6 Deneyimler ve davranışla gelişim

İlk sürümden itibaren isteğe bağlı ve asgari etkileşim olayları toplanabilir: gösterim, detay açma, listeye ekleme, açık uygunluk geri bildirimi. Tıklama tek başına kalite veya beğeni etiketi sayılmaz.

Deneyimlerin skora eklenmesi için minimum örnek, güncellik, yazar çeşitliliği ve doğrulama kapsamı belirlenir. Yeterli pilot veri yoksa deneyimler bilgi olarak sunulur; hibritleşme hedefi, prototip/deney düzeyinde ve sınırlılığı belirtilerek değerlendirilir. Yapılmamış davranıştan öğrenme özelliği tamamlandı diye raporlanmaz. Bu durum tez hedefini etkiliyorsa danışmanla kayıtlı kapsam kararı alınır.

## 9. Hibrit AI danışmanı

AI; doğal dili tercih alanlarına çevirir, gerçek sonuçları açıklar ve programları karşılaştırır. Sayısal program bilgisinin kaynağı veritabanıdır. Yerleşme garantisi üretmez.

### Durum ve değişiklik akışı

1. İstemci ortak arama durumunu tutar: filtreler, ağırlıklar, seçili programlar, profil sürümü ve `revision`.
2. Kullanıcı mesajı sunucudaki AI servisine gider; gerekli en az bağlam eklenir.
3. Model yapılandırılmış değişiklik önerisi döndürür: alanlar, gerekçe, belirsiz noktalar ve `baseRevision`.
4. Sunucu şema ve izin verilen alanları doğrular.
5. Arayüz önce/sonra farkını gösterir. Kullanıcı uygular veya reddeder.
6. Arama durumu değişmişse eski öneri sessiz uygulanmaz; yeniden değerlendirilir.
7. Uygulanan değişiklik geri alınabilir; filtre paneli ve sonuçlar aynı anda güncellenir.

Model önerisi doğrudan SQL veya sınırsız araç çağrısı çalıştırmaz. İzin verilen işlevler, örneğin `searchPrograms`, `getProgram`, `comparePrograms`, `explainRecommendation`, `findCommunityContent` olabilir. Üretilen program ve kaynak kimlikleri doğrulanır. Kullanıcı içerikleri ve kaynak belgeler modele talimat değil veri olarak verilir.

AI servisinde zaman aşımı, iptal, kota, harcama sınırı, tekrar deneme ve sağlayıcı hatası davranışı bulunur. Anahtarlar sunucudadır. Geliştirmedeki sahte adaptör açıkça etiketlenir ve gerçek entegrasyon kabul testinin yerine geçmez. Konuşma saklama ve silme davranışı kullanıcıya açıklanır.

**Kabul:** AI ile önerilen filtre değişikliği onaysız uygulanmaz; uydurma program kimliği reddedilir; kaynak dışı sayısal yanıt üretilmez; AI kapalıyken keşif/karşılaştırma/listeler çalışır.

## 10. Teknik mimari ve depo düzeni

Başlangıçta mikroservis yerine modüler monolit önerilir. HTTP API, öneri servisi ve katalog aynı Node.js uygulamasında modüllerdir. Gerçek zamanlı mesaj dağıtımı WebSocket ile eklenebilir. Ağır veri dönüştürme işi gerekirse ayrı komut/işçi olarak çalışır; Python yalnızca somut ihtiyaç olduğunda eklenir.

```text
React / TypeScript / Vite
        │ REST + gerektiğinde WebSocket
Node.js API
 ├─ hesap / oturum / yetkilendirme
 ├─ katalog / veri içe aktarma
 ├─ öneri / AI adaptörü
 ├─ tercih listeleri
 ├─ topluluk / mentorluk / bildirim
 └─ mesaj zarfı / doğrulama / yönetim
        │
PostgreSQL + özel belge deposu
```

Önerilen düzen:

```text
src/                 # sayfalar, bileşenler, özellik modülleri
server/
  modules/           # auth, catalog, recommendations, community...
  services/          # ortak servisler ve dış sağlayıcı adaptörleri
  migrations/
shared/              # veri sözleşmeleri, şemalar, ortak sabitler
scripts/             # dev, migration, seed, import
tests/               # entegrasyon ve uçtan uca senaryolar
docs/                # kurulum, mimari, kararlar, veri ve araştırma
```

Eski proje aynı sorumlulukları daha basit bir yapıyla karşılıyorsa toplu yeniden yazım yapılmaz. Sunucu durumunu ve yerel arayüz durumunu ayır; şema doğrulaması ve API sözleşmeleri paylaşılabilir. Paket sürümleri uygulama sırasında resmî belgelerden doğrulanıp kilit dosyasına sabitlenir.

## 11. Veri modeli

Aşağıdaki tablo mantıksal modeldir; migration SQL'i değildir. Kimlikler UUID olabilir. Zamanlar UTC tutulup istemcide gösterilir. Yabancı anahtarlar, benzersizlikler ve sorgu indeksleri migration ile tanımlanır.

| Varlık | Başlıca alanlar ve ilişkiler |
|---|---|
| `users` | id, email, password_hash, status, email_verified_at |
| `profiles` | user_id, display_name, role, bio, yerleşme/mezuniyet bilgisi |
| `preference_profiles` | user_id, version, score_type, rank, rank_kind, exam_year, interests, weights |
| `sessions` | user_id, refresh_token_hash, expiry, revoked_at |
| `verification_tokens` | user_id, purpose, token_hash, expiry, consumed_at |
| `universities` | id, name, city, type, source_id |
| `departments` | id, name, normalized_subject_tags |
| `programs` | id, official_code, university_id, department_id, language, scholarship, study_type, score_type |
| `program_year_data` | program_id, year, rank, score, quota, fee, currency, source_id |
| `program_documents` | program_id, source_id, extracted_text, content_hash |
| `data_sources` | source_url/reference, publisher, year, retrieved_at, usage_notes |
| `import_batches` | version, checksum, status, validation_report, imported_by |
| `preference_lists` | user_id, name, revision, created_at |
| `preference_items` | list_id, program_id, position, private_note |
| `recommendation_runs` | user_id/anon_id, algorithm_version, catalog_version, input_snapshot, created_at |
| `recommendation_feedback` | run_id, program_id, explicit_rating, feedback_context |
| `communities` | university_id, optional department_id, slug, name |
| `community_memberships` | community_id, user_id, joined_at |
| `questions`, `answers` | author_id, community/question_id, content, status, timestamps |
| `tags`, `question_tags` | etiket tanımları ve ilişkiler |
| `votes` | user_id, target_id, target_type, value; hedef doğruluğu güvence altında |
| `experiences` | author_id, program_id, topic, experience_year, structured_fields, body |
| `verification_requests` | user_id, claimed_affiliation, method, private_document_key, status, reviewer_id |
| `reputation_events` | user_id, reason, source_event_id, points, rule_version |
| `mentor_profiles`, `mentor_topics` | user_id, accepting_requests, program bağlantısı, konular |
| `mentorship_requests` | sender_id, mentor_id, topic, status |
| `conversations`, `conversation_members` | görüşme ve yetkili üyeler |
| `devices`, `public_key_bundles` | user_id, device_id, public keys, protocol_version; özel anahtar yok |
| `encrypted_messages` | conversation_id, sender_device_id, client_message_id, ciphertext, protocol_header, timestamp |
| `blocks` | blocker_id, blocked_id |
| `reports` | reporter_id, target, reason, user_submitted_evidence, status |
| `notifications` | user_id, event_type, safe_payload, read_at |
| `audit_logs` | actor_id, action, target, timestamp, safe_metadata |
| `ai_conversations`, `ai_messages` | user_id, sınırlı bağlam, saklama politikası |

Önemli kısıtlar: normalize e-posta benzersiz; program/yıl benzersiz; listede program benzersiz; oy kullanıcı/hedef bazında benzersiz; mesaj istemci kimliği tekrarları önler; açık mentor talebi yinelenmez. Silme davranışları her ilişki için belirlenir. Hassas belgeler ve özel notlar genel API cevaplarına girmez.

## 12. API sözleşmesi taslağı

Önek: `/api/v1`. Kimlik doğrulama, gövde doğrulama, nesne sahipliği ve hız sınırı uç nokta seviyesinde uygulanır. Liste uçları sayfalama ve kararlı sıralama sağlar. Hatalar örneğin `{ code, message, fieldErrors?, requestId }` döner. Sunucu yığını kullanıcıya açılmaz.

| Grup | Örnek uçlar |
|---|---|
| Hesap | `POST /auth/register`, `/login`, `/logout`, `/refresh`, `/verify-email`, `/forgot-password`, `/reset-password` |
| Profil | `GET/PATCH /me`, `GET/PUT /me/preferences`, `GET/DELETE /me/sessions/:id` |
| Katalog | `GET /programs`, `/programs/:id`, `/universities`, `/catalog/filters` |
| Karşılaştırma | `GET /programs/compare?ids=...` |
| Öneri | `POST /recommendations`, `POST /recommendations/:runId/feedback` |
| Listeler | `GET/POST /preference-lists`, `PATCH/DELETE /preference-lists/:id` |
| Liste öğeleri | `POST /preference-lists/:id/items`, `PATCH/DELETE /preference-lists/:id/items/:itemId`, `PUT /preference-lists/:id/order` |
| AI | `POST /advisor/messages`, `GET/DELETE /advisor/conversations/:id` |
| Topluluk | `GET /communities`, `GET /communities/:id`, `POST /communities/:id/questions` |
| İçerik | `GET/PATCH/DELETE /questions/:id`, `POST /questions/:id/answers`, `PUT/DELETE /answers/:id/vote` |
| Deneyim | `GET/POST /experiences`, `PATCH/DELETE /experiences/:id` |
| Doğrulama | `POST /verification-requests`, `GET /me/verification-requests` |
| Mentor | `GET /mentors`, `PUT /me/mentor-profile`, `POST /mentorship-requests`, `PATCH /mentorship-requests/:id` |
| Mesaj | `POST /contact-requests`, `GET/POST /conversations`, `GET/POST /conversations/:id/messages` |
| Güvenlik | `POST/DELETE /blocks/:userId`, `POST /reports` |
| Bildirim | `GET /notifications`, `PATCH /notifications/:id` |
| Yönetim | `/admin/imports`, `/admin/verifications`, `/admin/reports`, `/admin/users`, `/admin/audit-logs` |

Kesin OpenAPI sözleşmesi uygulamada üretilir. Toplu sıralama `revision` içerir; eski sürüme yazma çakışma döndürür. WebSocket bağlantısında ve her görüşme aboneliğinde üyelik denetlenir. REST veya WebSocket mesaj gövdesi yalnızca şifreli zarf taşır.

## 13. Mesajlaşma ve güvenlik tasarımı

### 13.1 Uçtan uca şifreleme

TLS tek başına uçtan uca şifreleme değildir. Şifreleme/çözme istemcide; sunucuda yalnızca şifreli mesaj zarfı ve teslim için gereken sınırlı metadata bulunur. Özel anahtarlar sunucuya düz metin gönderilmez. AES/ECDH/RSA isimlerini birleştirerek yeni protokol icat edilmez; formdaki ifadelerle uyum, seçilen incelenmiş protokol üzerinden açıklanır.

Mesajlaşmaya başlamadan bir mimari karar kaydı hazırlanır: protokol/kütüphane, lisans, cihaz anahtarları, kimlik doğrulama, ileri gizlilik desteği, tekrar saldırıları, sıralama, çevrimdışı teslim, anahtar yenileme, cihaz kaybı ve çoklu cihaz kapsamı. İlk sürüm tek cihazla sınırlandırılacaksa kullanıcıya ve danışmana açıkça belirtilir; çoklu cihaz varmış gibi sunulmaz.

Parola sıfırlama eski mesaj anahtarlarını otomatik geri getirmez. Anahtar kaybı, kurtarma ve yeni cihaz davranışı ürün ekranlarında açıklanır. XSS, uç cihaz ve üçüncü taraf script riskleri bu modelin sınırlarıdır; CSP ve bağımlılık yönetimi önemlidir.

### 13.2 Moderasyonla ilişkisi

Sunucu uçtan uca şifreli özel mesajları okuyup toksisite taraması yapamaz. Toksisite modeli açık forum içeriklerinde çalışır. Özel mesaj şikâyetinde kullanıcı seçtiği içeriği açıkça paylaşmayı kabul ederek kanıt sunabilir; bu ayrı paylaşımın kapsamı görünür olur. Yöneticiye tüm mesajları çözen arka kapı eklenmez.

### 13.3 Genel güvenlik

- Parolalar uygun, güncel bir parola hash yöntemiyle saklanır; kripto parametreleri uygulamada doğrulanır.
- JWT kısa ömürlü; refresh oturumları iptal edilebilir ve döndürülebilir. Webde HttpOnly/Secure cookie tercihinde CSRF koruması tasarlanır.
- Gizli anahtarlar `.env`/secret store içinde; `.env.example` yalnızca örnek değerler içerir.
- Yetkilendirme sunucuda, parametrik SQL, içerik temizleme ve çıktı kodlama uygulanır.
- Giriş, OTP, parola yenileme, AI, mesaj ve içerik üretimine uygun hız sınırları konur.
- Belge yükleme boyut/tür/içerik kontrolleriyle özel depoya yapılır; erişim süreli ve yetkilidir.
- Güvenlik loglarına parola, token, özel mesaj, öğrenci belgesi veya gereksiz profil bilgisi yazılmaz.
- Gizlilik metinleri ve KVKK gereklilikleri uygulama/pilot öncesinde güncel kaynaklarla değerlendirilir. Bu plan tek başına hukuki uygunluk kanıtı değildir.

## 14. Gerçek veri edinme ve güncelleme

YÖK Atlas ve diğer resmî kaynaklar olası kaynaklardır; hazır API, otomatik çekme izni veya yeniden yayın hakkı varsayılmaz. İlk adım kaynak envanteri ve erişim koşullarının incelenmesidir. Gerektiğinde izinli dosya aktarımı veya kontrollü manuel pilot veri girişi yapılır.

Akış: ham kaynak → alan eşleştirme → doğrulama raporu → önizleme → onaylı içe aktarma → katalog sürümü. Geçersiz kayıtlar karantinaya alınır; eksik alanlar doldurulmuş gibi gösterilmez. Aynı içe aktarma ikinci kez çalıştırıldığında çift kayıt üretmez. Kaynak değişikliği geçmiş yıl verisini silmez. Öğrenci deneyimleri ayrı veri hattıdır.

Örnek veri, gerçek veri ve sentetik araştırma profilleri açıkça etiketlenir. Sentetik kullanıcılar gerçek pilot katılımcısı sayılmaz. Katalog güncelleme sıklığı veri kaynağına göre belirlenir.

## 15. Geliştirme aşamaları ve çıkış ölçütleri

### Aşama 0 — Devralma ve envanter

Mevcut kaynakları bul, depo durumunu ve talimatları oku, bağımlılıkları/komutları incele, güvenli yerel ortamda çalıştır. Eski kod yoksa bunu açıkça kaydet. Çıktı: çalışan/eksik/hatalı parçalar listesi ve korunacak mimari.

**Çıkış:** Kodun gerçek durumu biliniyor; kurulum engelleri ve veri kaybı riskleri kayıtlı.

### Aşama 1 — Ürün ve teknik tasarım

Sayfa haritası, ana ekran taslakları, ortak tasarım sistemi, veri sözlüğü, API taslağı, rol matrisi, algoritma ve şifreleme karar kayıtları. Pilot veri araştırmasını başlat.

**Çıkış:** Adaydan öğrenciye ana akış ekran ve veri seviyesinde tanımlı; kritik açık kararların sahipleri belli.

### Aşama 2 — Temel altyapı ve hesaplar

Yerel geliştirme, PostgreSQL, migration, güvenli seed, hesap/oturum/profil, temel CI ve hata yönetimi.

**Çıkış:** Temiz kurulumdan kayıt/giriş/profil akışı çalışıyor; kalıcılık ve erişim sınırları doğrulandı.

### Aşama 3 — Katalog ve tercih çalışma alanı

İçe aktarma, program listesi/detayı, filtreler, karşılaştırma, listeler, sıralama ve notlar. Gerçek pilot veriyi ekle.

**Çıkış:** Kullanıcı programı bulup karşılaştırabiliyor ve kalıcı listesine alabiliyor; kaynak/yıl görünür.

### Aşama 4 — Açıklanabilir öneri motoru

Ortak özellikler, TF-IDF, kosinüs, ağırlıklandırma, eksik veri politikası, sürümleme, temel filtre karşılaştırması ve değerlendirme kayıtları.

**Çıkış:** Deterministik öneriler, hesapla uyumlu gerekçeler ve tekrarlanabilir değerlendirme düzeneği var.

### Aşama 5 — AI danışmanı

Sağlayıcı adaptörü, yapılandırılmış öneriler, filtre farkı/onay/geri alma, kaynaklı açıklama, kota ve hata davranışları.

**Çıkış:** AI ve filtreler aynı listeyi yönetiyor; gerçek sağlayıcıyla entegrasyon doğrulandı; AI arızası çekirdeği engellemiyor.

### Aşama 6 — Topluluk, doğrulama ve mentorluk

Soru-cevap, deneyimler, oylama, itibar, doğrulama, mentor profilleri/talepleri, bildirimler ve ilgili yönetim ekranları.

**Çıkış:** Aday soru soruyor, doğrulanmış öğrenci yanıtlıyor, mentorluk isteği kabul edilebiliyor; kötüye kullanım kuralları uygulanıyor.

### Aşama 7 — Şifreli mesajlaşma ve güvenlik tamamlama

Önceden seçilen protokolü uygula; cihaz/anahtar yaşam döngüsü, iletişim izni, engelleme, şikâyet ve teslim tekrarlarını test et. 2FA ve güvenlik maddelerindeki eksikleri tamamla.

**Çıkış:** Sunucu mesaj düz metnini saklamıyor; yetkisiz abonelik engelleniyor; anahtar kaybı ve cihaz davranışları belgeli.

### Aşama 8 — Pilot, tez değerlendirmesi ve teslim

Gerçek kullanıcı çalışması, algoritma karşılaştırması, kullanılabilirlik düzeltmeleri, performans ölçümü, erişilebilirlik kontrolü, yedek geri yükleme, dağıtım ve tez dokümanları.

**Çıkış:** Tam sürüm kabul listesi geçti; sonuçlar ve sınırlılıklar raporlandı; kurulum ve demo başka bilgisayarda tekrarlandı.

Her aşama aynı proje üzerine eklenir. Arayüzü tamamlayıp bütün sunucuyu sona bırakmak yerine çalışan dikey akışlar geliştirilir. Yönetim ve güvenlik ihtiyaç duyuldukları aşamada eklenir. Haricî yayınlama, ücretli servis ve gerçek kullanıcıya mesaj gönderme için ilgili kullanıcı yetkisi ayrıca alınır; yerel geliştirme bunlara bağlı tutulmaz.

## 16. İki kişilik ekip için önerilen iş bölümü

Kişilerin yetkinlikleri bilinmediği için aşağıdaki dağılım isimlere bağlanmamıştır.

| Sorumluluk | Birincil sahip | Ortak çalışma |
|---|---|---|
| Arayüz, sayfalar, tasarım sistemi | Geliştirici A | API sözleşmeleri ve erişilebilirlik |
| Sunucu, veri modeli, katalog | Geliştirici B | Veri doğrulama ve uçtan uca akış |
| Öneri motoru | B | A ile açıklama ekranları ve değerlendirme |
| AI danışmanı | B adaptör / A etkileşim | Birlikte kabul senaryoları |
| Topluluk ve mentorluk | A ekran / B servis | Yetkilendirme |
| Şifreleme ve güvenlik | Ortak | Karar incelemesi ve test |
| Tez ve pilot | Ortak | Veri analizi, sonuçlar, sunum |

Her özellik için tek sorumlu, gözden geçiren kişi ve kabul ölçütü olsun. Veri modeli ve API değişiklikleri birlikte gözden geçirilsin. Küçük, çalışan değişiklikler birleştirilsin; uzun süre ayrışan iki ayrı uygulama geliştirilmesin.

## 17. Test ve doğrulama planı

### Birim testleri

- Kesin filtre/esnek tercih ayrımı, ağırlıklar, sıfır vektör, eksik veri, deterministik eşitlik.
- Açıklama katkılarının gerçek skorla eşleşmesi.
- Rol geçişleri, itibar tekrar olayları ve mentor talebi durumları.
- AI değişiklik şeması ve eski `revision` davranışı.

### Entegrasyon testleri

- Temiz PostgreSQL üzerinde migration; migration tekrarının güvenliği; örnek seed idempotansı.
- Başka kullanıcının listesine, belgesine, bildirimine ve görüşmesine erişimin reddi.
- Eşzamanlı liste sıralama, yinelenen oy, mesaj tekrar teslimi.
- Doğrulama başvurusu ve yönetim yetkileri.
- İçe aktarma önizleme, hatalı kayıt ve katalog sürümleme.

### Uçtan uca kritik senaryolar

1. Kayıt → doğrulama → profil → program → karşılaştırma → liste → çıkış/giriş → veri korunması.
2. AI filtre değişikliği → önizleme → uygulama → geri alma; sağlayıcı hata senaryosu.
3. Aday soru sorar → öğrenci yanıtlar → oy → bildirim.
4. Öğrenci doğrulanır → mentor profili açar → talep kabul eder.
5. İki ayrı kullanıcı/cihaz şifreli mesajlaşır → engelleme → yeni mesaj reddi.
6. Kullanıcı şikâyet eder → moderatör yetkili işlemi yapar → denetim kaydı oluşur.

### Teslim doğrulaması

Mobil ve masaüstü kritik ekranlar; klavye akışı; boş/hata durumları; sıradan ve yetkisiz kullanıcı davranışları. Performans için katalog boyutu, eşzamanlı kullanıcı, donanım ve p95 süreleri kaydedilir; ölçülmeden “hızlı” veya “ölçeklenebilir” iddiası yapılmaz. Hedef eşikler pilot ortam belli olduğunda yazılır. Yedekten gerçekten geri yükleme denenir.

## 18. Tez araştırma ve değerlendirme planı

**Ana soru:** İlgi ve tercih önceliklerini kullanan açıklanabilir öneri yöntemi, temel filtreleme sonucuna göre kullanıcılar tarafından daha uygun bulunuyor mu?

### Karşılaştırılacak yöntemler

- A: Aynı katalog üzerinde temel filtreleme ve önceden belirlenmiş sabit sıralama.
- B: Aynı aday havuzunda kişiselleştirilmiş içerik tabanlı sıralama.
- C: Yeterli veri varsa deneyim/etkileşim bileşeni eklenmiş deneysel yöntem; ayrı raporlanır.

AI açıklamasının etkisi, öneri algoritmasının etkisiyle karıştırılmamalıdır. Önce A/B listeleri aynı sunum koşullarında karşılaştırılır; AI açıklaması için ayrı ikincil değerlendirme yapılabilir.

### Prosedür ve ölçümler

Gönüllü katılımcı profilleri, sabit katalog sürümü ve aynı liste uzunluğu kullanılır. Sunum sırası dengelenir/rastgeleleştirilir. Kullanıcıya yöntem etiketi sonuçları yönlendirecek biçimde sunulmaz. Önceden belirlenen ölçeklerle öneri uygunluğu, açıklama anlaşılabilirliği, karar desteği ve görev tamamlama değerlendirilir. Açık uçlu geri bildirim toplanır.

Program bazlı uygunluk etiketleri toplanırsa nDCG@k gibi sıralama ölçümleri kullanılabilir. Böyle etiketler yoksa bu metrikler hesaplanmış gibi raporlanmaz. Örneklem sayısı erişime ve çalışma tasarımına göre danışmanla belirlenir; küçük pilotun genellenebilirlik sınırları açıklanır. Etki büyüklüğü ve belirsizlik raporlanır; sonucu yalnızca p-değerine indirgeme.

Model ayarlama profilleri ve son değerlendirme profilleri ayrılır. Kullanıcı etkileşiminden öğrenme eklenirse zamansal veri sızıntısı önlenir. Rapor; veri kaynağı, algoritma sürümü, ağırlıklar, katılımcı seçimi, eksik veriler ve olumsuz sonuçları da içerir. Formdaki genel literatür iddiaları tez yazılırken gerçek akademik kaynaklarla doğrulanır; formun kendisi bu iddiaların kanıtı değildir.

## 19. Dağıtım, işletim ve dokümantasyon

Geliştirme, test ve üretim ayarları ayrılır. Üretimde kalıcı PostgreSQL, HTTPS, gizli anahtar yönetimi ve özel dosya deposu bulunur. Migration dağıtım sürecinin kontrollü adımıdır. Uygulama geri dönüşü ve veri migration geri dönüşü ayrı planlanır; yıkıcı değişiklikten önce yedek alınır.

Sağlık kontrolü, hata izleme, request ID, AI kullanım/maliyet ölçümü ve güvenli loglar kurulur. Hedef yedek sıklığı ve saklama süresi ortamla birlikte belirlenir; geri yükleme prosedürü test edilir.

Teslim belgeleri:

```text
README.md                       kurulum ve temel komutlar
docs/urun-kapsami.md             ürün ve kabul ölçütleri
docs/mimari.md                   bileşenler ve bağımlılıklar
docs/veri-modeli.md              ilişkiler, veri sözlüğü
docs/api/                       OpenAPI ve örnek akışlar
docs/onerimotoru.md              formüller, dönüşümler, eksik veri
docs/veri-kaynaklari.md          köken, yıl, erişim koşulları
docs/guvenlik.md                 tehdit modeli ve anahtar yaşam döngüsü
docs/arastirma-plani.md          yöntem ve ölçüm düzeni
docs/degerlendirme-sonuclari.md  gerçek sonuçlar ve sınırlılıklar
docs/dagitim.md                  işletim, yedek ve geri yükleme
docs/demo-senaryosu.md           savunmada gösterilecek akış
docs/kararlar/                  tarihli mimari/kapsam kararları
docs/durum.md                    tamamlanan, eksik, engelli işler
```

## 20. Başlıca riskler ve karşılıkları

| Risk | Karşılık |
|---|---|
| Eski kod kurtarılamıyor | Kaynak yokluğunu kaydet; bu planla aynı mimaride yeni temel kur |
| Katalog verisi erişilemiyor | Erken kaynak araştırması, izinli sınırlı gerçek pilot, örnek veriyi açık etiketle |
| Eksik veri öneriyi çarpıtıyor | Kapsam göstergesi, eksik veri politikası ve duyarlılık değerlendirmesi |
| AI yanlış bilgi üretiyor | İzinli araçlar, kimlik/kaynak doğrulama, şema kontrolü, temel akışa geri dönüş |
| Topluluk başlangıçta boş | Ulaşılabilir gönüllü pilot; kurucu içerikleri gerçek yazar ve kaynakla paylaş |
| Deneyim puanları manipüle ediliyor | Örnek yeterliliği, yazar çeşitliliği, tekrar ve oy kötüye kullanım kontrolleri |
| Şifreleme karmaşıklığı büyüyor | Erken protokol kararı, incelenmiş kütüphane, açık cihaz kapsamı |
| Kapsam iki kişiyi aşıyor | Aşamalı dikey teslim; çekirdek kapsamı koruyup ek özellikleri ertele |
| Araştırma yeterli katılımcıya ulaşmıyor | Pilotu erken planla; sınırlılığı raporla; sahte sonuç üretme |
| Ortam tekrar kayboluyor | Git, kilit dosyası, migration, kurulum belgesi, düzenli yedek |

## 21. Tam sürüm kabul listesi

- [ ] Yeni geliştirici yalnızca README ve gerekli ortam değişkenleriyle projeyi kurabiliyor.
- [ ] Sayfalar ayrı adreslerden açılıyor; yenileme ve doğrudan bağlantı çalışıyor.
- [ ] Kayıt, doğrulama, giriş, kurtarma ve oturum iptali çalışıyor.
- [ ] Profil, tercihler, listeler ve notlar kalıcı ve kullanıcıya özel.
- [ ] Pilot gerçek katalog kaynak ve yıl bilgisi içeriyor; örnek veriden ayırt ediliyor.
- [ ] Filtre, detay, karşılaştırma ve liste akışı uçtan uca çalışıyor.
- [ ] TF-IDF/kosinüs ve yapılandırılmış uyum yöntemi uygulanmış, belgeli ve test edilmiş.
- [ ] Öneri gerekçeleri hesaplanan bileşenlerle tutarlı; eksik veriler görünür.
- [ ] Başarı sırası bilgisi yerleşme garantisi gibi sunulmuyor.
- [ ] AI gerçek entegrasyonla çalışıyor; değişiklikler kullanıcı kontrolünde; arızası çekirdeği durdurmuyor.
- [ ] Forum, deneyim, oylama, doğrulama ve itibar çalışıyor.
- [ ] Yerleşme sonrası rol geçişi ve gönüllü mentorluk tamamlanmış.
- [ ] Bire bir mesajlaşma uçtan uca şifreli; cihaz/anahtar davranışı doğrulanmış.
- [ ] Engelleme, şikâyet, toksisite desteği ve yönetim süreçleri çalışıyor.
- [ ] Yetki/sahiplik kontrolleri, rate limiting ve güvenlik kayıtları doğrulanmış.
- [ ] Mobil ve klavye kullanımında kritik akışlar tamamlanabiliyor.
- [ ] Yedek geri yükleme ve temiz kurulum denenmiş.
- [ ] Tez karşılaştırması gerçek ölçümlerle yapılmış; sınırlılıklar yazılmış.
- [ ] Etkileşim temelli hibrit hedefin gerçekleşen düzeyi dürüstçe belgelenmiş; gerekiyorsa kapsam kararı kayıtlı.
- [ ] Bilinen eksikler ve dış bağımlılıklar teslim raporunda açıkça belirtilmiş.

## 22. Yeni bir AI sohbetine verilecek başlangıç talimatı

Aşağıdaki metin, bu belgeyle birlikte yeni sohbete gönderilebilir. Belgeyi paylaşmak tek başına kodlama veya yayınlama onayı değildir; kullanıcı aşağıdaki çalışma modunu seçer.

> Bu belge KampüsPusula bitirme projesinin devir ve uygulama planıdır. Önce tamamını oku. Kesinleşmiş kullanıcı kararlarını, form gereksinimlerini, önerilen varsayılanları ve açık kararları ayır. Önceki asistanın geliştirdiğini söylediği dosyaları doğrulanmış kabul etme. Mevcut kaynak kodunu sağladıysam önce incele, çalışan parçaları koru ve eksiklere göre bu planı uygula. Kaynak yoksa bunu belirt; sıfırdan kurulacak kapsamı bu belgeye göre belirle.
>
> Çalışma modu: [YALNIZCA PLANLAMA / GELİŞTİRMEYE BAŞLA]. Planlama modunda kod yazma. Geliştirme modunda Aşama 0'dan başlayıp çalışan dikey akışlarla ilerle. Her aşamada tamamlananları, doğrulama sonuçlarını, kalan işleri ve alınan kararları docs/durum.md içinde güncelle. Ürünü tek sayfalık görsel prototiple veya sahte API yanıtlarıyla tamamlanmış sayma. Gerçek PostgreSQL, yetkilendirme, kalıcı veri ve kritik uçtan uca akışları uygula.
>
> Kullanıcının önceden seçtiği teknoloji ve kapsamı yeniden sorma. Rutin teknik kararları gerekçesiyle al; formu değiştiren, veri kaynağına erişim gerektiren veya ücret/yayınlama doğuran kararları ilgili aşamada açıkça belirt. Program verisi, test sonucu, kullanıcı geri bildirimi ve akademik sonuç uydurma. AI sağlayıcısı ya da haricî hizmet eksikse bağımsız işleri sürdür, tamamlanamayan entegrasyonu görünür bırak. Formdaki yöntemleri sessizce çıkarma. Çalışmayı bu belgedeki tam sürüm kabul listesine göre raporla.

## 23. İlk geliştirme oturumunun somut iş listesi

1. Sağlanan depo/ZIP/klasörü ve varsa proje talimatlarını incele; Git durumunu kontrol et.
2. Dosya envanteri çıkar; package komutları, migration ve ortam değişkenlerini eşleştir.
3. Eski `dev.ts` ve DB bağlantısını birlikte doğrula; Windows süreç yaşam döngüsünü incele.
4. Temiz yerel veritabanında kurulum, migration ve seed akışını dene.
5. Hesap → profil → katalog → liste yolculuğunda neyin gerçekten çalıştığını belirle.
6. Bu planı proje `docs/` dizinine aktar; gerçek durum raporunu yaz.
7. Eksik temel akışları önceliklendir; ardından aşama sırasıyla ilerle.

Bu belgenin hazırlanması sırasında uygulama kodu yazılmamış, eski proje çalıştırılmamış ve üretim ortamı oluşturulmamıştır.
