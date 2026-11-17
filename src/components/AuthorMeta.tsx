import { BadgeCheck } from "lucide-react";
import type { AuthorMeta as Meta } from "../../shared/contracts";

/** Yazar adının yanında doğrulanmış rozet ve itibar. Rozet kapsamı başlıkta açıkça yazar. */
export function AuthorMeta({ meta }: { meta: Partial<Meta> }) {
  const badges = meta.authorBadges || [];
  return (
    <span className="author-meta">
      {badges.map((b) => (
        <span className="verified-badge" key={b.label} title={b.label}>
          <BadgeCheck size={13} />
          {b.claim === "student" ? "Doğrulanmış öğrenci" : "Doğrulanmış mezun"}
        </span>
      ))}
      {typeof meta.authorReputation === "number" && (
        <span className="reputation" title="İtibar puanı">
          {meta.authorReputation} itibar
        </span>
      )}
    </span>
  );
}
