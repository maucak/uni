import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, MessageSquare, CheckCircle2, Bell } from "lucide-react";
import { useLoad } from "../lib/useLoad";
import { api } from "../lib/api";
import { Loading, ErrorBox, PageHeading } from "../components/ui";
import { NOTIFICATIONS_CHANGED } from "../components/NotificationBell";
import type { AppNotification, NotificationList } from "../../shared/contracts";

const PAGE = 20;
const labels: Record<string, string> = {
  answer_received: "Sorunuza yanıt geldi",
  answer_accepted: "Yanıtınız kabul edildi",
  verification_decided: "Doğrulama başvurunuz sonuçlandı",
  mentorship_request: "Yeni mentorluk talebi",
  mentorship_response: "Mentorluk talebinize yanıt geldi",
  message_received: "Yeni mesajınız var",
};
const icons: Record<string, typeof Bell> = {
  answer_received: MessageSquare,
  answer_accepted: CheckCircle2,
};
const targetOf = (n: AppNotification) =>
  n.payload.requestId
    ? "/mentorluk"
    : n.payload.questionId
      ? `/sorular/${n.payload.questionId}`
      : null;
const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export default function Notifications() {
  const navigate = useNavigate();
  const [pages, setPages] = useState(1);
  const { data, loading, error, reload } = useLoad<NotificationList>(
    `/notifications?limit=${PAGE * pages}`,
  );
  const [actionError, setActionError] = useState("");
  async function open(n: AppNotification) {
    setActionError("");
    try {
      if (!n.read) await api(`/notifications/${n.id}/read`, { method: "PUT" });
      changed();
      const target = targetOf(n);
      if (target) navigate(target);
      else reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function readAll() {
    setActionError("");
    try {
      await api("/notifications/read-all", { method: "PUT" });
      changed();
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const items = data?.items ?? [];
  return (
    <>
      <PageHeading
        eyebrow="BİLDİRİMLER"
        title="Bildirimlerin"
        description={
          data?.unreadCount
            ? `${data.unreadCount} okunmamış bildirimin var.`
            : "Okunmamış bildirimin yok."
        }
        action={
          <button
            className="button"
            disabled={!data?.unreadCount}
            onClick={readAll}
          >
            <CheckCheck size={16} /> Tümünü okundu say
          </button>
        }
      />
      {actionError && <ErrorBox message={actionError} />}
      {items.length === 0 ? (
        <div className="empty">
          <h2>Henüz bildirim yok.</h2>
        </div>
      ) : (
        <ul className="notification-list">
          {items.map((n) => {
            const Icon = icons[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  className={`notification-item ${n.read ? "" : "unread"}`}
                  onClick={() => open(n)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{labels[n.kind] ?? "Yeni bildirim"}</strong>
                    {n.payload.title && <em>{n.payload.title}</em>}
                    <small>
                      {new Date(n.createdAt).toLocaleString("tr-TR")}
                    </small>
                  </span>
                  {!n.read && (
                    <i className="notification-dot" aria-label="Okunmadı" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {data?.hasMore && (
        <button className="button" onClick={() => setPages((p) => p + 1)}>
          Daha fazla göster
        </button>
      )}
    </>
  );
}
