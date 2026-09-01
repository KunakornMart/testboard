import React, { useEffect, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { User } from "./types";

/* ---------------- toast ---------------- */
export interface Toast { id: number; text: string; kind: "ok" | "info" | "warn"; icon?: string }
let toastId = 0;
const toastListeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];
export function toast(text: string, kind: Toast["kind"] = "info", icon?: string) {
  const t: Toast = { id: ++toastId, text, kind, icon };
  toasts = [...toasts, t].slice(-4);
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 3600);
}
export function ToastHub() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    const cb = (t: Toast[]) => setList([...t]);
    toastListeners.add(cb);
    return () => { toastListeners.delete(cb); };
  }, []);
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
      {list.map((t) => (
        <div key={t.id} className="toast-in pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13.5px] font-semibold shadow-lg border"
          style={{
            background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)", boxShadow: "var(--shadow-lg)",
            borderLeft: `4px solid ${t.kind === "ok" ? "var(--ok)" : t.kind === "warn" ? "var(--danger)" : "var(--gold)"}`,
          }}>
          {t.icon && <span className="text-[15px]">{t.icon}</span>}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- modal ---------------- */
export function Modal({ open, onClose, children, width = 520, title, icon }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number; title?: React.ReactNode; icon?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: "var(--overlay)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop-in w-full max-h-[92vh] overflow-y-auto rounded-2xl" style={{ maxWidth: width, background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
        {title !== undefined && (
          <div className="flex items-center justify-between px-6 pt-5 pb-1 sticky top-0 z-10" style={{ background: "var(--panel)" }}>
            <h3 className="font-display font-bold text-[19px] flex items-center gap-2.5" style={{ color: "var(--ink)" }}>{icon}{title}</h3>
            <button className="icon-btn" onClick={onClose}><X size={17} /></button>
          </div>
        )}
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onYes, title, body, yesLabel = "ยืนยัน", danger = true }: { open: boolean; onClose: () => void; onYes: () => void; title: string; body: string; yesLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} width={420} title={<span className="flex items-center gap-2">{danger && <AlertTriangle size={19} style={{ color: "var(--danger)" }} />}{title}</span>}>
      <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{body}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-gold"}`} onClick={() => { onYes(); onClose(); }}>{yesLabel}</button>
      </div>
    </Modal>
  );
}

/* ---------------- avatar ---------------- */
export function Avatar({ user, size = 30, ring }: { user?: Pick<User, "name" | "color"> | null; size?: number; ring?: boolean }) {
  const name = user?.name || "?";
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center justify-center rounded-full font-display font-bold shrink-0 no-select"
      style={{ width: size, height: size, background: user?.color || "#888", color: "#fff", fontSize: size * 0.38, boxShadow: ring ? "0 0 0 2px var(--panel)" : undefined }}>
      {initials}
    </div>
  );
}

/* ---------------- switch ---------------- */
export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => onChange(!on)} className="relative rounded-full transition-colors shrink-0"
      style={{ width: 40, height: 23, background: on ? "var(--ok)" : "var(--line-strong)", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <span className="absolute top-[2.5px] rounded-full bg-white transition-all" style={{ width: 18, height: 18, left: on ? 19.5 : 2.5, boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
    </button>
  );
}

/* ---------------- popover menu ---------------- */
export function useClickAway(onAway: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onAway(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onAway]);
  return ref;
}

export function Menu({ button, children, align = "right", width }: { button: (open: boolean) => React.ReactNode; children: React.ReactNode | ((close: () => void) => React.ReactNode); align?: "left" | "right"; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useClickAway(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{button(open)}</div>
      {open && (
        <div className="menu-panel absolute top-full mt-2 pop-in" style={align === "right" ? { right: 0 } : { left: 0, minWidth: width }}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

/* ---------------- scroll reveal ---------------- */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("is-in"); ob.disconnect(); } }, { threshold: 0.08 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/* ---------------- misc ---------------- */
export function Dot({ color, size = 8, pulse }: { color: string; size?: number; pulse?: boolean }) {
  return <span className={`inline-block rounded-full shrink-0 ${pulse ? "pulse-dot" : ""}`} style={{ width: size, height: size, background: color, ["--ok" as any]: color }} />;
}

export function EmptyHint({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 fade-up">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--gold-soft)", color: "var(--gold-strong)" }}>{icon}</div>
      <div className="font-display font-bold text-[17px]" style={{ color: "var(--ink)" }}>{title}</div>
      {sub && <div className="text-[13.5px] mt-1.5 max-w-sm leading-relaxed" style={{ color: "var(--muted)" }}>{sub}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
