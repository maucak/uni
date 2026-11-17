# Kaynak güncelleme sistemi

27 Ekim 2026. Yemek menüleri kapsam dışında.

## Kullanım

Kaynaklar sayfasındaki **Kaynak yönetimi** bağlantısı yetkili hesaplarda görünür. Doğrudan adres `/kaynak-yonetimi`.

Geliştirme başlatıcısının açtığı API'de yalnızca `developer@kampuspusula.invalid` hesabı varsayılan yetkilidir. Üretimde yönetim yetkisi `SOURCE_MANAGER_EMAILS` sunucu ayarındaki e-posta listesine bağlıdır; normal kullanıcılar kontrol işi oluşturamaz veya ayar değiştiremez. Kaynak adresleri kullanıcı girişinden alınmaz; ortak kayıt dosyasındaki izinli kaynaklar kullanılır.

`npm run dev` artık kaynak işçisini de başlatır. Zaten açık bir geliştirme oturumunda `npm run sources:worker` ayrı çalıştırılabilir. Üretimde bu komut ayrı bir servis olarak gözetilmelidir. Bilgisayar ve işçi kapalıyken kontrol yapılmaz; açıldığında zamanı gelen işler devam eder. API tek başına işçi çalıştırmaz.

Tek iş kontrolü: `npm run sources:check`. Belirli kaynağın bekleyen işini işlemek için `npm run sources:check -- --source=gsb-burs-kredi`.

## Sıklık

GSB burs/kredi ve yurt SSS'si ile İSUBÜ SKS SSS'si: 14 gün. İSUBÜ öğrenci rehberi ve topluluk yönergesi: 30 gün. Başlangıç havuzunda ayrı bir güncel duyuru kaynağı yoktur; yeni burs/yurt/kayıt duyuru kaynakları eklendiğinde haftalık tanımlanmalıdır.

Her kaynakta kontrol aralığı, otomatik kontrol ve isteğe bağlı sık kontrol tarih aralığı ayarlanabilir. Bu aralıkta günlük kontrol uygulanır; başlangıç tarihi normal kontrolden erkense iş o tarihe öne alınır. Tarihler Türkiye saatine göre değerlendirilir. Menü toplama eklenmedi.

## Kalıcılık ve hata davranışı

PostgreSQL `source_schedules` kontrol düzenini ve tarihleri; `source_update_jobs` bekleyen/çalışan/tamamlanan/başarısız işleri ve fetch/publish aşamasını saklar. Aynı kaynağın tek aktif işi olabilir. Global PostgreSQL advisory lock aynı anda tek işçinin kaynak dosyasını ve indeksi değiştirmesini sağlar.

İşçinin bağlantısı koparsa lock kalkar; sonraki işçi yarım kalmış işi saklanan aşamadan devam ettirir. En fazla üç deneme yapılır; ilk hatadan sonra 15, ikinci hatadan sonra 60 dakika beklenir. Sonrasında hata görünür kalır; elle yeni kontrol istenebilir. Yönetim ekranı 15 saniyede bir durum alır. Son 10 dakikada işçi sinyali yoksa uyarı gösterir; bu anlık bir süreç sağlık kontrolü değildir.

Kaynaklar bütün olarak indirilip temizlenir. Temizlenmiş içerik, kontrol tarihi hariç karşılaştırılır. Değişiklik yoksa embedding ve Qdrant yayını atlanır. Boş içerik, beklenmedik bölüm sayısı düşüşü, aşırı dosya boyutu veya ağ hatasında çalışan kaynak dosyası korunur. Son kontrol, son başarılı işlem ve son içerik değişikliği ayrı tutulur. Başarı tarihi, belgenin akademik dönem için geçerli olduğunu kanıtlamaz.

Değişiklik varsa yalnızca eksik/yeni embedding'ler üretilir; indeksleyici içerik hash'i eşleşen vektörleri tekrar kullanır. **Qdrant yayını bu sürümde hâlâ tam hazırlık koleksiyonu ve alias değişimiyle yapılır.** Büyük veri için kaynak bazlı artımlı Qdrant yayını sonraki iştir; bu paket onu tamamlamaz.

## Sınırlar

- Beş izinli otomatik kaynak yönetilir. Diğer elle hazırlanmış kaynaklar genel kaynak listesinde kalır; bu ekranda otomatik takip ediliyor gibi gösterilmez.
- Henüz HTTP ETag/Last-Modified ile koşullu indirme yok; embedding tasarrufu temizlenmiş metin karşılaştırmasından gelir.
- Genel ve güncel duyuru ayrımı kayıt türleri genişledikçe geliştirilmeli; duyurunun süresinin dolmasını otomatik anlamaya güvenilmez.
- Kaynak güncelleme CLI'larını çalışan işçiyle aynı anda elle çalıştırmayın; mevcut eski CLI yolları işçi kilidini henüz paylaşmaz.
- PostgreSQL aktif sürüm yayını ile Qdrant alias yayını ortak transaction değildir. İndeksleme hatasında iş publish aşamasında tekrar edilir; arada değişen belgeler kısa süre aramada görünmeyebilir.
- Üretimde işçi servis yönetimi, yedekleme, uyarı kanalı ve eski indeks/iş geçmişi saklama politikası ayrıca yapılandırılmalı.

## Doğrulama

Üretim derlemesi başarılı. Geçici test havuzunda değişmeyen metni algılama, diğer kaynakları koruma ve hatalı sayfa yapısında eski dosyayı koruma kontrol edildi. Canlı beş kaynağın kontrolü tamamlandı: dört kaynak değişmedi; yurt kaynağındaki değişiklik bir yeni embedding üretti ve 172 parçalık Qdrant indeksi yeniden yayımlandı. Yetkisiz erişim 401, ters tarih aralığı 400; yinelenen kontrol isteği ikinci iş oluşturmadı.
