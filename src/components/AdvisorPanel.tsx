import { useEffect, useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Send,
  Check,
  MessageSquare,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { api, json } from "../lib/api";
import { useStore } from "../lib/store";
import { ErrorBox, number } from "./ui";
import type { SearchState } from "../../shared/contracts";
import type { AdvisorReply } from "../../shared/advisor";
type Message =
  { role: "user"; text: string } | { role: "assistant"; reply: AdvisorReply };
const labels: Record<string, string> = {
  search: "Arama",
  city: "Şehir",
  scoreType: "Puan türü",
  language: "Dil",
  type: "Üniversite türü",
  rankMin: "En küçük sıra",
  rankMax: "En büyük sıra",
  maxTuition: "Yıllık öğrenim ücreti sınırı",
  minScholarship: "En düşük burs",
  includeUnknown: "Eksik verili programlar",
  sort: "Sıralama",
};
export default function AdvisorPanel({
  state,
  revision,
  onApply,
}: {
  state: SearchState | null;
  revision: string;
  onApply: (reply: AdvisorReply) => void;
}) {
  const { user, compare } = useStore();
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;
  const { data: status, reload } = useLoad<{
    configured: boolean;
    provider: string;
    model: string | null;
    dailyLimit: number;
  }>("/advisor/status");
  const [messages, setMessages] = useState<Message[]>([]),
    [conversationId, setConversationId] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [applied, setApplied] = useState<Set<string>>(new Set());
  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setError("");
    setBusy(false);
    if (!user) return;
    const id = sessionStorage.getItem(`kp-advisor-${user.id}`);
    if (!id) return;
    let active = true;
    api<{ role: string; payload: any }[]>(`/advisor/conversations/${id}`)
      .then((rows) => {
        if (!active) return;
        setConversationId(id);
        setMessages(
          rows.map((row) =>
            row.role === "user"
              ? { role: "user", text: row.payload.message }
              : { role: "assistant", reply: row.payload },
          ),
        );
      })
      .catch(() => sessionStorage.removeItem(`kp-advisor-${user.id}`));
    return () => {
      active = false;
    };
  }, [user?.id]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!state || !user || busy) return;
    setBusy(true);
    setError("");
    const text = message;
    try {
      const reply = await api<AdvisorReply>(
        "/advisor/messages",
        json("POST", {
          requestId: crypto.randomUUID(),
          conversationId,
          message: text,
          state,
          baseRevision: revision,
          comparedIds: compare,
        }),
      );
      if (activeUserId.current !== user.id) return;
      setMessages((prev) => [
        ...prev,
        { role: "user", text },
        { role: "assistant", reply },
      ]);
      setConversationId(reply.conversationId);
      sessionStorage.setItem(`kp-advisor-${user.id}`, reply.conversationId);
      setMessage("");
    } catch (e) {
      if (activeUserId.current === user.id) setError((e as Error).message);
    } finally {
      if (activeUserId.current === user.id) setBusy(false);
    }
  }
  function newConversation() {
    if (user) sessionStorage.removeItem(`kp-advisor-${user.id}`);
    setMessages([]);
    setConversationId(null);
    setError("");
    setApplied(new Set());
  }
  return (
    <aside className="advisor-panel">
      <header>
        <span className="advisor-symbol">
          <Sparkles size={19} />
        </span>
        <div>
          <h3>Tercih danışmanın</h3>
          <small>Filtrelerle aynı liste üzerinde</small>
        </div>
        <button
          className="icon-button"
          title="Yeni konuşma"
          aria-label="Yeni konuşma"
          onClick={newConversation}
          disabled={busy}
        >
          <RotateCcw size={16} />
        </button>
      </header>
      <div className="advisor-status">
        <span className={`status-dot ${status?.configured ? "online" : ""}`} />
        {status?.configured
          ? `${status.provider} · ayarlar tamam`
          : "Gemini bağlantısı bekleniyor"}
        <button className="text-button" onClick={reload}>
          Yenile
        </button>
      </div>
      {!status?.configured && (
        <div className="advisor-offline">
          <MessageSquare size={23} />
          <h4>Danışman alanın hazır.</h4>
          <p>
            Gemini anahtarı ve model sunucu ayarlarına eklendiğinde konuşmaya
            başlayabilirsin. Bu sırada filtreler ve kişisel öneriler çalışır.
          </p>
          <Link to="/yontem">Nasıl çalışacağını öğren</Link>
        </div>
      )}
      {!user && (
        <Link className="button light full" to="/giris">
          Danışmak için giriş yap
        </Link>
      )}
      <div className="advisor-messages" aria-live="polite">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div className="chat-user" key={i}>
              {m.text}
            </div>
          ) : (
            <div className="chat-assistant" key={i}>
              <span className="chat-label">
                <Sparkles size={13} /> Danışman
              </span>
              <p>{m.reply.plan.summary}</p>
              {m.reply.plan.questions.map((q) => (
                <p className="advisor-question" key={q}>
                  {q}
                </p>
              ))}
              {m.reply.programs.map((p) => (
                <div className="advisor-program" key={p.id}>
                  <Link to={`/programlar/${p.id}`}>
                    {p.university} · {p.name} ({p.language}){" "}
                    <ExternalLink size={12} />
                  </Link>
                  <small>
                    {p.isSample ? "Örnek kayıt" : "Kaynaklı kayıt"} ·{" "}
                    {p.year ?? "Sıra yılı yok"} · Sıra: {number(p.rank)}
                  </small>
                </div>
              ))}
              {m.reply.proposedState && (
                <div className="change-proposal">
                  <strong>Önerilen filtre değişikliği</strong>
                  {m.reply.plan.changes.map((c) => (
                    <div key={c.field}>
                      <span>{labels[c.field]}</span>
                      <b>
                        {String(
                          (m.reply.baseState as any)[c.field] ?? "Seçilmedi",
                        )}{" "}
                        → {c.value || "Seçilmedi"}
                      </b>
                    </div>
                  ))}
                  <button
                    className="button dark full"
                    disabled={
                      m.reply.baseRevision !== revision ||
                      applied.has(String(i))
                    }
                    onClick={() => {
                      onApply(m.reply);
                      setApplied((prev) => new Set([...prev, String(i)]));
                    }}
                  >
                    <Check size={15} />
                    {applied.has(String(i))
                      ? "Uygulandı"
                      : m.reply.baseRevision !== revision
                        ? "Filtreler değişti; yeniden sor"
                        : "Değişikliği uygula"}
                  </button>
                  <small>Uygulamadan önce sonuç listesi değişmez.</small>
                </div>
              )}
            </div>
          ),
        )}
      </div>
      <div className="advisor-examples">
        {[
          "İngilizce programları göster",
          "Sıralaması bilinmeyenleri çıkar",
        ].map((t) => (
          <button key={t} type="button" onClick={() => setMessage(t)}>
            {t}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} />}
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="advisor-message">
          Danışmana mesajın
        </label>
        <textarea
          id="advisor-message"
          rows={3}
          maxLength={1500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Önceliklerini anlat veya bir programı sor…"
          disabled={!user || !status?.configured || busy}
        />
        <button
          className="button dark full"
          disabled={
            !user ||
            !state ||
            !status?.configured ||
            message.trim().length < 2 ||
            busy
          }
        >
          <Send size={15} />
          {busy ? "Yanıt hazırlanıyor…" : "Danışmana gönder"}
        </button>
      </form>
      <p className="advisor-privacy">
        Gönderdiğinde mesajın, arama ölçütlerin ve öneri bağlamın Gemini’ye
        iletilir. E-posta ve adın gönderilmez. Konuşmalar hesabında saklanır;
        geçmişten silebilirsin.
      </p>
      {conversationId && (
        <button
          className="text-button danger"
          disabled={busy}
          onClick={async () => {
            try {
              await api(`/advisor/conversations/${conversationId}`, {
                method: "DELETE",
              });
              newConversation();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Bu konuşmayı sil
        </button>
      )}
    </aside>
  );
}
