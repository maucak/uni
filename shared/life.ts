export type LifeArticle = {
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
  mode: "generated" | "sources" | "no-evidence";
  answer: string;
  notice: string;
  sources: LifeArticle[];
};
