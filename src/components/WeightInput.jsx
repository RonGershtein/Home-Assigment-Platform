import { Minus, Plus } from "lucide-react";

// קלט משקל: מספר גדול עם כפתורי ± 0.1, ואפשר גם להקליד
export default function WeightInput({ value, onChange, size = "lg", autoFocus }) {
  const n = Number(value);
  const step = (d) => onChange((Math.round((isNaN(n) ? 70 : n) * 10 + d) / 10).toFixed(1));
  const big = size === "lg";
  return (
    <div className="flex items-center justify-center gap-3" dir="ltr">
      <button type="button" className={`press grid place-items-center rounded-full bg-raised ${big ? "w-14 h-14" : "w-11 h-11"}`} onClick={() => step(-1)} aria-label="פחות 0.1">
        <Minus size={big ? 22 : 18} />
      </button>
      <label className="relative flex items-baseline justify-center">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="20"
          max="400"
          autoFocus={autoFocus}
          className={`bare num bg-transparent text-center font-bold tracking-[-0.03em] outline-none ${big ? "text-[56px] leading-none w-[180px]" : "text-[34px] leading-none w-[120px]"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="משקל בקילוגרם"
        />
        <span className={`absolute -end-6 bottom-1 text-muted font-medium ${big ? "text-[15px]" : "text-[13px]"}`}>ק״ג</span>
      </label>
      <button type="button" className={`press grid place-items-center rounded-full bg-raised ${big ? "w-14 h-14" : "w-11 h-11"}`} onClick={() => step(1)} aria-label="עוד 0.1">
        <Plus size={big ? 22 : 18} />
      </button>
    </div>
  );
}
