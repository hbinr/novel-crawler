import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { ToastProvider } from "./components/Toast.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Books } from "./pages/Books.tsx";
import { Tasks } from "./pages/Tasks.tsx";
import { Login } from "./pages/Login.tsx";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import { ws } from "./lib/ws.ts";
import { api } from "./lib/api.ts";
import { scheduleIdle } from "./lib/idle.ts";

const TaskDetail = lazy(() => import("./pages/TaskDetail.tsx").then((m) => ({ default: m.TaskDetail })));
const Logs = lazy(() => import("./pages/Logs.tsx").then((m) => ({ default: m.Logs })));
const SettingsPage = lazy(() =>
  import("./pages/Settings.tsx").then((m) => ({ default: m.SettingsPage })),
);
const Preview = lazy(() => import("./pages/Preview.tsx").then((m) => ({ default: m.Preview })));
const NotFound = lazy(() => import("./pages/NotFound.tsx").then((m) => ({ default: m.NotFound })));

function RouteFallback() {
  return (
    <div style={{ padding: 32, color: "var(--text-lo)", fontSize: 13 }}>加载中…</div>
  );
}

function ProtectedShell() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const [stats, setStats] = useState({ running: 0, queued: 0, maxConcurrent: 2 });

  const refresh = useCallback(() => {
    api
      .stats()
      .then((s) => setStats({ running: s.running, queued: s.queued, maxConcurrent: s.maxConcurrent }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const initHandle = scheduleIdle(() => {
      ws.connect();
      refresh();
    });
    const pollHandle = scheduleIdle(() => {
      const t = setInterval(refresh, 4000);
      (window as unknown as { __pollT?: ReturnType<typeof setInterval> }).__pollT = t;
    });
    const off = ws.onTask(() => refresh());
    return () => {
      const t = (window as unknown as { __pollT?: ReturnType<typeof setInterval> }).__pollT;
      if (t) clearInterval(t);
      off();
      void initHandle;
      void pollHandle;
    };
  }, [user, refresh]);

  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <AppShell running={stats.running} queued={stats.queued} />
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedShell />}>
              <Route index element={<Dashboard />} />
              <Route path="books" element={<Books />} />
              <Route path="tasks" element={<Tasks />} />
              <Route
                path="tasks/:id"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <TaskDetail />
                  </Suspense>
                }
              />
              <Route
                path="logs"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Logs />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="preview"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Preview />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <NotFound />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
