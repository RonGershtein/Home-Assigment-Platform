import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarPlus, Camera, Car, Loader2, Plus, RefreshCw, Search, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { BackButton, Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SectionTitle, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { SERVICE_KINDS, fmtPlate, lookupPlate, modelImage, plateDigits, testState } from "../lib/cars";
import { daysUntil, fmtDate, money, relDays, todayStr, toNumber } from "../lib/format";
import { imageUrl, removeImage, uploadImage } from "../lib/images";
import { isDemoMode } from "../lib/supabase";
import { PhotoField } from "./Vouchers";

const TONE = { ok: "text-good", soon: "text-warn", expired: "text-crit", unknown: "text-muted" };
const carName = (c) => c.nickname || [c.make, c.model].filter(Boolean).join(" ") || fmtPlate(c.plate);
const byDateDesc = (a, b) => (b.done_on || "").localeCompare(a.done_on || "") || (b.created_at || "").localeCompare(a.created_at || "");

function useImage(path, fallback) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!path) return setUrl(fallback ?? null);
    imageUrl(path).then((u) => alive && setUrl(u ?? fallback ?? null));
    return () => {
      alive = false;
    };
  }, [path, fallback]);
  return url;
}

function Plate({ plate, className = "" }) {
  return (
    <span dir="ltr" className={`num inline-flex items-center h-7 px-2.5 rounded-md bg-[#f7c600] text-black text-[15px] font-bold tracking-wide border border-black/20 ${className}`}>
      {fmtPlate(plate)}
    </span>
  );
}

function TestLine({ car, className = "" }) {
  const d = daysUntil(car.test_until);
  const s = testState(d);
  return (
    <p className={`text-[13px] font-medium ${TONE[s]} ${className}`}>
      {car.test_until ? `טסט ${s === "expired" ? "פג" : "בתוקף עד"} ${fmtDate(car.test_until)} · ${relDays(d)}` : "תאריך טסט לא ידוע"}
    </p>
  );
}

export default function Cars() {
  const { id } = useParams();
  const cars = useTable("cars");
  const services = useTable("car_services");
  const [editing, setEditing] = useState(null);
  const nav = useNavigate();

  const saveCar = async (values, photo) => {
    const prev = editing;
    setEditing(null);
    const row = prev.id ? await cars.update(prev.id, values) : await cars.create(values);
    const carId = prev.id ?? row?.id;
    if (!carId || (!photo.file && !photo.remove)) return;
    try {
      const photo_path = photo.file ? await uploadImage(`cars/${carId}`, photo.file) : null;
      await cars.update(carId, { photo_path });
      removeImage(prev.photo_path).catch(() => {});
    } catch {
      toast.error("התמונה לא הועלתה");
    }
  };

  const deleteCar = async () => {
    const c = editing;
    setEditing(null);
    nav("/cars", { replace: true });
    const photos = services.rows.filter((s) => s.car_id === c.id).flatMap((s) => s.photos ?? []);
    await cars.remove(c.id);
    removeImage([c.photo_path, ...photos]).catch(() => {});
  };

  const car = id && cars.rows.find((c) => c.id === id);
  const carSheet = (
    <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת רכב" : "רכב חדש"}>
      {editing && <CarForm key={editing.id || "new"} car={editing} onSave={saveCar} onDelete={editing.id && deleteCar} />}
    </Sheet>
  );

  if (id) {
    if (!car) return <Page title="רכב" back={<BackButton fallback={{ to: "/cars", label: "רכבים" }} />}>{cars.loading ? <Skeletons n={2} h={200} /> : <Empty icon={<Car size={28} />} title="הרכב לא נמצא" />}</Page>;
    return (
      <>
        <CarDetail car={car} cars={cars} services={services} onEdit={() => setEditing(car)} />
        {carSheet}
      </>
    );
  }

  return (
    <Page title="רכבים" back={<BackButton fallback={{ to: "/more", label: "עוד" }} />}>
      {cars.loading ? (
        <Skeletons n={2} h={240} />
      ) : cars.rows.length === 0 ? (
        <Empty icon={<Car size={28} strokeWidth={1.8} />} title="עוד אין רכבים" text="מקלידים מספר רכב, והפרטים ותאריך הטסט מתמלאים מהרישוי." />
      ) : (
        <ul className="space-y-3 stagger">
          {[...cars.rows]
            .sort((a, b) => (a.test_until || "9").localeCompare(b.test_until || "9"))
            .map((c) => (
              <CarCard key={c.id} car={c} last={services.rows.filter((s) => s.car_id === c.id).sort(byDateDesc)[0]} />
            ))}
        </ul>
      )}
      <Fab onClick={() => setEditing({})} label="רכב" icon={<Plus size={20} strokeWidth={2.6} />} />
      {carSheet}
    </Page>
  );
}

function CarCard({ car, last }) {
  const img = useImage(car.photo_path, car.photo_url);
  return (
    <li className="card overflow-hidden">
      <Link to={`/cars/${car.id}`} state={{ back: "רכבים" }} className="press block">
        <div className="aspect-[16/9] bg-raised grid place-items-center overflow-hidden">
          {img ? <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Car size={40} className="text-muted" strokeWidth={1.5} />}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[17px] font-semibold truncate">{carName(car)}</p>
            <Plate plate={car.plate} className="shrink-0" />
          </div>
          <TestLine car={car} className="mt-2" />
          <p className="text-[13px] text-muted mt-1 truncate">
            {last ? `${SERVICE_KINDS[last.kind]?.emoji ?? "📝"} אחרון: ${SERVICE_KINDS[last.kind]?.label ?? "טיפול"} · ${fmtDate(last.done_on)}${last.km ? ` · ${last.km.toLocaleString("he-IL")} ק״מ` : ""}` : "עוד לא נרשמו טיפולים"}
          </p>
        </div>
      </Link>
    </li>
  );
}

function CarDetail({ car, cars, services, onEdit }) {
  const img = useImage(car.photo_path, car.photo_url);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const history = useMemo(() => services.rows.filter((s) => s.car_id === car.id).sort(byDateDesc), [services.rows, car.id]);
  const lastService = history.find((s) => s.kind === "service");
  const lastKm = history.find((s) => s.km)?.km;
  const total = history.reduce((s, h) => s + (Number(h.cost) || 0), 0);

  // הרישוי מתעדכן אחרי טסט; מעדכנים רק אם יש שם מידע חדש יותר
  const refresh = async (quiet) => {
    setRefreshing(true);
    try {
      const r = await lookupPlate(car.plate);
      if (!r) return quiet || toast.error("הרכב לא נמצא ברישוי");
      if (r.test_until && r.test_until !== car.test_until) {
        await cars.update(car.id, { test_until: r.test_until, last_test: r.last_test });
        toast.success(`טסט עודכן: בתוקף עד ${fmtDate(r.test_until)}`);
      } else if (!quiet) toast("אין עדכון חדש ברישוי");
    } catch {
      quiet || toast.error("אין חיבור למאגר הרישוי");
    } finally {
      setRefreshing(false);
    }
  };

  const saveService = async (values, photos) => {
    const prev = editing;
    setEditing(null);
    const row = prev.id ? await services.update(prev.id, values) : await services.create({ ...values, car_id: car.id });
    const sid = prev.id ?? row?.id;
    if (sid && (photos.added.length || photos.removed.length)) {
      try {
        const added = await Promise.all(photos.added.map((f) => uploadImage(`cars/${car.id}/${sid}`, f)));
        await services.update(sid, { photos: [...photos.kept, ...added] });
        removeImage(photos.removed).catch(() => {});
      } catch {
        toast.error("חלק מהתמונות לא הועלו");
      }
    }
    if (values.kind === "test") refresh(true);
  };

  return (
    <Page title={carName(car)} back={<BackButton fallback={{ to: "/cars", label: "רכבים" }} />} action={<button type="button" className="press text-accent-text text-[16px] font-medium h-10 px-1" onClick={onEdit}>עריכה</button>}>
      <div className="card overflow-hidden">
        <div className="aspect-[16/9] bg-raised grid place-items-center overflow-hidden">
          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Car size={48} className="text-muted" strokeWidth={1.5} />}
        </div>
        <div className="p-4 flex items-center justify-between gap-3">
          <p className="text-[14px] text-muted truncate">{[car.year, car.color, car.fuel].filter(Boolean).join(" · ")}</p>
          <Plate plate={car.plate} className="shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="hero p-4">
          <p className="text-[13px] text-muted">טסט הבא</p>
          <p className="num text-[22px] font-bold mt-0.5">{car.test_until ? fmtDate(car.test_until) : "—"}</p>
          <p className={`text-[12px] font-medium mt-1 ${TONE[testState(daysUntil(car.test_until))]}`}>{car.test_until ? relDays(daysUntil(car.test_until)) : "לא ידוע"}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">טיפול תקופתי אחרון</p>
          <p className="num text-[22px] font-bold mt-0.5">{lastService ? fmtDate(lastService.done_on) : "—"}</p>
          <p className="text-[12px] text-muted mt-1">{lastService ? relDays(daysUntil(lastService.done_on)) : "עוד לא נרשם"}</p>
        </div>
      </div>
      <div className="card divide-y mt-2 text-[14px]">
        {car.last_test && <Row label="טסט אחרון" value={fmtDate(car.last_test)} />}
        {lastKm && <Row label="קילומטראז׳ אחרון שנרשם" value={`${lastKm.toLocaleString("he-IL")} ק״מ`} />}
        {total > 0 && <Row label="סה״כ הוצאות שנרשמו" value={money(total)} />}
        {car.test_until && (
          <a
            href={`/api/ics?${new URLSearchParams({ date: car.test_until, title: `טסט ל${carName(car)} (${fmtPlate(car.plate)})`, uid: `test-${car.id}-${car.test_until}` })}`}
            target="_blank"
            rel="noreferrer"
            className="press w-full flex items-center justify-between px-4 h-12 text-accent-text"
          >
            <span>הוספה ליומן · התראה שבוע לפני</span>
            <CalendarPlus size={17} />
          </a>
        )}
        <button type="button" className="press w-full flex items-center justify-between px-4 h-12 text-accent-text" onClick={() => refresh(false)} disabled={refreshing}>
          <span>רענון תאריך הטסט מהרישוי</span>
          {refreshing ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
        </button>
      </div>
      {car.notes && <p className="card p-4 mt-2 text-[14px] whitespace-pre-wrap">{car.notes}</p>}

      <SectionTitle>היסטוריית טיפולים</SectionTitle>
      {history.length === 0 ? (
        <Empty icon={<Wrench size={28} strokeWidth={1.8} />} title="אין עדיין טיפולים" text="רושמים כל טיפול, טסט או תיקון עם צילום של החשבונית, והכל נשמר כאן לפי תאריך." />
      ) : (
        <ul className="space-y-2 stagger">
          {history.map((s) => (
            <ServiceCard key={s.id} s={s} onOpen={() => setEditing(s)} onPhoto={setViewing} />
          ))}
        </ul>
      )}

      <Fab onClick={() => setEditing({})} label="טיפול" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת טיפול" : "טיפול חדש"}>
        {editing && (
          <ServiceForm
            key={editing.id || "new"}
            s={editing}
            onSave={saveService}
            onDelete={
              editing.id &&
              (async () => {
                const s = editing;
                setEditing(null);
                await services.remove(s.id);
                removeImage(s.photos ?? []).catch(() => {});
              })
            }
          />
        )}
      </Sheet>
      <Sheet open={!!viewing} onClose={() => setViewing(null)} title="תמונה">
        {viewing && <img src={viewing} alt="" className="w-full rounded-2xl" />}
      </Sheet>
    </Page>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 h-12">
    <span className="text-muted">{label}</span>
    <span className="num font-medium">{value}</span>
  </div>
);

function ServiceCard({ s, onOpen, onPhoto }) {
  const k = SERVICE_KINDS[s.kind] ?? SERVICE_KINDS.other;
  return (
    <li className="card overflow-hidden">
      <button type="button" className="press w-full text-start p-4" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">
              {k.emoji} {k.label}
            </p>
            <p className="text-[13px] text-muted mt-0.5 truncate">{[fmtDate(s.done_on), s.km && `${s.km.toLocaleString("he-IL")} ק״מ`, s.garage].filter(Boolean).join(" · ")}</p>
          </div>
          {s.cost != null && <p className="num text-[17px] font-bold shrink-0">{money(Number(s.cost))}</p>}
        </div>
        {s.notes && <p className="text-[14px] mt-2 whitespace-pre-wrap">{s.notes}</p>}
      </button>
      {s.photos?.length > 0 && (
        <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
          {s.photos.map((p) => (
            <Thumb key={p} path={p} onOpen={onPhoto} />
          ))}
        </div>
      )}
    </li>
  );
}

function Thumb({ path, file, onOpen, onRemove }) {
  const stored = useImage(path);
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const url = file ? local : stored;
  return (
    <div className="relative shrink-0">
      <button type="button" className="press block w-20 h-20 rounded-xl bg-raised overflow-hidden" onClick={() => url && onOpen?.(url)} aria-label="הצגת התמונה">
        {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      </button>
      {onRemove && (
        <button type="button" className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full bg-black/70 text-white grid place-items-center" onClick={onRemove} aria-label="הסרת התמונה">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function CarForm({ car, onSave, onDelete }) {
  const [photo, setPhoto] = useState({ file: null, remove: false });
  const [looking, setLooking] = useState(false);
  const [f, setF] = useState({
    plate: car.plate || "",
    nickname: car.nickname || "",
    make: car.make || "",
    model: car.model || "",
    year: car.year ?? "",
    color: car.color || "",
    fuel: car.fuel || "",
    test_until: car.test_until || "",
    last_test: car.last_test || "",
    photo_url: car.photo_url || "",
    notes: car.notes || "",
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const digits = plateDigits(f.plate);

  const lookup = async () => {
    setLooking(true);
    try {
      const r = await lookupPlate(digits);
      if (!r) return toast.error("לא נמצא ברישוי. אפשר למלא ידנית");
      const photo_url = await modelImage(r.imageQuery);
      const { imageQuery, ...fields } = r;
      setF((p) => ({ ...p, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v ?? ""])), photo_url: photo_url || p.photo_url }));
      toast.success(`${r.make ?? ""} ${r.model ?? ""} ${r.year ?? ""}`.trim());
    } catch {
      toast.error("אין חיבור למאגר הרישוי");
    } finally {
      setLooking(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (digits.length < 5) return;
        onSave(
          {
            plate: digits,
            nickname: f.nickname.trim() || null,
            make: f.make.trim() || null,
            model: f.model.trim() || null,
            year: toNumber(f.year) || null,
            color: f.color.trim() || null,
            fuel: f.fuel.trim() || null,
            test_until: f.test_until || null,
            last_test: f.last_test || null,
            photo_url: f.photo_url || null,
            notes: f.notes.trim(),
          },
          photo
        );
      }}
    >
      <Field label="מספר רכב">
        <div className="flex gap-2">
          <input className="field num flex-1" dir="ltr" inputMode="numeric" value={f.plate} onChange={set("plate")} placeholder="12-345-67" autoFocus={!car.id} />
          <button type="button" className="btn bg-raised shrink-0" onClick={lookup} disabled={digits.length < 5 || looking}>
            {looking ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />} מילוי
          </button>
        </div>
      </Field>
      <Field label="כינוי (לא חובה)">
        <input className="field" value={f.nickname} onChange={set("nickname")} placeholder="הפיקנטו של רון…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="יצרן">
          <input className="field" value={f.make} onChange={set("make")} />
        </Field>
        <Field label="דגם">
          <input className="field" value={f.model} onChange={set("model")} />
        </Field>
        <Field label="שנה">
          <input className="field num" inputMode="numeric" value={f.year} onChange={set("year")} />
        </Field>
        <Field label="צבע">
          <input className="field" value={f.color} onChange={set("color")} />
        </Field>
        <Field label="טסט בתוקף עד">
          <input type="date" className="field" value={f.test_until} onChange={set("test_until")} />
        </Field>
        <Field label="טסט אחרון">
          <input type="date" className="field" value={f.last_test} onChange={set("last_test")} />
        </Field>
      </div>
      {f.photo_url && !photo.file && !(car.photo_path && !photo.remove) && (
        <div className="relative">
          <img src={f.photo_url} alt="" className="w-full aspect-[16/9] object-cover rounded-2xl bg-raised" />
          <p className="absolute bottom-2 start-2 text-[12px] bg-black/60 text-white rounded-full px-2.5 py-1">תמונה כללית של הדגם · אפשר להחליף בצילום שלכם</p>
        </div>
      )}
      {!isDemoMode && <PhotoField label="צילום של הרכב שלכם" path={photo.remove ? null : car.photo_path} file={photo.file} onChange={setPhoto} />}
      <Field label="הערות">
        <textarea className="field" rows={2} value={f.notes} onChange={set("notes")} placeholder="ביטוח, מוסך קבוע, קוד רדיו…" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={digits.length < 5}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}

function ServiceForm({ s, onSave, onDelete }) {
  const [f, setF] = useState({
    kind: s.kind || "service",
    done_on: s.done_on || todayStr(),
    km: s.km ?? "",
    cost: s.cost ?? "",
    garage: s.garage || "",
    notes: s.notes || "",
  });
  const [kept, setKept] = useState(s.photos ?? []);
  const [added, setAdded] = useState([]);
  const [viewing, setViewing] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          { kind: f.kind, done_on: f.done_on || todayStr(), km: toNumber(f.km) || null, cost: f.cost === "" ? null : toNumber(f.cost), garage: f.garage.trim() || null, notes: f.notes.trim() },
          { kept, added, removed: (s.photos ?? []).filter((p) => !kept.includes(p)) }
        );
      }}
    >
      <div className="flex flex-wrap gap-2">
        {Object.entries(SERVICE_KINDS).map(([k, v]) => (
          <button key={k} type="button" className="chip press" data-on={f.kind === k} onClick={() => setF((p) => ({ ...p, kind: k }))}>
            {v.emoji} {v.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תאריך">
          <input type="date" className="field" value={f.done_on} onChange={set("done_on")} />
        </Field>
        <Field label="קילומטראז׳">
          <input className="field num" inputMode="numeric" value={f.km} onChange={set("km")} placeholder="0" />
        </Field>
        <Field label="עלות">
          <input className="field num" inputMode="decimal" value={f.cost} onChange={set("cost")} placeholder="₪0" />
        </Field>
        <Field label="מוסך">
          <input className="field" value={f.garage} onChange={set("garage")} />
        </Field>
      </div>
      <Field label="מה נעשה?">
        <textarea className="field" rows={3} value={f.notes} onChange={set("notes")} placeholder="החלפת שמן ופילטרים, רפידות קדמיות…" />
      </Field>
      {!isDemoMode && (
        <div>
          <span className="label">תמונות (חשבונית, החלק שהוחלף…)</span>
          <div className="flex gap-2 overflow-x-auto pt-1.5 pb-1">
            {kept.map((p) => (
              <Thumb key={p} path={p} onOpen={setViewing} onRemove={() => setKept((k) => k.filter((x) => x !== p))} />
            ))}
            {added.map((file, i) => (
              <Thumb key={i} file={file} onOpen={setViewing} onRemove={() => setAdded((a) => a.filter((x) => x !== file))} />
            ))}
            <label className="press shrink-0 w-20 h-20 rounded-xl bg-raised grid place-items-center cursor-pointer text-muted" aria-label="הוספת תמונה">
              <Camera size={22} />
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setAdded((a) => [...a, ...Array.from(e.target.files ?? [])])} />
            </label>
          </div>
          {viewing && (
            <button type="button" className="block mt-2 w-full" onClick={() => setViewing(null)} aria-label="סגירת התמונה">
              <img src={viewing} alt="" className="w-full rounded-2xl" />
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1">
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}

