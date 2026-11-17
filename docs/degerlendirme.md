# Değerlendirme altyapısı

Bu belge tez ölçümlerinin (issue #4 öneri karşılaştırması, issue #7 arama düzenekleri) nasıl yapılacağını anlatır. Script'ler hazırdır; **ölçümün kendisi, ekip soru ve etiket dosyalarını yazınca yapılır.** Bu belgede ölçülmüş sonuç yoktur.

Ajanlar soru setini, aday profilini ve uygunluk etiketini yazmaz (`AGENTS.md` — Değerlendirme dürüstlüğü). Ekibin yazacağı iki dosya:

| Dosya | Kim yazar | Şablon |
|---|---|---|
| `data/eval/profiller.json` | ekip | `data/eval/profiller.ornek.json` |
| `data/eval/rag-sorular.json` | ekip | `data/eval/rag-sorular.ornek.json` |

Şablonlar `"ornek": true` taşır ve ölçümde kullanılmaz: script bunları `--allow-example` bayrağı olmadan reddeder; bayrakla çalışırsa rapor "ÖRNEK VERİ" ve `valid: false` işaretlenir. Gerçek dosyada `ornek` alanı olmamalı (ya da `false` olmalı).

## Komutlar

Önce ortam: veritabanı, `npm run db:migrate && npm run db:seed`, tam katalog için `npm run catalog:osym`, arama için `npm run rag:index:local`. Vektör ve yeniden sıralama düzenekleri için ayrıca `npm run rag:models` (modelleri `var/models` içine indirir) ve `npm run rag:index` (parça vektörlerini üretir).

```text
npm run eval:recommend -- [--profiles data/eval/profiller.json] [--threshold 2]
npm run eval:rag       -- [--questions data/eval/rag-sorular.json] [--modes bm25,vector,hybrid,hybrid_rerank] [--repeats 1]
```

- Dosya yoksa script ne yapılacağını söyleyen bir hata ile `1` koduyla çıkar.
- Çıktı: `var/reports/eval-recommend-<zaman>.json` / `.md` ve `var/reports/eval-rag-<zaman>.json` / `.md`. JSON ham sonuçları (profil/soru başına) içerir; Markdown okunabilir tablodur. `var/` commit edilmez; rapor tabloları final raporuna elle taşınır.
- Her rapor şunları kaydeder: katalog sürümü (öneri) veya korpus sürümü ve model anahtarları (RAG), algoritma sürümleri, git commit (ve çalışma ağacı kirli mi), girdi dosyasının sha256 özeti, Node sürümü. Ölçümden sonra girdi dosyasını değiştirirseniz özet farklı çıkar; bu bilerek yapılmıştır.
- `npm run rag:evaluate` (geliştirme seti `data/rag-evaluation.json`) olduğu gibi çalışmaya devam eder; bu script'lerden bağımsızdır.

## 1. Aday profilleri: `data/eval/profiller.json`

```json
{
  "surum": "1",
  "aciklama": "serbest metin",
  "profiller": [
    {
      "id": "p01",
      "profil": {
        "scoreType": "SAY", "rank": 50000,
        "interests": "yazılım ve yapay zeka",
        "cities": ["Ankara"], "language": "any", "universityType": "any",
        "maxAnnualTuition": null, "minimumScholarship": null,
        "weights": { "interest": 3, "city": 2, "language": 2, "budget": 2 }
      },
      "filtre": { "rankMin": "30000", "rankMax": "90000" },
      "etiketler": { "110410279": 3, "110410349": 0 }
    }
  ]
}
```

- `profil`: uygulamadaki profil alanları (`shared/contracts.ts` → `profileSchema`). Verilmeyen alan varsayılanı alır.
- `filtre`: `/api/recommendations` gövdesindeki `filters` ile aynı parametreler (`rankMin`, `rankMax`, `city`, `maxTuition`, ...). Her iki yöntem **aynı aday kümesini** bu filtreyle alır. Aday listesini gerçekçi bir bantla daraltmak, 21.000 programlık katalogda etiketlemeyi mümkün kılar.
- `etiketler`: anahtar **ÖSYM program kodu** (`officialCode`; veritabanı kimliği sürümler arası değiştiği için kod kullanılır), değer 0–3 uygunluk derecesi. Katalogda bulunmayan anahtar hata verir (yazım hatası sessizce ölçümü bozmasın).

### Etiketleme kuralları

1. Etiketi, öneri yöntemlerinin çıktısına bakmadan yazın. Önce profili ve kataloğu (aday kümesi) görerek etiketleyin; ardından tüm etiketleyiciler için aynı havuzu kullanın. Yöntem çıktısına bakarak etiketlemek ölçümü o yönteme göre eğriltir.
2. Derece: **0** uygun değil (puan türü/ilgi/öncelik ile açıkça uyuşmaz), **1** kısmen uygun, **2** uygun, **3** çok uygun. `2` ve üzeri "uygun" sayılır (Precision/Hit eşiği; `--threshold` ile değiştirilebilir, rapora yazılır).
3. Etiketi yalnızca profildeki bilgi ve katalogdaki doğrulanmış alanlara dayandırın. Katalogda olmayan bilgi (ders içerikleri, ücret) için tahmin etmeyin; bilmiyorsanız etiketlemeyin.
4. **Etiketlenmeyen program "uygun değil" sayılır.** Her profil için her iki yöntemin ilk 10'una bakıp, ikisinin de önerdiği programları etiketleyin (havuzlama). Rapordaki "Etiketsiz (ilk 10)" sütunu bu eksikliği gösterir; yüksekse etiket havuzu ölçüm için yetersizdir.
5. En az iki kişi bağımsız etiketleyip anlaşmazlıkları tartışarak birleştirin; anlaşma oranını (ör. Cohen kappa) raporda ayrıca belirtin. Bu script anlaşmayı hesaplamaz.
6. Her profilde en az bir `≥2` etiketi olmalı; yoksa o profilde nDCG tanımsızdır ve ortalamaya girmez (rapor uyarır).
7. Hedef: 15–20 profil (yol haritası A).

## 2. RAG soruları: `data/eval/rag-sorular.json`

```json
{
  "surum": "1",
  "sorular": [
    {
      "id": "s001",
      "soru": "OBS şifremi unuttum, ne yapmalıyım?",
      "onceki_turlar": [],
      "kurum": "isubu",
      "ilgili_kaynaklar": ["obs"],
      "kacinilacak_kaynaklar": [],
      "sinif": "acik",
      "not": "isteğe bağlı"
    }
  ]
}
```

- `kurum`: `isubu`, `sdu`, `pau`, `akdeniz`, `national` ya da `diger` (korpusta olmayan kurum).
- `ilgili_kaynaklar`: korpustaki kaynak kimlikleri (`LifeArticle.id`; bkz. `npm run rag:search`). Bulunmayan kimlik hata verir.
- `kacinilacak_kaynaklar` (isteğe bağlı): dönmemesi gereken kaynaklar; özellikle `yaniltici_belge` sınıfında eski/yanıltıcı belge kimlikleri.
- `onceki_turlar`: yalnızca `cok_turlu` sınıfında dolu; son sorudan önceki kullanıcı mesajları, sırayla.
- `sinif` (tek değer):

| Değer | Anlamı |
|---|---|
| `acik` | Açık, tek anlamlı soru |
| `belirsiz` | Netleştirme gerektiren soru (`ilgili_kaynaklar` boş olabilir) |
| `cok_turlu` | Önceki turlara bağlı soru |
| `kurum_degisimi` | Konuşma ortasında başka kuruma geçiş |
| `ulusal` | Türkiye geneli (GSB/KYK vb.) |
| `kaynaksiz` | Korpusta cevabı olmayan soru; `ilgili_kaynaklar` **boş** olmalı |
| `guncel_ucret_tarih` | Güncel ücret/tarih isteyen soru |
| `yazim_hatali` | Yazım hatası/ASCII'leşmiş Türkçe |
| `yaniltici_belge` | Korpusta yanıltıcı/eski belge bulunan soru |

### Soru yazma ve etiketleme kuralları

1. Bağımsız set, **geliştirme sırasında kullanılmamış** olmalıdır. `data/rag-evaluation.json` içindeki soruları ve onlara bakarak türetilmiş soruları almayın. Soruları yazmadan önce arama çıktılarına bakıp sorunun "çalışacak" biçimini seçmeyin.
2. En az 60 soru; her sınıftan yeterli sayıda (script 60'ın altında uyarır, sınıf başı sayıları raporlar).
3. `ilgili_kaynaklar`: soruyu **tek başına** cevaplamaya yeten kaynaklar. Sorunun cevabını içeren birden fazla kaynak varsa hepsini yazın; aksi halde Recall'u haksız düşürürsünüz. Etiketleme, kaynağın metnini okuyarak yapılır, arama sırasına bakarak değil.
4. `kurum`: sorunun hangi kuruma ait olduğunu kullanıcı bakış açısıyla yazın. Ulusal bir kaynağın (`scope: national`) bir kurum sorusunda dönmesi **yanlış kurum sayılmaz**; başka bir kurumun kaynağı sayılır.
5. `kaynaksiz` sorularda korpusta gerçekten cevap olmadığını elle doğrulayın; ilgili görünen bir kaynak varsa soruyu `kaynaksiz` yazmayın.
6. İki kişi çaprazlayarak etiketlesin; anlaşmazlıkları tartışın.

## 3. Ölçülenler ve ölçülmeyenler

### Öneri (`eval:recommend`)

Her profil için iki yöntem, **aynı katalog, aynı aday kümesi, aynı liste uzunluğu (k=10)** ile çalışır: kişiselleştirilmiş (`recommend`, TF-IDF + ağırlıklı ölçütler) ve temel (`baselineRecommend`, filtre + son başarı sırası).

| Metrik | Ne ölçer | Ne ölçmez |
|---|---|---|
| nDCG@10 | Etiketli uygun programların listede ne kadar üstte olduğu; kazanç `2^derece − 1`, ideal sıra profilin tüm etiketlerinden | Etiketlenmemiş programları (0 sayılır); gerçek memnuniyeti; yerleşme olasılığını |
| Precision@10 | İlk 10'un kaçı "uygun" (≥ eşik); payda her zaman 10 | Sıralama kalitesini; uygun olup listede olmayan programları |
| Hit@10 | İlk 10'da en az bir uygun program var mı (0/1) | Kaç tane olduğunu |
| Kapsama | Önerilen **benzersiz** program sayısı / toplam öneri yuvası (profil × 10). Raporda ayrıca benzersiz önerilen / katalog büyüklüğü | Önerilerin doğruluğunu; yüksek kapsama tek başına iyi değildir |
| Eksik veri oranı | İlk 10'daki programlardan, kullanıcının ilgilendiği alanlarda veri eksik olanların oranı: son başarı sırası boş; ücret üst sınırı verilmişse ücret boş; burs eşiği verilmişse burs oranı boş | Verinin doğruluğunu; yalnızca varlığını |
| Eşleştirilmiş fark | Profil başına (kişiselleştirilmiş − temel); ortalama, SS, kazanç/kayıp/eşit sayısı, tohumlu bootstrap %95 güven aralığı | İstatistiksel anlamlılık testi; 15–20 profilde aralık yol göstericidir. Etiketleyiciler arası yanlılığı |

Genel sınırlar: etiketler ekibin yargısıdır, kullanıcı çalışması (#5) yerine geçmez. Katalogda ücret, burs ve ders içeriği yoktur (`docs/onerimotoru.md`), dolayısıyla bu alanlara dayalı uygunluk ölçülmez. Kişiselleştirilmiş yöntem eksik veriyi puan düşürerek cezalandırır; temel yöntem hiç bakmaz — eksik veri oranı bu farkı görünür kılar.

### Arama (`eval:rag`)

Dört düzenek aynı soru ve aynı korpus sürümüyle çalışır; önbellek kapalıdır. LLM çağrısı yoktur.

| Düzenek | `retrieve()` seçeneği |
|---|---|
| `bm25` | `{ semantic: false, reranking: false }` |
| `vector` | `{ lexical: false, reranking: false }` (yeni, varsayılanı `true` olan seçenek) |
| `hybrid` | `{ reranking: false }` (BM25 + vektör, RRF) |
| `hybrid_rerank` | `{}` (üretim varsayılanı) |

`lexical` seçeneği yalnızca değerlendirme içindir; verilmediğinde `retrieve()` davranışı değişmez.

| Metrik | Ne ölçer | Ne ölçmez |
|---|---|---|
| Recall@1/3/5 | İlgili kaynakların kaçı ilk k dönen kaynak içinde (soru başına, sonra ortalama) | Cevabın doğruluğunu; kaynak sayısı sınırı (en çok 4 kaynak döner) k=5'in anlamını sınırlar |
| MRR | İlk ilgili kaynağın sırasının tersi (dönmediyse 0) | Birden çok ilgili kaynağın hepsini |
| Yanlış kurum kaynağı oranı | Dönen kaynaklardan scope'u ne `national` ne sorunun kurumu olanların oranı (kaynak düzeyi) ve en az bir yanlış kaynak dönen soruların oranı (soru düzeyi) | Cevapta yanlış kurum bilgisinin kullanılıp kullanılmadığını (yanıt düzeyi, LLM gerekir) |
| p50/p95 süre | `retrieve()` çağrısının duvar saati süresi, ms (en yakın sıra yüzdelikleri); korpus önbellek yenilemesi ölçüme girmez; ilk çağrı ısınma sayılır | Uçtan uca cevap süresini (LLM, ağ, SSE); Qdrant arka ucunda ağ gecikmesi hariç değildir |
| Kaynaksız boş dönme | `kaynaksiz` sorularda hiç kaynak dönmeme oranı | Netleştirme sorusu gerekliliğini |
| Kaçınılacak kaynak oranı | `kacinilacak_kaynaklar` tanımlı sorularda bunlardan birinin dönme oranı | Yanıltıcı içeriğin cevaba yansımasını |
| Sınıf kırılımı | Aynı metrikler soru sınıfına göre | Sınıf başına az soruda genelleme |

Dikkat edilecekler:

- **Bağlam simülasyonu.** Her soru için `contextFor` + `retrievalQuestion` kullanılır (`rag:evaluate` ile aynı). Soruda üniversite adı geçmiyorsa ve `kurum` dört kurumdan biriyse, kullanıcı profilinde o kurumun kayıtlı olduğu varsayılır. Bağlam `diger` kurumu algılarsa üretim akışındaki gibi arama yapılmaz (kapsam koruması; konut konusu hariç) ve sonuç boş sayılır; bu sorular süre istatistiğine girmez.
- Vektör ve yeniden sıralama modelleri (`var/models`) ya da parça vektörleri yoksa `vector`, `hybrid` ve `hybrid_rerank` **"atlandı: model yok"** olarak raporlanır, script çökmez. Hibrit de atlanır, çünkü vektör olmadan hibrit sessizce BM25'e düşer ve karşılaştırmayı yanıltır. Bir mod beklenen arama yolunu çalıştıramazsa (ör. çalışma sırasında model hatası) rapor uyarı verir.
- Ölçüm sırasında korpus sürümü değişirse (kaynak güncelleme işçisi) rapor uyarır; kaynak işçisini kapatıp yeniden çalıştırın.
- Zamanlama makineye bağlıdır; modların sürelerini aynı çalıştırmadan karşılaştırın, farklı makinelerin sayılarını birbirine eklemeyin. Daha kararlı süre için `--repeats 5`.

## 4. Geliştirme seti ile bağımsız set

| | Geliştirme seti | Bağımsız set |
|---|---|---|
| Dosya | `data/rag-evaluation.json` (`npm run rag:evaluate`) | `data/eval/rag-sorular.json`, `data/eval/profiller.json` |
| Amaç | Gerileme denetimi: bir değişiklik bilinen soruları bozdu mu | Yöntemlerin tarafsız karşılaştırması |
| Yazım | Geliştirme sırasında, arama çıktısına bakılarak | Geliştirmeden bağımsız, ekip tarafından, çıktıya bakmadan |
| Kullanım | Ayar yapmak serbest | Ayar yapmak için **kullanılmaz**; ölçümden sonra sistemi bu sete göre ayarlamak ölçümü geçersiz kılar |
| Sonuç | "Geçti/kaldı" | Tabloya girer, rapora yazılır |

Bağımsız set bir kez ölçüldükten sonra sistem değişirse (eşik, ağırlık, model), ölçümü tekrarlarken değişikliğin hangi sete bakılarak yapıldığını raporda belirtin. Geliştirme setindeki başarı, bağımsız setteki başarıyı göstermez.
