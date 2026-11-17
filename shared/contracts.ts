import { z } from "zod";
export const educationLanguages = [
  "Türkçe",
  "İngilizce",
  "Almanca",
  "Arapça",
  "Fransızca",
  "Rusça",
  "İspanyolca",
  "Bulgarca",
  "Ermenice",
  "İtalyanca",
  "Boşnakça",
  "Çince",
  "Korece",
  "Türkçe-Rusça",
] as const;
export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(["candidate", "student", "graduate"]),
  scoreType: z.enum(["SAY", "EA", "SÖZ", "DİL", "TYT"]),
  rank: z.number().int().min(1).max(5000000).nullable(),
  interests: z.string().trim().max(1500),
  cities: z.array(z.string().max(80)).max(20),
  language: z.enum(["any", ...educationLanguages]),
  universityType: z.enum(["any", "Devlet", "Vakıf", "Yurt dışı"]),
  maxAnnualTuition: z
    .number()
    .int()
    .min(0)
    .max(10000000)
    .nullable()
    .default(null),
  minimumScholarship: z.number().min(0).max(100).nullable().default(null),
  weights: z.object({
    interest: z.number().min(0).max(5),
    city: z.number().min(0).max(5),
    language: z.number().min(0).max(5),
    budget: z.number().min(0).max(5).default(2),
  }),
  university: z.string().trim().max(150),
  department: z.string().trim().max(150),
  bio: z.string().trim().max(1000),
  studentCity: z.string().trim().max(80).default(""),
  campus: z.string().trim().max(150).default(""),
  studyStage: z.enum(["new", "prep", "undergraduate", "other"]).default("new"),
  lifeSteps: z
    .array(
      z.enum(["registration", "obs", "calendar", "prep", "housing", "campus"]),
    )
    .max(6)
    .default([]),
});
export type Profile = z.infer<typeof profileSchema>;
export const defaultProfile: Profile = {
  displayName: "",
  role: "candidate",
  scoreType: "SAY",
  rank: null,
  interests: "",
  cities: [],
  language: "any",
  universityType: "any",
  maxAnnualTuition: null,
  minimumScholarship: null,
  weights: { interest: 3, city: 2, language: 2, budget: 2 },
  university: "",
  department: "",
  bio: "",
  studentCity: "",
  campus: "",
  studyStage: "new",
  lifeSteps: [],
};
export type User = { id: string; email: string; profile: Profile };
export type Program = {
  id: string;
  name: string;
  university: string;
  city: string;
  universityType: "Devlet" | "Vakıf" | "Yurt dışı";
  language: string;
  scoreType: string;
  scholarship: string;
  description: string;
  subjects: string[];
  rank: number | null;
  quota: number | null;
  year: number | null;
  rankYear?: number | null;
  quotaYear?: number | null;
  isSample: boolean;
  source: string;
  sourceUrl: string | null;
  admissionData?: {
    year: number;
    table: string;
    row: number;
    columns: Record<string, string | number | null>;
  };
  officialCode?: string | null;
  tuition?: number | null;
  feeYear?: number | null;
  scholarshipPercent?: number | null;
  sources?: DataSource[];
  history?: YearData[];
  catalogVersion?: string;
};
export type DataSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  notes: string;
};
export type YearData = {
  year: number;
  rank: number | null;
  quota: number | null;
  tuition: number | null;
  currency: string | null;
  source: string;
  sourceUrl: string | null;
};
export type Recommendation = {
  program: Program;
  score: number | null;
  coverage: number;
  reasons: string[];
  missing: string[];
  components?: { name: string; weight: number; value: number | null }[];
};
export const searchStateSchema = z
  .object({
    search: z.string().max(100).default(""),
    city: z.string().max(80).default(""),
    scoreType: z.enum(["", "SAY", "EA", "SÖZ", "DİL", "TYT"]).default(""),
    language: z.enum(["", ...educationLanguages]).default(""),
    type: z.enum(["", "Devlet", "Vakıf", "Yurt dışı"]).default(""),
    dataKind: z.enum(["real", "sample", "all"]).default("real"),
    rankMin: z.number().int().min(1).max(5000000).nullable().default(null),
    rankMax: z.number().int().min(1).max(5000000).nullable().default(null),
    maxTuition: z.number().int().min(0).max(10000000).nullable().default(null),
    minScholarship: z.number().min(0).max(100).nullable().default(null),
    includeUnknown: z.boolean().default(true),
    sort: z.enum(["name", "rank", "fit"]).default("name"),
  })
  .refine(
    (s) => s.rankMin === null || s.rankMax === null || s.rankMin <= s.rankMax,
    {
      message: "En küçük sıra, en büyük sıradan büyük olamaz.",
      path: ["rankMin"],
    },
  );
export type SearchState = z.infer<typeof searchStateSchema>;
export type ListItem = {
  id: string;
  position: number;
  note: string;
  program: Program;
};
export type PreferenceList = {
  id: string;
  name: string;
  revision: number;
  items: ListItem[];
};
export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string;
  questionCount: number;
  programId: string | null;
  kind: CommunityKind;
  universityId: string | null;
  experienceCount: number;
};
export const communityKinds = ["general", "university", "program"] as const;
export type CommunityKind = (typeof communityKinds)[number];
export const experienceTopics = [
  "ders",
  "hazirlik",
  "staj",
  "kampus",
  "barinma",
  "kariyer",
  "diger",
] as const;
export type ExperienceTopic = (typeof experienceTopics)[number];
export const experienceTopicLabels: Record<ExperienceTopic, string> = {
  ders: "Dersler",
  hazirlik: "Hazırlık",
  staj: "Staj",
  kampus: "Kampüs",
  barinma: "Barınma",
  kariyer: "Kariyer",
  diger: "Diğer",
};
export type ExperienceAuthorStatus = "student" | "graduate";
/** Deneyim kartı etiketi: resmi bilgiden ayrı görünen beyan. */
export function experienceLabel(
  status: ExperienceAuthorStatus,
  year: number,
): string {
  return `${status === "graduate" ? "mezun deneyimi" : "öğrenci deneyimi"} · ${year}`;
}
export const experienceInputSchema = z.object({
  communityId: z.uuid(),
  programId: z.uuid().nullable().default(null),
  topic: z.enum(experienceTopics),
  experienceYear: z.number().int().min(1990).max(2100),
  title: z.string().trim().min(5).max(180),
  body: z.string().trim().min(30).max(8000),
});
export const experienceUpdateSchema = experienceInputSchema
  .omit({ communityId: true, programId: true })
  .partial();
export type Experience = {
  id: string;
  communityId: string;
  communityName: string;
  programId: string | null;
  topic: ExperienceTopic;
  experienceYear: number;
  authorStatus: ExperienceAuthorStatus;
  title: string;
  body: string;
  author: string;
  mine: boolean;
  votes: number;
  voted: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Question = {
  tags: string[];
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  answerCount: number;
  communityId: string;
  communityName: string;
  acceptedAnswerId: string | null;
};
export type Answer = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  votes: number;
  voted: boolean;
  accepted: boolean;
};
