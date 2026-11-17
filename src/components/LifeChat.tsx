import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Send, Plus, Trash2, ArrowUpRight, MessageCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { askLife } from "../lib/life-stream";
import { AnswerFeedback } from "./AnswerFeedback";
import { useStore } from "../lib/store";
import { DevLogin } from "./DevLogin";
import { ErrorBox } from "./ui";
import type { LifeAnswer, LifeArticle } from "../../shared/life";
type Turn =
  | { role: "user"; payload: { message: string } }
  | { role: "assistant"; payload: LifeAnswer };
type Conversation = { id: string; title: string };
export function LifeChat() {
  const { user } = useStore();
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [conversationId, setConversationId] = useState<string | null>(null),
    [turns, setTurns] = useState<Turn[]>([]),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const request = useRef<{
    message: string;
    requestId: string;
    conversationId: string | null;
  } | null>(null);
  const account = useRef(user?.id);
  account.current = user?.id;
  const [phase, setPhase] = useState("searching"),
    [preview, setPreview] = useState<LifeArticle[]>([]);
  useEffect(() => {
    let active = true;
    setTurns([]);
    setConversationId(null);
    setConversations([]);
    setError("");
    setPending("");
    setPreview([]);
    setBusy(false);
    request.current = null;
    if (user) {
      api<Conversation[]>("/life/conversations")
        .then((v) => {
          if (active) setConversations(v);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (turns.length || pending)
      bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, pending]);
  async function ask(e: FormEvent) {
    e.preventDefault();
    if (busy || message.trim().length < 3) return;
    const question = message.trim();
    const owner = user!.id;
    setBusy(true);
    setError("");
    setPending(question);
    setPreview([]);
    setPhase("searching");
    try {
      if (
        !request.current ||
        request.current.message !== question ||
        request.current.conversationId !== conversationId
      )
        request.current = {
          message: question,
          requestId: crypto.randomUUID(),
          conversationId,
        };
      const reply = await askLife(
        request.current,
        (s) => {
          if (account.current === owner) setPreview(s);
        },
        (p) => {
          if (account.current === owner) setPhase(p);
        },
      );
      if (account.current !== owner) return;
      setConversationId(reply.conversationId || null);
      setTurns((t) => [
        ...t,
        { role: "user", payload: { message: question } },
        { role: "assistant", payload: reply },
      ]);
      setMessage("");
      request.current = null;
      void api<Conversation[]>("/life/conversations")
        .then((c) => {
          if (account.current === owner) setConversations(c);
        })
        .catch(() => {});
    } catch (e) {
      if (account.current !== owner) return;
      if (e instanceof ApiError && e.code !== "REQUEST_PENDING")
        request.current = null;
      setError((e as Error).message);
    } finally {
      if (account.current === owner) {
        setBusy(false);
        setPending("");
        setPreview([]);
      }
    }
  }
  async function select(id: string) {
    if (!id) {
      setConversationId(null);
      setTurns([]);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await api<Turn[]>(`/life/conversations/${id}`);
      setConversationId(id);
      setTurns(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!conversationId || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/life/conversations/${conversationId}`, { method: "DELETE" });
      setConversations((c) => c.filter((x) => x.id !== conversationId));
      setConversationId(null);
      setTurns([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <div className="chat-login">
        <MessageCircle size={26} />
        <h3>Rehberle konuşmaya başla.</h3>
        <p>
          Konuşmalarını hesabında saklamak için giriş yap. Rehber içerikleri
          herkese açık.
        </p>
        <Link className="button dark" to="/giris">
          Giriş yap
        </Link>
        <DevLogin />
      </div>
    );
  return (
    <div className="source-chat">
      <div className="chat-toolbar">
        <select
          aria-label="Önceki konuşmalar"
          value={conversationId || ""}
          disabled={busy}
          onChange={(e) => void select(e.target.value)}
        >
          <option value="">Yeni konuşma</option>
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          className="button light"
          disabled={busy}
          onClick={() => void select("")}
        >
          <Plus size={16} /> Yeni
        </button>
        {conversationId && (
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => void remove()}
            aria-label="Bu konuşmayı sil"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <div
        className="chat-turns"
        role="log"
        aria-label="Danışman konuşması"
        aria-live="polite"
      >
        {!turns.length && !pending && (
          <div className="chat-welcome">
            <MessageCircle size={25} />
            <h3>Neyi öğrenmek istersin?</h3>
            <p>
              İSUBÜ öğrenci işlemleri ve yaşam rehberi ile GSB barınma
              kaynakları içinde ararım.
            </p>
            <div className="chat-suggestions">
              {[
                "Yurt başvurusunu nasıl yapabilirim?",
                "Yemekhane bakiyemi nasıl yüklerim?",
                "OBS şifremi unuttum.",
              ].map((q) => (
                <button key={q} type="button" onClick={() => setMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div className="chat-user" key={index}>
              {turn.payload.message}
            </div>
          ) : (
            <div className="chat-assistant" key={index}>
              <span className="chat-label">
                {turn.payload.mode === "sources" ||
                turn.payload.mode === "no-evidence"
                  ? "Kaynak araması"
                  : "Danışman"}
              </span>
              {turn.payload.answer && (
                <p className="chat-response">{turn.payload.answer}</p>
              )}
              <p className="chat-notice">{turn.payload.notice}</p>
              {turn.payload.actions?.map((action) => (
                <Link className="button light" key={action.url} to={action.url}>
                  {action.label}
                  <ArrowUpRight size={15} />
                </Link>
              ))}
              {turn.payload.sources.map((s, i) => (
                <details className="chat-source" key={s.id}>
                  <summary>
                    [S{i + 1}] {s.title}
                  </summary>
                  <p>{s.text}</p>
                  <small>
                    {s.period || "Kaynakta dönem belirtilmiyor"} · Kontrol{" "}
                    {s.checkedAt}
                  </small>
                  <a
                    href={s.page ? `${s.url}#page=${s.page}` : s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.sourceTitle} <ArrowUpRight size={13} />
                  </a>
                  {s.page && (
                    <small>
                      Sayfa {s.page}
                      {s.pageEnd && s.pageEnd !== s.page
                        ? `–${s.pageEnd}`
                        : ""}{" "}
                      · {s.section}
                    </small>
                  )}
                </details>
              ))}
              {turn.payload.requestId && (
                <AnswerFeedback
                  requestId={turn.payload.requestId}
                  initial={turn.payload.feedback}
                />
              )}
            </div>
          ),
        )}
        {pending && (
          <>
            <div className="chat-user">{pending}</div>
            <p className="chat-notice" role="status">
              {phase === "answering"
                ? "Yanıt hazırlanıyor…"
                : "Kaynaklar inceleniyor…"}
            </p>
            {preview.length > 0 && (
              <div className="chat-preview">
                <small>Bulunan kaynaklar</small>
                {preview.map((s) => (
                  <a
                    key={s.id}
                    href={s.page ? `${s.url}#page=${s.page}` : s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.title} <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
        <div ref={bottom} />
      </div>
      {error && <ErrorBox message={error} />}
      <form className="chat-compose" onSubmit={ask}>
        <label className="sr-only" htmlFor="life-question">
          Danışmana sorun
        </label>
        <textarea
          id="life-question"
          rows={2}
          minLength={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Öğrenci hayatıyla ilgili bir soru sor…"
          required
          disabled={busy}
        />
        <button
          className="button dark"
          disabled={busy || message.trim().length < 3}
          aria-label="Mesajı gönder"
        >
          <Send size={18} />
        </button>
      </form>
      <small className="chat-privacy">
        Konuşmalarını yalnızca hesabın görür. Kaynaklar tarih veya birim
        açısından farklılık gösterebilir.
      </small>
      <Link className="chat-sources-link" to="/veri-kaynaklari">
        Kullanılan kaynakları incele <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}
