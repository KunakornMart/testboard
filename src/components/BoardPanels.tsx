import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X, ThumbsUp, MessageCircle, History, Tag, Palette, Download, Copy, Check, Globe, Lock,
  ShieldCheck, UserPlus, Trash2, Archive, RotateCcw, Link2, Sparkles, StickyNote, Layers,
  Image as ImageIcon, Keyboard, Send,
} from "lucide-react";
import type { Board, Item, ItemKind, Project, User, Visibility } from "../types";
import { KIND_META, PASTELS, VIS_META } from "../data";
import { addLog, canManage, deleteProject, getState, setBoard, sendChat, timeAgo, fullTime, updateProject, useApp } from "../store";
import { Avatar, Modal, Switch, toast } from "../ui";
import { copyCanvas, downloadCanvas, renderBoard, computeBounds } from "../exporter";

/* ---------- shared: patch item with log/version ---------- */
function patchItem(projectId: string, itemId: string, patch: Partial<Item>, me: User, logText: string, opts: { version?: { field: "title" | "body"; before: string; after: string }; type?: string } = {}) {
  const b0 = getState().boards[projectId]; if (!b0) return;
  const b: Board = JSON.parse(JSON.stringify(b0));
  const it = b.items.find((i) => i.id === itemId); if (!it) return;
  Object.assign(it, patch);
  it.editedBy = me.id; it.editedByName = me.name; it.editedAt = Date.now();
  if (opts.version) it.versions.push({ at: Date.now(), by: me.id, byName: me.name, ...opts.version });
  setBoard(projectId, b);
  addLog({ projectId, type: opts.type || "CARD_UPDATED", userId: me.id, userName: me.name, userColor: me.color, text: logText, before: opts.version?.before.slice(0, 90), after: opts.version?.after.slice(0, 90), objectId: itemId });
}

/* ================= CardDrawer ================= */
export function CardDrawer({ projectId, itemId, onClose, onDeleted }: { projectId: string; itemId: string; onClose: () => void; onDeleted: () => void }) {
  const app = useApp();
  const me = app.users.find((u) => u.id === app.sessionUserId)!;
  const board = app.boards[projectId];
  const item = board?.items.find((i) => i.id === itemId);
  const [tab, setTab] = useState<"comment" | "history">("comment");
  const [comment, setComment] = useState("");
  const [tagInput, setTagInput] = useState("");
  const me2 = me;

  if (!item || !board) return null;
  const meta = item.kind ? KIND_META[item.kind] : null;
  const myVote = item.votes.includes(me.id);
  const voters = item.votes.map((v) => app.users.find((u) => u.id === v)).filter(Boolean) as User[];
  const logs = app.logs.filter((l) => l.objectId === itemId).slice(0, 20);
  const patch = (p: Partial<Item>, logText: string, o?: Parameters<typeof patchItem>[5]) => patchItem(projectId, itemId, p, me2, logText, o);

  const setField = (field: "title" | "body", v: string) => {
    if (item[field] === v) return;
    patch({ [field]: v } as any, `แก้ไข${field === "title" ? "หัวข้อ" : "เนื้อหา"}การ์ด`, { version: { field, before: item[field], after: v } });
  };

  const addCommentNow = () => {
    if (!comment.trim()) return;
    patch({ comments: [...item.comments, { id: `COM-${Date.now()}`, userId: me.id, name: me.name, color: me.color, text: comment.trim(), at: Date.now() }] }, `คอมเมนต์ในการ์ด "${(item.title || item.body).slice(0, 24) || "การ์ด"}"`, { type: "COMMENT_ADDED" });
    setComment("");
  };

  return (
    <motion.div initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="absolute z-50 top-[58px] right-0 bottom-0 w-full sm:w-[370px] flex flex-col"
      style={{ background: "var(--panel)", borderLeft: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
      {/* header */}
      <div className="flex items-center gap-2 px-4 h-[50px] border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <span className="w-3 h-3 rounded-sm" style={{ background: meta?.color || item.color }} />
        <span className="font-display font-bold text-[14px] flex-1 truncate">รายละเอียดการ์ด</span>
        <span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>{item.id}</span>
        <button className="icon-btn !w-8 !h-8" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* kind */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>ประเภทการ์ด</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND_META) as ItemKind[]).map((k) => (
              <button key={k} className="chip !py-1.5 transition-all" onClick={() => patch({ kind: k }, `เปลี่ยนประเภทเป็น "${KIND_META[k].label}"`)}
                style={item.kind === k ? { background: KIND_META[k].color, borderColor: "transparent", color: "#2b2b26" } : {}}>
                {KIND_META[k].label}
              </button>
            ))}
            {item.type === "sticky" && (
              <button className="chip !py-1.5" onClick={() => patch({ type: "card", kind: item.kind || "idea", w: Math.max(item.w, 240), h: Math.max(item.h, 150) }, "แปลงสติ๊กกี้เป็นการ์ด")}><Layers size={11} /> แปลงเป็นการ์ด</button>
            )}
            {item.type === "card" && (
              <button className="chip !py-1.5" onClick={() => patch({ type: "sticky", w: Math.max(150, Math.min(item.w, 220)), h: Math.max(150, Math.min(item.h, 220)) }, "แปลงการ์ดเป็นสติ๊กกี้")}><StickyNote size={11} /> แปลงเป็นสติ๊กกี้</button>
            )}
          </div>
        </div>

        {/* title + body */}
        {item.type === "card" && (
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>หัวข้อ</span>
            <input className="input mt-1 font-bold" defaultValue={item.title} key={`t-${item.versions.length}-${item.editedAt || 0}`}
              onBlur={(e) => setField("title", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          </label>
        )}
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>เนื้อหา</span>
          <textarea className="input mt-1 min-h-[90px] resize-y leading-relaxed" defaultValue={item.body} key={`b-${item.versions.length}-${item.editedAt || 0}`}
            onBlur={(e) => setField("body", e.target.value)} />
        </label>

        {/* color */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Palette size={11} /> สีการ์ด</div>
          <div className="flex gap-1.5">
            {PASTELS.slice(0, 7).map((c) => (
              <button key={c} className="w-8 h-8 rounded-lg transition-transform hover:scale-110" style={{ background: c, boxShadow: item.color === c ? "inset 0 0 0 2.5px var(--gold-strong)" : "inset 0 0 0 1px rgba(0,0,0,.1)" }}
                onClick={() => patch({ color: c }, "เปลี่ยนสีการ์ด")} />
            ))}
          </div>
        </div>

        {/* tags */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Tag size={11} /> แท็ก</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {item.tags.map((t) => (
              <span key={t} className="chip !py-1" style={{ background: "var(--panel-2)" }}>#{t}
                <button className="hover:opacity-60" onClick={() => patch({ tags: item.tags.filter((x) => x !== t) }, `ลบแท็ก #${t}`)}><X size={10} /></button>
              </span>
            ))}
            <input className="input !w-[110px] !py-1 !text-[12px]" placeholder="เพิ่มแท็ก + Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  const t = tagInput.trim().replace(/^#/, "");
                  if (!item.tags.includes(t)) patch({ tags: [...item.tags, t] }, `เพิ่มแท็ก #${t}`, { type: "TAG_ADDED" });
                  setTagInput("");
                }
              }} />
          </div>
        </div>

        {/* votes */}
        <div className="rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
          <div className="flex items-center gap-2.5">
            <button className="btn !py-2" style={myVote ? { background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold-strong)" } : {}}
              onClick={() => patch({ votes: myVote ? item.votes.filter((v) => v !== me.id) : [...item.votes, me.id] }, `${myVote ? "เลิกโหวต" : "โหวตให้"}การ์ดนี้`, { type: myVote ? "VOTE_REMOVED" : "VOTE_ADDED" })}>
              <ThumbsUp size={15} fill={myVote ? "currentColor" : "none"} /> {myVote ? "โหวตแล้ว" : "โหวต"}
            </button>
            <div className="flex -space-x-1.5">
              {voters.slice(0, 6).map((v) => <Avatar key={v.id} user={v} size={24} ring />)}
            </div>
            <span className="ml-auto font-display font-extrabold text-[18px]" style={{ color: "var(--gold-strong)" }}>{item.votes.length}</span>
          </div>
        </div>

        {/* attribution */}
        <div className="text-[12px] space-y-1.5 rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
          <div className="flex items-center gap-2"><span className="font-bold" style={{ color: "var(--muted)" }}>สร้างโดย</span>
            <Avatar user={{ name: item.authorName, color: item.authorColor }} size={20} /> <b>{item.authorName}</b></div>
          <div className="flex items-center gap-2"><span className="font-bold" style={{ color: "var(--muted)" }}>แก้ไขล่าสุด</span>
            {item.editedByName ? <><Avatar user={{ name: item.editedByName, color: app.users.find((u) => u.id === item.editedBy)?.color || "#888" }} size={20} /> <b>{item.editedByName}</b> · {item.editedAt ? fullTime(item.editedAt) : ""}</> : <span style={{ color: "var(--muted)" }}>ยังไม่เคยแก้</span>}
          </div>
        </div>

        {/* tabs */}
        <div>
          <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "var(--panel-2)" }}>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all" style={tab === "comment" ? { background: "var(--panel)", boxShadow: "var(--shadow-sm)" } : { color: "var(--muted)" }} onClick={() => setTab("comment")}>
              <MessageCircle size={13} /> ความคิดเห็น ({item.comments.length})
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all" style={tab === "history" ? { background: "var(--panel)", boxShadow: "var(--shadow-sm)" } : { color: "var(--muted)" }} onClick={() => setTab("history")}>
              <History size={13} /> ประวัติ ({item.versions.length})
            </button>
          </div>

          {tab === "comment" ? (
            <div className="space-y-3">
              {item.comments.length === 0 && <div className="text-[12.5px] text-center py-4" style={{ color: "var(--muted)" }}>ยังไม่มีความคิดเห็น — เริ่มคุยเลย 💬</div>}
              {item.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar user={{ name: c.name, color: c.color }} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{c.name} · {timeAgo(c.at)}</div>
                    <div className="text-[13px] leading-snug mt-0.5">{c.text}</div>
                  </div>
                  {c.userId === me.id && (
                    <button className="icon-btn !w-7 !h-7 self-center" title="ลบคอมเมนต์" onClick={() => patch({ comments: item.comments.filter((x) => x.id !== c.id) }, "ลบคอมเมนต์", { type: "COMMENT_DELETED" })}><X size={12} /></button>
                  )}
                </div>
              ))}
              <div className="flex gap-1.5 pt-1">
                <input className="input !py-2" placeholder="เขียนความคิดเห็น..." value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCommentNow()} />
                <button className="btn btn-gold !px-3" onClick={addCommentNow}><Send size={14} /></button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {item.versions.length === 0 && <div className="text-[12.5px] text-center py-4" style={{ color: "var(--muted)" }}>ยังไม่มีการแก้ไขเนื้อหา — ทุกเวอร์ชันจะถูกเก็บที่นี่ กู้คืนได้เหมือน Google Docs</div>}
              {[...item.versions].reverse().map((v, i) => (
                <div key={i} className="rounded-xl p-3 text-[12px]" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <div className="flex items-center gap-2 font-bold">
                    <Avatar user={{ name: v.byName, color: app.users.find((u) => u.id === v.by)?.color || "#888" }} size={20} />
                    {v.byName} แก้ไข{v.field === "title" ? "หัวข้อ" : "เนื้อหา"}
                    <span className="ml-auto font-normal" style={{ color: "var(--muted)" }}>{fullTime(v.at)}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="px-2 py-1 rounded-md line-through" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)", color: "var(--muted)" }}>{v.before || "(ว่าง)"}</div>
                    <div className="px-2 py-1 rounded-md" style={{ background: "color-mix(in srgb, var(--ok) 10%, transparent)" }}>{v.after || "(ว่าง)"}</div>
                  </div>
                  <button className="btn !py-1 !px-2.5 !text-[11px] mt-2" onClick={() => {
                    patch({ [v.field]: v.before } as any, `กู้คืนเวอร์ชันก่อนหน้า (${v.field === "title" ? "หัวข้อ" : "เนื้อหา"})`, { version: { field: v.field, before: item[v.field], after: v.before } });
                    toast("กู้คืนเวอร์ชันแล้ว", "ok", "⏪");
                  }}><RotateCcw size={11} /> กู้คืนเวอร์ชันนี้</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div className="p-3 border-t flex gap-2 shrink-0" style={{ borderColor: "var(--line)" }}>
        <button className="btn flex-1" onClick={() => { toast("คัดลอกลิงก์การ์ดแล้ว", "ok", "🔗"); try { navigator.clipboard.writeText(`https://brainspace.mtsgoldgroup.com/#${projectId}/${itemId}`); } catch { /* noop */ } }}><Link2 size={14} /> คัดลอกลิงก์</button>
        <button className="btn btn-danger" onClick={() => {
          const b: Board = JSON.parse(JSON.stringify(board));
          b.items = b.items.filter((i) => i.id !== itemId);
          b.connectors = b.connectors.filter((c) => c.from !== itemId && c.to !== itemId);
          setBoard(projectId, b);
          addLog({ projectId, type: "CARD_DELETED", userId: me.id, userName: me.name, userColor: me.color, text: `ลบการ์ด "${(item.title || item.body).slice(0, 24) || "การ์ด"}"`, objectId: itemId });
          onDeleted(); toast("ลบการ์ดแล้ว", "ok", "🗑️");
        }}><Trash2 size={14} /> ลบ</button>
      </div>
    </motion.div>
  );
}

/* ================= ActivityDrawer ================= */
export function ActivityDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const app = useApp();
  const [typeF, setTypeF] = useState("ALL");
  const logs = app.logs.filter((l) => l.projectId === projectId && (typeF === "ALL" || l.type === typeF));
  const types = useMemo(() => [...new Set(app.logs.filter((l) => l.projectId === projectId).map((l) => l.type))], [app.logs, projectId]);
  return (
    <motion.div initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="absolute z-40 top-[58px] right-0 bottom-0 w-full sm:w-[340px] flex flex-col"
      style={{ background: "var(--panel)", borderLeft: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
      <div className="flex items-center gap-2 px-4 h-[50px] border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <History size={16} style={{ color: "var(--gold-strong)" }} />
        <span className="font-display font-bold text-[14px] flex-1">Activity · ใครแก้อะไร</span>
        <button className="icon-btn !w-8 !h-8" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="px-4 py-2.5 border-b flex gap-1.5 overflow-x-auto shrink-0" style={{ borderColor: "var(--line)" }}>
        {["ALL", ...types].map((t) => (
          <button key={t} className="chip shrink-0 !py-1" onClick={() => setTypeF(t)}
            style={typeF === t ? { background: "var(--gold-soft)", color: "var(--gold-strong)", borderColor: "var(--gold)" } : {}}>{t === "ALL" ? "ทั้งหมด" : t.replace(/_/g, " ").toLowerCase()}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {logs.length === 0 && <div className="text-[12.5px] text-center mt-8" style={{ color: "var(--muted)" }}>ยังไม่มีกิจกรรม</div>}
        <div className="relative pl-5">
          <span className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: "var(--line)" }} />
          {logs.slice(0, 40).map((l) => (
            <div key={l.id} className="relative pb-4">
              <span className="absolute -left-5 top-1" style={{ marginLeft: 2 }}><Avatar user={{ name: l.userName, color: l.userColor }} size={15} /></span>
              <div className="text-[12.5px] leading-snug"><b>{l.userName}</b> {l.text}</div>
              {(l.before || l.after) && (
                <div className="mt-1 text-[11px] space-y-0.5">
                  {l.before && <div className="px-2 py-0.5 rounded line-through truncate" style={{ background: "color-mix(in srgb, var(--danger) 7%, transparent)", color: "var(--muted)" }}>{l.before}</div>}
                  {l.after && <div className="px-2 py-0.5 rounded truncate" style={{ background: "color-mix(in srgb, var(--ok) 9%, transparent)" }}>{l.after}</div>}
                </div>
              )}
              <div className="text-[10.5px] font-bold mt-0.5" style={{ color: "var(--muted)" }}>{fullTime(l.at)} · <span className="chip !text-[9px] !py-0 !px-1">{l.type}</span></div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ================= ShareModal ================= */
export function ShareModal({ open, onClose, project, me }: { open: boolean; onClose: () => void; project: Project; me: User }) {
  const app = useApp();
  const mgr = canManage(project, me);
  const [memberQ, setMemberQ] = useState("");
  const users = app.users.filter((u) => u.id !== project.owner && u.name.toLowerCase().includes(memberQ.toLowerCase()));
  const setVis = (v: Visibility) => {
    if (!mgr) return;
    updateProject(project.id, { visibility: v }, `เปลี่ยนสิทธิ์โปรเจกต์เป็น ${VIS_META[v].label}`);
    toast(`เปลี่ยนเป็น ${VIS_META[v].label} แล้ว`, "ok", "🔐");
  };
  const toggleMember = (id: string) => {
    if (!mgr) return;
    const has = project.members.includes(id);
    updateProject(project.id, { members: has ? project.members.filter((x) => x !== id) : [...project.members, id] }, `${has ? "ลบ" : "เพิ่ม"}สมาชิกโปรเจกต์`);
  };
  const owner = app.users.find((u) => u.id === project.owner);
  return (
    <Modal open={open} onClose={onClose} width={560} title="แชร์ & สิทธิ์การเข้าถึง" icon={<UserPlus size={19} style={{ color: "var(--gold-strong)" }} />}>
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 text-[13px] rounded-xl p-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
          <Avatar user={owner} size={28} />
          <span><b>{owner?.name}</b> เป็นเจ้าของโปรเจกต์ · แผนก {project.dept}</span>
          <button className="btn !py-1.5 !px-2.5 !text-[11.5px] ml-auto" onClick={() => { toast("คัดลอกลิงก์แล้ว ส่งให้ทีมได้เลย", "ok", "🔗"); try { navigator.clipboard.writeText(`https://brainspace.mtsgoldgroup.com/#${project.id}`); } catch { /* noop */ } }}><Link2 size={12} /> คัดลอกลิงก์</button>
        </div>

        <div>
          <div className="text-[12px] font-bold mb-2">ระดับการมองเห็น {!mgr && <span className="chip !text-[10px] ml-1">ดูได้อย่างเดียว — เฉพาะเจ้าของ/Admin แก้ได้</span>}</div>
          <div className="space-y-2">
            {(Object.keys(VIS_META) as Visibility[]).map((v) => {
              const Ic = v === "public" ? Globe : v === "private" ? Lock : ShieldCheck;
              const on = project.visibility === v;
              return (
                <button key={v} disabled={!mgr} className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                  onClick={() => setVis(v)}
                  style={{ border: `1.5px solid ${on ? VIS_META[v].tone : "var(--line)"}`, background: on ? `color-mix(in srgb, ${VIS_META[v].tone} 9%, var(--panel))` : "var(--panel)", opacity: mgr ? 1 : 0.7 }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${VIS_META[v].tone} 16%, transparent)`, color: VIS_META[v].tone }}><Ic size={17} /></span>
                  <span className="flex-1">
                    <span className="block font-bold text-[13.5px]">{VIS_META[v].label}</span>
                    <span className="block text-[11.5px] font-medium" style={{ color: "var(--muted)" }}>{VIS_META[v].th}</span>
                  </span>
                  {on && <Check size={17} style={{ color: VIS_META[v].tone }} />}
                </button>
              );
            })}
          </div>
        </div>

        {(project.visibility === "private" || project.visibility === "locked") && (
          <div className="fade-up rounded-xl p-3.5" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold">สมาชิกที่เข้าถึงได้ ({project.members.length + 1})</span>
              <input className="input !w-[140px] !py-1.5 !text-[12px]" placeholder="ค้นหาสมาชิก..." value={memberQ} onChange={(e) => setMemberQ(e.target.value)} />
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>ดึงรายชื่อจากชีต USERS ทั้งหมดอัตโนมัติ — ติ๊กเพื่อเพิ่ม/ถอนสิทธิ์ได้ทีหลังเสมอ</p>
            <div className="mt-2.5 space-y-1 max-h-[190px] overflow-y-auto pr-1">
              <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
                <Avatar user={owner} size={28} />
                <span className="text-[13px] font-bold flex-1">{owner?.name} <span className="chip !text-[9.5px] ml-1" style={{ color: "var(--gold-strong)" }}>เจ้าของ</span></span>
                <Check size={15} style={{ color: "var(--ok)" }} />
              </div>
              {users.map((u) => {
                const on = project.members.includes(u.id);
                return (
                  <button key={u.id} className="w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-colors hover:bg-[var(--panel)]" onClick={() => toggleMember(u.id)} disabled={!mgr}>
                    <Avatar user={u} size={28} />
                    <span className="text-[13px] font-semibold flex-1 text-left">{u.name} <span className="text-[10.5px] font-bold" style={{ color: "var(--muted)" }}>· {u.dept}{!u.active && " · ระงับ"}</span></span>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ border: `1.5px solid ${on ? "var(--gold)" : "var(--line-strong)"}`, background: on ? "var(--gold)" : "transparent", color: "#fff" }}>
                      {on && <Check size={12} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mgr && (
          <div className="rounded-xl p-3.5" style={{ border: "1px solid color-mix(in srgb, var(--danger) 30%, var(--line))" }}>
            <div className="text-[12px] font-bold mb-2" style={{ color: "var(--danger)" }}>โซนจัดการ (เจ้าของ / Admin)</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn !py-2" onClick={() => { updateProject(project.id, { archived: true }, `เก็บถาวร "${project.name}"`); toast("เก็บถาวรแล้ว — กู้คืนได้จากหน้าแรก", "ok", "📦"); onClose(); }}><Archive size={14} /> เก็บถาวร</button>
              <button className="btn btn-danger !py-2" onClick={() => { deleteProject(project.id); toast("ลบโปรเจกต์แล้ว", "ok", "🗑️"); onClose(); }}><Trash2 size={14} /> ลบโปรเจกต์ถาวร</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ================= ExportModal ================= */
export function ExportModal({ open, onClose, board, project }: { open: boolean; onClose: () => void; board: Board; project: Project }) {
  const [format, setFormat] = useState<"png" | "jpg">("png");
  const [scale, setScale] = useState(2);
  const [grid, setGrid] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dark = document.documentElement.dataset.theme === "dark";
  const bounds = useMemo(() => computeBounds(board), [board]);
  const outW = Math.round((bounds.maxX - bounds.minX) * scale);
  const outH = Math.round((bounds.maxY - bounds.minY) * scale);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPreview(null);
    const t = setTimeout(async () => {
      try {
        const c = await renderBoard(board, project, { scale: 0.4, format, grid, dark });
        if (alive) setPreview(c.toDataURL("image/png"));
      } catch { /* noop */ }
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [open, format, grid, board, project, dark]);

  const doExport = async (copy?: boolean) => {
    setBusy(true);
    try {
      const c = await renderBoard(board, project, { scale, format, grid, dark });
      if (copy) { await copyCanvas(c); toast("คัดลอกรูปไปยังคลิปบอร์ดแล้ว", "ok", "📋"); }
      else { downloadCanvas(c, `brainspace-${project.name}`, format); toast(`Export ${format.toUpperCase()} ${outW}×${outH}px แล้ว`, "ok", "🎉"); }
    } catch { toast("Export ไม่สำเร็จ ลองใหม่อีกครั้ง", "warn", "⚠️"); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} width={560} title="Export บอร์ดเป็นรูปภาพ" icon={<ImageIcon size={19} style={{ color: "var(--gold-strong)" }} />}>
      <div className="grid sm:grid-cols-[1fr_210px] gap-5">
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-bold mb-1.5">รูปแบบไฟล์</div>
            <div className="flex gap-2">
              {(["png", "jpg"] as const).map((f) => (
                <button key={f} className="btn flex-1 uppercase" style={format === f ? { background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold-strong)" } : {}} onClick={() => setFormat(f)}>{f}</button>
              ))}
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>💡 PDF: เลือก PNG แล้วสั่งพิมพ์จากเบราว์เซอร์เป็น PDF ได้เลย</p>
          </div>
          <div>
            <div className="text-[12px] font-bold mb-1.5">สเกล (บอร์ดขยายอัตโนมัติตามเนื้อหา)</div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((s) => (
                <button key={s} className="btn" style={scale === s ? { background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--gold-strong)" } : {}} onClick={() => setScale(s)}>{s}x</button>
              ))}
            </div>
            <div className="chip mt-2 !text-[10.5px]">📐 {outW.toLocaleString()} × {outH.toLocaleString()} px — เก็บครบทุกการ์ด ทุกเส้นวาด</div>
          </div>
          <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}>
            <span className="text-[12.5px] font-bold">รวมพื้นหลังเส้นกริด</span>
            <Switch on={grid} onChange={setGrid} />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-gold flex-1" disabled={busy} onClick={() => doExport()}><Download size={15} /> {busy ? "กำลังเรนเดอร์..." : `ดาวน์โหลด ${format.toUpperCase()} ${scale}x`}</button>
            <button className="btn" disabled={busy || format === "jpg"} onClick={() => doExport(true)} title="PNG เท่านั้น"><Copy size={14} /> คัดลอก</button>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-bold mb-1.5">ตัวอย่าง</div>
          <div className="rounded-xl overflow-hidden flex items-center justify-center min-h-[180px]" style={{ border: "1px solid var(--line)", background: "var(--panel-2)" }}>
            {preview ? <img src={preview} alt="preview" className="max-w-full max-h-[260px] object-contain" /> : <span className="text-[12px] spin inline-flex"><Sparkles size={16} /></span>}
          </div>
          <p className="text-[10.5px] mt-2 leading-relaxed" style={{ color: "var(--muted)" }}>ขอบรูปตัดตามเนื้อหาพอดี — บอร์ดเลื่อน/ซูมได้อิสระเหมือน Miro แต่รูปที่ได้ออกมาครบทั้งบอร์ดในไฟล์เดียว</p>
        </div>
      </div>
    </Modal>
  );
}

/* ================= ShortcutsModal ================= */
export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ["V / H / S / T / X / F / P / E / C", "เลือกเครื่องมือ"],
    ["ดับเบิลคลิกที่ว่าง", "สร้างสติ๊กกี้ทันที"],
    ["ดับเบิลคลิกการ์ด", "แก้ไขข้อความ"],
    ["ดับเบิลคลิกลูกศร", "ใส่ป้ายกำกับ"],
    ["Ctrl + Scroll / บีบนิ้ว", "ซูมเข้า-ออก"],
    ["Scroll / ลากที่ว่าง", "เลื่อนแคนวาส"],
    ["Space ค้าง + ลาก", "เลื่อนแคนวาส"],
    ["Shift + คลิก", "เลือกหลายการ์ด"],
    ["Ctrl + Z / Ctrl + Shift + Z", "เลิกทำ / ทำซ้ำ"],
    ["Ctrl + C / Ctrl + V", "คัดลอก / วางการ์ด"],
    ["Ctrl + D", "ทำซ้ำการ์ด"],
    ["Delete / Backspace", "ลบสิ่งที่เลือก"],
    ["+ / - / 0 / 1", "ซูม / 100% / พอดีจอ"],
    ["Esc", "ยกเลิกการเลือก"],
  ];
  return (
    <Modal open={open} onClose={onClose} width={520} title="คีย์ลัดทั้งหมด" icon={<Keyboard size={19} style={{ color: "var(--gold-strong)" }} />}>
      <div className="space-y-1">
        {rows.map(([k, d], i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-1.5 border-b last:border-0" style={{ borderColor: "var(--line)" }}>
            <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>{d}</span>
            <kbd className="chip !text-[10.5px] !font-mono shrink-0" style={{ background: "var(--panel-2)" }}>{k}</kbd>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] mt-3 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Sparkles size={12} /> บน iPad ใช้ Apple Pencil วาดได้โดยตรง · บนมือถือใช้นิ้วลาก/บีบซูม</p>
    </Modal>
  );
}
