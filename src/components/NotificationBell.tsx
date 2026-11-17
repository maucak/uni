import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../lib/api";
import type { NotificationList } from "../../shared/contracts";

export const NOTIFICATIONS_CHANGED = "notifications:changed";
const POLL_MS = 30_000;

/** Zil ikonu ve okunmamış sayısı. 30 saniyede bir yoklar; sekme gizliyken yoklamaz. */
export function NotificationBell() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const r = await api<NotificationList>("/notifications?unread=1&limit=1");
      setCount(r.unreadCount);
    } catch {}
  }, []);
  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      stop();
      void refresh();
      timer = window.setInterval(() => void refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [refresh]);
  return (
    <Link
      to="/bildirimler"
      className="bell"
      aria-label={count ? `Bildirimler, ${count} okunmamış` : "Bildirimler"}
    >
      <Bell size={18} />
      {count > 0 && <b className="bell-count">{count > 99 ? "99+" : count}</b>}
    </Link>
  );
}
