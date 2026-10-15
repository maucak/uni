import { DevLogin } from "./DevLogin";
import { useState } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import {
  Compass,
  LayoutGrid,
  Search,
  Bookmark,
  Users,
  SlidersHorizontal,
  ArrowUpRight,
  Menu,
  X,
  LogOut,
  Scale,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { useStore } from "../lib/store";
const nav = [
  ["/", "Genel bakış", LayoutGrid],
  ["/kampus", "Kampüs yaşamı", GraduationCap],
  ["/programlar", "Programları keşfet", Search],
  ["/oneriler", "Bana uygun programlar", Compass],
  ["/tercihler", "Tercih listelerim", Bookmark],
  ["/karsilastir", "Karşılaştır", Scale],
  ["/topluluklar", "Topluluklar", Users],
  ["/profil", "Profil ve öncelikler", SlidersHorizontal],
] as const;
export function Layout() {
  const { user, logout, notice, compare } = useStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <button
        className="mobile-toggle"
        aria-label="Menüyü aç"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </button>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <Compass size={26} />
          </span>
          <span>
            Kampüs<span className="brand-light">Pusula</span>
            <small>KENDİ YOLUNU BUL</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="nav-caption">ÇALIŞMA ALANIN</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {to === "/karsilastir" && compare.length > 0 && (
                <b className="nav-count">{compare.length}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-guide">
          <BookOpen size={20} />
          <h3>Yolculuğuna bilgiyle devam et.</h3>
          <p>Önerilerin yöntemini ve kullandığımız kaynakları incele.</p>
          <Link to="/yontem" onClick={() => setOpen(false)}>
            Yöntemi incele <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          {user ? (
            <>
              <Link className="user-chip" to="/profil">
                <span className="avatar">
                  {user.profile.displayName.slice(0, 1).toLocaleUpperCase("tr")}
                </span>
                <span>
                  <strong>{user.profile.displayName}</strong>
                  <small>
                    {user.profile.role === "candidate"
                      ? "Üniversite adayı"
                      : user.profile.role === "student"
                        ? "Öğrenci · doğrulanmadı"
                        : "Mezun · doğrulanmadı"}
                  </small>
                </span>
              </Link>
              <button
                className="icon-button"
                aria-label="Çıkış yap"
                onClick={async () => {
                  try {
                    await logout();
                    navigate("/");
                  } catch {}
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <DevLogin />
              <Link className="button dark full" to="/giris">
                Çalışma alanına giriş yap <ArrowUpRight size={17} />
              </Link>
            </>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>
            <span className="topbar-dot" /> Üniversite yolculuğun burada başlar
          </span>
          <div>
            <span className="pilot-label">Geliştirme sürümü</span>
            {!user && (
              <Link to="/kayit">
                Hesap oluştur <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </div>
        <main>
          <Outlet />
        </main>
        <footer className="footer">
          <span>KampüsPusula · Bitirme projesi</span>
          <Link to="/yontem">Yöntem ve veri kaynakları</Link>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
