import { useEffect, useState } from "react";
import { supabase, isDemoMode } from "./supabase";

export function useSession() {
  const [state, setState] = useState(() => (isDemoMode ? { status: "in", user: { email: "demo@local" } } : { status: "checking" }));

  useEffect(() => {
    if (isDemoMode || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setState(data.session ? { status: "in", user: data.session.user } : { status: "out" }));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setState(session ? { status: "in", user: session.user } : { status: "out" }));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" : error.message);
}

export const signOut = () => supabase?.auth.signOut();
