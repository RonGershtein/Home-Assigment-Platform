import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { TabBar } from "./components/Shell";
import { useSession } from "./lib/auth";
import { isDemoMode, isSupabaseConfigured } from "./lib/supabase";
import Home from "./pages/Home";
import Shopping from "./pages/Shopping";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";

// מסכים עם recharts / אקסל נטענים רק כשנכנסים אליהם
const Money = lazy(() => import("./pages/Money"));
const Budget = lazy(() => import("./pages/Budget"));
const Vouchers = lazy(() => import("./pages/Vouchers"));
const Gifts = lazy(() => import("./pages/Gifts"));
const Recipes = lazy(() => import("./pages/Recipes"));
const More = lazy(() => import("./pages/More"));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const session = useSession();

  const toaster = <Toaster position="top-center" dir="rtl" offset="calc(env(safe-area-inset-top) + 8px)" toastOptions={{ style: { fontFamily: "Rubik", borderRadius: 16 } }} />;

  if (!isSupabaseConfigured && !isDemoMode)
    return (
      <main className="min-h-[100dvh] grid place-items-center p-8 text-center">
        <div>
          <p className="text-4xl mb-3">⚙️</p>
          <p className="font-semibold">Supabase לא מוגדר</p>
          <p className="text-muted text-[14px] mt-1">צריך להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY</p>
        </div>
      </main>
    );
  if (session.status === "checking") return <div className="min-h-[100dvh]" />;
  if (session.status === "out")
    return (
      <>
        <Login />
        {toaster}
      </>
    );

  return (
    <>
      <ScrollTop />
      <Suspense fallback={<div className="min-h-[100dvh]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/money" element={<Money />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/gifts" element={<Gifts />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/more" element={<More user={session.user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <TabBar />
      {toaster}
    </>
  );
}
