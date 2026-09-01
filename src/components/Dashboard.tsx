import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Plus, Search, Star, MoreHorizontal, ChevronDown, Globe, Lock, ShieldCheck, FolderKanban,
  Activity, Users, Settings, LogOut, Sun, Moon, Monitor, Trash2, Archive, Copy, Pencil,
  Lightbulb, ThumbsUp, Sparkles, LayoutDashboard, EyeOff, RotateCcw, Building2, CheckCircle2, X,
} from "lucide-react";
import type { Dept, Project, Visibility } from "../types";
import { EMOJIS, KIND_META, PASTELS, TEMPLATES, VIS_META } from "../data";
import { canManage, canView, createProject, currentUser, deleteProject, getState, isAdmin, logout, resetAll, setBoard, setTheme, timeAgo, toggleFavorite, updateProject, updateUser, useApp } from "../store";
import { Avatar, Confirm, EmptyHint, Menu, Modal, Reveal, Switch, toast } from "../ui";
import { LogoMark } from "./Auth";

type Tab = "home" | "activity" | "users" | "settings";

export default function Dashboard({ onOpenBoard }: { onOpenBoard: (id: string) => void }) {
  const app = useApp();
  const me = currentUser();
  const [tab, setTab] = useState<Tab>("home");
  const [rail, setRail] = useState(true);
  const [dept, setDept] = useState<"ALL" | Dept>("ALL");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDel, setConfirmDel] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (!me) return null;
  const myProjects = app.projects.filter((p) => !p.archived && canView(p, me) && (dept === "ALL" || p.dept === dept));
  const pinned = myProjects.filter((p) => p.favoriteBy.includes(me.id));
  const rest = myProjects.filter((p) => !p.favoriteBy.includes(me.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const archived = app.projects.filter((p) => p.archived && canView(p, me));

  const allBoards = app.boards;
  const ideaCount = Object.entries(allBoards).reduce((n, [pid, b]) => {
    const p = app.projects.find((x) => x.id === pid);
    return n + (p && canView(p, me) ? b.items.filter((i) => i.type === "sticky" || i.type === "card").length : 0);
  }, 0);
  const totalVotes = Object.values(allBoards).reduce((n, b) => n + b.items.reduce((m, i) => m + i.votes.length, 0), 0);

  const trending = useMemo(() => {
    const list: { item: any; project: Project }[] = [];
    app.projects.forEach((p) => {
      if (!canView(p, me)) return;
      (allBoards[p.id]?.items || []).forEach((i) => { if (i.votes.length > 0) list.push({ item: i, project: p }); });
    });
    return list.sort((a, b) => b.item.votes.length - a.item.votes.length).slice(0, 5);
  }, [app.projects, allBoards]);

  const searchResults = useMemo(() => {
    if (q.trim().length < 2) return null;
    const ql = q.trim().toLowerCase();
    const projs = app.projects.filter((p) => canView(p, me) && (p.name.toLowerCase().includes(ql) || p.description.toLowerCase().includes(ql))).slice(0, 5);
    const cards: { item: any; project: Project }[] = [];
    app.projects.forEach((p) => {
      if (!canView(p, me)) return;
      (allBoards[p.id]?.items || []).forEach((i) => {
        if ((i.title + " " + i.body + " " + i.tags.join(" ")).toLowerCase().includes(ql)) cards.push({ item: i, project: p });
      });
    });
    return { projs, cards: cards.slice(0, 8) };
  }, [q, app.projects, allBoards]);

  const nav: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "home", label: "หน้าแรก", icon: LayoutDashboard },
    { id: "activity", label: "Activity Log", icon: Activity },
    { id: "users", label: "สมาชิกทีม", icon: Users, adminOnly: true },
    { id: "settings", label: "ตั้งค่า", icon: Settings },
  ];

  const hour = new Date().getHours();
  const greet = hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";

  return (
    <div className="h-screen flex overflow-hidden relative" style={{ background: "var(--bg)" }}>
      <div className="ambient" style={{ background: "radial-gradient(800px 520px at 90% -10%, color-mix(in srgb, var(--gold) 12%, transparent), transparent 70%), radial-gradient(700px 500px at -10% 110%, color-mix(in srgb, var(--navy) 22%, transparent), transparent 70%)" }} />

      {/* ---------- dock rail ---------- */}
      <aside className="relative z-20 flex flex-col m-3 mr-0 rounded-2xl transition-all duration-300"
        style={{ width: rail ? 218 : 74, background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)" }}>
        <div className="flex items-center gap-2.5 px-3.5 h-[62px] border-b" style={{ borderColor: "var(--line)" }}>
          <LogoMark small />
          {rail && (
            <div className="min-w-0">
              <div className="font-display font-extrabold text-[14.5px] leading-tight truncate">MTS <span style={{ color: "var(--gold)" }}>BrainSpace</span></div>
              <div className="text-[9.5px] font-bold tracking-[0.16em] uppercase" style={{ color: "var(--muted)" }}>Gold Group</div>
            </div>
          )}
        </div>
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {nav.filter((n) => !n.adminOnly || isAdmin(me)).map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all"
              style={tab === n.id
                ? { background: "var(--gold-soft)", color: "var(--gold-strong)" }
                : { color: "var(--ink-soft)" }}
              onMouseEnter={(e) => { if (tab !== n.id) (e.currentTarget as HTMLElement).style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { if (tab !== n.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <n.icon size={18} className="shrink-0" />
              {rail && <span className="truncate">{n.label}</span>}
            </button>
          ))}
          {rail && (
            <div className="pt-3 mt-3 border-t" style={{ borderColor: "var(--line)" }}>
              <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>แผนก</div>
              {(["ALL", "OIA", "FIA"] as const).map((d) => (
                <button key={d} onClick={() => { setDept(d); setTab("home"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors"
                  style={{ color: dept === d && tab === "home" ? "var(--ink)" : "var(--muted)", background: dept === d && tab === "home" ? "var(--panel-2)" : "transparent" }}>
                  {d === "ALL" ? <Sparkles size={15} /> : <Building2 size={15} />}
                  {d === "ALL" ? "ทุกแผนก" : d}
                  {d !== "ALL" && <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>{app.projects.filter((p) => p.dept === d && !p.archived && canView(p, me)).length}</span>}
                </button>
              ))}
            </div>
          )}
        </nav>
        <div className="p-2.5 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar user={me} size={32} />
            {rail && (
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold truncate">{me.name}</div>
                <div className="text-[10.5px] font-semibold truncate" style={{ color: "var(--muted)" }}>{me.dept} · {me.role === "admin" ? "Admin" : "Member"}</div>
              </div>
            )}
            {rail && <button className="icon-btn !w-8 !h-8" title="ออกจากระบบ" onClick={() => { logout(); toast("ออกจากระบบแล้ว — เจอกันใหม่ 👋", "info"); }}><LogOut size={15} /></button>}
          </div>
          <button className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11.5px] font-bold transition-colors hover:opacity-80"
            style={{ background: "var(--panel-2)", color: "var(--muted)" }} onClick={() => setRail((r) => !r)}>
            <ChevronDown size={14} className="rotate-90 transition-transform" style={{ transform: rail ? "rotate(90deg)" : "rotate(-90deg)" }} />
            {rail && "พับเมนู"}
          </button>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        {tab === "home" && (
          <div className="px-7 lg:px-10 py-8 max-w-[1400px] mx-auto">
            {/* header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[12.5px] font-bold tracking-wide" style={{ color: "var(--gold-strong)" }}>
                  {dept === "ALL" ? "IDEAS · EXPLORE · DECIDE · BUILD" : `แผนก ${dept}`}
                </div>
                <h1 className="font-display font-extrabold text-[32px] leading-tight mt-1">{greet}, {me.name} 👋</h1>
                <p className="text-[14px] mt-1" style={{ color: "var(--muted)" }}>พร้อมเปลี่ยนไอเดียให้เป็นของจริงหรือยัง? เปิดบอร์ดแล้วโยนความคิดได้เลย</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                  <input className="input !pl-9 !w-[230px]" placeholder="ค้นหาโปรเจกต์, ไอเดีย, แท็ก..." value={q} onChange={(e) => setQ(e.target.value)} />
                  {searchResults && (
                    <div className="menu-panel absolute left-0 right-0 top-full mt-2 max-h-[380px] overflow-y-auto pop-in" style={{ minWidth: 320 }}>
                      {searchResults.projs.length === 0 && searchResults.cards.length === 0 && <div className="p-3 text-[13px]" style={{ color: "var(--muted)" }}>ไม่พบผลลัพธ์ 😢</div>}
                      {searchResults.projs.map((p) => (
                        <button key={p.id} className="menu-item" onClick={() => { onOpenBoard(p.id); setQ(""); }}>
                          <span className="text-[16px]">{p.icon}</span><span className="font-bold">{p.name}</span>
                          <span className="ml-auto chip !text-[10px]">โปรเจกต์</span>
                        </button>
                      ))}
                      {searchResults.cards.map(({ item, project }, i) => (
                        <button key={i} className="menu-item" onClick={() => { onOpenBoard(project.id); setQ(""); }}>
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color === "transparent" ? "#FFE06B" : item.color }} />
                          <span className="truncate">{item.title || item.body.slice(0, 40) || item.emoji}</span>
                          <span className="ml-auto text-[10.5px] font-semibold truncate max-w-[90px]" style={{ color: "var(--muted)" }}>{project.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn btn-gold" onClick={() => setCreating(true)}><Plus size={16} /> โปรเจกต์ใหม่</button>
              </div>
            </div>

            {/* stats strip */}
            <Reveal className="mt-7">
              <div className="panel !rounded-2xl px-7 py-5 flex flex-wrap items-center gap-x-10 gap-y-4">
                {[
                  { n: ideaCount, l: "ไอเดียบนบอร์ด", icon: <Lightbulb size={17} /> },
                  { n: myProjects.length, l: "โปรเจกต์ที่เห็น", icon: <FolderKanban size={17} /> },
                  { n: totalVotes, l: "โหวตทั้งหมด", icon: <ThumbsUp size={17} /> },
                  { n: app.users.filter((u) => u.active).length, l: "สมาชิก Active", icon: <Users size={17} /> },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gold-soft)", color: "var(--gold-strong)" }}>{s.icon}</div>
                    <div>
                      <div className="font-display font-extrabold text-[26px] leading-none tabular-nums">{s.n}</div>
                      <div className="text-[11.5px] font-bold mt-1" style={{ color: "var(--muted)" }}>{s.l}</div>
                    </div>
                  </div>
                ))}
                <div className="ml-auto hidden md:flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                  <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--ok)" }} />
                  เปิดบอร์ดเดียวกัน 2 แท็บเพื่อลองโหมดเรียลไทม์
                </div>
              </div>
            </Reveal>

            <div className="mt-8 grid xl:grid-cols-[1fr_300px] gap-8 items-start">
              <div className="min-w-0">
                {/* pinned */}
                {pinned.length > 0 && (
                  <section>
                    <SectionTitle icon={<Star size={15} />} title="ปักหมุดไว้" count={pinned.length} />
                    <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {pinned.map((p, i) => (
                        <Reveal key={p.id} delay={i * 60}><ProjectCard p={p} me={me} onOpen={() => onOpenBoard(p.id)} onEdit={() => setEditing(p)} onDelete={() => setConfirmDel(p)} /></Reveal>
                      ))}
                    </div>
                  </section>
                )}
                <section className={pinned.length ? "mt-8" : ""}>
                  <SectionTitle icon={<FolderKanban size={15} />} title={dept === "ALL" ? "โปรเจกต์ทั้งหมด" : `โปรเจกต์ ${dept}`} count={rest.length} />
                  {rest.length === 0 && pinned.length === 0 ? (
                    <div className="panel">
                      <EmptyHint icon={<Lightbulb size={24} />} title="ยังไม่มีโปรเจกต์ในมุมมองนี้"
                        sub="สร้างสเปซแรกของคุณ แล้วชวนทีมมาโยนไอเดียกันเลย"
                        action={<button className="btn btn-gold" onClick={() => setCreating(true)}><Plus size={16} /> สร้างโปรเจกต์แรก</button>} />
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {rest.map((p, i) => (
                        <Reveal key={p.id} delay={i * 60}><ProjectCard p={p} me={me} onOpen={() => onOpenBoard(p.id)} onEdit={() => setEditing(p)} onDelete={() => setConfirmDel(p)} /></Reveal>
                      ))}
                    </div>
                  )}
                </section>
                {/* archived */}
                {archived.length > 0 && (
                  <section className="mt-8">
                    <button className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--muted)" }} onClick={() => setShowArchived((s) => !s)}>
                      <Archive size={14} /> เก็บถาวร ({archived.length}) <ChevronDown size={14} className="transition-transform" style={{ transform: showArchived ? "rotate(180deg)" : "" }} />
                    </button>
                    {showArchived && (
                      <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-4 mt-3">
                        {archived.map((p) => (
                          <div key={p.id} className="panel p-4 opacity-70">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[20px]">{p.icon}</span>
                              <div className="min-w-0 flex-1"><div className="font-bold text-[14px] truncate">{p.name}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>เก็บถาวรแล้ว</div></div>
                              {canManage(p, me) && (
                                <button className="btn !py-1.5 !px-2.5 !text-[11.5px]" onClick={() => { updateProject(p.id, { archived: false }, `กู้คืนโปรเจกต์ "${p.name}"`); toast("กู้คืนแล้ว", "ok", "♻️"); }}>
                                  <RotateCcw size={12} /> กู้คืน
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* right rail */}
              <div className="space-y-5 xl:sticky xl:top-0">
                <Reveal delay={120}>
                  <div className="panel p-5">
                    <div className="flex items-center gap-2 font-display font-bold text-[15px]"><span style={{ color: "var(--gold)" }}>🔥</span> ไอเดียมาแรง</div>
                    <div className="mt-3.5 space-y-2.5">
                      {trending.length === 0 && <div className="text-[13px]" style={{ color: "var(--muted)" }}>ยังไม่มีโหวต — เริ่มโหวตไอเดียแรกเลย</div>}
                      {trending.map(({ item, project }, i) => (
                        <button key={i} className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-[var(--panel-2)]" onClick={() => onOpenBoard(project.id)}>
                          <span className="font-display font-extrabold text-[15px] w-5 text-center" style={{ color: i < 3 ? "var(--gold-strong)" : "var(--muted)" }}>{i + 1}</span>
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color === "transparent" ? "#FFE06B" : item.color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold truncate">{item.title || item.body.slice(0, 28) || item.emoji}</span>
                            <span className="block text-[10.5px] font-semibold truncate" style={{ color: "var(--muted)" }}>{project.name}</span>
                          </span>
                          <span className="chip !py-0.5" style={{ color: "var(--gold-strong)", borderColor: "color-mix(in srgb, var(--gold) 40%, transparent)" }}><ThumbsUp size={11} /> {item.votes.length}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Reveal>
                <Reveal delay={200}>
                  <div className="panel p-5">
                    <div className="flex items-center gap-2 font-display font-bold text-[15px]"><Activity size={15} style={{ color: "var(--gold)" }} /> ความเคลื่อนไหวล่าสุด</div>
                    <div className="mt-3.5 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                      {app.logs.filter((l) => l.projectId !== "SYSTEM" && app.projects.some((p) => p.id === l.projectId && canView(p, me))).slice(0, 8).map((l) => (
                        <div key={l.id} className="flex gap-2.5">
                          <Avatar user={{ name: l.userName, color: l.userColor }} size={26} />
                          <div className="min-w-0">
                            <div className="text-[12.5px] leading-snug"><b>{l.userName}</b> {l.text}</div>
                            <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(l.at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-ghost w-full mt-3 !text-[12.5px]" onClick={() => setTab("activity")}>ดู Log ทั้งหมด →</button>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        )}

        {tab === "activity" && <ActivityPage me={me} />}
        {tab === "users" && (isAdmin(me) ? <UsersPage me={me} /> : (
          <div className="p-10 max-w-md mx-auto"><EmptyHint icon={<Lock size={22} />} title="เฉพาะ Admin" sub="หน้าจัดการสมาชิกสงวนไว้สำหรับผู้ดูแลระบบเท่านั้น" /></div>
        ))}
        {tab === "settings" && <SettingsPage me={me} />}
      </main>

      <ProjectModal open={creating} onClose={() => setCreating(false)} me={me} onCreated={(p) => { setCreating(false); onOpenBoard(p.id); confetti({ particleCount: 130, spread: 75, origin: { y: 0.7 }, colors: ["#e2b64e", "#FFE06B", "#A9E8C5", "#A5D8F6", "#FFB59E"] }); }} />
      {editing && <ProjectModal open onClose={() => setEditing(null)} me={me} existing={editing} onCreated={() => setEditing(null)} />}
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} title="ลบโปรเจกต์ถาวร?"
        body={`"${confirmDel?.name}" และการ์ดทั้งหมดจะถูกลบถาวร พร้อมบันทึกใน Log ว่าใครลบ`}
        yesLabel="ลบถาวร" onYes={() => { if (confirmDel) { deleteProject(confirmDel.id); toast("ลบโปรเจกต์แล้ว", "ok", "🗑️"); } }} />
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3.5">
      <span style={{ color: "var(--gold-strong)" }}>{icon}</span>
      <h2 className="font-display font-bold text-[16px]">{title}</h2>
      <span className="chip !text-[10.5px]">{count}</span>
    </div>
  );
}

/* ================= project card ================= */
function ProjectCard({ p, me, onOpen, onEdit, onDelete }: { p: Project; me: any; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const app = useApp();
  const board = app.boards[p.id];
  const ideas = board ? board.items.filter((i) => i.type === "sticky" || i.type === "card").length : 0;
  const members = p.visibility === "public" ? app.users.filter((u) => u.active).length : p.members.length + 1;
  const fav = p.favoriteBy.includes(me.id);
  const vis = VIS_META[p.visibility];
  const VisIcon = p.visibility === "public" ? Globe : p.visibility === "private" ? Lock : ShieldCheck;
  return (
    <motion.div whileHover={{ y: -4 }} className="panel overflow-hidden cursor-pointer group relative" style={{ borderRadius: 16 }}
      onClick={onOpen} transition={{ type: "spring", stiffness: 380, damping: 26 }}>
      <div className="relative h-[86px] overflow-hidden" style={{ background: p.color }}>
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.14) 1.1px, transparent 1.1px)", backgroundSize: "18px 18px" }} />
        <div className="absolute -right-4 -top-7 w-24 h-24 rounded-2xl rotate-12 opacity-60" style={{ background: "rgba(255,255,255,.55)" }} />
        <div className="absolute right-10 top-6 w-10 h-10 rounded-lg -rotate-6 opacity-50 wiggle" style={{ background: "rgba(255,255,255,.7)" }} />
        <span className="absolute left-4 bottom-2.5 text-[30px] drop-shadow-sm">{p.icon}</span>
        <span className="absolute right-3 bottom-2.5 chip !bg-white/75 !border-white/40 !text-[10.5px]" style={{ color: "#2b2b26" }}>
          <VisIcon size={11} style={{ color: vis.tone }} /> {vis.label}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-[15px] truncate group-hover:underline decoration-2 underline-offset-4" style={{ textDecorationColor: "var(--gold)" }}>{p.name}</div>
            <div className="text-[12px] mt-0.5 line-clamp-2 leading-snug" style={{ color: "var(--muted)" }}>{p.description || "ไม่มีคำอธิบาย"}</div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn !w-8 !h-8" onClick={() => { toggleFavorite(p.id, me.id); }} style={fav ? { color: "var(--gold-strong)", opacity: 1 } : undefined} title="ปักหมุด">
              <Star size={15} fill={fav ? "currentColor" : "none"} />
            </button>
            <Menu button={() => <button className="icon-btn !w-8 !h-8"><MoreHorizontal size={16} /></button>}>
              {(close) => (
                <>
                  <button className="menu-item" onClick={() => { close(); onOpen(); }}>🗂️ เปิดบอร์ด</button>
                  {canManage(p, me) && <button className="menu-item" onClick={() => { close(); onEdit(); }}><Pencil size={14} /> แก้ไข / สิทธิ์</button>}
                  <button className="menu-item" onClick={() => { close(); duplicate(p, me); }}><Copy size={14} /> ทำสำเนา</button>
                  {canManage(p, me) && (
                    <>
                      <button className="menu-item" onClick={() => { close(); updateProject(p.id, { archived: true }, `เก็บถาวร "${p.name}"`); toast("เก็บถาวรแล้ว", "ok", "📦"); }}><Archive size={14} /> เก็บถาวร</button>
                      <button className="menu-item danger" onClick={() => { close(); onDelete(); }}><Trash2 size={14} /> ลบถาวร</button>
                    </>
                  )}
                </>
              )}
            </Menu>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
          <span className="flex items-center gap-1"><Lightbulb size={12} style={{ color: "var(--gold-strong)" }} /> {ideas} ไอเดีย</span>
          <span className="flex items-center gap-1"><Users size={12} /> {members} คน</span>
          <span className="chip !text-[10px] !py-0">{p.dept}</span>
          <span className="ml-auto">{timeAgo(p.updatedAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function duplicate(p: Project, me: any) {
  const src = getState().boards[p.id];
  const np = createProject(
    { name: `${p.name} (สำเนา)`, description: p.description, dept: p.dept, visibility: p.visibility, members: p.members, icon: p.icon, color: p.color, template: "blank" },
    me
  );
  if (src) setBoard(np.id, JSON.parse(JSON.stringify(src)));
  toast("ทำสำเนาแล้ว 📄", "ok");
}

/* ================= project create/edit modal ================= */
function ProjectModal({ open, onClose, me, existing, onCreated }: { open: boolean; onClose: () => void; me: any; existing?: Project; onCreated: (p: Project) => void }) {
  const app = useApp();
  const [name, setName] = useState(existing?.name || "");
  const [desc, setDesc] = useState(existing?.description || "");
  const [dept, setDept] = useState<Dept>(existing?.dept || me.dept);
  const [vis, setVis] = useState<Visibility>(existing?.visibility || "public");
  const [members, setMembers] = useState<string[]>(existing?.members || []);
  const [icon, setIcon] = useState(existing?.icon || "🧠");
  const [color, setColor] = useState(existing?.color || PASTELS[0]);
  const [tpl, setTpl] = useState("blank");
  const [memberQ, setMemberQ] = useState("");

  const submit = () => {
    if (!name.trim()) { toast("ตั้งชื่อโปรเจกต์ก่อนนะ", "warn", "✏️"); return; }
    if (existing) {
      updateProject(existing.id, { name, description: desc, dept, visibility: vis, members: vis === "private" ? members : [], icon, color }, `แก้ไขโปรเจกต์ "${name}"`);
      toast("บันทึกการแก้ไขแล้ว", "ok", "✅");
      onCreated(existing);
      return;
    }
    const p = createProject({ name, description: desc, dept, visibility: vis, members: vis === "private" ? members : [], icon, color, template: tpl }, me);
    toast(`สร้าง "${p.name}" แล้ว 🎉`, "ok");
    onCreated(p);
  };

  const filteredUsers = app.users.filter((u) => u.id !== me.id && u.name.toLowerCase().includes(memberQ.toLowerCase()));

  return (
    <Modal open={open} onClose={onClose} width={600} title={existing ? "แก้ไขโปรเจกต์" : "สร้างสเปซใหม่"} icon={<span className="text-[20px]">{icon}</span>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_130px] gap-3">
          <label className="block">
            <span className="text-[12.5px] font-bold">ชื่อโปรเจกต์ *</span>
            <input className="input mt-1.5" placeholder="เช่น AI Reconciliation" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-bold">แผนก</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(["OIA", "FIA"] as Dept[]).map((d) => (
                <button key={d} className="btn !py-[9px] !px-2" style={dept === d ? { background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold-strong)" } : {}} onClick={() => setDept(d)}>{d}</button>
              ))}
            </div>
          </label>
        </div>
        <label className="block">
          <span className="text-[12.5px] font-bold">คำอธิบาย</span>
          <textarea className="input mt-1.5 min-h-[64px] resize-none" placeholder="โปรเจกต์นี้เกี่ยวกับอะไร..." value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>

        {/* visibility */}
        <div>
          <span className="text-[12.5px] font-bold">สิทธิ์การเข้าถึง</span>
          <div className="mt-1.5 grid sm:grid-cols-3 gap-2">
            {(Object.keys(VIS_META) as Visibility[]).map((v) => {
              const Ic = v === "public" ? Globe : v === "private" ? Lock : ShieldCheck;
              return (
                <button key={v} className="p-3 rounded-xl text-left transition-all" onClick={() => setVis(v)}
                  style={{ border: `1.5px solid ${vis === v ? VIS_META[v].tone : "var(--line)"}`, background: vis === v ? `color-mix(in srgb, ${VIS_META[v].tone} 10%, var(--panel))` : "var(--panel-2)" }}>
                  <div className="flex items-center gap-1.5 font-bold text-[13px]"><Ic size={14} style={{ color: VIS_META[v].tone }} /> {VIS_META[v].label}</div>
                  <div className="text-[10.5px] mt-1 leading-snug font-medium" style={{ color: "var(--muted)" }}>{VIS_META[v].th}</div>
                </button>
              );
            })}
          </div>
        </div>

        {vis === "private" && (
          <div className="fade-up rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold">สมาชิกที่มองเห็น ({members.length})</span>
              <input className="input !w-[150px] !py-1.5 !text-[12px]" placeholder="ค้นหา..." value={memberQ} onChange={(e) => setMemberQ(e.target.value)} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
              {filteredUsers.map((u) => {
                const on = members.includes(u.id);
                return (
                  <button key={u.id} className="chip !py-1.5 transition-all" onClick={() => setMembers((m) => on ? m.filter((x) => x !== u.id) : [...m, u.id])}
                    style={on ? { background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold-strong)" } : {}}>
                    {on ? <CheckCircle2 size={12} /> : <Plus size={12} />} {u.name} <span className="opacity-60">· {u.dept}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* icon + color */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[12.5px] font-bold">ไอคอน</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["🧠", "🤖", "🎫", "🔥", "💡", "🚀", "📊", "🔁", "🎯", "💰", "🧪", "📌"].map((e) => (
                <button key={e} className="w-9 h-9 rounded-lg text-[17px] flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: icon === e ? "var(--gold-soft)" : "var(--panel-2)", boxShadow: icon === e ? "inset 0 0 0 1.5px var(--gold)" : undefined }}
                  onClick={() => setIcon(e)}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[12.5px] font-bold">สีปก</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PASTELS.slice(0, 6).map((c) => (
                <button key={c} className="w-9 h-9 rounded-lg transition-transform hover:scale-110" style={{ background: c, boxShadow: color === c ? "inset 0 0 0 2.5px var(--gold-strong)" : "inset 0 0 0 1px rgba(0,0,0,.08)" }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>

        {/* template */}
        {!existing && (
          <div>
            <span className="text-[12.5px] font-bold">เทมเพลตเริ่มต้น</span>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} className="p-2.5 rounded-xl text-left transition-all" onClick={() => setTpl(t.id)}
                  style={{ border: `1.5px solid ${tpl === t.id ? "var(--gold)" : "var(--line)"}`, background: tpl === t.id ? "var(--gold-soft)" : "var(--panel-2)" }}>
                  <div className="text-[17px]">{t.icon}</div>
                  <div className="font-bold text-[12.5px] mt-1">{t.name}</div>
                  <div className="text-[10px] leading-snug font-medium mt-0.5" style={{ color: "var(--muted)" }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-gold" onClick={submit}>{existing ? "บันทึกการแก้ไข" : "สร้างโปรเจกต์ →"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ================= activity page ================= */
function ActivityPage({ me }: { me: any }) {
  const app = useApp();
  const [projF, setProjF] = useState("ALL");
  const [typeF, setTypeF] = useState("ALL");
  const types = ["PROJECT_CREATED", "PROJECT_UPDATED", "CARD_CREATED", "CARD_UPDATED", "CARD_MOVED", "CARD_DELETED", "COMMENT_ADDED", "VOTE_ADDED", "CONNECTION_CREATED", "DRAW", "USER_JOINED", "USER_UPDATED"];
  const logs = app.logs.filter((l) =>
    (projF === "ALL" || l.projectId === projF) &&
    (typeF === "ALL" || l.type === typeF) &&
    (l.projectId === "SYSTEM" || app.projects.some((p) => p.id === l.projectId && canView(p, me)))
  );
  return (
    <div className="px-7 lg:px-10 py-8 max-w-[900px]">
      <h1 className="font-display font-extrabold text-[26px]">Activity Log</h1>
      <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>ทุกการแก้ไขถูกบันทึกพร้อมชื่อผู้กระทำ — ไม่มีใครแก้เงียบ ๆ</p>
      <div className="flex flex-wrap gap-2 mt-5">
        <select className="input !w-auto" value={projF} onChange={(e) => setProjF(e.target.value)}>
          <option value="ALL">ทุกโปรเจกต์</option>
          {app.projects.filter((p) => canView(p, me)).map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
          <option value="SYSTEM">🔧 ระบบ</option>
        </select>
        <select className="input !w-auto" value={typeF} onChange={(e) => setTypeF(e.target.value)}>
          <option value="ALL">ทุกเหตุการณ์</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="chip self-center">{logs.length} รายการ</span>
      </div>
      <div className="panel mt-5 divide-y" style={{ borderColor: "var(--line)" }}>
        {logs.length === 0 && <EmptyHint icon={<Activity size={22} />} title="ไม่มีรายการตามเงื่อนไข" />}
        {logs.slice(0, 60).map((l) => {
          const proj = app.projects.find((p) => p.id === l.projectId);
          return (
            <div key={l.id} className="flex gap-3.5 px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
              <Avatar user={{ name: l.userName, color: l.userColor }} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] leading-snug"><b>{l.userName}</b> {l.text} {proj && <span className="chip !text-[10px] ml-1">{proj.icon} {proj.name}</span>}</div>
                {(l.before || l.after) && (
                  <div className="mt-1.5 grid sm:grid-cols-2 gap-1.5 text-[11.5px]">
                    {l.before !== undefined && <div className="px-2.5 py-1.5 rounded-lg line-through" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)", color: "var(--muted)" }}>{l.before}</div>}
                    {l.after !== undefined && <div className="px-2.5 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--ok) 10%, transparent)" }}>{l.after}</div>}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>
                  <span className="chip !text-[9.5px] !py-0 !px-1.5">{l.type}</span> {timeAgo(l.at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= users page ================= */
function UsersPage({ me }: { me: any }) {
  const app = useApp();
  return (
    <div className="px-7 lg:px-10 py-8 max-w-[900px]">
      <h1 className="font-display font-extrabold text-[26px]">สมาชิกทีม <span className="chip !text-[12px] align-middle">@mtsgoldgroup.com</span></h1>
      <p className="text-[13.5px] mt-1" style={{ color: "var(--muted)" }}>
        เทียบกับชีต USERS ใน Google Sheets — คนที่ล็อกอินครั้งแรกจะถูกบันทึกอัตโนมัติ แล้ว Admin เปิด/ปิดสิทธิ์ (active) ได้ที่นี่
      </p>
      <div className="panel mt-5 overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_110px_90px] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--panel-2)" }}>
          <span>ผู้ใช้</span><span>แผนก</span><span>สิทธิ์</span><span className="text-center">Active</span>
        </div>
        {app.users.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_110px_110px_90px] gap-3 px-5 py-3.5 items-center border-b last:border-0" style={{ borderColor: "var(--line)", opacity: u.active ? 1 : 0.55 }}>
            <div className="flex items-center gap-3 min-w-0">
              <Avatar user={u} size={34} />
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold flex items-center gap-1.5">{u.name} {u.id === me.id && <span className="chip !text-[9px] !py-0">คุณ</span>}{u.role === "admin" && <span className="chip !text-[9px] !py-0" style={{ color: "var(--gold-strong)" }}>👑 Admin</span>}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{u.email}</div>
              </div>
            </div>
            <select className="input !py-1.5 !text-[12.5px]" value={u.dept} disabled={u.id === me.id}
              onChange={(e) => { updateUser(u.id, { dept: e.target.value as any }, `เปลี่ยนแผนก ${u.name} → ${e.target.value}`); toast(`ย้าย ${u.name} ไป ${e.target.value}`, "ok"); }}>
              <option value="OIA">OIA</option><option value="FIA">FIA</option>
            </select>
            <select className="input !py-1.5 !text-[12.5px]" value={u.role} disabled={u.id === me.id}
              onChange={(e) => { updateUser(u.id, { role: e.target.value as any }, `เปลี่ยนสิทธิ์ ${u.name} → ${e.target.value}`); toast("อัปเดตสิทธิ์แล้ว", "ok"); }}>
              <option value="member">Member</option><option value="admin">Admin</option>
            </select>
            <div className="flex justify-center">
              <Switch on={u.active} disabled={u.id === me.id} onChange={(v) => { updateUser(u.id, { active: v }, `${v ? "เปิด" : "ปิด"}ใช้งาน ${u.name}`); toast(v ? `เปิดใช้งาน ${u.name}` : `ระงับ ${u.name}`, v ? "ok" : "warn"); }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] mt-3 font-medium flex items-center gap-1.5" style={{ color: "var(--muted)" }}><X size={12} /> ผู้ใช้ active = false จะเข้าระบบไม่ได้ (ขึ้นหน้า "บัญชีถูกระงับ")</p>
    </div>
  );
}

/* ================= settings page ================= */
function SettingsPage({ me }: { me: any }) {
  const app = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const themeOpts = [
    { id: "light", label: "สว่าง", icon: <Sun size={18} /> },
    { id: "dark", label: "มืด", icon: <Moon size={18} /> },
    { id: "system", label: "ตามระบบ", icon: <Monitor size={18} /> },
  ] as const;
  return (
    <div className="px-7 lg:px-10 py-8 max-w-[760px]">
      <h1 className="font-display font-extrabold text-[26px]">ตั้งค่า</h1>
      <div className="panel mt-5 p-5">
        <div className="font-display font-bold text-[15px] mb-3">ธีมหน้าจอ <span className="chip !text-[10px] ml-1">ค่าเริ่มต้น: ตามระบบ</span></div>
        <div className="grid grid-cols-3 gap-2.5 max-w-sm">
          {themeOpts.map((t) => (
            <button key={t.id} className="p-3.5 rounded-xl text-center transition-all" onClick={() => { setTheme(t.id); toast(`เปลี่ยนธีมเป็น${t.label}`, "ok", "🎨"); }}
              style={{ border: `1.5px solid ${app.theme === t.id ? "var(--gold)" : "var(--line)"}`, background: app.theme === t.id ? "var(--gold-soft)" : "var(--panel-2)" }}>
              <span className="inline-flex" style={{ color: app.theme === t.id ? "var(--gold-strong)" : "var(--muted)" }}>{t.icon}</span>
              <div className="text-[12.5px] font-bold mt-1.5">{t.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="panel mt-4 p-5">
        <div className="font-display font-bold text-[15px] mb-3">บัญชีของฉัน</div>
        <div className="flex items-center gap-3.5">
          <Avatar user={me} size={46} />
          <div>
            <div className="font-bold text-[15px]">{me.name} {me.role === "admin" && <span style={{ color: "var(--gold-strong)" }}>👑</span>}</div>
            <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>{me.email} · แผนก {me.dept}</div>
          </div>
        </div>
      </div>
      <div className="panel mt-4 p-5" style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, var(--line))" }}>
        <div className="font-display font-bold text-[15px] mb-1.5" style={{ color: "var(--danger)" }}>โซนอันตราย</div>
        <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>ล้างข้อมูลเดโมทั้งหมดแล้วเริ่มต้นใหม่ (ผู้ใช้, โปรเจกต์, การ์ด, log)</p>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> รีเซ็ตข้อมูลเดโม</button>
          <button className="btn btn-danger" onClick={() => { localStorage.clear(); location.reload(); }}><LogOut size={14} /> ออกจากระบบ</button>
        </div>
      </div>
      <p className="text-[11.5px] mt-5 leading-relaxed" style={{ color: "var(--muted)" }}>
        💡 เวอร์ชันนี้รันข้อมูลในเบราว์เซอร์ (localStorage + BroadcastChannel) เพื่อเดโมครบทุกฟีเจอร์ — โครงสร้าง store ถูกออกแบบให้สลับไปเรียก <b>google.script.run</b> บน Google Apps Script ได้ทันที ดู schema ชีตได้ในโฟลเดอร์ <code className="chip !text-[10px]">appscript/</code>
      </p>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="รีเซ็ตข้อมูลเดโม?" body="ข้อมูลปัจจุบันทั้งหมดจะหาย แล้วกลับเป็นข้อมูลตัวอย่างชุดแรก" yesLabel="รีเซ็ตเลย" onYes={() => { resetAll(); toast("รีเซ็ตเรียบร้อย", "ok", "♻️"); }} />
    </div>
  );
}
