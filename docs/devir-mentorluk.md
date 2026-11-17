# Mentorluk devri

- Çalışma dizini: `C:/Users/ucakm/Documents/Codex/2026-10-14/me/uni-guncel-inceleme`; dal: `feat/mentorluk`.
- Yerel portlar: web `5174`, API `3002`, PostgreSQL `55433`.
- M12: migration `server/migrations/017_mentorship.sql`, API `server/routes/mentorship.ts`, servis `server/services/mentorship.ts`, kurallar `server/services/mentorship-rules.ts`, sözleşme `shared/mentorship.ts`, sayfalar `src/pages/Mentors.tsx` ve `src/pages/Mentorship.tsx`. Entegrasyon kontrolü `scripts/mentorship-check.ts`.
- Son servis düzenlemesi sonrası `npm run check` (105 birim testi, typecheck ve Prettier), build ve tam entegrasyon zinciri başarılı. Mentorluk kontrolü hız sınırının Retry-After süresini (47 saniye) bekleyerek geçti. PR ve CI bekliyor.
- Tarayıcıda `/mentorlar` misafir boş liste ve menü, girişten sonra `/mentorluk` doğrulama gerekliliği kartı ve boş gelen talepler denendi; korumalı profil görünümü doğru. Dolu mentor profili ve form akışı henüz tarayıcıda denenmedi.
- Entegrasyon betikleri sınırlı hesap kotaları kullanır; tam zinciri tekrar tekrar çalıştırırken yeni sunucu oturumu başlatın.
- `server/services/blocks.ts` içindeki `isBlocked` M14 uygulanana kadar geçici olarak her zaman `false` döner. Mesajlaşma henüz uygulanmadı.
- `data/life-knowledge.json` worker tarafından değiştirildi; kaynak verisi değişikliğini koruyun, bu işle birlikte commit etmeyin.
