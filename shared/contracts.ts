import { z } from "zod";
export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(["candidate", "student", "graduate"]),
  scoreType: z.enum(["SAY", "EA", "SÖZ", "DİL"]),
  rank: z.number().int().min(1).max(5000000).nullable(),
  interests: z.string().trim().max(1500),
  cities: z.array(z.string().max(80)).max(20),
  language: z.enum(["any", "Türkçe", "İngilizce"]),
  universityType: z.enum(["any", "Devlet", "Vakıf"]),
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
};
export type User = { id: string; email: string; profile: Profile };
export type Program = {
  id: string;
  name: string;
  university: string;
  city: string;
  universityType: "Devlet" | "Vakıf";
  language: string;
  scoreType: string;
  scholarship: string;
  description: string;
  subjects: string[];
  rank: number | null;
  quota: number | null;
  year: number | null;
  isSample: boolean;
  source: string;
  sourceUrl: string | null;
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
    scoreType: z.enum(["", "SAY", "EA", "SÖZ", "DİL"]).default(""),
    language: z.enum(["", "Türkçe", "İngilizce"]).default(""),
    type: z.enum(["", "Devlet", "Vakıf"]).default(""),
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
};
export type Answer = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  votes: number;
  voted: boolean;
};
