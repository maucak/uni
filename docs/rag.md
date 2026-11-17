# RAG işletim notları

22 Ekim 2026 itibarıyla mimari: sürümlü resmî kaynaklar → bölüm ve sayfa koruyan parçalama → yerel E5 embedding → BM25 ve cosine aramasının RRF ile birleşimi → en fazla sekiz adayda yerel BGE yeniden sıralama → en fazla dört kaynak bölümüyle cevap üretimi → kaynak ve sayısal iddia kontrolü.

## Kurulum ve güncelleme

`npm run rag:setup` sabit sürümlü modelleri indirir ve vektörleri oluşturur. Modeller `var/models` içinde tutulur; kullanıcı sorusu sırasında indirilmez. Model dosyaları yüzlerce MB yer kaplar. CPU üzerinde yeniden sıralama birkaç saniye sürebilir.

`npm run rag:refresh` izinli HTML ve PDF kaynaklarını yeniler ve değişen içerikleri indeksler. Başarısız yenileme eski veriyi korur. Yeni sürüm, vektörler tamamlandıktan sonra etkinleşir. `npm run rag:index` kaynak indirmeden indeksi günceller. `npm run rag:index:local` yalnızca metadata hazırlamak içindir.

`npm run rag:report` kapsam ve geri bildirim özetini verir. `npm run rag:evaluate` geliştirmede kullanılan 15 soruyu çalıştırır; bağımsız kalite ölçümü değildir ve üretken API çağırmaz.

## Kapsam ve ölçek

Son başarılı kaynak yenilemesinde 7 URL, 114 içerik bölümü ve 134 parça bulunuyor. PDF işleme metin katmanı gerektirir; OCR yoktur. İndirme tarihi belgenin yürürlük tarihi değildir. Kaynaklarda bulunmayan güncel fiyat, kontenjan ve kupon bilgisi üretilmez.

Vektörler mevcut küçük havuzda tam taranır. Büyük çok üniversiteli havuza geçmeden önce indeksli vektör araması ve yük altında gecikme ölçümü gerekir. Kaynak sayısından bağımsız olarak yeniden sıralama aday sayısı ve modele gönderilen bağlam sınırlıdır. Önbellek kaynak sürümüne bağlıdır.

Kaynak işaretleri ve sayısal iddia denetimi tam anlamsal doğruluk garantisi sağlamaz. Canlı sağlayıcı doğrulaması ve bağımsız soru seti ayrıca gereklidir. Anahtarlar yalnızca yerel .env içinde tutulmalıdır.


## Konuşma planlama — 27 Ekim 2026

Danışman isteklerinde eski contextFor kelime kuralları yerine LLM tarafından üretilen yapılandırılmış konuşma durumu kullanılır. Durum konu, amaç, kapsam, kullanıcı beyanıyla desteklenen kurum/şehir/bölüm/burs alanları ve eksikleri içerir; mevcut konuşmanın context JSON alanında atomik saklanır. Asistanın kendi söyledikleri kurum kanıtı sayılmaz. Kaynak arama sorusu doğrulanan alanlardan oluşturulur. Eksik kurum bilgisiyle kuruma özel kaynak araması engellenir. Eski contextFor yardımcıları rehber ve önceki değerlendirme araçları için durmaktadır; sohbet kararlarını yönetmez.

AI_ROUTER_MODEL yönlendirme modelini açıkça seçer; boşsa cevap modeli kullanılır. Yerel geliştirmede Groq gpt-oss-120b hem planlama hem cevap üretimi için seçilmiştir. Küçük cevap modelinin özel nakil koşulunu genel başvuruya karıştırdığı canlı denemeden sonra cevap modeli de değiştirildi. Bu otomatik hata sonrası model değişimi değildir. Aynı turdaki iki model çağrısı uygulamada tek günlük kullanım sayılır; sağlayıcı maliyet ve token sınırları her çağrıya ayrı uygulanır. Serbest planın hız sınırı cevap üretimini engelleyebilir. Kaynak ve konuşma durumu kontrolleri tam anlamsal doğruluk garantisi değildir.


GSB burs ve öğrenim kredisi SSS kaynağı eklendi: 37 resmî soru-cevap. Son indeks 8 kaynak adresi ve 172 parça içeriyor. `npm run rag:refresh -- --source=gsb-burs-kredi` diğer kaynakları koruyarak yalnızca bu kaynağı yeniler. Kontrol tarihi yürürlük garantisi değildir. Yurt ve burs kaynaklarının kapsamları aramada ayrılır. İlk başvuru sorusu gerçek API üzerinden kaynaklı üretimle doğrulandı.
