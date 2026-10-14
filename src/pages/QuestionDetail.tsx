import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ThumbsUp } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { Loading, ErrorBox } from "../components/ui";
import type { Question, Answer } from "../../shared/contracts";
export default function QuestionDetail() {
  const { id } = useParams();
  const { user } = useStore();
  const { data, loading, error, reload } = useLoad<
    Question & { answers: Answer[] }
  >(`/questions/${id}`);
  const [body, setBody] = useState(""),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  async function answer(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await api(`/questions/${id}/answers`, json("POST", { body }));
      setBody("");
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function vote(a: Answer) {
    setActionError("");
    try {
      await api(`/answers/${a.id}/vote`, {
        method: a.voted ? "DELETE" : "PUT",
      });
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return null;
  return (
    <div className="reading-width">
      <Link
        className="back-link"
        to={`/topluluklar?communityId=${data.communityId}`}
      >
        <ArrowLeft size={16} /> Topluluklara dön
      </Link>
      <article className="panel question-detail">
        <span className="badge">{data.communityName}</span>
        <div className="tags">
          {data.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <h1>{data.title}</h1>
        <p className="quiet">
          {data.author} · {new Date(data.createdAt).toLocaleDateString("tr-TR")}
        </p>
        <p className="user-content">{data.body}</p>
      </article>
      <h2 className="answers-heading">{data.answers.length} yanıt</h2>
      {actionError && <ErrorBox message={actionError} />}
      <div className="answer-list">
        {data.answers.map((a) => (
          <article className="panel" key={a.id}>
            <div className="answer-author">
              <span className="avatar">{a.author[0]}</span>
              <strong>{a.author}</strong>
              <small>{new Date(a.createdAt).toLocaleDateString("tr-TR")}</small>
            </div>
            <p className="user-content">{a.body}</p>
            <button
              className={`text-button ${a.voted ? "selected" : ""}`}
              disabled={!user}
              onClick={() => vote(a)}
            >
              <ThumbsUp size={16} /> Faydalı ({a.votes})
            </button>
          </article>
        ))}
      </div>
      {user ? (
        <section className="panel">
          <h2>Deneyimini paylaş.</h2>
          <form onSubmit={answer}>
            <label>
              Yanıtın
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                placeholder="Kendi deneyimini ve bilginin bağlamını belirt."
              />
            </label>
            <button className="button dark" disabled={busy}>
              {busy ? "Gönderiliyor…" : "Yanıtı paylaş"}
            </button>
          </form>
        </section>
      ) : (
        <div className="panel">
          <Link className="button dark" to="/giris">
            Yanıt vermek için giriş yap
          </Link>
        </div>
      )}
    </div>
  );
}
