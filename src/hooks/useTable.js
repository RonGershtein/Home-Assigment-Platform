import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { table, subscribe, errorMessage } from "../lib/db";

// טעינת טבלה + פעולות אופטימיות: המסך מתעדכן מיד, ואם השרת נכשל - חוזרים אחורה
export function useTable(name) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = useRef(table(name)).current;
  const busy = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api.list();
      // לא דורסים עדכון אופטימי שעוד בדרך
      if (busy.current === 0) setRows(data);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
    let t;
    const unsub = subscribe(name, () => {
      clearTimeout(t);
      t = setTimeout(refresh, 250);
    });
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsub();
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [name, refresh]);

  const run = useCallback(
    async (optimistic, action) => {
      const prev = rows;
      if (optimistic) setRows(optimistic);
      busy.current++;
      try {
        return await action();
      } catch (e) {
        setRows(prev);
        toast.error(errorMessage(e));
        throw e;
      } finally {
        busy.current--;
        if (busy.current === 0) refresh();
      }
    },
    [rows, refresh]
  );

  const create = useCallback(
    (values) => {
      const temp = { id: `tmp-${Math.random()}`, created_at: new Date().toISOString(), ...values };
      return run([temp, ...rows], () => api.create(values));
    },
    [rows, run, api]
  );

  const update = useCallback(
    (id, patch) => run(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)), () => api.update(id, patch)),
    [rows, run, api]
  );

  const remove = useCallback(
    (ids) => {
      const set = new Set(Array.isArray(ids) ? ids : [ids]);
      return run(
        rows.filter((r) => !set.has(r.id)),
        () => api.remove([...set])
      );
    },
    [rows, run, api]
  );

  return { rows, loading, create, update, remove, refresh, api };
}
