# Yol haritası ve güncel durum

Son güncelleme: 17 Kasım 2026. Final teslimi: **17 Aralık 2026**. Kapsam kilidi: **7 Aralık** (sonrası yalnızca düzeltme, ölçüm, rapor). **Güncel durumun tek kaynağı bu dosyadır.** İş bittiğinde ilgili satırı güncelleyin; ayrıntı issue/PR'da kalsın.

## Nerede duruyoruz

Vize raporu teslim edildi (6–8 Kasım). Final aşamasındayız.

| Alan | Durum |
|---|---|
| Hesap, profil, tercih listeleri, karşılaştırma, topluluk | Çalışıyor; güncel uçtan uca test turu gerekli |
| Program kataloğu | ÖSYM 2026 Tablo-3/4: 21.493 program kaydı. Ücret ve ders içerikleri yok |
| Öneri sistemi | TF-IDF + kosinüs + ağırlıklı ölçütler, açıklamalı. **Temel yöntemle karşılaştırma yapılmadı** |
| Danışman (RAG) | Hibrit arama + yeniden sıralama + Qdrant, kurum/dönem kapsamı, kaynak denetimi, SSE. Groq ile canlı kaynaklı cevap alındı. **Bağımsız soru setiyle ölçüm yok** |
| Bilgi havuzu | 24 kaynak, 574 parça: İSUBÜ 303, SDÜ 103, PAÜ 79, Akdeniz 18, ulusal (GSB/KYK) 71 |
| Kaynak güncelleme | İşçi, zamanlama, yönetim ekranı. Qdrant yayını hâlâ tam yeniden kurulum |
| Otomatik testler | 51 test; `npm run check` CI'da çalışır |

Finalde proje planının (docs/proje-plani.md §4) 11 modülünün tamamı teslim edilir. Genişleme hedefi olarak kalanlar: çoklu cihazlı mesajlaşma, ileri gizlilik, 2FA, yerel mobil uygulama, otomatik mentor eşleştirme.

## Haftalık plan

Her haftanın sonunda çıkış ölçütü tarayıcıda denenir; geçmeyen iş bir sonraki haftanın ilk işi olur.

### 1. hafta · 17–23 Kasım · Temel ve tasarım kararları
- [x] Hesap: e-posta doğrulama, parola sıfırlama, rol geçişi aday → öğrenci → mezun (migration 014)
- [x] Şifreli mesajlaşma karar kaydı: `docs/karar-mesajlasma.md`
- [x] Topluluk/doğrulama/mentorluk/bildirim/moderasyon veri modeli ve API taslağı: `docs/veri-modeli-v2.md`
- [x] Öneri temel yöntemi (#2)
- [x] Yedekleme ve geri yükleme (#15)
- [x] Değerlendirme script iskeletleri (#4, #7)
- [ ] Ekip: RAG soru setinin ilk 30 sorusu (#6), aday profilleri (#3), kullanıcı çalışması için 8–10 kişi

**Çıkış:** Yeni hesap e-postasını doğrular ve parolasını sıfırlar; karar kaydı ile veri modeli onaylı.

### 2. hafta · 24–30 Kasım · Topluluk katmanı
- [x] Üniversite ve bölüm toplulukları, etiketler, arama, kabul edilen yanıt (015)
- [x] Deneyim kaydı: konu, program, yıl ve yazarın o dönemki durumu; resmi bilgiden ayrı gösterilir (015)
- [x] Doğrulama: kurumsal e-posta ve özel depoda belge; `pending/approved/rejected/revoked` durumları; inceleme ekranı; rozet (016)
- [x] İtibar: sürümlü kurallar, kendine oy ve tekrar engeli (016)
- [ ] Mentorluk: profil ve talep durumları (017)
- [x] Uygulama içi bildirimler (018)

**Çıkış:** Aday soru sorar, doğrulanmış öğrenci rozetle yanıtlar, mentorluk talebi kabul edilir.

### 3. hafta · 1–7 Aralık · Güvenlik, mesajlaşma, işletme
- [ ] Uçtan uca şifreli bire bir mesajlaşma, tek cihaz (019)
- [ ] Engelleme, şikâyet, moderatör/yönetici paneli, denetim kaydı (020)
- [ ] Açık forumda toksisite işaretleme: moderatöre yardımcı olur, otomatik silmez
- [ ] Qdrant temizleme (#16), Docker Compose ile demo dağıtımı
- [ ] Değerlendirmelerin ilk turu

**Çıkış (7 Aralık):** 11 modülün tamamı demo ortamında çalışır.

### 4. hafta · 8–14 Aralık · Pilot ve ölçüm
- [ ] Kullanıcı çalışması (#5), RAG ölçümleri (#7–#9), öneri karşılaştırması (#4)
- [ ] Hata düzeltme, mobil ve erişilebilirlik kontrolü, temiz makinede kurulum (#14), kılavuz (#17)
- [ ] Final raporu (#18)

### 15–17 Aralık · Teslim
Rapor, sunum, demo provası, yedek video ve tampon süre.

## Migration numarası ayırmaları

| No | Modül |
|---|---|
| 014 | Hesap: e-posta doğrulama, parola sıfırlama, rol |
| 015 | Topluluk genişletme ve deneyimler |
| 016 | Doğrulama ve itibar |
| 017 | Mentorluk |
| 018 | Bildirimler |
| 019 | Şifreli mesajlaşma |
| 020 | Engelleme, şikâyet, moderasyon, denetim kaydı |
| 021+ | Gerektikçe; almadan önce bu tabloya ekleyin |

## Paralel çalışma alanları

Alanlar birbirine az dokunacak şekilde ayrıldı; iki kişi aynı anda farklı alanda çalışabilir. Her madde bir GitHub issue olmalı.

### A — Öneri sistemi değerlendirmesi (`server/services/recommendation.ts`, `scripts/`, `docs/onerimotoru.md`)
- [ ] Temel yöntem: yalnızca filtre + sabit sıralama (başarı sırasına göre) — aynı API üzerinden seçilebilir olsun
- [ ] 15–20 örnek aday profili (`data/eval/profiller.json`) ve uygunluk etiketleri
- [ ] Karşılaştırma script'i: aynı profil, aynı liste uzunluğu; nDCG@10 / isabet ve kapsama
- [ ] Küçük kullanıcı çalışması formu (5–10 kişi): uygunluk ve gerekçe anlaşılırlığı

### B — Danışman değerlendirmesi (`server/services/rag/`, `data/rag-evaluation.json`)
- [ ] Geliştirmede kullanılmamış bağımsız soru seti (≥60 soru): açık, belirsiz, çok turlu, kurum değişimi, ulusal, kaynaksız, güncel ücret/tarih, yazım hatalı, yanıltıcı belge
- [ ] Dört düzenek karşılaştırması: BM25 / vektör / hibrit / hibrit + yeniden sıralama → Recall@k, MRR
- [ ] Yanıt düzeyi: kaynakla desteklenme, yanlış kurum kaynağı kullanma oranı, gereksiz netleştirme sorusu
- [ ] p50/p95 cevap süresi ve çağrı başına token

### C — Ürün bütünlüğü ve arayüz (`src/`)
- [ ] İki ana yolculuğun tarayıcıda baştan sona kontrolü (tercih öncesi / yerleşme sonrası), bulunan hatalar issue olarak
- [ ] Ana sayfada iki kullanım alanının anlaşılırlığı
- [ ] Mobil görünüm kontrolü
- [ ] `npm run test:integration` güncel akışları (danışman geri bildirimi, silme) kapsasın

### D — Altyapı ve işletim (`scripts/`, `README.md`)
- [ ] Temiz bir makinede kurulum denemesi (Windows + bir Linux/macOS), README düzeltmeleri
- [ ] Yedekleme / geri yükleme komutu ve denemesi (`pg_dump` → yeni veritabanı)
- [ ] Qdrant eski koleksiyon temizleme politikası
- [ ] Yönetici ve öğrenci için kısa kullanım kılavuzu

### E — Final raporu (`docs/` dışında, ortak belge)
- Sıra: problem → kullanıcı ihtiyacı → çözüm → sistem → yöntem → doğrulama → sınırlar → final çıktısı
- A ve B'nin sayıları geldikçe doldurulur; ölçülmemiş sonuç yazılmaz

## Öneri iş bölümü

İki kişi için: biri **A + C**, diğeri **B + D**; rapor (E) ortak. Haftalık kısa senkron: bu dosyadaki tabloyu birlikte güncelleyin.

## İlerleme günlüğü

En yeni en üstte. Bir iş bitince bir satır ekleyin.

| Tarih | Ne yapıldı | PR |
|---|---|---|
| 2026-11-17 | **Devir:** mentorluk (017) yarım → `wip/mentorluk` dalı; Docker dağıtımı main'de (#33) ama **hiç denenmedi** (bulutta imaj çekilemedi): registry erişimi olan makinede `docker compose up -d --build` ile ilk deneme yapılmalı; `wip/docker` dalı boş, yok sayın. Devralan ajan bu dallardan devam etsin ya da 017'yi `docs/veri-modeli-v2.md`'den yeniden yapsın. Sonra 019, 020. | — |
| 2026-11-17 | İlerleme günlüğü | #31 |
| 2026-11-17 | Doğrulama, roller, itibar, moderatör gizleme (016) | #30 |
| 2026-11-17 | CI düzeltmesi: birim testleri veritabanısız | #29 |
| 2026-11-17 | Bildirimler (018) | #28 |
| 2026-11-17 | Değerlendirme script'leri; veri dosyaları ekipte | #27 |
| 2026-11-17 | Topluluklar, arama, kabul edilen yanıt, deneyimler (015) | #26 |
| 2026-11-17 | Hesap: e-posta doğrulama, parola sıfırlama/değiştirme, rol beyanı (014) | #23 |
| 2026-11-17 | Yedekleme/geri yükleme; Windows'ta pg_dump ayrıca kurulmalı | #22 |
| 2026-11-17 | Öneri temel yöntemi (`method=baseline`) | #21 |
| 2026-11-17 | v2 veri modeli ve mesajlaşma karar kaydı | #20 |
| 2026-11-17 | AGENTS.md, Linux ajan veritabanı script'i, port ayarları, 4 haftalık plan | — |
| 2026-11-17 | RAG çalışması depoya alındı, ekip düzeni, 17 issue açıldı | #1 |
