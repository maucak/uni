import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Provider, useStore } from "./lib/store";
import { Layout } from "./components/Layout";
import { Loading, ErrorBox } from "./components/ui";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Programs from "./pages/Programs";
import ProgramDetail from "./pages/ProgramDetail";
import Compare from "./pages/Compare";
import Preferences from "./pages/Preferences";
import Recommendations from "./pages/Recommendations";
import Communities from "./pages/Communities";
import QuestionDetail from "./pages/QuestionDetail";
import Method from "./pages/Method";
import Sources from "./pages/Sources";
import "./styles.css";
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useStore();
  if (loading) return <Loading />;
  if (error)
    return <ErrorBox message={error} retry={() => window.location.reload()} />;
  return user ? children : <Navigate to="/giris" replace />;
}
function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="giris" element={<Auth />} />
            <Route path="kayit" element={<Auth />} />
            <Route
              path="profil"
              element={
                <Protected>
                  <Profile />
                </Protected>
              }
            />
            <Route path="programlar" element={<Programs />} />
            <Route path="programlar/:id" element={<ProgramDetail />} />
            <Route
              path="oneriler"
              element={
                <Protected>
                  <Recommendations />
                </Protected>
              }
            />
            <Route
              path="tercihler"
              element={
                <Protected>
                  <Preferences />
                </Protected>
              }
            />
            <Route path="karsilastir" element={<Compare />} />
            <Route path="topluluklar" element={<Communities />} />
            <Route path="sorular/:id" element={<QuestionDetail />} />
            <Route path="yontem" element={<Method />} />
            <Route path="veri-kaynaklari" element={<Sources />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Bu sayfa bulunamadı.</h1>
                  <Link to="/">Ana sayfaya dön</Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
