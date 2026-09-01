import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Users, PenLine, ArrowRight, Lock, Zap } from "lucide-react";
import { DOMAIN } from "../data";
import { login, useApp } from "../store";
import { toast } from "../ui";

const FLOATERS = [
  { c: "#FFE06B", t: "AI ตรวจยอด\nReconciliation", x: "8%", y: "16%", r: -7, d: 0 },
  { c: "#A9E8C5", t: "ไอเดียใหม่ 💡\nลด manual work", x: "58%", y: "10%", r: 5, d: 0.8 },
  { c: "#FFB59E", t: "Problem:\nยอดไม่ตรง T+1", x: "12%", y: "62%", r: 4, d: 1.4 },
  { c: "#A5D8F6", t: "POC เริ่ม\nศุกร์นี้ 🚀", x: "62%", y: "58%", r: -5, d: 0.4 },
  { c: "#FFC7DE", t: "โหวต 👍 14", x: "38%", y: "38%", r: 8, d: 1.9 },
];

export default function AuthScreen() {
  const app = useApp();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);

  const doLogin = (em: string, nm?: string) => {
    setErr(""); setLoading(true);
    setTimeout(() => {
      const res = login(em, nm);
      setLoading(false);
      if (!res.ok) {
        if (res.error === "inactive") setDenied(res.user?.name || "");
        else setErr(res.error || "เข้าสู่ระบบไม่ได้");
        return;
      }
      toast(`ยินดีต้อนรับ ${res.user?.name} 👋`, "ok", "🧠");
    }, 650);
  };

  if (denied) {
    return (
      <Shell>
        <div className="panel p-10 text-center max-w-md mx-auto fade-up">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)" }}>
            <Lock size={26} />
          </div>
          <h2 className="font-display font-bold text-2xl">บัญชีถูกระงับชั่วคราว</h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
            บัญชีของ <b style={{ color: "var(--ink)" }}>{denied}</b> ถูกปิดใช้งาน (active = false) โดยผู้ดูแลระบบ<br />ติดต่อ Admin ทีมเพื่อเปิดใช้งานอีกครั้ง
          </p>
          <button className="btn btn-gold mt-6" onClick={() => setDenied(null)}>กลับหน้าเข้าสู่ระบบ</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr]">
        {/* brand side */}
        <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-12" style={{ background: "linear-gradient(150deg, #16233f 0%, #1b2b4d 55%, #233a63 100%)" }}>
          <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(rgba(226,182,78,.35) 1.2px, transparent 1.2px)", backgroundSize: "28px 28px" }} />
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full" style={{ background: "radial-gradient(circle, rgba(226,182,78,.22), transparent 65%)" }} />
          {FLOATERS.map((f, i) => (
            <div key={i} className="absolute floaty" style={{ left: f.x, top: f.y, ["--r" as any]: `${f.r}deg`, animationDelay: `${f.d}s` }}>
              <div className="w-36 h-32 rounded-lg p-3.5 text-[13px] font-semibold leading-snug whitespace-pre-line"
                style={{ background: f.c, color: "#2b2b26", transform: `rotate(${f.r}deg)`, boxShadow: "0 14px 30px rgba(0,0,0,.35)" }}>
                {f.t}
              </div>
            </div>
          ))}
          <div className="relative flex items-center gap-3.5">
            <LogoMark />
            <div>
              <div className="font-display font-extrabold text-[22px] leading-tight text-white">MTS <span style={{ color: "#e2b64e" }}>BrainSpace</span></div>
              <div className="text-[12px] font-semibold tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,.55)" }}>MTS Gold Group</div>
            </div>
          </div>
          <div className="relative max-w-lg">
            <h1 className="font-display font-extrabold text-[44px] leading-[1.15] text-white">
              แหล่งรวมไอเดีย<br />ของทีม <span style={{ color: "#e2b64e" }}>MTS</span>
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>
              บอร์ดระดมสมองแบบเรียลไทม์ สไตล์ FigJam × Miro — คิด เขียน วาด เชื่อมไอเดีย โหวต และติดตามว่าใครแก้อะไรที่ไหน ครบจบในบอร์ดเดียว
            </p>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
              {[
                { icon: <Zap size={16} />, t: "เรียลไทม์ เห็นเคอร์เซอร์เพื่อนร่วมทีม" },
                { icon: <PenLine size={16} />, t: "วาด เขียน สติกเกอร์ โฟลว์ชาร์ต" },
                { icon: <Users size={16} />, t: "แยกแผนก OIA / FIA + สิทธิ์ private" },
                { icon: <ShieldCheck size={16} />, t: "Log ทุกการแก้ไข กู้คืนเวอร์ชันได้" },
              ].map((x, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "rgba(255,255,255,.85)" }}>
                  <span style={{ color: "#e2b64e" }}>{x.icon}</span>{x.t}
                </div>
              ))}
            </div>
          </div>
          <div className="relative text-[12px] font-medium" style={{ color: "rgba(255,255,255,.45)" }}>
            Ideas · Explore · Decide · Build — สำหรับ @mtsgoldgroup.com เท่านั้น
          </div>
        </div>

        {/* login side */}
        <div className="flex items-center justify-center p-6 relative">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <LogoMark small /><span className="font-display font-extrabold text-xl">MTS <span style={{ color: "var(--gold)" }}>BrainSpace</span></span>
            </div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <div className="flex items-center gap-2 text-[12.5px] font-bold tracking-wide" style={{ color: "var(--gold-strong)" }}>
                <Sparkles size={15} /> ทีมเวิร์กเริ่มที่นี่
              </div>
              <h2 className="font-display font-extrabold text-[30px] mt-2 leading-tight">เข้าสู่ระบบ</h2>
              <p className="mt-1.5 text-[14px]" style={{ color: "var(--muted)" }}>
                ใช้ชื่อบัญชี Google ของบริษัท — เข้าสู่ระบบครั้งแรกจะลงทะเบียนให้อัตโนมัติเหมือนระบบ Ticket
              </p>

              <div className="mt-7 space-y-3">
                <label className="block">
                  <span className="text-[12.5px] font-bold" style={{ color: "var(--ink-soft)" }}>อีเมลบริษัท</span>
                  <div className="relative mt-1.5">
                    <input className="input pr-32" placeholder={`yourname@${DOMAIN}`} value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin(email, name)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold" style={{ color: "var(--muted)" }}>@{DOMAIN}</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[12.5px] font-bold" style={{ color: "var(--ink-soft)" }}>ชื่อที่แสดง (ครั้งแรกเท่านั้น)</span>
                  <input className="input mt-1.5" placeholder="เช่น Mart, Game, Nut" value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doLogin(email, name)} />
                </label>
                {err && <div className="text-[13px] font-semibold px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>{err}</div>}
                <button className="btn btn-gold w-full !py-3 !text-[15px]" disabled={loading || !email.includes("@")} onClick={() => doLogin(email, name)}>
                  {loading ? <span className="spin inline-flex"><ArrowRight size={17} /></span> : <>เข้าสู่บอร์ด <ArrowRight size={17} /></>}
                </button>
              </div>

              <div className="mt-7">
                <div className="text-[12px] font-bold flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <span className="h-px flex-1" style={{ background: "var(--line)" }} />ทีมเดโม — คลิกเข้าเลย<span className="h-px flex-1" style={{ background: "var(--line)" }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {app.users.filter((u) => ["U-MART", "U-GAME", "U-PLE"].includes(u.id)).map((u) => (
                    <button key={u.id} className="panel !rounded-xl p-3 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md" onClick={() => doLogin(u.email)}>
                      <div className="w-9 h-9 rounded-full mx-auto flex items-center justify-center font-display font-bold text-white text-[13px]" style={{ background: u.color }}>{u.name.slice(0, 2)}</div>
                      <div className="mt-1.5 text-[12.5px] font-bold">{u.name}</div>
                      <div className="text-[10.5px] font-semibold" style={{ color: "var(--muted)" }}>{u.dept} · {u.role === "admin" ? "Admin" : "Member"}</div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function LogoMark({ small }: { small?: boolean }) {
  const s = small ? 34 : 46;
  return (
    <div className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: s, height: s, background: "linear-gradient(150deg,#22375f,#16233f)", boxShadow: "0 4px 14px rgba(0,0,0,.35), inset 0 0 0 1.5px rgba(226,182,78,.5)" }}>
      <svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z" fill="#e2b64e" />
      </svg>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg)" }}>
      <div className="ambient" style={{ background: "radial-gradient(700px 500px at 85% -10%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 70%)" }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
