import { useState, type FormEvent } from "react";
import { Save, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { api, json } from "../lib/api";
import { PageHeading, ErrorBox } from "../components/ui";
import type { Profile as ProfileType, User } from "../../shared/contracts";
export default function Profile() {
  const { user, setUser, notify } = useStore();
  const [profile, setProfile] = useState<ProfileType>(user!.profile),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [citiesText, setCitiesText] = useState(profile.cities.join(", "));
  const update = <K extends keyof ProfileType>(key: K, value: ProfileType[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const next = await api<User>(
        "/me/profile",
        json("PUT", {
          ...profile,
          cities: citiesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      );
      setUser(next);
      notify("Profilin ve önceliklerin kaydedildi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SENİN ÖNCELİKLERİN"
        title="Seni tanıyalım."
        description="Aynı sıralamaya sahip iki kişinin yolu farklı olabilir. Senin için önemli olanları belirt."
        action={
          <Link className="button light" to="/oneriler">
            Önerilerime git <ArrowRight size={16} />
          </Link>
        }
      />
      {error && <ErrorBox message={error} />}
      <form className="profile-form" onSubmit={save}>
        <section className="panel">
          <div className="panel-heading">
            <span className="section-number">01</span>
            <div>
              <h2>Temel bilgilerin</h2>
              <p>Üniversite yolculuğunun hangi aşamasındasın?</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Adın ve soyadın
              <input
                value={profile.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              Durumun
              <select
                value={profile.role}
                onChange={(e) =>
                  update("role", e.target.value as ProfileType["role"])
                }
              >
                <option value="candidate">Üniversite adayı</option>
                <option value="student">Üniversite öğrencisi</option>
                <option value="graduate">Mezun</option>
              </select>
            </label>
            <label>
              Puan türün
              <select
                value={profile.scoreType}
                onChange={(e) =>
                  update(
                    "scoreType",
                    e.target.value as ProfileType["scoreType"],
                  )
                }
              >
                {["SAY", "EA", "SÖZ", "DİL"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Başarı sıran <span className="quiet">(isteğe bağlı)</span>
              <input
                type="number"
                min={1}
                max={5000000}
                value={profile.rank ?? ""}
                onChange={(e) =>
                  update("rank", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Örneğin 85000"
              />
            </label>
            {profile.role !== "candidate" && (
              <>
                <label>
                  Üniversiten
                  <input
                    value={profile.university}
                    onChange={(e) => update("university", e.target.value)}
                    maxLength={150}
                  />
                </label>
                <label>
                  Bölümün
                  <input
                    value={profile.department}
                    onChange={(e) => update("department", e.target.value)}
                    maxLength={150}
                  />
                </label>
                <p className="form-hint">
                  Bu bilgiler kendi beyanındır. Doğrulama rozeti verilmez;
                  doğrulama modülü sonraki aşamada eklenecek.
                </p>
              </>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="section-number">02</span>
            <div>
              <h2>İlgi alanların ve beklentilerin</h2>
              <p>Ne öğrenmek ve nasıl bir hayat kurmak istiyorsun?</p>
            </div>
          </div>
          <label>
            İlgi ve hedeflerin
            <textarea
              value={profile.interests}
              onChange={(e) => update("interests", e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="Yazılım, yapay zeka ve matematik ilgimi çekiyor. Web ve mobil uygulamalar geliştirmek istiyorum…"
            />
          </label>
          <div className="form-grid">
            <label>
              Öncelikli şehirlerin
              <input
                value={citiesText}
                onChange={(e) => setCitiesText(e.target.value)}
                placeholder="İzmir, Ankara"
              />
              <small>
                Virgülle ayır. Bu alan kesin eleme yerine öncelik belirtir.
              </small>
            </label>
            <label>
              Eğitim dili
              <select
                value={profile.language}
                onChange={(e) =>
                  update("language", e.target.value as ProfileType["language"])
                }
              >
                <option value="any">Fark etmez</option>
                <option>Türkçe</option>
                <option>İngilizce</option>
              </select>
            </label>
            <label>
              Üniversite türü
              <select
                value={profile.universityType}
                onChange={(e) =>
                  update(
                    "universityType",
                    e.target.value as ProfileType["universityType"],
                  )
                }
              >
                <option value="any">Hepsi</option>
                <option>Devlet</option>
                <option>Vakıf</option>
              </select>
              <small>Seçersen öneriler bu türle sınırlanır.</small>
            </label>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="section-number">03</span>
            <div>
              <h2>Neye ne kadar önem veriyorsun?</h2>
              <p>
                Önceliklerini değiştirerek önerilerin nasıl değiştiğini
                görebilirsin.
              </p>
            </div>
          </div>
          <div className="form-grid budget-fields">
            <label>
              Yıllık öğrenim ücreti üst sınırın (TL)
              <input
                type="number"
                min={0}
                max={10000000}
                value={profile.maxAnnualTuition ?? ""}
                onChange={(e) =>
                  update(
                    "maxAnnualTuition",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="İsteğe bağlı"
              />
              <small>
                Yalnızca kaynaklı öğrenim ücretiyle karşılaştırılır; barınma ve
                yaşam giderlerini kapsamaz.
              </small>
            </label>
            <label>
              En düşük burs önceliğin (%)
              <input
                type="number"
                min={0}
                max={100}
                value={profile.minimumScholarship ?? ""}
                onChange={(e) =>
                  update(
                    "minimumScholarship",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="İsteğe bağlı"
              />
              <small>Eksik burs bilgisi olumlu eşleşme sayılmaz.</small>
            </label>
          </div>
          <div className="weight-grid">
            {(
              [
                ["interest", "İlgi uyumu"],
                ["city", "Şehir önceliği"],
                ["language", "Eğitim dili"],
                ["budget", "Ücret / burs"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <b>{profile.weights[key]} / 5</b>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={profile.weights[key]}
                  onChange={(e) =>
                    update("weights", {
                      ...profile.weights,
                      [key]: Number(e.target.value),
                    })
                  }
                />
                <small>0: önem verme · 5: çok önemli</small>
              </label>
            ))}
          </div>
        </section>
        <div className="save-bar">
          <p>Uyum endeksi yerleşme olasılığı değildir.</p>
          <button className="button dark" disabled={busy}>
            <Save size={17} />
            {busy ? "Kaydediliyor…" : "Profilimi kaydet"}
          </button>
        </div>
      </form>
    </>
  );
}
