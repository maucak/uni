export type LifeArticle = {
  documentId?: string;
  chunkId?: string;
  sourceVersion?: string;
  historical?: boolean;
  program?: string | null;
  page?: number;
  pageEnd?: number;
  section?: string;
  scope?: "isubu" | "sdu" | "pau" | "akdeniz" | "national";
  kind?: "guide" | "official-excerpt";
  id: string;
  title: string;
  topic: string;
  text: string;
  keywords: string[];
  sourceTitle: string;
  url: string;
  checkedAt: string;
  period: string | null;
};
export type LifeAnswer = {
  requestId?: string;
  feedback?: number | null;
  conversationId?: string;
  retrievalQuery?: string;
  mode:
    | "conversation"
    | "generated"
    | "sources"
    | "no-evidence"
    | "clarification"
    | "action";
  actions?: { label: string; url: string }[];
  retrieval?: { method: string; elapsedMs: number; corpusVersion: string };
  answer: string;
  notice: string;
  sources: LifeArticle[];
};
