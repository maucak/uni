# Öneri yöntemi: content-v2-budget-tfidf

Korpus: mevcut programların adları, açıklamaları ve konu etiketleri. Metin Türkçe küçük harfe dönüştürülür; harf/sayı sözcükleri ayrılır ve sınırlı durak sözcük listesi uygulanır. Bu sürüm kök bulma veya anlamsal embedding içermez.

TF: sözcük sayısı / toplam token sayısı. IDF: `log((1+N)/(1+df))+1`. Kullanıcı metni aynı korpus sözlüğüyle dönüştürülür. Kosinüs, kullanıcı ve programın TF-IDF vektörleri arasında hesaplanır. Korpusta olmayan kullanıcı kavramları eşleşme üretmez.

Puan türü ve varsa üniversite türü kesin filtrelerdir. Keşifte sıra bandı, ücret ve burs koşulları kullanıcıya açık kesin filtrelerdir. Eksik veriyi dahil etme seçimi vardır. Şehir/dil ve kaynaklı ücret/burs öncelikleri eşleşme bileşenidir; kullanıcı ağırlıkları 0–5 arasıdır. Bütçe ağırlığı, etkin ücret ve burs bileşenlerine ayrı uygulanır. Geçmiş sıralama kişisel uyuma katılmaz ve yerleşme olasılığı üretilmez.

Her bileşen için değer `s_j`, ağırlık `w_j`, veri varlığı `a_j`:

```text
gözlenen uyum = Σ(w_j a_j s_j) / Σ(w_j a_j)
kapsam = Σ(w_j a_j) / Σ(w_j)
endeks = round(100 × gözlenen uyum × kapsam)
```

Payda sıfırsa endeks null olur. Belirtilmeyen şehir/dil tercihi bileşene eklenmez. İlgi metni eksikse bu bileşenin ağırlığı veri kapsamını azaltır. Başarı sırası, yerleşme olasılığı ve bütçe sonucu üretilmez.

Gerekçeler gerçek eşleşmelerden üretilir; bir dil/şehir tercihinin karşılanmaması da yazılır. Sonuçlar algoritma ve katalog sürümü, profil/filtre snapshot'ı ve skorlarla PostgreSQL'e kaydedilir. Geri bildirim 1–5 uygunluk ölçeğiyle saklanır; akademik karşılaştırma çalışması henüz yapılmadı. TF-IDF korpusu veri kapsamı içinde sabit tutulur; filtre daralması aynı programın metinsel skorunu sebepsiz değiştirmez.

Bu yöntem ilk ölçülebilir başlangıçtır. Ağırlık seçimi, eksik veri cezası, sözcük eşleşmesinin sınırları ve gerçek kullanıcı uygunluğu tez değerlendirmesinde incelenecek. Algoritma başarılı olduğuna dair akademik sonuç henüz yoktur.

## Temel yöntem: baseline-v1-filter-rank

Tez karşılaştırması için eklenen, kişiselleştirme içermeyen yöntemdir. Kişiselleştirilmiş yöntemle aynı kesin filtreleri kullanır: puan türü ve üniversite türü `eligiblePrograms` ile, keşif filtreleri (sıra bandı, şehir, dil, ücret, burs, veri kapsamı) ise yönlendirme katmanındaki `filterPrograms` ile paylaşılır; mantık kopyalanmaz. Ardından programlar son bilinen başarı sırasına göre artan dizilir (en iyi sıra önce). Sırası bilinmeyenler sonda yer alır, eşitlikte program kimliği belirler. İlgi metni, şehir/dil/bütçe ağırlıkları ve TF-IDF kullanılmaz; uyum endeksi üretilmez (`score: null`).

Seçim: `POST /api/recommendations?method=baseline` (gövdede `method` de kabul edilir; `personalized` varsayılandır). Yanıt `method` ve `algorithmVersion` alanlarını içerir. `recommendation_runs.algorithm_version` yöntemin sürümünü, `input.method` yöntem adını saklar; şema değişmedi. Arayüzde öneri sayfasında yöntem seçicisi vardır. Bu bir değerlendirme aracıdır; temel yöntemin kişiselleştirilmişten daha iyi ya da kötü olduğuna dair ölçülmüş bir sonuç henüz yoktur (#4).
