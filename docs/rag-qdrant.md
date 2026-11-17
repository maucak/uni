# PostgreSQL + Qdrant geçişi

27 Ekim 2026 — ilk uygulama paketi. Yerel Qdrant 1.16.3 çalıştırıldı; 172 parça yayımlandı ve uygulama qdrant aramasını kullanacak şekilde ayarlandı.

## Veri akışı

Resmî kaynak → orijinal dosya arşivi → PostgreSQL kaynak/sürüm/bölüm/parça → yerel E5 embedding → Qdrant hazırlık koleksiyonu → sayım kontrolü → atomik alias yayını.

Sohbet → mevcut LLM konuşma planı → üniversite/konu/program/dönem filtresi → paralel Qdrant dense + sparse arama → en fazla 40 parçanın PostgreSQL'den doğrulanması → mevcut RRF ve BGE yeniden sıralama → kaynaklı cevap.

PostgreSQL kaynakların ana kaydıdır. Qdrant yalnızca vektörler, parça kimlikleri ve arama filtrelerini içerir. Kullanıcılar, parola özetleri ve sohbetler aktarılmaz. API araması bütün vektörleri belleğe almaz. Kaynak hazırlama sohbet isteği içinde çalışmaz.

## Kurulum

1. Yerel `.env` içine rastgele oluşturulmuş `QDRANT_API_KEY` ekle. Anahtarı paylaşma/commitleme.
2. Docker Desktop Linux engine çalışırken `npm run rag:qdrant:start`.
3. Mevcut PostgreSQL ve embedding hazırlığı tamamlandıktan sonra `npm run rag:qdrant:index`.
4. Test aramalarını süreç ortamında `RAG_SEARCH_BACKEND=qdrant` ile yap. Canlı doğrulamadan sonra `.env` değerini değiştirip API'yi yeniden başlat.

Compose yalnızca 127.0.0.1:6333 portunu açar; API anahtarı zorunludur. Veriler Docker named volume içinde saklanır. Uzak sunucuda uygulama HTTPS gerektirir; özel ağ ve yedekleme ayrıca kurulmalıdır.

## Yayın ve tutarlılık

İndeksleyici, kaynak indeksleyiciyle aynı PostgreSQL advisory lock'u alır. Aktif belgeleri 40 parçalık sayfalar halinde okur. Eksik/bozuk embedding varsa yayın yapmaz. Yeni koleksiyon tamamen yüklenip sayımı doğrulanınca alias tek işlemle değiştirilir. Eski koleksiyon otomatik silinmez; geri dönüş ve teşhis için tutulur. Eski koleksiyonların saklama/temizleme politikası sonraki pakette gereklidir.

Bir arama alias'ı somut koleksiyona çözüp iki sorguyu da o sürüme gönderir. PostgreSQL yalnızca halen aktif ve etkin kaynak parçalarını döndürür. Böylece eski veya kaldırılmış belgeler cevapta kullanılmaz. PostgreSQL yayını ile Qdrant yayını arasında yeni kaynakların görünmediği kısa bir pencere olabilir; iki sistem arasında atomik transaction yoktur. Bu pencereyi ve yeniden denemeyi yönetecek kalıcı iş kuyruğu/outbox sonraki pakettir.

`rag:refresh`, Qdrant etkinse PostgreSQL hazırlığından sonra Qdrant yayınını da çalıştırır. Sadece `rag:index` çalıştırmak Qdrant yayınlamaz. Qdrant hatası sessizce yerel aramaya çevrilmez.

## İlk sürümün arama tercihi

384 boyutlu mevcut E5 dense vektörü ve normalize edilmiş Türkçe kelimelerden kararlı SHA-256 özellik kimlikli sparse TF-IDF araması. Qdrant koleksiyon IDF değerlerini uygular. Bu BM25 değildir. Sözcük hash çakışmaları teorik olarak mümkündür. Büyük veri yayını öncesinde BM25 veya öğrenilmiş sparse temsil ile gerçek Türkçe sorularda karşılaştırılmalıdır. Mevcut yeniden sıralama eşikleri henüz Qdrant sonuçlarında kalibre edilmedi.

## Sınırlar ve sonraki paket

- Şema kapsamı mevcut pilotun `isubu/national` ayrımını koruyor. Çok üniversiteli genel kurum kimlikleri, kampüs/şehir kimlikleri ve ulusal/kurumsal belge sınıfları ayrıca modellenmeli.
- İlk yayın bir tam yeniden kurulumdur. Milyonlarca parçada sürekli tam yeniden kurulum hedeflenmiyor; artımlı outbox işçisi, kaynak silme/tombstone ve idempotent yeniden deneme gerekli.
- Kaynak bazlı iş durumu, hata/yeniden deneme ekranı ve kalıcı arka plan iş kuyruğu henüz yok.
- Docker servisinde canlı indeksleme, cevap kalitesi karşılaştırması ve yeniden başlatma/kalıcılık doğrulanmalı.
- Ardından 100 bin / 1 milyon sentetik parçada kapasite; gerçek sorularda doğru kaynak, kapsam sızıntısı ve kanıt doğruluğu ayrı ölçülmeli.
- Mevcut hesaplar PostgreSQL'de kalır. PostgreSQL runtime rolünün superuser yetkisini kaldırmak ve yedekten dönüş kontrolü ayrıca tamamlanmalı.

API bağlantı sözleşmesi ve filtreler `tests/qdrant.test.ts` ile sahte HTTP sunucusunda sınanır. Bu test canlı Qdrant uyumluluğu veya yük testi değildir.

Resmî referanslar: https://qdrant.tech/documentation/manage-data/collections/ ve https://qdrant.tech/documentation/concepts/points/.

## İlk canlı kontrol — 27 Ekim 2026

Üç sorgu iki aramayla, önbelleksiz ve LLM çağrısı olmadan çalıştırıldı. KYK bursu ve İSUBÜ yemek bursunda aynı kaynak kümeleri; KYK yurtta aynı küme farklı sıra bulundu. Ulusal KYK sorgularında üniversite kaynakları dönmedi. Toplam arama + yerel yeniden sıralama süreleri Qdrant için yaklaşık 2,3 / 3,6 / 2,3 saniye. Bunlar tek ölçümdür; ilk yerel ölçüm model ısınmasını içerdiğinden hız üstünlüğü çıkarılamaz.

KYK bursunda özel durum/nakil belgesi genel başvuru belgesinin önüne gelebiliyor. Bu eski aramada da görülen bir sıralama sorunu; üç örnek doğruluk değerlendirmesi değildir. Gerçek cevap üretimi, yüksek yük, yeniden başlatma sonrası kalıcılık ve artımlı yayın henüz bu pakette doğrulanmadı.
