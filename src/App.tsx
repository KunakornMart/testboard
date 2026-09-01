import { useEffect, useState } from "react";
import { applyTheme, currentUser, useApp } from "./store";
import { ToastHub } from "./ui";
import AuthScreen from "./components/Auth";
import Dashboard from "./components/Dashboard";
import BoardScreen from "./components/Board";

type Route = { name: "dash" } | { name: "board"; id: string };

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
    <>
      {!me ? (
        <AuthScreen />
      ) : route.name === "board" ? (
        <BoardScreen projectId={route.id} onBack={() => setRoute({ name: "dash" })} />
      ) : (
        <Dashboard onOpenBoard={(id) => setRoute({ name: "board", id })} />
      )}
      <ToastHub />
    </>
  );
}
