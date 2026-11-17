# AGENTS.md — KampüsPusula'da çalışan ajanlar için (Codex, Claude Code ve diğerleri)

Bu dosya bir ajanın önceki konuşmaları görmeden işe devam edebilmesi için yazıldı. Önce bunu, sonra `docs/YOL-HARITASI.md` dosyasını okuyun.

## Proje

KampüsPusula: kişiselleştirilmiş üniversite tercih öneri sistemi ve danışma platformu. Mehmet Ali Uçak ile Mesut Özdemir'in bitirme projesi. **Final teslimi 17 Aralık 2026.** Kullanıcı arayüzü ve bütün metinler Türkçe.

Teknoloji: React 19 + TypeScript + Vite (`src/`), Node.js + Express 5 API (`server/`), PostgreSQL (`server/migrations/`), ortak Zod sözleşmeleri (`shared/`), Node test runner (`tests/`). TypeScript dosyaları Node'un tip ayıklamasıyla doğrudan çalışır, derleme adımı yoktur. Bu yüzden enum ve namespace gibi çalışma zamanı TS söz dizimi kullanılmaz.

## Kaldığın yeri bul

1. `docs/YOL-HARITASI.md`: haftalık plan, migration numarası ayırmaları ve **İlerleme günlüğü**.
2. Açık GitHub issue'ları ve PR'lar (`maucak/uni`).
3. `git log --oneline -20`

Bir işi bitirince İlerleme günlüğüne bir satır ekle (tarih, ne yapıldı, PR numarası) ve issue'yu kapat. Bir sonraki ajan oradan devam eder.

## Kurulum

- Windows/macOS: `npm install` ve ardından `npm run dev`. Gömülü PostgreSQL kendiliğinden kurulur.
- Linux ajan/bulut ortamı (root): gömülü PostgreSQL root altında çalışmaz.
  1. `bash scripts/linux-dev-db.sh` sistem PostgreSQL'ini 5433 portunda başlatır ve `DATABASE_URL` satırını yazdırır.
  2. `.env` dosyasına `DATABASE_URL` ve 32+ karakterlik `JWT_SECRET` yaz.
  3. Sırayla: `npm ci --ignore-scripts`, `npm run db:migrate`, `npm run db:seed`, `npm run catalog:pilot`, `npm run catalog:osym`, `npm run rag:index:local`.
  4. Servisler: `npm run dev:api` ve `npm run dev:web`. Bunları arka planda bırakmak gerekir.
- Aynı makinede ikinci bir kopya çalıştırmak için `.env` içinde farklı `PORT`, `WEB_PORT`, `WEB_ORIGIN` ve `DATABASE_URL` ver.

## Doğrulama

- `npm run check`: typecheck, Prettier biçim kontrolü ve birim testleri. Her PR'dan önce çalıştırılır.
- `npm run test:integration`: çalışan API'ye karşı uçtan uca akışları dener. API, oturum veya veritabanına dokunan her değişiklikte çalıştırılır. Yeni modül, kendi akışını `scripts/smoke.ts` dosyasına ya da kendi `scripts/*-check.ts` script'ine ekler.
- Yeni davranış yeni test gerektirir. Test edilmeyen şey "çalışıyor" diye raporlanmaz.

## İş akışı

- `main` korunur. Dal adları `feat/…`, `fix/…`, `docs/…`, `chore/…` biçimindedir. Her iş ayrı bir PR olur. PR, CI yeşil olduktan sonra **squash merge** edilir.
- Commit mesajı: `tür: kısa Türkçe açıklama`.
- Kullanıcı ajanlardan soru sormadan ilerlemesini istedi. Makul varsayımı yap ve PR açıklamasına yaz. Geri alınamaz işlerde (veri silme, `main` geçmişini yeniden yazma, gizli anahtar) dur ve sor.

## Kurallar

- **Migration:** Uygulanmış bir `.sql` dosyası asla değiştirilmez. Numaralar `docs/YOL-HARITASI.md` içinde modüllere ayrılmıştır; başka bir modülün numarasını kullanma.
- **Güvenlik:** Bütün yetki kontrolleri sunucuda yapılır. SQL parametriktir. İstemciden gelen rol ve sahiplik iddiasına güvenilmez. Parola, belirteç, özel mesaj ve belge içeriği loglanmaz.
- **Gizli bilgiler:** `.env`, `var/` ve anahtarlar commit edilmez.
- **Veri dosyaları:** `data/*.json` dosyaları script ile üretilir, elle düzenlenmez.
- **Arayüz:** Sade ve açık tonlar kullanılır. Yeşil veya koyu lacivert blok kullanılmaz. Ana sayfa iki sade girişten oluşur. Projeyi gereksiz yere karmaşıklaştırma; mevcut desenleri (route/servis/sözleşme ayrımı, `fail()` hata biçimi, `transaction()`) izle.
- **Değerlendirme dürüstlüğü:** Bağımsız soru setlerini ve uygunluk etiketlerini ajan yazmaz, ekip yazar. Ölçülmemiş bir sonuç belgeye yazılmaz. Sahte kullanıcı yorumu ya da sahte deneyim üretilmez.
- **E-posta:** Gerçek e-posta gönderilmez. Geliştirmede bağlantılar sunucu loguna ve `var/mail/` altına yazılır.
