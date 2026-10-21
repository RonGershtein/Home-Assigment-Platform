import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// גיליון תחתון בסגנון iOS: נכנס מלמטה, נסגר בגרירה מטה (גם בהחלקה מהירה), ברקע או ב-X
export default function Sheet({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const onPointerDown = (e) => {
    if (drag.current || e.button > 0) return; // מגע נוסף באמצע גרירה לא "קופץ"
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.current.style.transition = "none";
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const raw = e.clientY - drag.current.y;
    // מעלה - חיכוך במקום קיר
    const dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    drag.current.dy = raw;
    panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    drag.current = null;
    const velocity = dy / (performance.now() - t);
    panel.current.style.transition = "";
    panel.current.style.transform = "";
    if (dy > 120 || (dy > 10 && velocity > 0.11)) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        ref={panel}
        className="absolute inset-x-0 bottom-0 mx-auto max-w-xl bg-card rounded-t-[28px] shadow-float flex flex-col max-h-[92dvh] transition-transform duration-[380ms] ease-drawer will-change-transform"
        style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
      >
        <div
          className="no-select pt-2.5 pb-1 px-5 cursor-grab"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between mt-3">
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <button type="button" className="icon-btn bg-raised -ml-1" onClick={onClose} aria-label="סגירה">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pt-3 pb-4 flex-1">{children}</div>
        {footer && <div className="px-5 pt-3 border-t pb-[calc(12px+env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body
  );
}
