# Modüler yapı ve geliştirme aşamaları

Son güncelleme: 17 Kasım 2026. Bu belge projeyi bağımsız geliştirilebilen 15 modüle ayırır, modüller arası sınırları ve kalan işi aşamalara böler. Ajanlar (Codex, Claude Code) ve ekip burada yazan modül ve aşama sırasına göre çalışır. Güncel durum ve ilerleme günlüğü: `docs/YOL-HARITASI.md`.

## 1. Modül haritası

| No  | Modül                          | Sahip olduğu dosyalar                                                                                                                                                                                      | Migration        | Durum                                   |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------- |
| M01 | Çekirdek ve işletim            | `server/index.ts`, `db.ts`, `errors.ts`, `scripts/{dev,migrate,environment,local-postgres,db-backup,db-restore,backup-*}.ts`, `server/services/mail.ts`, `Dockerfile`, `compose.yaml`                      | —                | Tamam. Docker hiç denenmedi             |
| M02 | Hesap ve profil                | `server/auth.ts`, `routes/auth.ts`, `services/account-tokens.ts`; sayfalar `Auth`, `Profile`, `PasswordReset`, `VerifyEmail`; `VerifyBanner`, `PasswordChange`, `DevLogin`                                 | 001, 014         | Tamam                                   |
| M03 | Katalog ve karşılaştırma       | `routes/catalog.ts`, `services/{catalog-import,catalog-metrics,search}.ts`, `shared/search.ts`; sayfalar `Programs`, `ProgramDetail`, `Compare`, `Sources`                                                 | 002, 005         | Tamam                                   |
| M04 | Tercih listeleri               | `routes/preferences.ts`; sayfa `Preferences`                                                                                                                                                               | 001              | Tamam                                   |
| M05 | Öneri motoru                   | `services/recommendation.ts`; sayfalar `Recommendations`, `Method`; `scripts/eval-recommend.ts`                                                                                                            | —                | Kod tamam, ölçüm bekliyor               |
| M06 | Tercih danışmanı (AI + filtre) | `routes/advisor.ts`, `services/advisor.ts`, `shared/advisor.ts`; `AdvisorPanel`                                                                                                                            | 002, 003         | Tamam                                   |
| M07 | Yaşam danışmanı (RAG)          | `routes/life.ts`, `services/rag/*`, `services/life-content.ts`, `shared/{life,life-steps,institutions}.ts`; sayfalar `LifeAdvisor`, `Campus`; `LifeChat`, `AnswerFeedback`; `scripts/rag-*`, `eval-rag.ts` | 006–009, 011–013 | Kod tamam, ölçüm bekliyor               |
| M08 | Kaynak yönetimi                | `routes/source-management.ts`, `services/source-updates.ts`, `shared/source-registry.ts`, `scripts/{source-worker,life-sync}.ts`; sayfa `SourceManagement`                                                 | 010              | Tamam. Qdrant temizleme (#16) açık      |
| M09 | Topluluk ve deneyimler         | `routes/{community,experiences}.ts`, `services/{community-rules,author-meta}.ts`; sayfalar `Communities`, `QuestionDetail`; `Experiences`, `AuthorMeta`                                                    | 001, 004, 015    | Tamam                                   |
| M10 | Doğrulama, roller, itibar      | `routes/{verification,admin}.ts`, `services/verification{,-rules}.ts`; sayfalar `Verification`, `AdminVerification`                                                                                        | 016              | Tamam                                   |
| M11 | Bildirimler                    | `routes/notifications.ts`, `services/notification{s,-rules}.ts`; sayfa `Notifications`; `NotificationBell`                                                                                                 | 018              | Tamam. 3 bildirim türü henüz bağlanmadı |
| M12 | Mentorluk                      | `routes/mentorship.ts`, `services/mentorship{,-rules}.ts`, `services/blocks.ts` (geçici)                                                                                                                   | 017              | **Yarım:** `wip/mentorluk` dalında      |
| M13 | Şifreli mesajlaşma             | Yeni                                                                                                                                                                                                       | 019              | Başlanmadı                              |
| M14 | Güvenlik ve moderasyon         | Yeni; `services/blocks.ts` bu modüle geçer                                                                                                                                                                 | 020              | Başlanmadı                              |
| M15 | Değerlendirme ve tez           | `scripts/eval-*`, `docs/degerlendirme.md`, `data/eval/`                                                                                                                                                    | —                | Altyapı tamam. Veriyi ekip yazacak      |

## 2. Bağımlılıklar

```
M01 Çekirdek ─┬─ M02 Hesap ─┬─ M09 Topluluk ──┐
              │             ├─ M10 Doğrulama ─┼─ M12 Mentorluk ── M13 Mesajlaşma
              │             └─ M11 Bildirim ◄─┴──────────────┴──────────┘
              ├─ M03 Katalog ─┬─ M04 Listeler
              │               ├─ M05 Öneri ─────── M15 Değerlendirme
              │               └─ M06 Tercih danışmanı
              └─ M07 RAG ── M08 Kaynak yönetimi ── M15
M14 Moderasyon: M09–M13'ün hepsine kural ekler (engelleme, gizleme, yaptırım)
```

Okuma sırası: oktaki modül, soldakinin servislerini kullanır. Bir modülü geliştirmek için yalnızca solundaki modüllerin bitmiş olması gerekir.

## 3. Modül sınırları (sözleşme)

1. **Yazma sahipliği:** Bir tabloya yalnızca o tabloyu oluşturan modülün servisi yazar. Başka modül okuma için JOIN yapabilir. Yazma gerektiğinde sahibin servis fonksiyonunu çağırır.
2. **Modüller arası çağrılar** yalnızca aşağıdaki fonksiyonlarla yapılır. Yeni bir çağrı gerekiyorsa sahibi modülde fonksiyon olarak açılır ve bu tabloya eklenir.

| Fonksiyon                                                 | Sahibi                               | Ne için                                                           |
| --------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `requireUser`, `requireVerifiedEmail`, `requireRole(...)` | M02/M10 (`server/auth.ts`)           | Kimlik ve yetki                                                   |
| `notify(userId, kind, payload, actorId)`                  | M11                                  | Bildirim. Payload'da içerik olmaz, yalnızca kimlik ve kısa başlık |
| `onContributionEvent(...)`                                | M10 (`community-rules.ts` üzerinden) | İtibar olayı                                                      |
| Onaylı doğrulama sorgusu                                  | M10                                  | Mentor uygunluğu (M12). Fonksiyon yoksa M10'da açılır             |
| `isBlocked(a, b)`                                         | M14 (geçici olarak M12'de)           | Talep, mesaj ve bildirim engeli                                   |
| `sendMail(...)`                                           | M01                                  | E-posta (geliştirmede dosyaya yazar)                              |

3. **Saf kural ayrımı:** Her modülün karar mantığı (durum geçişleri, yetki kararları, doğrulama kuralları) `services/<modül>-rules.ts` dosyasında durur ve `db.ts` içe aktarmaz. Birim testleri yalnızca bu dosyayı test eder, çünkü CI'da veritabanı yoktur.
4. **Yeni modüllerin dosya düzeni** (M12, M13, M14 ve sonrası):

```
server/migrations/NNN_<ad>.sql          # numara YOL-HARITASI'ndaki ayırmadan
server/routes/<ad>.ts                   # HTTP, Zod doğrulama, yetki; server/index.ts'e tek satırla bağlanır
server/services/<ad>.ts                 # veritabanı işlemleri
server/services/<ad>-rules.ts           # saf kurallar
shared/<ad>.ts                          # bu modülün Zod sözleşmeleri (contracts.ts'e eklenmez)
src/pages/<Ad>*.tsx, src/components/<Ad>*.tsx
src/styles.css                          # yalnızca /* === <ad> === */ başlıklı kendi bölümü
tests/<ad>-rules.test.ts
scripts/<ad>-check.ts                   # package.json test:integration zincirine eklenir
```

`contracts.ts` ve `styles.css` paylaşılan dosyalardır. Yeni modül bunlara yalnızca ekleme yapar ve var olanı yeniden düzenlemez. Böylece paralel PR'lar çakışmaz.

## 4. Bir modülün "bitti" sayılması

- [ ] Migration, route, servis ve kurallar `docs/veri-modeli-v2.md` sözleşmesine uyuyor. Sözleşmeden ayrılan yer o belgede "Uygulama notları" bölümünde yazılı.
- [ ] Bütün yetki kontrolleri sunucuda. Taraf olmayana 404, yetkisize 403 dönüyor.
- [ ] `.env` olmadan `npm run check` geçiyor.
- [ ] Çalışan API'ye karşı `npm run test:integration` geçiyor ve modülün kendi `*-check.ts` script'i zincirde.
- [ ] Arayüz sayfası var ve menüden erişiliyor. Tarayıcıda en az bir kez elle denendi ya da PR'da "tarayıcıda denenmedi" yazıyor.
- [ ] README'nin "Mevcut işlevler" bölümüne bir satır, YOL-HARITASI ilerleme günlüğüne bir satır eklendi.
- [ ] PR, CI yeşil olduktan sonra squash merge edildi.

## 5. Geliştirme aşamaları

Her aşamanın bir çıkış kapısı var. Kapı geçilmeden bir sonraki aşamanın modülüne başlanmaz. Ekip verisi (M15) bütün aşamalar boyunca paralel hazırlanır.

| Aşama | Tarih        | Modüller                   | Çıkış kapısı                                                                                                                                                             |
| ----- | ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 18–21 Kas    | M12 Mentorluk              | Doğrulanmış öğrenci mentor profili açar. Aday talep gönderir, mentor kabul eder, iki tarafa bildirim gider                                                               |
| 2     | 21–26 Kas    | M13 Şifreli mesajlaşma     | İki tarayıcı arasında mesaj gider. Veritabanında düz metin yok. İzni olmayan kişi mesaj gönderemez                                                                       |
| 3     | 26 Kas–3 Ara | M14 Güvenlik ve moderasyon | Engelleme M12/M13/M11'de geçerli. Şikâyet → moderatör kararı → denetim kaydı. Gizlenen içerik geri açılabiliyor                                                          |
| 4     | 3–7 Ara      | Bütünleştirme              | Tarayıcıda uçtan uca tur yapıldı ve hatalar kapandı. Docker denemesi geçti. Kalan bildirim türleri bağlandı. Qdrant temizleme (#16) yapıldı. **7 Aralık: kapsam kilidi** |
| 5     | 8–14 Ara     | M05, M07, M15 ölçümleri    | `eval:recommend` ve `eval:rag` ekip verisiyle çalıştırıldı. Kullanıcı çalışması (#5) yapıldı. Sayılar rapora girdi                                                       |
| 6     | 15–17 Ara    | Teslim                     | Rapor, sunum, demo provası, yedek video                                                                                                                                  |

**Ekip işi (M15, en geç 30 Kasım):** `data/eval/profiller.json` ve `data/eval/rag-sorular.json` doldurulur (biçim `docs/degerlendirme.md`). Kullanıcı çalışması için 5–10 katılımcı bulunur.

## 6. Ajan görev kartları

Her kart bir ajan oturumuna olduğu gibi verilebilir. Kartlar sırayla çalıştırılır; aynı aşamadaki kartlar paralel çalışabilir. Her kart için: önce `AGENTS.md`, `docs/MODULLER.md` ve `docs/veri-modeli-v2.md` içindeki ilgili bölümü oku, `main`'den dal aç, bitince PR aç, CI yeşilse squash merge et ve günlüğe yaz.

### Aşama 1

**K1 · M12 Mentorluk** (dal `feat/mentorluk`)

- `wip/mentorluk` dalındaki çalışmadan devam et: migration 017, route, kurallar ve testler yazıldı; arayüz eksik ve testler çalıştırılmadı. Bu dalı güncel `main` ile birleştir.
- Sözleşme `veri-modeli-v2.md` §017. Kurallar:
  - Mentor profili için onaylı doğrulama gerekir. Doğrulama kaldırılırsa profil listede görünmez.
  - Talep için doğrulanmış e-posta gerekir. Kendine talep olmaz. Açık çift için ikinci talep 409 döner.
  - Kabul/ret yalnızca mentorda, iptal yalnızca menteede. Tamamlama yalnızca `accepted` durumundan yapılır.
  - `mentorship_request` ve `mentorship_response` bildirimleri gönderilir; talep mesajı payload'a konmaz.
- Arayüz: `/mentorlar` (filtreli liste, talep formu) ve `/mentorluk` (gelen/giden talepler, profil düzenleme). Kabul edilmiş talepte "Mesaj gönder" yer tutucusu olur.
- Entegrasyon testi `scripts/mentorship-check.ts`: doğrulamasız profil reddi, ikinci talep 409, mentee kabul edemez, üçüncü kişi 404, kabul sonrası bildirim, tamamlama.

### Aşama 2

**K2 · M13 Şifreli mesajlaşma** (dal `feat/mesajlasma`, migration 019)

- Karar: `docs/karar-mesajlasma.md`. Yeni bağımlılık `libsodium-wrappers-sumo`, yalnızca istemcide kullanılır.
- Anahtar çifti istemcide üretilir. Özel anahtar Argon2id ile parolaya sarılıp sunucuya gönderilir.
- Parola değişiminde anahtar yeniden sarılır; bunun için M02'deki parola değiştirme akışına istemci tarafında bir kanca eklenir. Parola sıfırlamada yeni anahtar üretilir; arayüz bunu önceden uyarır.
- Sohbet yalnızca kabul edilmiş mentorluk talebiyle açılır. `isBlocked` kontrol edilir.
- Mesajlar alıcı ve gönderici için iki kez şifrelenir. `client_id` ile tekrar gönderim aynı kaydı döndürür. Arayüz 5 saniyede bir yoklar. Güvenlik kodu gösterilir.
- `message_received` bildirimi gider ama payload'da içerik olmaz.
- Test: düz metin, veritabanının hiçbir sütununda bulunmamalı (bilinen metin gönderip arama). Yetkisiz gönderim ve okuma reddedilmeli. Parola değişiminden sonra eski mesajlar okunabilmeli. Mesaj şifreleme ve çözme saf fonksiyonları birim testiyle denenmeli.
- Ek: Helmet CSP'nin libsodium WASM'ını engellemediğini kontrol et (`wasm-unsafe-eval` gerekebilir).

### Aşama 3

**K3 · M14 Güvenlik ve moderasyon** (dal `feat/moderasyon`, migration 020)

- Sözleşme `veri-modeli-v2.md` §020.
- `blocks.ts`'i M14'e taşı ve gerçek `isBlocked` yaz. Engelleme şunlara uygulanır: mentorluk talebi, mesaj, bildirim üretimi; ayrıca engellenen kişinin içeriği engelleyenin akışında gizlenir.
- Şikâyet: soru, yanıt, deneyim, kullanıcı ve mesaj için. Mesaj şikâyetinde yalnızca kullanıcının açık onayıyla seçtiği metin gider.
- Moderatör paneli `/yonetim/*`: şikâyet kuyruğu, toksisite işaretleri, gizlenen içerik ve geri açma (M10'un eksiği), yaptırım (uyarı, susturma, askıya alma), denetim kaydı görünümü.
- Yaptırımlar: `mute` içerik ve mesaj üretimini durdurur, `suspend` girişi engeller. Her yönetim işlemi `audit_log`'a yazılır; uygulama bu tabloda UPDATE/DELETE yapmaz.
- Toksisite: sürümlü Türkçe kural listesi. İçerik oluşturulunca puanlanır. Eşiği aşan içerik kuyruğa düşer, otomatik gizlenmez.

### Aşama 4

Bu aşamanın kartları paralel çalışabilir.

- **K4 · Tarayıcı turu:** Her sayfayı aç, iki ana yolculuğu (tercih öncesi ve yerleşme sonrası) ve yönetim yolculuğunu baştan sona dene. Bulunan her hatayı bir issue olarak aç ve düzelt. Mobil genişlikte de bak.
- **K5 · Docker:** İmaj indirilebilen bir makinede `docker compose up -d --build` çalıştır. `docs/dagitim.md`'yi doğrula, `smoke.ts`'i compose'a karşı çalıştır.
- **K6 · Kalan bağlantılar:** Eksik bildirim türlerini bağla. Qdrant eski koleksiyon temizliğini yap (#16). Kurulumu temiz bir makinede dene (#14). Entegrasyon testini genişlet (#13).

### Aşama 5–6

- **K7 · Ölçüm:** Ekip verisi hazır olunca `npm run eval:recommend` ve `npm run eval:rag` çalıştır. Modeller kurulu makinede dört arama düzeneğinin dördü de çalışmalı. Raporları `var/reports/` altından al ve tabloları rapora aktar. Ölçülmemiş sonuç yazılmaz.
- **K8 · Belgeler:** Öğrenci ve yönetici kılavuzu (#17) ile final rapor iskeleti (#18).

## 7. Kapsam dışı (genişleme hedefi)

Çoklu cihaz ve ileri gizlilikli mesajlaşma (Signal), 2FA, yerel mobil uygulama, otomatik mentor eşleştirme, gerçek e-posta gönderimi (SMTP adaptörü için arayüz hazır).
