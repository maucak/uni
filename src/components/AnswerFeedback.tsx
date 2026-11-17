import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { api, json } from "../lib/api";
export function AnswerFeedback({
  requestId,
  initial,
}: {
  requestId: string;
  initial?: number | null;
}) {
  const [rating, setRating] = useState(initial ?? null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(value: -1 | 1) {
    if (busy || value === rating) return;
    setBusy(true);
    setError("");
    try {
      await api("/life/feedback", json("POST", { requestId, rating: value }));
      setRating(value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="answer-feedback">
      <span>Bu sonuç faydalı mı?</span>
      <button
        type="button"
        aria-label="Faydalı"
        aria-pressed={rating === 1}
        disabled={busy}
        onClick={() => void save(1)}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        aria-label="Eksik veya yanlış"
        aria-pressed={rating === -1}
        disabled={busy}
        onClick={() => void save(-1)}
      >
        <ThumbsDown size={14} />
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
