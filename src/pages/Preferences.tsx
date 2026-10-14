import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  ArrowUpRight,
} from "lucide-react";
import { api, json } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useStore } from "../lib/store";
import {
  PageHeading,
  Loading,
  ErrorBox,
  Empty,
  number,
} from "../components/ui";
import type { PreferenceList, ListItem } from "../../shared/contracts";
function Item({
  item,
  list,
  index,
  onChange,
  onError,
}: {
  item: ListItem;
  list: PreferenceList;
  index: number;
  onChange: () => void;
  onError: (s: string) => void;
}) {
  const [note, setNote] = useState(item.note),
    [busy, setBusy] = useState(false);
  const { notify } = useStore();
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(path, body === undefined ? { method } : json(method, body));
      onChange();
      return true;
    } catch (e) {
      onError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function move(delta: number) {
    const ids = list.items.map((i) => i.id);
    const other = index + delta;
    [ids[index], ids[other]] = [ids[other], ids[index]];
    void action(`/preference-lists/${list.id}/order`, "PUT", {
      revision: list.revision,
      ids,
    });
  }
  return (
    <article className="list-item">
      <span className="list-number">
        {index + 1 < 10 ? "0" : ""}
        {index + 1}
      </span>
      <div className="list-item-main">
        <div className="list-title-row">
          <div>
            <span className="university-name">{item.program.university}</span>
            <h3>
              <Link to={`/programlar/${item.program.id}`}>
                {item.program.name} <ArrowUpRight size={16} />
              </Link>
            </h3>
            <p className="quiet">
              {item.program.city} · {item.program.language} ·{" "}
              {item.program.isSample ? "Örnek sıra" : "Başarı sırası"}:{" "}
              {number(item.program.rank)}
            </p>
          </div>
          <div className="list-tools">
            <button
              className="icon-button"
              disabled={busy || index === 0}
              aria-label="Programı yukarı taşı"
              onClick={() => move(-1)}
            >
              <ArrowUp size={17} />
            </button>
            <button
              className="icon-button"
              disabled={busy || index === list.items.length - 1}
              aria-label="Programı aşağı taşı"
              onClick={() => move(1)}
            >
              <ArrowDown size={17} />
            </button>
            <button
              className="icon-button danger"
              disabled={busy}
              aria-label="Programı listeden çıkar"
              onClick={() =>
                void action(
                  `/preference-lists/${list.id}/items/${item.id}`,
                  "DELETE",
                )
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        <label>
          Kişisel notun
          <textarea
            rows={2}
            maxLength={3000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bu program hakkında ne düşünüyorsun? Neyi araştırmak istiyorsun?"
          />
        </label>
        <button
          className="text-button"
          disabled={busy || note === item.note}
          onClick={async () => {
            if (
              await action(
                `/preference-lists/${list.id}/items/${item.id}`,
                "PATCH",
                { note },
              )
            )
              notify("Not kaydedildi.");
          }}
        >
          <Save size={15} /> Notu kaydet
        </button>
      </div>
    </article>
  );
}
export default function Preferences() {
  const { data, loading, error, reload } =
    useLoad<PreferenceList[]>("/preference-lists");
  const [selected, setSelected] = useState(""),
    [actionError, setActionError] = useState(""),
    [creating, setCreating] = useState(false);
  const list = data?.find((l) => l.id === selected) || data?.[0];
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    setActionError("");
    setCreating(true);
    try {
      const l = await api<PreferenceList>(
        "/preference-lists",
        json("POST", { name }),
      );
      setSelected(l.id);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="KİŞİSEL ÇALIŞMA ALANIN"
        title="Tercihlerin, senin sıranla."
        description="Seçeneklerini sakla, kendi sıralamanı oluştur ve araştırma notlarını ekle."
        action={
          <Link className="button light" to="/programlar">
            <Plus size={16} /> Program keşfet
          </Link>
        }
      />
      {actionError && (
        <ErrorBox
          message={actionError}
          retry={() => {
            setActionError("");
            reload();
          }}
        />
      )}
      <div className="list-toolbar">
        <div className="list-tabs">
          {data?.map((l) => (
            <button
              className={l.id === list?.id ? "active" : ""}
              onClick={() => setSelected(l.id)}
              key={l.id}
            >
              {l.name}
              <span>{l.items.length}</span>
            </button>
          ))}
        </div>
        <form onSubmit={create} className="new-list-form">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Yeni liste adı"
            aria-label="Yeni liste adı"
          />
          <button className="button light" disabled={creating}>
            <Plus size={16} /> Oluştur
          </button>
        </form>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !list ? (
        <Empty title="İlk tercih listeni oluştur.">
          <p>Yukarıdan listene bir isim ver veya bir programı kaydet.</p>
        </Empty>
      ) : !list.items.length ? (
        <Empty title="Bu listede henüz program yok.">
          <Link className="button dark" to="/programlar">
            Programları keşfet
          </Link>
        </Empty>
      ) : (
        <div className="preference-items">
          {list.items.map((item, i) => (
            <Item
              key={`${item.id}:${item.note}`}
              item={item}
              list={list}
              index={i}
              onChange={reload}
              onError={setActionError}
            />
          ))}
        </div>
      )}
      <p className="form-hint">
        Bu liste kişisel çalışma taslağıdır. Resmî tercih başvurusu yerine
        geçmez. Listelerin ve notların diğer kullanıcılara açık değildir.
      </p>
    </>
  );
}
