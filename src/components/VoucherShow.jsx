import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { imageUrl } from "../lib/images";
import { money, toNumber } from "../lib/format";

// קוד שאפשר להציג כברקוד: קצר, בלי רווחים ולא קישור
export const barcodeable = (code) => !!code && !/^https?:/i.test(code.trim()) && /^[\x21-\x7e]{3,40}$/.test(code.trim().replace(/[‪-‮]/g, ""));
const clean = (code) => code.trim().replace(/[‪-‮]/g, "");

function Barcode({ value }) {
  const svg = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svg.current) return;
      try {
        JsBarcode(svg.current, value, { format: "CODE128", displayValue: false, height: 96, width: 2.4, margin: 0, background: "#ffffff", lineColor: "#000000" });
      } catch {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (failed) return null;
  return <svg ref={svg} className="w-full h-auto max-h-[120px]" role="img" aria-label={`ברקוד ${value}`} />;
}

export function VoucherShow({ v, onUse, onPartial }) {
  const [img, setImg] = useState(null);
  const [partial, setPartial] = useState(false);
  const [spent, setSpent] = useState("");
  const code = v.voucher_code ? clean(v.voucher_code) : null;
  const balance = v.voucher_type === "cash" ? Number(v.balance ?? v.amount ?? 0) : null;
  const s = toNumber(spent);
  const after = balance != null && s ? Math.max(0, balance - s) : null;

  useEffect(() => {
    let alive = true;
    imageUrl(v.image_path).then((u) => alive && setImg(u));
    return () => {
      alive = false;
    };
  }, [v.image_path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("הקוד הועתק");
    } catch {
      toast.error("לא הצלחתי להעתיק");
    }
  };

  return (
    <div className="space-y-4 pb-2">
      {balance != null && (
        <div className="flex items-baseline justify-between px-1">
          <span className="text-muted text-[14px]">יתרה בשובר</span>
          <span className="num text-[28px] font-bold">
            {money(balance)}
            {v.balance != null && Number(v.amount) > balance && <span className="text-[14px] font-normal text-muted"> מתוך {money(Number(v.amount))}</span>}
          </span>
        </div>
      )}

      {code && (
        <div className="rounded-3xl bg-white text-black p-5">
          {barcodeable(code) && <Barcode value={code} />}
          <p className="num text-center text-[26px] font-semibold tracking-[0.06em] mt-3 break-all" dir="ltr">
            {code}
          </p>
          <button type="button" className="press mx-auto mt-3 flex items-center gap-2 h-10 px-4 rounded-full bg-black/5 text-[14px]" onClick={copy}>
            <Copy size={15} /> העתקת הקוד
          </button>
        </div>
      )}

      {img && (
        <a href={img} target="_blank" rel="noreferrer" className="block">
          <img src={img} alt={`תמונת השובר ${v.title}`} className="w-full rounded-3xl bg-raised object-contain max-h-[60dvh]" />
        </a>
      )}

      {v.store_url && (
        <a href={v.store_url} target="_blank" rel="noreferrer" className="btn btn-soft w-full">
          <ExternalLink size={17} /> פתיחת האתר
        </a>
      )}

      {v.status !== "used" &&
        (partial ? (
          <form
            className="bg-raised rounded-3xl p-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (s) onPartial(after);
            }}
          >
            <label className="block">
              <span className="label">כמה השתמשתם עכשיו?</span>
              <input className="field bg-card num text-[22px] font-semibold h-14" inputMode="decimal" value={spent} onChange={(e) => setSpent(e.target.value)} placeholder="₪0" autoFocus />
            </label>
            {after != null && (
              <p className="text-[14px] px-1">
                {after > 0 ? (
                  <>
                    יישאר בשובר <span className="num font-semibold">{money(after)}</span>
                  </>
                ) : (
                  "השובר ינוצל במלואו"
                )}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={!s}>
                עדכון יתרה
              </button>
              <button type="button" className="btn btn-soft" onClick={() => setPartial(false)}>
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            {balance != null && balance > 0 && (
              <button type="button" className="btn btn-soft flex-1" onClick={() => setPartial(true)}>
                שימוש חלקי
              </button>
            )}
            <button type="button" className="btn btn-primary flex-1" onClick={onUse}>
              ניצלנו את כולו
            </button>
          </div>
        ))}
    </div>
  );
}
