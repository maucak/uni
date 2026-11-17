# Yol haritası ve güncel durum

Son güncelleme: 17 Kasım 2026. **Güncel durumun tek kaynağı bu dosyadır.** İş bittiğinde ilgili satırı güncelleyin; ayrıntı issue/PR'da kalsın.

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

Finalde **teslim edilmeyecek** (genişleme hedefi): mentorluk, şifreli mesajlaşma, doğrulanmış öğrenci rozeti, moderasyon paneli, mobil uygulama.

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
