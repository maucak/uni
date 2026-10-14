import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool, transaction } from "../server/db.ts";
const catalog = [
  [
    "Örnek Ege Üniversitesi",
    "İzmir",
    "Devlet",
    "Bilgisayar Mühendisliği",
    "İngilizce",
    "SAY",
    "Ücretsiz",
    42000,
    "Yazılım geliştirme, algoritmalar, yapay zeka ve veri bilimi. Araştırma projeleri ve bilgisayar sistemleri.",
    ["Yazılım", "Matematik", "Yapay zeka"],
  ],
  [
    "Örnek İç Anadolu Üniversitesi",
    "Ankara",
    "Devlet",
    "Bilgisayar Mühendisliği",
    "Türkçe",
    "SAY",
    "Ücretsiz",
    68000,
    "Algoritma, programlama, veritabanı, bilgisayar ağları ve yazılım mühendisliği üzerine eğitim.",
    ["Yazılım", "Algoritma", "Veritabanı"],
  ],
  [
    "Örnek Akdeniz Üniversitesi",
    "Antalya",
    "Devlet",
    "Yazılım Mühendisliği",
    "İngilizce",
    "SAY",
    "Ücretsiz",
    82000,
    "Web ve mobil uygulama geliştirme, yazılım mimarisi, test ve proje yönetimi.",
    ["Yazılım", "Web", "Mobil"],
  ],
  [
    "Örnek Marmara Vakıf Üniversitesi",
    "İstanbul",
    "Vakıf",
    "Yazılım Mühendisliği",
    "İngilizce",
    "SAY",
    "%100 burslu",
    51000,
    "Yazılım tasarımı, dağıtık sistemler, girişimcilik ve ürün geliştirme.",
    ["Yazılım", "Girişimcilik", "Tasarım"],
  ],
  [
    "Örnek Göller Üniversitesi",
    "Isparta",
    "Devlet",
    "Elektrik-Elektronik Mühendisliği",
    "Türkçe",
    "SAY",
    "Ücretsiz",
    125000,
    "Elektronik devreler, kontrol sistemleri, robotik, enerji ve haberleşme.",
    ["Elektronik", "Robotik", "Fizik"],
  ],
  [
    "Örnek Ege Üniversitesi",
    "İzmir",
    "Devlet",
    "Endüstri Mühendisliği",
    "İngilizce",
    "SAY",
    "Ücretsiz",
    58000,
    "Optimizasyon, üretim sistemleri, veri analizi ve operasyon araştırması.",
    ["Matematik", "Veri analizi", "Yönetim"],
  ],
  [
    "Örnek İç Anadolu Üniversitesi",
    "Ankara",
    "Devlet",
    "Psikoloji",
    "Türkçe",
    "EA",
    "Ücretsiz",
    34000,
    "İnsan davranışı, bilişsel psikoloji, araştırma yöntemleri ve istatistik.",
    ["Psikoloji", "Araştırma", "İnsan davranışı"],
  ],
  [
    "Örnek Marmara Vakıf Üniversitesi",
    "İstanbul",
    "Vakıf",
    "Yönetim Bilişim Sistemleri",
    "İngilizce",
    "EA",
    "%50 burslu",
    95000,
    "İşletme, teknoloji, veri analizi ve dijital dönüşüm alanlarının birleşimi.",
    ["İşletme", "Yazılım", "Veri analizi"],
  ],
  [
    "Örnek Göller Üniversitesi",
    "Isparta",
    "Devlet",
    "İşletme",
    "Türkçe",
    "EA",
    "Ücretsiz",
    210000,
    "Pazarlama, finans, yönetim ve girişimcilik odaklı eğitim.",
    ["İşletme", "Finans", "Girişimcilik"],
  ],
  [
    "Örnek Akdeniz Üniversitesi",
    "Antalya",
    "Devlet",
    "Görsel İletişim Tasarımı",
    "Türkçe",
    "SÖZ",
    "Ücretsiz",
    72000,
    "Grafik tasarım, görsel hikaye anlatımı, dijital medya ve iletişim.",
    ["Tasarım", "Medya", "Sanat"],
  ],
  [
    "Örnek Ege Üniversitesi",
    "İzmir",
    "Devlet",
    "İngiliz Dili ve Edebiyatı",
    "İngilizce",
    "DİL",
    "Ücretsiz",
    18000,
    "Dilbilim, edebiyat, kültür ve metin inceleme.",
    ["Dil", "Edebiyat", "Kültür"],
  ],
  [
    "Örnek İç Anadolu Üniversitesi",
    "Ankara",
    "Devlet",
    "Makine Mühendisliği",
    "Türkçe",
    "SAY",
    "Ücretsiz",
    110000,
    "Mekanik tasarım, termodinamik, malzeme bilimi ve üretim teknolojileri.",
    ["Fizik", "Tasarım", "Üretim"],
  ],
] as const;
export async function seed() {
  await transaction(async (client) => {
    for (const [
      university,
      city,
      type,
      name,
      language,
      scoreType,
      scholarship,
      rank,
      description,
      subjects,
    ] of catalog) {
      const u = await client.query(
        "INSERT INTO universities(id,name,city,university_type) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id",
        [randomUUID(), university, city, type],
      );
      const p = await client.query(
        "INSERT INTO programs(id,university_id,name,language,score_type,scholarship,description,subjects) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(university_id,name,language,scholarship) DO UPDATE SET name=excluded.name RETURNING id",
        [
          randomUUID(),
          u.rows[0].id,
          name,
          language,
          scoreType,
          scholarship,
          description,
          JSON.stringify(subjects),
        ],
      );
      await client.query(
        "INSERT INTO program_year_data(program_id,year,rank,quota,source) VALUES($1,2025,$2,60,$3) ON CONFLICT DO NOTHING",
        [
          p.rows[0].id,
          rank,
          "Sentetik geliştirme verisi — resmî bilgi değildir",
        ],
      );
    }
    for (const [name, slug, description] of [
      [
        "Tercih Yolculuğu",
        "tercih-yolculugu",
        "Tercih sürecini konuş, sorularını paylaş.",
      ],
      [
        "Yazılım ve Bilgisayar",
        "yazilim-bilgisayar",
        "Dersler, projeler ve yazılım alanındaki deneyimler.",
      ],
      [
        "Kampüs Yaşamı",
        "kampus-yasami",
        "Hazırlık, barınma ve üniversitede günlük yaşam.",
      ],
    ])
      await client.query(
        "INSERT INTO communities(id,name,slug,description) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO NOTHING",
        [randomUUID(), name, slug, description],
      );
  });
  console.log(
    "Örnek katalog hazır. Kullanıcı hesabı veya sahte öğrenci yorumu oluşturulmadı.",
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .catch(async (e) => {
      console.error(e.message);
      await pool.end();
      process.exitCode = 1;
    });
}
