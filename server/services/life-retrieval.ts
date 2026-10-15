import { lifeArticles } from "./life-content.ts";
// Curated small corpus, lexical retrieval. No embedding or semantic model.
export function lifeTokens(text: string) {
  return (
    text
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .match(/[a-z0-9]+/g) || []
  )
    .filter((t) => t.length > 2)
    .map((t) => (t.length > 6 ? t.slice(0, 6) : t));
}
export function retrieveLife(query: string) {
  const tokens = [...new Set(lifeTokens(query))];
  return lifeArticles
    .map((article) => {
      const title = new Set(
        lifeTokens(article.title + " " + article.keywords.join(" ")),
      );
      const body = new Set(lifeTokens(article.text));
      return {
        article,
        score: tokens.reduce(
          (n, t) => n + (title.has(t) ? 3 : body.has(t) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.article);
}
