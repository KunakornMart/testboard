import React, { useEffect, useState } from "react";
import { applyTheme, currentUser, useApp } from "./store";
import { ToastHub } from "./ui";
import AuthScreen from "./components/Auth";
import Dashboard from "./components/Dashboard";
import BoardScreen from "./components/Board";

type Route = { name: "dash" } | { name: "board"; id: string };

/* กันจอขาว — ถ้ามี error ตอนรัน ให้โชว์หน้าจอบอกปัญหาแทน */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #edeee8)", fontFamily: "Anuphan, Prompt, sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 520, background: "var(--panel, #fff)", border: "1px solid var(--line, #dfe2d6)", borderRadius: 18, padding: "36px 32px", boxShadow: "0 18px 50px rgba(27,43,77,.18)" }}>
            <div style={{ fontSize: 34 }}>🧯</div>
            <h1 style={{ fontFamily: "Prompt, sans-serif", fontSize: 22, margin: "10px 0 6px" }}>บอร์ดสะดุดนิดนึง</h1>
            <p style={{ color: "var(--muted, #7f8899)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              เกิดข้อผิดพลาดระหว่างแสดงผล ลองล้างข้อมูลแคชของแอพแล้วเริ่มใหม่ — ข้อมูลในชีตจริงไม่หาย
            </p>
            <pre style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--panel-2, #f6f7f2)", fontSize: 11.5, overflowX: "auto", color: "var(--danger, #cf5252)" }}>
              {String(this.state.err)}
            </pre>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn btn-gold" onClick={() => { localStorage.removeItem("mts-brainspace-v1"); location.reload(); }}>ล้างแคชแล้วเริ่มใหม่</button>
              <button className="btn" onClick={() => location.reload()}>Refresh</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const app = useApp();
  const me = currentUser();
  const [route, setRoute] = useState<Route>({ name: "dash" });

  useEffect(() => { applyTheme(app.theme); }, [app.theme]);

  // ถ้าโปรเจกต์ถูกลบ/เพิกถอนสิทธิ์ขณะเปิดอยู่ ให้กลับหน้าแรก
  useEffect(() => {
    if (route.name === "board" && !app.projects.some((p) => p.id === route.id)) setRoute({ name: "dash" });
  }, [app.projects, route]);

  return (
    <ErrorBoundary>
      {!me ? (
        <AuthScreen />
      ) : route.name === "board" ? (
        <BoardScreen projectId={route.id} onBack={() => setRoute({ name: "dash" })} />
      ) : (
        <Dashboard onOpenBoard={(id) => setRoute({ name: "board", id })} />
      )}
      <ToastHub />
    </ErrorBoundary>
  );
}
