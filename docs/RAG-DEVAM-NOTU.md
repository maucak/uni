> **Tarihsel not (21 Ekim 2026).** Güncel durum için [YOL-HARITASI.md](YOL-HARITASI.md).

# RAG geliştirme — duraklama noktası

21 Ekim 2026. Kullanıcı şarjı bittiği için çalışmayı durdurdu; devam isteğine kadar yeni geliştirme yapılmayacak.

## Tamamlananlar

- Migration 007, 008, 009 uygulandı: kaynak/sürüm/belge/parça/vektör kayıtları; idempotent RAG istekleri; erişim ve konuşma kilidi; kullanıcıya bağlı geri bildirim.
- Yerel E5-small embedding ve BGE-reranker-v2-m3 ONNX q8 modelleri indirildi. Modeller sabit Hugging Face commitleriyle `var/models` içinde. Çalışma anında ağdan model indirme yok; sabit yerel model yolları kullanılıyor. Transformers.js 4.3.1 sürümünün tokenizer metadata keşfi nedeniyle bu yerel yol yaklaşımı gerekli oldu.
- Hibrit BM25 + cosine araması, RRF birleştirme, tekrar eden üst belgeleri ayırma, en fazla 8 adayda yeniden sıralama, ilgisiz kanıt eleme, 5 dakikalık sınırlı kamu-kaynak arama önbelleği.
- Kurum, program ve dönem bağlamı; yanlış üniversite/bölüm kaynaklarını eleme; hazırlık sorularında bölüm netleştirme; güncel ücret/kontenjan/kupon verisi yoksa kesin bilgi vermeme.
- Kaynak gösterimi ve kaynakta bulunmayan sayısal iddiaları reddetme. Bu kontroller tam anlamsal doğruluk kanıtı değildir.
- HTML Türkçe/numeric-hex entity düzeltmeleri; PDF madde ve sayfa koruması. PDF-parse 2.4.5 eklendi. PDF ilk sayfa görsel kontrolü yapıldı.
- Kaynak yenilemede boyut sınırı, beklenmedik içerik kaybı denetimi, bir kez sınırlı ağ yeniden denemesi, ham kaynak arşivi, son yenileme sağlık raporu; güncelleme başarısızsa eski veri korunuyor. Yeni aktif sürüm, vektörler tamamlandıktan sonra atomik etkinleşiyor.
- Son yenileme başarılı: 104 otomatik kaynak belgesi/bölümü + 10 rehber kartı, toplam 134 parça, 7 kaynak, embedding kapsamı %100. Korpus sürümü `10056f17f9013b3fb0cd`.
- Sohbette SSE ile kaynakları model yanıtından önce gösterme; kopan bağlantıda aynı requestId ile güvenli tekrar; sunucu tarafında bağlantı kopmasına bağlı model iptali.
- Kaynak sayfası, faydalı/eksik geri bildirimi ve operatör raporu.

## Doğrulananlar ve sınırları

- 15 soruluk geliştirme regresyon seti son çalıştırmada geçti. Bu set geliştirmede kullanıldı; bağımsız değerlendirme veya genel doğruluk garantisi değildir. Rapor `var/reports/rag-evaluation.json`.
- Gerçek HTTP kontrolünde kaynak akışı, idempotent tekrar, kontrol listesi, takip soruları, kurum/bölüm netleştirmesi, kullanıcılar arası erişim engeli ve silme geçti. Bu kontrol geri bildirim özelliği eklenmeden önce geçti; son eklenen geri bildirim sahipliği ve silme-kaskadı kontrolleri henüz yeniden çalıştırılmadı.
- RAG birim kontrolleri ve sahte taşımalı Gemini/Groq sözleşme kontrolleri geçti. Son sayısal-token iyileştirmesinden sonra ilgili birim kontrolü yeniden çalıştırılmalı.
- Üretim derlemesi önceki ara noktada geçti. Son geri bildirim, iptal sinyali ve kaynak-yenileme değişikliklerinden sonra son derleme henüz yapılmadı.
- Üretken sağlayıcı halen `.env` içinde `groq`, Groq anahtarı yok. Kayıtlı Gemini anahtarı mevcut. Anahtarlar çıktıya veya Git'e alınmadı.
- Son salt-okunur bağlantı kontrolü: Gemini `gemini-3.8-flash` model metadata isteği HTTP 200 döndü. Henüz gerçek RAG yanıtı denenmedi; `.env` sağlayıcısı değiştirilmedi. Önceki konuşmada kullanıcı Gemini kullanımını istemişti.

## Devam sırası

1. Açık süreçleri ve Git durumunu kontrol et. Bu turdaki değişiklikler commit/push yapılmadı; önceki kullanıcı çalışmasını koru.
2. Son kod için `npm run build`, yeni birim kontrolleri ve `node scripts/life-check.ts` çalıştır. Son HTTP kontrolü geri bildirim sahipliği ve silme-kaskadı doğrulamasını da içeriyor. Gereksiz tekrar yapma.
3. Kayıtlı Gemini anahtarıyla yalnızca kamu kaynaklarını kullanan tek örnek RAG yanıtını dene; sırrı asla çıktıya yazma. Başarılı ve kaynak denetiminden geçen yanıt olmadan bağlı çalışıyor deme. Şu an henüz sağlayıcı değişikliği yapılmadı.
4. `docs/ogrenci-yasami.md` ve README güncellenmeli: eski BM25-only açıklamaları artık tarihsel. Yeni kurulum komutları ve gerçek model/vektör sınırları açıklanmalı.
5. Sade açık renkli arayüzde sohbet/SSE/kaynak ayrıntıları/geri bildirimi kısa tarayıcı kontrolünden geçir.

## Komutlar

- `npm run dev`: yerel servisler; yerel veritabanında metadata dizini başlangıçta hazırlanır.
- `npm run rag:models`: sabit yerel modelleri hazırla.
- `npm run rag:setup`: modeller + vektör dizini.
- `npm run rag:refresh`: izinli kaynakları al + dizini güncelle.
- `npm run rag:index`: değişen parçalara vektör üret; aynı içerikte eskisini kullan.
- `npm run rag:search -- "soru"`: operatör arama tanısı.
- `npm run rag:evaluate`: 15 geliştirme sorusu, canlı üretken API çağrısı yapmaz.
- `npm run rag:report`: kaynak/vektör/geri bildirim özeti; özel soru metinlerini yazdırmaz.

## Kullanıcı tercihleri

Sade, açık tonlar; yeşil/koyu lacivert bloklar kullanılmayacak. Ana sayfa iki sade giriş olarak kalacak. Mevcut proje karmaşıklaştırılmayacak. Soru sormadan yetkili kapsamda ilerleme isteği vardı; son mesaj bu çalışmayı açıkça duraklattı. Tez/akademik yazım şu an istenmiyor.
