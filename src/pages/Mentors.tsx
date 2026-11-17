import { useState } from "react";
import { Link } from "react-router-dom";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import { ErrorBox, Loading, PageHeading } from "../components/ui";
import type { Mentor } from "../../shared/mentorship";

function RequestForm({ mentor }: { mentor: Mentor }) {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <p role="status">
        Talebin gönderildi. <Link to="/mentorluk">Taleplerini gör</Link>
      </p>
    );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(
            "/mentorship-requests",
            json("POST", { mentorId: mentor.userId, topic, message }),
          );
          setSent(true);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <ErrorBox message={error} />}
      <label>
        Konu
        <input
          required
          minLength={2}
          maxLength={80}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>
      <label>
        Kendini ve yardım istediğin konuyu anlat
        <textarea
          required
          minLength={10}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Gönderiliyor…" : "Mentorluk talebi gönder"}
      </button>
    </form>
  );
}

export default function Mentors() {
  const { user } = useStore();
  const [topic, setTopic] = useState("");
  const [filter, setFilter] = useState("");
  const { data, loading, error, reload } = useLoad<Mentor[]>(
    `/mentors?topic=${encodeURIComponent(filter)}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="MENTORLUK"
        title="Öğrencilerden destek al"
        description="Doğrulanmış öğrencilerin ve mezunların deneyimlerinden yararlan."
      />
      <p>
        <Link to="/mentorluk">Taleplerim ve mentor profilim</Link>
      </p>
      <form
        className="mentorship-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(topic.trim());
        }}
      >
        <label>
          Konu etiketi
          <input
            maxLength={40}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Örneğin hazırlık"
          />
        </label>
        <button className="button">Filtrele</button>
      </form>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <div className="mentorship-grid">
          {!data?.length && (
            <p className="empty">
              Bu konuda talep kabul eden mentor bulunamadı.
            </p>
          )}
          {data?.map((mentor) => (
            <article className="mentorship-card" key={mentor.userId}>
              <h2>{mentor.displayName}</h2>
              <p>
                {mentor.university}
                {mentor.program ? ` · ${mentor.program}` : ""}
              </p>
              <p>{mentor.bio}</p>
              <p>{mentor.topics.join(" · ")}</p>
              {user ? (
                <details>
                  <summary>Destek iste</summary>
                  <RequestForm mentor={mentor} />
                </details>
              ) : (
                <Link to="/giris">Talep göndermek için giriş yap</Link>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
