# Birlikte geliştirme

Bu belge, projede birden fazla kişinin aynı anda çalışabilmesi için ortak kuralları toplar. Kısa tutuldu; kural eklemeden önce gerçekten gerekli mi diye düşünün.

## İlk kurulum

1. Node.js **24.12+** kurun. Depoyu klonlayın.
2. `npm install`
3. `.env.example` dosyasını `.env` olarak kopyalayın. Yapay zekâ anahtarlarınızı **yalnızca** `.env` içine yazın.
4. `npm run dev` → http://127.0.0.1:5173. Yerel PostgreSQL kendiliğinden kurulur; veri `var/` altında kalır.
5. Danışman (RAG) üzerinde çalışacaksanız bir kez `npm run rag:setup` (modeller birkaç yüz MB).

Herkesin kendi `var/` klasörü ve kendi veritabanı vardır. Veritabanı içeriği paylaşılmaz; paylaşılan şey migration'lar ve `data/` altındaki kaynak dosyalarıdır.

## Günlük akış

1. `main` her zaman çalışır durumdadır. Doğrudan `main`'e commit atmayın.
2. İşe başlamadan bir GitHub issue seçin veya açın, kendinize atayın. Böylece iki kişi aynı işe girişmez.
3. `main`'den dal açın: `feat/oneri-degerlendirme`, `fix/rag-kapsam`, `docs/final-rapor`, `chore/ci`.
4. Küçük ve sık commit atın. Dalı `main` ile güncel tutun: `git pull --rebase origin main`.
5. Göndermeden önce: `npm run check` (typecheck + biçim + testler). Biçim hatası varsa `npm run format`.
6. Pull request açın. Şablondaki maddeleri doldurun. Diğer kişi en az bir kez baksın, CI yeşil olsun, sonra **squash merge**.
7. Bir PR tek bir işi yapsın. 400 satırı geçen PR'ları mümkünse bölün.

Commit mesajı biçimi: `tür: kısa açıklama` — `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`. Türkçe yazılabilir.

## Çakışma çıkaran yerler

- **Migration numaraları.** `server/migrations/NNN_ad.sql` dosyaları ada göre sıralanıp uygulanır ve uygulanmış dosyanın içeriği değişirse başlatıcı hata verir. Kurallar:
  - Uygulanmış bir migration dosyasını asla düzenlemeyin; yeni dosya ekleyin.
  - Yeni migration eklemeden hemen önce `main`'i çekin ve sıradaki numarayı alın. PR açarken başka bir PR aynı numarayı aldıysa, merge sırası ikinci olan numarasını değiştirir.
- **`data/life-knowledge.json` ve katalog dosyaları.** Bu dosyalar script'lerle üretilir (`npm run life:sync`, `catalog:*`). Elle düzenlemeyin ve aynı anda iki dalda yeniden üretmeyin; üreten kişi PR açıklamasında belirtsin.
- **`src/styles.css`** büyük ve ortak. Yeni bileşen stillerini ilgili bölümün altına ekleyin; dosyanın tamamını yeniden düzenlemeyin.
- **`shared/`** istemci ve sunucunun ortak sözleşmesidir. Burada alan adı değiştiren PR her iki tarafı da aynı PR'da güncellemelidir.

## Gizli bilgiler ve veri

- Anahtar, parola, `.env`, `var/` ve gerçek kullanıcı verisi commit edilmez. Yanlışlıkla commit edilen anahtar **iptal edilip yenilenir**; geçmişten silmek yetmez.
- Kaynak eklerken yalnızca resmî, izinli adresler `shared/source-registry.ts` içine eklenir. Kullanıcıdan URL alınmaz.

## Testler

| Komut | Ne zaman |
|---|---|
| `npm test` | Her PR öncesi (CI de çalıştırır) |
| `npm run test:integration` | API/oturum/liste akışına dokunan PR'larda, `npm run dev` açıkken |
| `npm run rag:evaluate` | Danışman araması, kapsam veya sıralamaya dokunan PR'larda |

Yeni davranış = yeni test. Testlerin neyi kanıtlamadığını da PR açıklamasına yazın (ör. "sahte sağlayıcıyla test edildi, canlı API denenmedi").

## Belgeler

- Güncel durum ve kimin ne yaptığı: [docs/YOL-HARITASI.md](docs/YOL-HARITASI.md)
- Ürün kapsamı: [docs/proje-plani.md](docs/proje-plani.md)
- Mimari: [docs/mimari.md](docs/mimari.md), RAG işletimi: [docs/rag.md](docs/rag.md)

Tarihli notlar (`durum.md`, `RAG-DEVAM-NOTU.md` gibi) tarihsel kayıttır; güncel durumu yalnızca yol haritasında tutun.

## Aynı makinede birden fazla kopya

İki çalışma kopyasını (ör. iki dal) aynı anda çalıştırmak için her birinin `.env` dosyasında farklı `PORT` (API), `WEB_PORT` (Vite) ve `DATABASE_URL` verin; `WEB_ORIGIN` de `http://127.0.0.1:<WEB_PORT>` olmalı. `npm run test:integration` bu değerleri `.env`'den okur.
