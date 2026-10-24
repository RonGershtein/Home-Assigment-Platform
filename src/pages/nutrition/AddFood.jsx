import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Keyboard, Loader2, Pencil, Plus, ScanBarcode, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Field, SearchField, Segmented } from "../../components/ui";
import { FOODS, FOOD_CATEGORIES, foodByKey, searchFoods } from "../../lib/foods";
import { MEALS, fmt0 } from "../../lib/nutrition";
import { decodeImage, forGrams, lookupBarcode, startScanner } from "../../lib/barcode";
import { onVisionProgress, recognizeFood, shrinkImage, visionProgress, warmVision } from "../../lib/foodVision";

export const foodIcon = (key) => (key?.startsWith("off:") ? "🏷️" : (foodByKey(key)?.icon ?? "🍽️"));

/**
 * גיליון "מה אכלת?": חיפוש במאגר, צילום (זיהוי במכשיר), ברקוד (Open Food Facts), והוספה ידנית.
 * mode: search | photo | scan | product | custom
 */
export default function AddFood({ meal: initialMeal, recentRows, onAdd }) {
  const [mode, setMode] = useState("search");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("israeli");
  const [picked, setPicked] = useState(null); // {key, name, kcal, protein, unit, icon}
  const [qty, setQty] = useState(1);
  const [meal, setMeal] = useState(initialMeal);
  const [product, setProduct] = useState(null);

  const recents = useMemo(() => {
    const seen = new Map();
    for (const e of [...recentRows].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))) {
      const k = e.food_key || e.name;
      const cur = seen.get(k);
      if (cur) cur.count++;
      else seen.set(k, { key: e.food_key, name: e.name, kcal: Number(e.kcal) / (Number(e.qty) || 1), protein: Number(e.protein_g || 0) / (Number(e.qty) || 1), unit: e.unit, count: 1, icon: foodIcon(e.food_key) });
    }
    return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [recentRows]);

  const results = q.trim() ? searchFoods(q) : FOODS.filter((f) => f.category === cat);
  const pick = (f) => {
    setPicked({ key: f.key, name: f.name, kcal: f.kcal, protein: f.protein, unit: f.serving ?? f.unit, icon: f.icon ?? foodIcon(f.key) });
    setQty(1);
    setMode("search");
  };
  const submit = () => {
    if (!picked) return;
    onAdd({ meal, name: picked.name, kcal: Math.round(picked.kcal * qty), protein_g: picked.protein ? Math.round(picked.protein * qty * 10) / 10 : null, qty, unit: picked.unit || null, food_key: picked.key || null });
  };
  const mealLabel = MEALS.find((m) => m.value === meal)?.label;

  return (
    <div className="space-y-3 -mt-1">
      <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.value, label: m.icon }))} />

      {picked ? (
        <div className="rounded-2xl bg-raised p-4 enter">
          <div className="flex items-center gap-3">
            <span className="text-[28px] leading-none">{picked.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold truncate">{picked.name}</p>
              <p className="text-[13px] text-muted truncate">{picked.unit || "מנה"}</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setPicked(null)} aria-label="ביטול">
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2" dir="ltr">
              {[0.5, 1, 1.5, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setQty(n)} className={`press num h-9 min-w-[40px] px-2 rounded-full text-[14px] font-medium ${qty === n ? "bg-fg text-bg" : "bg-card"}`}>
                  ×{n}
                </button>
              ))}
            </div>
            <p className="num text-[20px] font-bold">
              {fmt0(picked.kcal * qty)} <span className="text-[12px] text-muted font-normal">קק״ל</span>
            </p>
          </div>
          <button type="button" className="btn btn-primary w-full mt-4 h-11" onClick={submit}>
            <Plus size={18} /> הוספה ל{mealLabel}
          </button>
        </div>
      ) : mode === "photo" ? (
        <PhotoMode onPick={pick} onBack={() => setMode("search")} />
      ) : mode === "scan" ? (
        <ScanMode
          onBack={() => setMode("search")}
          onProduct={(p) => {
            setProduct(p);
            setMode("product");
          }}
        />
      ) : mode === "product" && product ? (
        <ProductMode
          product={product}
          mealLabel={mealLabel}
          onBack={() => setMode("scan")}
          onAdd={(grams, label) => {
            const v = forGrams(product, grams);
            onAdd({ meal, name: product.brand ? `${product.name} (${product.brand})` : product.name, kcal: v.kcal, protein_g: v.protein, qty: 1, unit: label, food_key: `off:${product.code}` });
          }}
        />
      ) : mode === "custom" ? (
        <CustomMode initialName={q} onBack={() => setMode("search")} onAdd={(v) => onAdd({ meal, ...v, qty: 1, unit: null, food_key: null })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="press rounded-2xl bg-fg text-bg p-3.5 flex items-center gap-3 text-start" onClick={() => setMode("photo")}>
              <Camera size={22} className="shrink-0" />
              <span>
                <span className="block text-[15px] font-semibold">צילום</span>
                <span className="block text-[12px] opacity-70">זיהוי במכשיר</span>
              </span>
            </button>
            <button type="button" className="press rounded-2xl bg-raised p-3.5 flex items-center gap-3 text-start" onClick={() => setMode("scan")}>
              <ScanBarcode size={22} className="shrink-0" />
              <span>
                <span className="block text-[15px] font-semibold">ברקוד</span>
                <span className="block text-[12px] text-muted">מוצרים ארוזים</span>
              </span>
            </button>
          </div>

          <SearchField value={q} onChange={setQ} placeholder="חיפוש: פיתה, קוטג׳, שניצל…" />

          {!q && recents.length > 0 && (
            <div>
              <p className="label">אכלת לאחרונה</p>
              <div className="hscroll -mx-5 px-5">
                {recents.map((r) => (
                  <button key={r.key || r.name} type="button" className="chip bg-raised" onClick={() => pick({ key: r.key, name: r.name, kcal: r.kcal, protein: r.protein, serving: r.unit, icon: r.icon })}>
                    <span className="text-[16px] leading-none">{r.icon}</span> {r.name} <span className="num opacity-60">{fmt0(r.kcal)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!q && (
            <div className="hscroll -mx-5 px-5">
              {FOOD_CATEGORIES.map((c) => (
                <button key={c.value} type="button" className="chip bg-raised" data-on={cat === c.value} onClick={() => setCat(c.value)}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          )}

          <ul className="divide-y">
            {results.map((f) => (
              <li key={f.key}>
                <FoodRow food={f} onClick={() => pick(f)} />
              </li>
            ))}
            {q && results.length === 0 && <li className="py-6 text-center text-[14px] text-muted">לא נמצא במאגר</li>}
          </ul>
          <button type="button" className="btn btn-soft w-full h-11" onClick={() => setMode("custom")}>
            <Pencil size={16} /> הוספה ידנית (שם וקלוריות)
          </button>
        </>
      )}
    </div>
  );
}

function FoodRow({ food, onClick, right }) {
  return (
    <button type="button" className="press w-full flex items-center gap-3 min-h-[52px] text-start" onClick={onClick}>
      <span className="text-[22px] leading-none w-7 text-center">{food.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium truncate">{food.name}</span>
        <span className="block text-[12px] text-muted truncate">
          {food.serving}
          {food.protein ? ` · ${food.protein} גר׳ חלבון` : ""}
        </span>
      </span>
      {right ?? <span className="num text-[15px] font-semibold text-muted">{food.kcal}</span>}
    </button>
  );
}

function BackRow({ onBack, title, hint }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="icon-btn bg-raised" onClick={onBack} aria-label="חזרה">
        <ChevronRight size={20} />
      </button>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold">{title}</p>
        {hint && <p className="text-[12px] text-muted truncate">{hint}</p>}
      </div>
    </div>
  );
}

/* ───── צילום: המודל רץ בדפדפן ───── */
function PhotoMode({ onPick, onBack }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [results, setResults] = useState([]);
  const [prog, setProg] = useState(visionProgress());

  useEffect(() => {
    warmVision();
    return onVisionProgress(setProg);
  }, []);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const onFile = async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setState("working");
    setResults([]);
    try {
      const small = await shrinkImage(file);
      const top = await recognizeFood(small, 5);
      setResults(top.map((r) => ({ ...foodByKey(r.key), score: r.score })).filter((r) => r.key));
      setState("done");
    } catch (e) {
      setState("error");
      toast.error(e?.message?.includes("fetch") ? "צריך אינטרנט להורדת המודל בפעם הראשונה" : "הזיהוי נכשל");
    }
  };

  return (
    <div className="space-y-3 enter">
      <BackRow onBack={onBack} title="צילום הארוחה" hint="הזיהוי רץ על המכשיר. התמונה לא נשלחת לשום מקום" />
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="photo-input" />

      {!preview ? (
        <button type="button" className="press w-full rounded-2xl bg-raised aspect-[4/3] flex flex-col items-center justify-center gap-2 text-muted" onClick={() => input.current?.click()}>
          <Camera size={40} strokeWidth={1.5} />
          <span className="text-[15px] font-medium text-fg">נגיעה לצילום</span>
          <span className="text-[12px]">או בחירה מהגלריה</span>
        </button>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-raised">
          <img src={preview} alt="" className="w-full max-h-[260px] object-cover" />
          <button type="button" className="press absolute bottom-2 start-2 h-9 px-3 rounded-full bg-black/60 text-white text-[13px] font-medium backdrop-blur" onClick={() => input.current?.click()}>
            <Camera size={14} className="inline -mt-0.5 me-1" /> צילום אחר
          </button>
        </div>
      )}

      {prog.status === "downloading" && (
        <div className="rounded-2xl bg-raised p-3 text-[13px]">
          <p className="flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> מוריד את מודל הזיהוי (23MB, פעם אחת בלבד)
          </p>
          <div className="h-1.5 rounded-full bg-card mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(3, prog.pct)}%` }} />
          </div>
        </div>
      )}
      {state === "working" && prog.status !== "downloading" && (
        <p className="flex items-center justify-center gap-2 text-[14px] text-muted py-2">
          <Sparkles size={16} className="text-accent-text" /> מזהה…
        </p>
      )}

      {state === "done" && (
        <div>
          <p className="label">מה זה? נוגעים על הנכון</p>
          <ul className="divide-y">
            {results.map((f) => (
              <li key={f.key}>
                <FoodRow
                  food={f}
                  onClick={() => onPick(f)}
                  right={
                    <span className="flex flex-col items-end w-14">
                      <span className="num text-[13px] font-semibold">{Math.round(f.score * 100)}%</span>
                      <span className="h-1 w-full rounded-full bg-raised overflow-hidden">
                        <span className="block h-full bg-accent rounded-full" style={{ width: `${Math.max(4, f.score * 100)}%` }} />
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-soft w-full h-11 mt-2" onClick={onBack}>
            לא ברשימה? חיפוש ידני
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── ברקוד ───── */
function ScanMode({ onBack, onProduct }) {
  const video = useRef(null);
  const fileInput = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | looking | manual | error
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const stop = useRef(() => {});

  const found = async (c) => {
    stop.current();
    setStatus("looking");
    try {
      const p = await lookupBarcode(c);
      if (!p) {
        toast.error(`המוצר ${c} לא נמצא במאגר. אפשר להוסיף ידנית`);
        setStatus("manual");
        setCode(c);
        return;
      }
      onProduct(p);
    } catch (e) {
      toast.error(e.message || "משהו השתבש");
      setStatus("manual");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("manual");
      return;
    }
    startScanner(
      video.current,
      (c) => !cancelled && found(c),
      (e) => {
        if (cancelled) return;
        setErr(e?.message || "המצלמה לא זמינה");
        setStatus("manual");
      }
    ).then((s) => {
      stop.current = s;
      if (!cancelled) setStatus((st) => (st === "starting" ? "scanning" : st));
    });
    return () => {
      cancelled = true;
      stop.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 enter">
      <BackRow onBack={onBack} title="סריקת ברקוד" hint="מכוונים את המצלמה לברקוד שעל האריזה" />
      <div className={`relative rounded-2xl overflow-hidden bg-black aspect-[4/3] ${status === "manual" ? "hidden" : ""}`}>
        <video ref={video} className="w-full h-full object-cover" playsInline muted autoPlay />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-xl pointer-events-none" />
        {(status === "starting" || status === "looking") && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-white text-[14px]">
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {status === "looking" ? "מחפש את המוצר…" : "מפעיל מצלמה…"}
            </span>
          </div>
        )}
      </div>
      {err && <p className="text-[13px] text-crit px-1">{err}</p>}

      <input ref={fileInput} type="file" accept="image/*" className="hidden" data-testid="barcode-image-input" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setStatus("looking");
        const c = await decodeImage(f);
        if (c) found(c);
        else {
          toast.error("לא זוהה ברקוד בתמונה");
          setStatus("manual");
        }
      }} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.replace(/\D/g, "").length >= 8) found(code);
        }}
      >
        <div className="relative flex-1">
          <Keyboard size={18} className="absolute top-1/2 -translate-y-1/2 start-4 text-muted pointer-events-none" />
          <input className="field ps-11 num" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="או מקלידים את המספר" enterKeyHint="search" />
        </div>
        <button type="submit" className="btn btn-primary h-12 px-4" disabled={code.replace(/\D/g, "").length < 8}>
          חיפוש
        </button>
      </form>
      <button type="button" className="btn btn-soft w-full h-11" onClick={() => fileInput.current?.click()}>
        <Camera size={16} /> תמונה של הברקוד מהגלריה
      </button>
    </div>
  );
}

function ProductMode({ product, mealLabel, onBack, onAdd }) {
  const [choice, setChoice] = useState(product.serving ? "serving" : "100");
  const [grams, setGrams] = useState(product.serving?.grams ? String(product.serving.grams) : "100");
  const g = choice === "serving" ? product.serving.grams : choice === "100" ? 100 : Number(grams) || 0;
  const v = forGrams(product, g);
  const label = choice === "serving" ? product.serving.label : `${g} גר׳`;
  return (
    <div className="space-y-3 enter">
      <BackRow onBack={onBack} title="נמצא במאגר" hint="Open Food Facts · הערכים מהאריזה" />
      <div className="rounded-2xl bg-raised p-4 flex items-center gap-3">
        {product.image ? <img src={product.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-card" /> : <span className="grid place-items-center w-14 h-14 rounded-xl bg-card text-[26px]">🏷️</span>}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold truncate">{product.name}</p>
          <p className="text-[13px] text-muted truncate">
            {[product.brand, product.quantity].filter(Boolean).join(" · ")}
          </p>
          <p className="num text-[12px] text-muted mt-0.5">
            ל-100 גר׳: {product.per100.kcal} קק״ל{product.per100.protein != null ? ` · ${product.per100.protein} חלבון` : ""}
          </p>
        </div>
      </div>
      <div>
        <span className="label">כמה אכלת?</span>
        <div className="grid grid-cols-3 gap-2">
          {product.serving && (
            <button type="button" onClick={() => setChoice("serving")} className={`press rounded-2xl p-3 text-start ${choice === "serving" ? "bg-accent text-accent-ink" : "bg-raised"}`}>
              <p className="text-[14px] font-semibold">מנה</p>
              <p className="num text-[12px] opacity-75 truncate">{product.serving.label}</p>
            </button>
          )}
          <button type="button" onClick={() => setChoice("100")} className={`press rounded-2xl p-3 text-start ${choice === "100" ? "bg-accent text-accent-ink" : "bg-raised"}`}>
            <p className="text-[14px] font-semibold">100 גר׳</p>
            <p className="num text-[12px] opacity-75">{product.per100.kcal} קק״ל</p>
          </button>
          <button type="button" onClick={() => setChoice("custom")} className={`press rounded-2xl p-3 text-start ${choice === "custom" ? "bg-accent text-accent-ink" : "bg-raised"}`}>
            <p className="text-[14px] font-semibold">אחר</p>
            <p className="num text-[12px] opacity-75">בגרמים</p>
          </button>
        </div>
        {choice === "custom" && (
          <input className="field num mt-2" type="number" inputMode="numeric" min="1" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="גרמים" autoFocus />
        )}
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="num text-[22px] font-bold">
          {fmt0(v.kcal)} <span className="text-[12px] text-muted font-normal">קק״ל{v.protein != null ? ` · ${v.protein} חלבון` : ""}</span>
        </span>
      </div>
      <button type="button" className="btn btn-primary w-full h-11" disabled={!(g > 0)} onClick={() => onAdd(g, label)}>
        <Plus size={18} /> הוספה ל{mealLabel}
      </button>
    </div>
  );
}

function CustomMode({ initialName, onBack, onAdd }) {
  const [name, setName] = useState(initialName || "");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  return (
    <div className="space-y-3 enter">
      <BackRow onBack={onBack} title="הוספה ידנית" />
      <Field label="שם">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="סלט עוף של אמא" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="קלוריות">
          <input className="field num" type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="350" />
        </Field>
        <Field label="חלבון (גר׳)">
          <input className="field num" type="number" inputMode="decimal" value={prot} onChange={(e) => setProt(e.target.value)} placeholder="20" />
        </Field>
      </div>
      <button type="button" className="btn btn-primary w-full h-11" disabled={!name.trim() || kcal === ""} onClick={() => onAdd({ name: name.trim(), kcal: Math.round(Number(kcal) || 0), protein_g: prot ? Number(prot) : null })}>
        הוספה
      </button>
    </div>
  );
}
