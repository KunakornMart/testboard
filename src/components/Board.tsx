import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MousePointer2, Hand, StickyNote, Type, Shapes, Frame as FrameIcon, PenLine, Highlighter, Eraser,
  Link2, SmilePlus, Undo2, Redo2, Minus, Plus, Maximize2, ArrowLeft, MoreHorizontal, Download,
  History, Users, Trash2, Copy, BringToFront, SendToBack, Pencil, Palette, Check, Keyboard,
  MessageCircle, X, Star, Grid3x3, Bot, Eye, ThumbsUp, ChevronDown, GripVertical, Circle, Diamond as DiamondIcon, Square, Sparkles, Send,
} from "lucide-react";
import type { Board, Connector, Frame, Item, ItemKind, Peer, Project, Stroke, User } from "../types";
import { CONNECTOR_COLORS, DRAW_COLORS, EMOJIS, FRAME_COLORS, KIND_META, PASTELS, VIS_META, uid } from "../data";
import {
  addBotPeer, addLog, announcePresence, canEdit, canManage, currentUser, deleteProject, getState, onRemoteLog,
  removeBotPeer, sendChat, setBoard, timeAgo, updateProject, useApp, usePeers,
} from "../store";
import { Avatar, Confirm, Menu, toast } from "../ui";
import { computeBounds } from "../exporter";
import { CardDrawer, ActivityDrawer, ShareModal, ExportModal, ShortcutsModal } from "./BoardPanels";

type Tool = "select" | "hand" | "sticky" | "text" | "shape" | "frame" | "pen" | "marker" | "pencil" | "eraser" | "connector" | "emoji";
type View = { x: number; y: number; zoom: number };
const clampZoom = (z: number) => Math.min(3.5, Math.max(0.15, z));
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

export default function BoardScreen({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const app = useApp();
  const me = currentUser();
  const project = app.projects.find((p) => p.id === projectId);
  const board: Board = app.boards[projectId] || { items: [], frames: [], strokes: [], connectors: [] };
  const readOnly = !project || !canEdit(project, me);

  /* ---------- view & tools ---------- */
  const [view, setView] = useState<View>({ x: 80, y: 80, zoom: 0.9 });
  const [tool, setTool] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<"rect" | "diamond" | "ellipse">("rect");
  const [color, setColor] = useState("#FFE06B");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [emoji, setEmoji] = useState("💡");
  const [grid, setGrid] = useState(true);
  const [botsOn, setBotsOn] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  /* ---------- selection & editing ---------- */
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selFrame, setSelFrame] = useState<string | null>(null);
  const [selConn, setSelConn] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: "body" | "title" } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null); // frame id or 'project'
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [connLabel, setConnLabel] = useState<{ id: string; x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  /* ---------- panels ---------- */
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  /* ---------- refs ---------- */
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const toolRef = useRef(tool); toolRef.current = tool;
  const emptyBoard = (): Board => ({ items: [], frames: [], strokes: [], connectors: [] });
  // อ่าน board ล่าสุดจาก store เสมอ (ไม่ใช้ค่าจาก render ที่อาจ stale ระหว่าง gesture)
  const boardRef = { get current(): Board { return getState().boards[projectId] || emptyBoard(); } };
  const selRef = useRef(sel); selRef.current = sel;
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const spaceRef = useRef(false);
  const gesture = useRef<any>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const clipboard = useRef<Item[]>([]);
  const [histVer, setHistVer] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [tbPos, setTbPos] = useState<{ x: number; y: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem("bs-toolbar") || "null"); } catch { return null; }
  });

  /* ---------- board mutation core ---------- */
  const snapRef = useRef<string | null>(null); // snapshot ก่อน gesture (ลาก/วาด/resize) เพื่อ undo ที่ถูกต้อง
  const takeSnap = () => { snapRef.current = JSON.stringify(boardRef.current); };
  const commit = useCallback((next: Board, opts: { broadcast?: boolean; history?: boolean; log?: Omit<Parameters<typeof addLog>[0], "projectId" | "userId" | "userName" | "userColor"> } = {}) => {
    if (opts.history) { undoStack.current.push(snapRef.current ?? JSON.stringify(boardRef.current)); snapRef.current = null; if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; setHistVer((v) => v + 1); }
    setBoard(projectId, next, { broadcast: opts.broadcast !== false });
    if (opts.log && me) addLog({ projectId, userId: me.id, userName: me.name, userColor: me.color, ...opts.log });
    setSaveState("saving");
    setTimeout(() => setSaveState("saved"), 700);
  }, [projectId, me]);

  const mutate = useCallback((fn: (b: Board) => void, opts: Parameters<typeof commit>[1] = {}) => {
    const next: Board = JSON.parse(JSON.stringify(boardRef.current));
    fn(next);
    commit(next, opts);
    return next;
  }, [commit]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop(); if (!prev) return;
    redoStack.current.push(JSON.stringify(boardRef.current));
    commit(JSON.parse(prev), { broadcast: true }); setHistVer((v) => v + 1);
  }, [commit]);
  const redo = useCallback(() => {
    const nxt = redoStack.current.pop(); if (!nxt) return;
    undoStack.current.push(JSON.stringify(boardRef.current));
    commit(JSON.parse(nxt), { broadcast: true }); setHistVer((v) => v + 1);
  }, [commit]);

  /* ---------- coordinate helpers ---------- */
  const toBoard = useCallback((cx: number, cy: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  }, []);
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setView((v) => {
      const r = viewportRef.current!.getBoundingClientRect();
      const sx = cx - r.left, sy = cy - r.top;
      const z = clampZoom(v.zoom * factor);
      const bx = (sx - v.x) / v.zoom, by = (sy - v.y) / v.zoom;
      return { zoom: z, x: sx - bx * z, y: sy - by * z };
    });
  }, []);
  const fitView = useCallback(() => {
    const b = computeBounds(boardRef.current);
    const r = viewportRef.current?.getBoundingClientRect(); if (!r) return;
    const z = clampZoom(Math.min((r.width - 120) / (b.maxX - b.minX), (r.height - 160) / (b.maxY - b.minY), 1.1));
    setView({ zoom: z, x: (r.width - (b.maxX - b.minX) * z) / 2 - b.minX * z, y: (r.height - (b.maxY - b.minY) * z) / 2 - b.minY * z + 10 });
  }, []);
  useEffect(() => { const t = setTimeout(fitView, 60); return () => clearTimeout(t); }, [projectId, fitView]);

  /* ---------- wheel zoom/pan ---------- */
  useEffect(() => {
    const el = viewportRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0024));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.code === "Space" && !typing) { spaceRef.current = true; e.preventDefault(); }
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "c") { copySel(); return; }
      if (mod && e.key.toLowerCase() === "v") { paste(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && !readOnly) { deleteSel(); }
      if (e.key === "Escape") { setSel(new Set()); setSelFrame(null); setSelConn(null); setPendingFrom(null); setCtxMenu(null); setEditing(null); }
      if (e.key === "=" || e.key === "+") setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }));
      if (e.key === "-") setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }));
      if (e.key === "0") setView((v) => ({ ...v, zoom: 1 }));
      if (e.key === "1") fitView();
      if (!mod) {
        const map: Record<string, Tool> = { v: "select", h: "hand", s: "sticky", t: "text", p: "pen", f: "frame", c: "connector", e: "eraser", x: "shape" };
        if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  /* ---------- presence ---------- */
  useEffect(() => {
    if (!me) return;
    announcePresence(projectId, me, cursorRef.current);
    const iv = setInterval(() => announcePresence(projectId, me, cursorRef.current), 2000);
    return () => clearInterval(iv);
  }, [projectId, me]);
  const peers = usePeers(projectId);

  /* demo bots */
  useEffect(() => {
    if (!botsOn || !me) return;
    const others = app.users.filter((u) => u.active && u.id !== me.id).slice(0, 2);
    if (!others.length) return;
    const b = computeBounds(boardRef.current);
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    let raf = 0, frame = 0;
    const loop = (t: number) => {
      frame++;
      if (frame % 2 === 0) others.forEach((u, i) => {
        const ph = i * 2.4;
        addBotPeer({
          tabId: `BOT-${u.id}`, userId: u.id, name: u.name, color: u.color, boardId: projectId,
          cursor: { x: cx + Math.sin(t * 0.00045 + ph) * 330 + Math.sin(t * 0.0011 + ph) * 60, y: cy + Math.cos(t * 0.00038 + ph) * 210 + Math.cos(t * 0.001 + ph) * 45 },
          at: Date.now(), bot: true,
        });
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); others.forEach((u) => removeBotPeer(`BOT-${u.id}`)); };
  }, [botsOn, projectId, me, app.users]);

  /* remote log toasts */
  useEffect(() => {
    const off = onRemoteLog((l) => { if (l.projectId === projectId) toast(`${l.userName} ${l.text}`, "info", "👀"); });
    return () => { off(); };
  }, [projectId]);

  /* ---------- item factory ---------- */
  const makeItem = (partial: Partial<Item>): Item => ({
    id: uid(partial.type === "shape" ? "SH" : "CARD"), type: "sticky", x: 0, y: 0, w: 190, h: 190,
    color: "#FFE06B", title: "", body: "", votes: [], tags: [], comments: [], versions: [],
    z: Math.max(0, ...boardRef.current.items.map((i) => i.z)) + 1,
    authorId: me!.id, authorName: me!.name, authorColor: me!.color, ...partial,
  } as Item);

  const addItem = (it: Item, logText: string) => {
    mutate((b) => { b.items.push(it); }, { history: true, log: { type: "CARD_CREATED", text: logText, objectId: it.id } });
    setSel(new Set([it.id]));
  };

  /* ---------- pointer logic on canvas ---------- */
  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    setCtxMenu(null); setSelFrame(null); setSelConn(null);
    const pt = toBoard(e.clientX, e.clientY);
    viewportRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pan = () => { gesture.current = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }; };
    if (e.button === 1 || spaceRef.current || toolRef.current === "hand") { pan(); return; }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), z0: viewRef.current.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v0: { ...viewRef.current } };
      return;
    }
    const t = toolRef.current;
    if (readOnly) { pan(); return; }
    if (t === "select") {
      if (e.pointerType === "touch") { pan(); return; }
      gesture.current = { mode: "marquee", ...pt };
      setSel(new Set()); setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      return;
    }
    if (t === "sticky") {
      const it = makeItem({ type: "sticky", x: pt.x - 95, y: pt.y - 95, w: 190, h: 190, color: PASTELS.includes(color) ? color : "#FFE06B" });
      addItem(it, "สร้างสติ๊กกี้ใหม่");
      setEditing({ id: it.id, field: "body" });
      setTool("select");
    } else if (t === "text") {
      const it = makeItem({ type: "text", x: pt.x - 20, y: pt.y - 20, w: 280, h: 44, color: "transparent", body: "" });
      addItem(it, "เพิ่มข้อความ");
      setEditing({ id: it.id, field: "body" }); setTool("select");
    } else if (t === "shape") {
      const it = makeItem({ type: "shape", shape: shapeKind, x: pt.x - 100, y: pt.y - 60, w: 200, h: 120, color });
      addItem(it, `เพิ่มรูปทรง (${shapeKind})`);
      setEditing({ id: it.id, field: "body" });
    } else if (t === "emoji") {
      addItem(makeItem({ type: "emoji", emoji, x: pt.x - 48, y: pt.y - 48, w: 96, h: 96, color: "transparent" }), `ติดสติกเกอร์ ${emoji}`);
      setTool("select");
    } else if (t === "frame") {
      takeSnap();
      gesture.current = { mode: "newframe", ...pt };
    } else if (t === "pen" || t === "marker" || t === "pencil") {
      takeSnap();
      const stroke: Stroke = { id: uid("ST"), tool: t as any, color: drawColor, size: t === "marker" ? 5 : t === "pencil" ? 2 : 3, points: [pt.x, pt.y] };
      gesture.current = { mode: "draw", stroke };
      mutate((b) => { b.strokes.push(stroke); }, { broadcast: false });
    } else if (t === "eraser") {
      takeSnap();
      gesture.current = { mode: "erase", hit: false };
    } else if (t === "connector") {
      setPendingFrom(null);
    }
  };

  const onCanvasMove = (e: React.PointerEvent) => {
    const pt = toBoard(e.clientX, e.clientY);
    cursorRef.current = pt;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current; if (!g) return;

    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = clampZoom(g.z0 * (d / Math.max(1, g.d0)));
      const r = viewportRef.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const bx = (g.mx - r.left - g.v0.x) / g.v0.z, by = (g.my - r.top - g.v0.y) / g.v0.z;
      setView({ zoom: z, x: mx - r.left - bx * z, y: my - r.top - by * z });
      return;
    }
    if (g.mode === "pan") { setView((v) => ({ ...v, x: g.vx + (e.clientX - g.sx), y: g.vy + (e.clientY - g.sy) })); return; }
    if (g.mode === "marquee") { setMarquee({ x1: g.x, y1: g.y, x2: pt.x, y2: pt.y }); return; }
    if (g.mode === "newframe") { setMarquee({ x1: g.x, y1: g.y, x2: pt.x, y2: pt.y }); return; }
    if (g.mode === "draw") {
      g.stroke.points.push(pt.x, pt.y);
      mutate((b) => { const s = b.strokes.find((x) => x.id === g.stroke.id); if (s) s.points = [...g.stroke.points]; }, { broadcast: false });
      return;
    }
    if (g.mode === "erase") {
      const th = 12 / viewRef.current.zoom + 6;
      mutate((b) => {
        const before = b.strokes.length;
        b.strokes = b.strokes.filter((s) => !strokeHit(s, pt.x, pt.y, th));
        if (b.strokes.length !== before) g.hit = true;
      }, { broadcast: false });
      return;
    }
    if (g.mode === "dragItems") {
      const dx = pt.x - g.px, dy = pt.y - g.py;
      mutate((b) => { b.items.forEach((i) => { const o = g.orig[i.id]; if (o) { i.x = o.x + dx; i.y = o.y + dy; } }); }, { broadcast: false });
      return;
    }
    if (g.mode === "dragFrame") {
      mutate((b) => { const f = b.frames.find((x) => x.id === g.id); if (f) { f.x = g.ox + (pt.x - g.px); f.y = g.oy + (pt.y - g.py); } }, { broadcast: false });
      return;
    }
    if (g.mode === "resize") {
      mutate((b) => {
        const it = b.items.find((x) => x.id === g.id); if (!it) return;
        const dx = pt.x - g.px, dy = pt.y - g.py;
        if (g.corner.includes("e")) it.w = Math.max(70, g.w + dx);
        if (g.corner.includes("s")) it.h = Math.max(50, g.h + dy);
        if (g.corner.includes("w")) { it.w = Math.max(70, g.w - dx); it.x = Math.min(g.x + g.w - 70, g.x + dx); }
        if (g.corner.includes("n")) { it.h = Math.max(50, g.h - dy); it.y = Math.min(g.y + g.h - 50, g.y + dy); }
      }, { broadcast: false });
      return;
    }
    if (g.mode === "resizeFrame") {
      mutate((b) => { const f = b.frames.find((x) => x.id === g.id); if (f) { f.w = Math.max(220, g.w + (pt.x - g.px)); f.h = Math.max(180, g.h + (pt.y - g.py)); } }, { broadcast: false });
    }
  };

  const onCanvasUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current; gesture.current = null;
    if (!g) return;
    const pt = toBoard(e.clientX, e.clientY);
    if (g.mode === "marquee") {
      setMarquee(null);
      const [x1, x2] = [Math.min(g.x, pt.x), Math.max(g.x, pt.x)];
      const [y1, y2] = [Math.min(g.y, pt.y), Math.max(g.y, pt.y)];
      if (x2 - x1 > 6 || y2 - y1 > 6) {
        const hit = boardRef.current.items.filter((i) => i.x < x2 && i.x + i.w > x1 && i.y < y2 && i.y + i.h > y1).map((i) => i.id);
        setSel(new Set(hit));
      }
    } else if (g.mode === "newframe") {
      setMarquee(null);
      const x = Math.min(g.x, pt.x), y = Math.min(g.y, pt.y);
      const w = Math.max(260, Math.abs(pt.x - g.x)), h = Math.max(200, Math.abs(pt.y - g.y));
      const f: Frame = { id: uid("FR"), x, y, w, h, title: `Section ${boardRef.current.frames.length + 1}`, color: FRAME_COLORS[boardRef.current.frames.length % FRAME_COLORS.length], z: 0 };
      mutate((b) => { b.frames.push(f); }, { history: true, log: { type: "FRAME_CREATED", text: `สร้างเฟรม "${f.title}"`, objectId: f.id } });
      setSelFrame(f.id); setRenaming(f.id); setTool("select");
    } else if (g.mode === "draw") {
      if (g.stroke.points.length < 6) mutate((b) => { b.strokes = b.strokes.filter((s) => s.id !== g.stroke.id); }, { broadcast: false });
      else { commit({ ...boardRef.current, strokes: [...boardRef.current.strokes] }, { history: true, log: { type: "DRAW", text: `วาดเส้นด้วย${g.stroke.tool === "pen" ? "ปากกา" : g.stroke.tool === "marker" ? "มาร์กเกอร์" : "ดินสอ"}` } }); }
    } else if (g.mode === "erase") {
      if (g.hit) commit({ ...boardRef.current }, { history: true, log: { type: "DRAW", text: "ลบเส้นวาด" } });
    } else if (g.mode === "dragItems") {
      const moved = Object.keys(g.orig).some((id) => {
        const it = boardRef.current.items.find((i) => i.id === id); const o = g.orig[id];
        return it && (Math.abs(it.x - o.x) > 2 || Math.abs(it.y - o.y) > 2);
      });
      if (moved) commit({ ...boardRef.current }, { history: true, log: { type: "CARD_MOVED", text: `ย้ายการ์ด ${Object.keys(g.orig).length} ใบ` } });
    } else if (g.mode === "dragFrame" || g.mode === "resizeFrame" || g.mode === "resize") {
      commit({ ...boardRef.current }, { history: true });
    }
    snapRef.current = null;
  };

  /* ---------- item interactions ---------- */
  const onItemDown = (e: React.PointerEvent, it: Item) => {
    if (readOnly) return;
    e.stopPropagation();
    if (e.button === 2) { setCtxMenu({ x: e.clientX, y: e.clientY, itemId: it.id }); return; }
    const t = toolRef.current;
    if (t === "connector") {
      if (!pendingFrom) { setPendingFrom(it.id); toast("คลิกการ์ดปลายทางเพื่อเชื่อมลูกศร", "info", "🔗"); }
      else if (pendingFrom !== it.id) {
        const conn: Connector = { id: uid("CN"), from: pendingFrom, to: it.id, color: CONNECTOR_COLORS.includes(drawColor) ? drawColor : CONNECTOR_COLORS[0] };
        mutate((b) => { b.connectors.push(conn); }, { history: true, log: { type: "CONNECTION_CREATED", text: "เชื่อมต่อการ์ด 2 ใบ", objectId: conn.id } });
        setPendingFrom(null);
      } else setPendingFrom(null);
      return;
    }
    if (t !== "select") return;
    viewportRef.current!.setPointerCapture(e.pointerId);
    const pt = toBoard(e.clientX, e.clientY);
    let next = selRef.current;
    if (e.shiftKey) { next = new Set(next); next.has(it.id) ? next.delete(it.id) : next.add(it.id); }
    else if (!next.has(it.id)) next = new Set([it.id]);
    setSel(next); setSelFrame(null); setSelConn(null);
    const orig: Record<string, { x: number; y: number }> = {};
    boardRef.current.items.forEach((i) => { if (next.has(i.id)) orig[i.id] = { x: i.x, y: i.y }; });
    takeSnap();
    gesture.current = { mode: "dragItems", px: pt.x, py: pt.y, orig };
  };

  const startResize = (e: React.PointerEvent, it: Item, corner: string) => {
    e.stopPropagation();
    viewportRef.current!.setPointerCapture(e.pointerId);
    const pt = toBoard(e.clientX, e.clientY);
    takeSnap();
    gesture.current = { mode: "resize", id: it.id, corner, px: pt.x, py: pt.y, x: it.x, y: it.y, w: it.w, h: it.h };
  };

  const vote = (it: Item) => {
    if (!me) return;
    const has = it.votes.includes(me.id);
    mutate((b) => {
      const x = b.items.find((i) => i.id === it.id); if (!x) return;
      x.votes = has ? x.votes.filter((v) => v !== me.id) : [...x.votes, me.id];
    }, { history: true, log: { type: has ? "VOTE_REMOVED" : "VOTE_ADDED", text: `${has ? "เลิกโหวต" : "โหวตให้"} "${it.title || it.body.slice(0, 24) || "การ์ด"}"`, objectId: it.id } });
  };

  const deleteSel = () => {
    if (readOnly) return;
    if (selConn) {
      const c = boardRef.current.connectors.find((x) => x.id === selConn);
      mutate((b) => { b.connectors = b.connectors.filter((x) => x.id !== selConn); }, { history: true, log: { type: "CONNECTION_DELETED", text: "ลบการเชื่อมต่อ", objectId: selConn } });
      void c; setSelConn(null); return;
    }
    if (selFrame) {
      const f = boardRef.current.frames.find((x) => x.id === selFrame);
      mutate((b) => { b.frames = b.frames.filter((x) => x.id !== selFrame); }, { history: true, log: { type: "FRAME_DELETED", text: `ลบเฟรม "${f?.title}"` } });
      setSelFrame(null); return;
    }
    if (!sel.size) return;
    const names = boardRef.current.items.filter((i) => sel.has(i.id)).map((i) => i.title || i.body.slice(0, 18) || "การ์ด").slice(0, 2).join(", ");
    mutate((b) => {
      b.items = b.items.filter((i) => !sel.has(i.id));
      b.connectors = b.connectors.filter((c) => !sel.has(c.from) && !sel.has(c.to));
    }, { history: true, log: { type: "CARD_DELETED", text: `ลบการ์ด "${names}"` } });
    setSel(new Set()); setDrawerId(null);
  };

  const duplicateSel = () => {
    if (!sel.size || readOnly || !me) return;
    const clones: Item[] = boardRef.current.items.filter((i) => sel.has(i.id)).map((i) => ({
      ...JSON.parse(JSON.stringify(i)), id: uid("CARD"), x: i.x + 28, y: i.y + 28,
      authorId: me.id, authorName: me.name, authorColor: me.color, votes: [], comments: [], versions: [],
      z: Math.max(0, ...boardRef.current.items.map((z) => z.z)) + 1,
    }));
    mutate((b) => { b.items.push(...clones); }, { history: true, log: { type: "CARD_CREATED", text: `ทำซ้ำการ์ด ${clones.length} ใบ` } });
    setSel(new Set(clones.map((c) => c.id)));
  };

  const copySel = () => {
    clipboard.current = boardRef.current.items.filter((i) => sel.has(i.id)).map((i) => JSON.parse(JSON.stringify(i)));
    if (clipboard.current.length) toast(`คัดลอก ${clipboard.current.length} ใบ`, "ok", "📋");
  };
  const paste = () => {
    if (!clipboard.current.length || readOnly || !me) return;
    const clones = clipboard.current.map((i) => ({ ...JSON.parse(JSON.stringify(i)), id: uid("CARD"), x: i.x + 34, y: i.y + 34, authorId: me.id, authorName: me.name, authorColor: me.color, z: Math.max(0, ...boardRef.current.items.map((z) => z.z)) + 1 }));
    mutate((b) => { b.items.push(...clones); }, { history: true, log: { type: "CARD_CREATED", text: `วางการ์ด ${clones.length} ใบ` } });
    setSel(new Set(clones.map((c) => c.id)));
  };

  const setColorOf = (ids: Iterable<string>, c: string) => {
    mutate((b) => { b.items.forEach((i) => { if ([...ids].includes(i.id)) i.color = c; }); }, { history: true, log: { type: "CARD_UPDATED", text: "เปลี่ยนสีการ์ด" } });
  };
  const zMove = (dir: "front" | "back") => {
    mutate((b) => {
      const zs = b.items.map((i) => i.z);
      b.items.forEach((i) => { if (sel.has(i.id)) i.z = dir === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1; });
    }, { history: true });
  };

  /* commit text edits */
  const commitText = (id: string, field: "body" | "title", value: string) => {
    const it = boardRef.current.items.find((i) => i.id === id);
    setEditing(null);
    if (!it || !me || it[field] === value) return;
    const before = it[field];
    mutate((b) => {
      const x = b.items.find((i) => i.id === id); if (!x) return;
      (x as any)[field] = value;
      x.editedBy = me.id; x.editedByName = me.name; x.editedAt = Date.now();
      if (field === "body" || field === "title") x.versions.push({ at: Date.now(), by: me.id, byName: me.name, field, before, after: value });
    }, { history: true, log: { type: "CARD_UPDATED", text: `แก้ไข${field === "title" ? "หัวข้อ" : "เนื้อหา"}การ์ด "${(it.title || it.body).slice(0, 26) || "การ์ด"}"`, before: before.slice(0, 90), after: value.slice(0, 90), objectId: id } });
  };

  /* ---------- render helpers ---------- */
  if (!project || !me) return (
    <div className="h-screen flex items-center justify-center">
      <div className="panel p-8 text-center"><p className="font-bold">ไม่พบโปรเจกต์นี้ หรือคุณไม่มีสิทธิ์เข้าถึง 🔒</p>
        <button className="btn btn-gold mt-4" onClick={onBack}>กลับหน้าแรก</button></div>
    </div>
  );

  const vis = VIS_META[project.visibility];
  const sortedItems = [...board.items].sort((a, b) => a.z - b.z);
  const sortedFrames = [...board.frames].sort((a, b) => a.z - b.z);
  const onlinePeers = peers;
  const cursorCls = spaceRef.current || tool === "hand" ? "board-cursor-grab" : tool === "select" ? "" : "cursor-crosshair";

  const tools: { id: Tool; icon: any; label: string; key?: string; ro?: boolean }[] = [
    { id: "select", icon: MousePointer2, label: "เลือก / ลาก", key: "V" },
    { id: "hand", icon: Hand, label: "เลื่อนแคนวาส", key: "H" },
    { id: "sticky", icon: StickyNote, label: "สติ๊กกี้", key: "S" },
    { id: "text", icon: Type, label: "ข้อความ", key: "T" },
    { id: "shape", icon: Shapes, label: "รูปทรง / โฟลว์ชาร์ต", key: "X" },
    { id: "frame", icon: FrameIcon, label: "เฟรม (Section)", key: "F" },
    { id: "pen", icon: PenLine, label: "ปากกา", key: "P" },
    { id: "marker", icon: Highlighter, label: "มาร์กเกอร์" },
    { id: "pencil", icon: Pencil, label: "ดินสอ" },
    { id: "eraser", icon: Eraser, label: "ยางลบ", key: "E" },
    { id: "connector", icon: Link2, label: "ลูกศรเชื่อมต่อ", key: "C" },
    { id: "emoji", icon: SmilePlus, label: "สติกเกอร์อีโมจิ" },
  ];

  const empty = board.items.length === 0 && board.frames.length === 0 && board.strokes.length === 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: "var(--canvas)" }}>
      {/* ================= top bar ================= */}
      <header className="relative z-40 flex items-center gap-2 px-3 h-[58px] shrink-0" style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
        <button className="icon-btn" onClick={onBack} title="กลับหน้าแรก"><ArrowLeft size={18} /></button>
        <span className="text-[21px] wiggle inline-block">{project.icon}</span>
        {renaming === "project" ? (
          <input autoFocus className="input !w-[220px] !py-1.5 font-bold" defaultValue={project.name}
            onBlur={(e) => { setRenaming(null); if (e.target.value.trim() && e.target.value !== project.name) { updateProject(project.id, { name: e.target.value.trim() }, `เปลี่ยนชื่อโปรเจกต์เป็น "${e.target.value.trim()}"`); } }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
        ) : (
          <button className="font-display font-bold text-[16.5px] truncate max-w-[260px] flex items-center gap-1.5 hover:opacity-75" onClick={() => canManage(project, me) && setRenaming("project")} title={canManage(project, me) ? "คลิกเพื่อเปลี่ยนชื่อ" : undefined}>
            {project.name} {canManage(project, me) && <Pencil size={12} style={{ color: "var(--muted)" }} />}
          </button>
        )}
        <span className="chip">{project.dept}</span>
        <button className="chip hover:opacity-75" style={{ color: vis.tone }} onClick={() => (canManage(project, me) ? setShareOpen(true) : toast(`${vis.label}: ${vis.th}`, "info", "🔐"))}>
          {project.visibility === "public" ? <Eye size={12} /> : project.visibility === "private" ? <Users size={12} /> : <Sparkles size={12} />} {vis.label}
        </button>
        {readOnly && <span className="chip" style={{ color: "var(--danger)" }}>🔒 อ่านอย่างเดียว</span>}

        {/* autosave */}
        <div className="flex-1 hidden sm:flex justify-center">
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: saveState === "saved" ? "var(--ok)" : "var(--muted)" }}>
            {saveState === "saved" ? <><Check size={13} /> บันทึกแล้วทุกการเปลี่ยนแปลง</> : <><span className="spin inline-flex"><History size={12} /></span> กำลังบันทึก…</>}
          </div>
        </div>
        <div className="flex-1 sm:hidden" />

        {/* presence */}
        <div className="flex items-center -space-x-2 mr-1" title={`ออนไลน์: ${[me.name, ...onlinePeers.map((p) => p.name)].join(", ")}`}>
          <Avatar user={me} size={29} ring />
          {onlinePeers.slice(0, 4).map((p) => <Avatar key={p.tabId} user={{ name: p.name, color: p.color }} size={29} ring />)}
          {onlinePeers.length > 4 && <span className="w-[29px] h-[29px] rounded-full flex items-center justify-center text-[10.5px] font-bold" style={{ background: "var(--panel-2)", border: "2px solid var(--panel)" }}>+{onlinePeers.length - 4}</span>}
          <span className="ml-3.5 hidden md:flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--ok)" }}>
            <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--ok)" }} /> {1 + onlinePeers.length} ออนไลน์
          </span>
        </div>

        <button className={`icon-btn ${chatOpen ? "on" : ""}`} onClick={() => setChatOpen((o) => !o)} title="แชททีม"><MessageCircle size={18} /></button>
        <button className={`icon-btn ${activityOpen ? "on" : ""}`} onClick={() => setActivityOpen((o) => !o)} title="ประวัติการแก้ไข"><History size={18} /></button>
        <button className="btn btn-gold !py-2" onClick={() => setShareOpen(true)}><Users size={15} /> <span className="hidden md:inline">แชร์ / สิทธิ์</span></button>
        <Menu button={() => <button className="icon-btn"><MoreHorizontal size={18} /></button>}>
          {(close) => (
            <>
              <button className="menu-item" onClick={() => { close(); setExportOpen(true); }}><Download size={15} /> Export PNG / JPG</button>
              <button className="menu-item" onClick={() => { close(); setKeysOpen(true); }}><Keyboard size={15} /> คีย์ลัด</button>
              <button className="menu-item" onClick={() => { close(); setGrid((g) => !g); }}><Grid3x3 size={15} /> {grid ? "ซ่อน" : "แสดง"}เส้นกริด</button>
              <button className="menu-item" onClick={() => { close(); setBotsOn((b) => !b); }}><Bot size={15} /> {botsOn ? "ปิด" : "เปิด"}เพื่อนร่วมทีมเดโม ✨</button>
              <button className="menu-item" onClick={() => { close(); fitView(); }}><Maximize2 size={15} /> พอดีจอ (1)</button>
              {canManage(project, me) && <button className="menu-item danger" onClick={() => { close(); setConfirmDel(true); }}><Trash2 size={15} /> ลบโปรเจกต์</button>}
            </>
          )}
        </Menu>
      </header>

      {/* ================= canvas ================= */}
      <div ref={viewportRef}
        className={`relative flex-1 overflow-hidden no-select ${cursorCls}`}
        style={{
          background: "var(--canvas)", touchAction: "none",
          ...(grid ? {
            backgroundImage: "radial-gradient(var(--dot) 1.3px, transparent 1.3px)",
            backgroundSize: `${26 * view.zoom}px ${26 * view.zoom}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          } : {}),
        }}
        onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} onPointerCancel={onCanvasUp}
        onDoubleClick={(e) => {
          if (readOnly || toolRef.current !== "select" || e.target !== e.currentTarget) return;
          const pt = toBoard(e.clientX, e.clientY);
          const it = makeItem({ type: "sticky", x: pt.x - 95, y: pt.y - 95, color: PASTELS[hash(`${pt.x}${pt.y}`) % 6] });
          addItem(it, "สร้างสติ๊กกี้ใหม่");
          setEditing({ id: it.id, field: "body" });
        }}
        onContextMenu={(e) => e.preventDefault()}>
        <div className="absolute" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0", width: 0, height: 0 }}>

          {/* frames */}
          {sortedFrames.map((f) => (
            <FrameView key={f.id} f={f} selected={selFrame === f.id} renaming={renaming === f.id}
              onDown={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                setSelFrame(f.id); setSel(new Set()); setSelConn(null);
                const pt = toBoard(e.clientX, e.clientY);
                viewportRef.current!.setPointerCapture(e.pointerId);
                takeSnap();
                gesture.current = { mode: "dragFrame", id: f.id, px: pt.x, py: pt.y, ox: f.x, oy: f.y };
              }}
              onRename={() => setRenaming(f.id)}
              onRenameDone={(v) => { setRenaming(null); mutate((b) => { const x = b.frames.find((q) => q.id === f.id); if (x) x.title = v; }, { history: true }); }}
              onResize={(e) => {
                e.stopPropagation();
                const pt = toBoard(e.clientX, e.clientY);
                viewportRef.current!.setPointerCapture(e.pointerId);
                takeSnap();
                gesture.current = { mode: "resizeFrame", id: f.id, px: pt.x, py: pt.y, w: f.w, h: f.h };
              }}
              onColor={(c) => mutate((b) => { const x = b.frames.find((q) => q.id === f.id); if (x) x.color = c; }, { history: true })}
              onDelete={() => { setSelFrame(f.id); setTimeout(deleteSel, 0); }}
            />
          ))}

          {/* strokes + connectors svg */}
          <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 10, height: 10, pointerEvents: "none" }}>
            {board.strokes.map((s) => (
              <path key={s.id} d={pointsToPath(s.points)} fill="none" stroke={s.color}
                strokeWidth={s.tool === "marker" ? s.size * 3 : s.tool === "pencil" ? s.size * 0.7 : s.size}
                strokeLinecap="round" strokeLinejoin="round" opacity={s.tool === "marker" ? 0.38 : s.tool === "pencil" ? 0.85 : 1} />
            ))}
          </svg>
          <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 10, height: 10 }}>
            <defs>
              {CONNECTOR_COLORS.map((c) => (
                <marker key={c} id={`ar-${c.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={c} />
                </marker>
              ))}
            </defs>
            {board.connectors.map((c) => {
              const a = board.items.find((i) => i.id === c.from), b = board.items.find((i) => i.id === c.to);
              if (!a || !b) return null;
              const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
              const p1 = edgePoint(a, bc.x, bc.y), p2 = edgePoint(b, ac.x, ac.y);
              const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
              return (
                <g key={c.id} style={{ pointerEvents: "auto", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setSelConn(c.id); setSel(new Set()); setSelFrame(null); }}
                  onDoubleClick={(e) => { e.stopPropagation(); const r = viewportRef.current!.getBoundingClientRect(); setConnLabel({ id: c.id, x: r.left + mx * view.zoom + view.x, y: r.top + my * view.zoom + view.y }); }}>
                  <path d={`M${p1.x},${p1.y} Q${mx + (p2.y - p1.y) * 0.12},${my - (p2.x - p1.x) * 0.12} ${p2.x},${p2.y}`} fill="none" stroke="transparent" strokeWidth={16} />
                  <path d={`M${p1.x},${p1.y} Q${mx + (p2.y - p1.y) * 0.12},${my - (p2.x - p1.x) * 0.12} ${p2.x},${p2.y}`} fill="none"
                    stroke={c.color} strokeWidth={selConn === c.id ? 3.6 : 2.4} markerEnd={`url(#ar-${c.color.slice(1)})`}
                    className={selConn === c.id ? "dash-march" : ""} strokeDasharray={selConn === c.id ? "7 7" : undefined} />
                  {c.label && (
                    <text x={mx} y={my - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={c.color}
                      style={{ paintOrder: "stroke", stroke: "var(--canvas)", strokeWidth: 5, fontFamily: "Anuphan, sans-serif" }}>{c.label}</text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* items */}
          {sortedItems.map((it) => (
            <ItemView key={it.id} it={it} selected={sel.has(it.id)} single={sel.size === 1 && sel.has(it.id)}
              pending={pendingFrom === it.id} editing={editing?.id === it.id ? editing.field : null}
              meId={me.id} zoom={view.zoom} readOnly={readOnly}
              onDown={(e) => onItemDown(e, it)} onResize={(e, c) => startResize(e, it, c)}
              onDbl={(field) => !readOnly && setEditing({ id: it.id, field })}
              onCtx={(e) => { setCtxMenu({ x: e.clientX, y: e.clientY, itemId: it.id }); }}
              onVote={() => vote(it)} onCommit={(f, v) => commitText(it.id, f, v)}
              onOpen={() => setDrawerId(it.id)} />
          ))}

          {/* marquee / new frame preview */}
          {marquee && (
            <div className="absolute rounded-lg pointer-events-none" style={{
              left: Math.min(marquee.x1, marquee.x2), top: Math.min(marquee.y1, marquee.y2),
              width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1),
              border: "1.5px dashed var(--gold)", background: "color-mix(in srgb, var(--gold) 10%, transparent)",
            }} />
          )}

          {/* remote cursors */}
          {onlinePeers.filter((p) => p.cursor).map((p) => <RemoteCursor key={p.tabId} peer={p} zoom={view.zoom} />)}
        </div>

        {/* empty state */}
        {empty && !readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center fade-up pointer-events-auto">
              <div className="text-[42px] mb-2">💡</div>
              <div className="font-display font-bold text-[19px]">เริ่มจากความคิดแรก</div>
              <p className="text-[13.5px] mt-1.5" style={{ color: "var(--muted)" }}>ดับเบิลคลิกที่ว่างเพื่อสร้างสติ๊กกี้ · ลากเพื่อเลือก · Scroll เพื่อเลื่อน · Ctrl+Scroll เพื่อซูม</p>
              <div className="flex gap-2 justify-center mt-5">
                <button className="btn btn-gold" onClick={() => { const it = makeItem({ type: "sticky", x: -95, y: -95, color: "#FFE06B" }); addItem(it, "สร้างสติ๊กกี้ใหม่"); setEditing({ id: it.id, field: "body" }); }}><StickyNote size={15} /> สติ๊กกี้แรก</button>
                <button className="btn" onClick={() => setTool("pen")}><PenLine size={15} /> ลองวาดดู</button>
                <button className="btn" onClick={() => setTool("frame")}><FrameIcon size={15} /> สร้างเฟรม</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= floating toolbar ================= */}
      {!readOnly && (
        <div className="absolute z-50" style={tbPos ? { left: tbPos.x, top: tbPos.y } : { left: "50%", bottom: 22, transform: "translateX(-50%)" }}>
          <div className="panel !rounded-2xl px-1.5 py-1.5 flex items-center gap-0.5 max-w-[94vw] overflow-x-auto" style={{ boxShadow: "var(--shadow-lg)" }}>
            <div className="cursor-grab active:cursor-grabbing px-0.5 flex items-center self-stretch" style={{ color: "var(--muted)" }}
              onPointerDown={(e) => {
                e.preventDefault();
                const startX = e.clientX, startY = e.clientY;
                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                const move = (ev: PointerEvent) => {
                  const nx = Math.max(6, Math.min(window.innerWidth - rect.width - 6, rect.left + ev.clientX - startX));
                  const ny = Math.max(64, Math.min(window.innerHeight - rect.height - 6, rect.top + ev.clientY - startY));
                  setTbPos({ x: nx, y: ny });
                  try { localStorage.setItem("bs-toolbar", JSON.stringify({ x: nx, y: ny })); } catch { /* noop */ }
                };
                const upEv = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", upEv); };
                window.addEventListener("pointermove", move); window.addEventListener("pointerup", upEv);
              }}>
              <GripVertical size={15} />
            </div>
            <span className="tl-sep" />
            {tools.map((t) => (
              <div key={t.id} className="relative">
                {t.id === "shape" ? (
                  <ShapeToolButton kind={shapeKind} onKind={setShapeKind} active={tool === "shape"} onPick={() => setTool("shape")} />
                ) : t.id === "emoji" ? (
                  <EmojiToolButton emoji={emoji} onEmoji={(em) => { setEmoji(em); setTool("emoji"); }} active={tool === "emoji"} />
                ) : (
                  <button className={`tl-btn ${tool === t.id ? "on" : ""}`} onClick={() => { setTool(t.id); setPendingFrom(null); }}>
                    <t.icon size={19} />
                    <span className="tl-tip">{t.label}{t.key ? ` · ${t.key}` : ""}</span>
                  </button>
                )}
              </div>
            ))}
            <span className="tl-sep" />
            <div className="relative">
              <button className={`tl-btn ${paletteOpen ? "on" : ""}`} onClick={() => setPaletteOpen((o) => !o)}>
                <Palette size={19} />
                <span className="tl-tip">สีการ์ด / สีปากกา</span>
              </button>
              {paletteOpen && (
                <div className="menu-panel absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pop-in flex flex-col gap-2 !p-3" style={{ minWidth: 190 }}>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>สีสติ๊กกี้ / การ์ด / รูปทรง</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {PASTELS.slice(0, 7).map((c) => (
                      <button key={c} className="w-7 h-7 rounded-lg transition-transform hover:scale-110" style={{ background: c, boxShadow: color === c ? "inset 0 0 0 2.5px var(--gold-strong)" : "inset 0 0 0 1px rgba(0,0,0,.1)" }} onClick={() => { setColor(c); if (sel.size) setColorOf(sel, c); }} />
                    ))}
                  </div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--muted)" }}>สีปากกา / ลูกศร</div>
                  <div className="flex gap-1.5">
                    {DRAW_COLORS.map((c) => (
                      <button key={c} className="w-7 h-7 rounded-lg transition-transform hover:scale-110" style={{ background: c, boxShadow: drawColor === c ? "inset 0 0 0 2.5px var(--gold)" : "inset 0 0 0 1px rgba(0,0,0,.1)" }} onClick={() => setDrawColor(c)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="tl-sep" />
            <button className="tl-btn" onClick={undo} style={{ opacity: undoStack.current.length ? 1 : 0.35 }}><Undo2 size={19} /><span className="tl-tip">เลิกทำ · Ctrl+Z</span></button>
            <button className="tl-btn" onClick={redo} style={{ opacity: redoStack.current.length ? 1 : 0.35 }}><Redo2 size={19} /><span className="tl-tip">ทำซ้ำ · Ctrl+Shift+Z</span></button>
          </div>
          {pendingFrom && (
            <div className="mt-2 mx-auto w-fit chip !py-1.5 pop-in" style={{ background: "var(--gold-soft)", color: "var(--gold-strong)", borderColor: "var(--gold)" }}>
              🔗 เลือกการ์ดปลายทาง... (Esc เพื่อยกเลิก)
            </div>
          )}
        </div>
      )}

      {/* zoom pill */}
      <div className="absolute z-30 right-3 flex items-center gap-1 panel !rounded-xl px-1.5 py-1" style={{ top: 68, boxShadow: "var(--shadow-md)" }}>
        <button className="icon-btn !w-8 !h-8" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.2) }))}><Minus size={15} /></button>
        <button className="text-[12px] font-bold w-12 text-center tabular-nums" onClick={() => setView((v) => ({ ...v, zoom: 1 }))}>{Math.round(view.zoom * 100)}%</button>
        <button className="icon-btn !w-8 !h-8" onClick={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.2) }))}><Plus size={15} /></button>
        <button className="icon-btn !w-8 !h-8" onClick={fitView} title="พอดีจอ"><Maximize2 size={14} /></button>
      </div>

      {/* connector label editor */}
      {connLabel && (
        <input autoFocus className="input fixed z-[120] !w-[150px] !py-1.5 !text-[12.5px]" style={{ left: connLabel.x - 75, top: connLabel.y - 16 }}
          defaultValue={board.connectors.find((c) => c.id === connLabel.id)?.label || ""} placeholder="ป้ายกำกับ (Enter)"
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setConnLabel(null); }}
          onBlur={(e) => { mutate((b) => { const c = b.connectors.find((x) => x.id === connLabel.id); if (c) c.label = e.target.value || undefined; }, { history: true }); setConnLabel(null); }} />
      )}

      {/* item context menu */}
      {ctxMenu && (() => {
        const it = board.items.find((i) => i.id === ctxMenu.itemId);
        if (!it) return null;
        return (
          <div className="menu-panel fixed pop-in" style={{ left: Math.min(ctxMenu.x, window.innerWidth - 230), top: Math.min(ctxMenu.y, window.innerHeight - 300), minWidth: 220 }} onMouseLeave={() => setCtxMenu(null)}>
            <button className="menu-item" onClick={() => { setDrawerId(it.id); setCtxMenu(null); }}><Pencil size={14} /> แก้ไขรายละเอียด</button>
            <button className="menu-item" onClick={() => { setSel(new Set([it.id])); duplicateSel(); setCtxMenu(null); }}><Copy size={14} /> ทำซ้ำ (Ctrl+D)</button>
            <button className="menu-item" onClick={() => { vote(it); setCtxMenu(null); }}><ThumbsUp size={14} /> {it.votes.includes(me.id) ? "เลิกโหวต" : "โหวต 👍"}</button>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>สี:</span>
              {PASTELS.slice(0, 7).map((c) => (
                <button key={c} className="w-5.5 h-5.5 rounded-md transition-transform hover:scale-110" style={{ width: 21, height: 21, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} onClick={() => { setColorOf([it.id], c); setCtxMenu(null); }} />
              ))}
            </div>
            <button className="menu-item" onClick={() => { setSel(new Set([it.id])); zMove("front"); setCtxMenu(null); }}><BringToFront size={14} /> นำไปข้างหน้าสุด</button>
            <button className="menu-item" onClick={() => { setSel(new Set([it.id])); zMove("back"); setCtxMenu(null); }}><SendToBack size={14} /> ส่งไปข้างหลังสุด</button>
            <button className="menu-item danger" onClick={() => { setSel(new Set([it.id])); deleteSel(); setCtxMenu(null); }}><Trash2 size={14} /> ลบการ์ด</button>
          </div>
        );
      })()}

      {/* ================= chat panel ================= */}
      <AnimatePresence>
        {chatOpen && <ChatPanel projectId={projectId} me={me} onClose={() => setChatOpen(false)} msgs={app.chat.filter((m) => m.projectId === projectId)} />}
      </AnimatePresence>

      {/* drawers & modals */}
      <AnimatePresence>
        {activityOpen && <ActivityDrawer projectId={projectId} onClose={() => setActivityOpen(false)} />}
      </AnimatePresence>
      {drawerId && <CardDrawer projectId={projectId} itemId={drawerId} onClose={() => setDrawerId(null)} onDeleted={() => { setDrawerId(null); }} />}
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} project={project} me={me} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} board={board} project={project} />
      <ShortcutsModal open={keysOpen} onClose={() => setKeysOpen(false)} />
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} title="ลบโปรเจกต์นี้?" body={`"${project.name}" และการ์ดทั้งหมดจะถูกลบถาวร พร้อมบันทึกใน Activity Log ว่าใครลบ`} yesLabel="ลบถาวร"
        onYes={() => { deleteProject(project.id); onBack(); toast("ลบโปรเจกต์แล้ว", "ok", "🗑️"); }} />
    </div>
  );
}

/* ================= item view ================= */
function ItemView({ it, selected, single, pending, editing, meId, zoom, readOnly, onDown, onResize, onDbl, onCtx, onVote, onCommit, onOpen }: {
  it: Item; selected: boolean; single: boolean; pending: boolean; editing: "body" | "title" | null; meId: string; zoom: number; readOnly: boolean;
  onDown: (e: React.PointerEvent) => void; onResize: (e: React.PointerEvent, corner: string) => void;
  onDbl: (field: "body" | "title") => void; onCtx: (e: React.MouseEvent) => void; onVote: () => void;
  onCommit: (field: "body" | "title", v: string) => void; onOpen: () => void;
}) {
  const meta = it.kind ? KIND_META[it.kind] : null;
  const rot = it.type === "sticky" ? ((hash(it.id) % 5) - 2) * 1.15 : 0;
  const [voting, setVoting] = useState(false);
  const myVote = it.votes.includes(meId);
  const inv = 1 / zoom;

  const ring = (selected || pending) && (
    <div className="absolute rounded-[10px] pointer-events-none" style={{ inset: -4, border: `2px solid ${pending ? "var(--info)" : "var(--gold)"}`, borderRadius: it.type === "sticky" ? 8 : 16 }} />
  );
  const handles = single && !readOnly && ["nw", "ne", "sw", "se"].map((c) => (
    <div key={c} onPointerDown={(e) => onResize(e, c)} className="absolute w-3.5 h-3.5 rounded-full z-20"
      style={{
        background: "var(--panel)", border: "2px solid var(--gold)", cursor: `${c}-resize`,
        ...(c.includes("n") ? { top: -7 } : { bottom: -7 }), ...(c.includes("w") ? { left: -7 } : { right: -7 }),
      }} />
  ));

  const editable = (field: "body" | "title", cls: string, ph: string) =>
    editing === field ? (
      <EditableText initial={it[field]} className={cls} darkCard={it.type !== "text"}
        onDone={(v) => onCommit(field, v)} />
    ) : (
      <div className={`item-body ${cls}`} data-ph={ph} onDoubleClick={(e) => { e.stopPropagation(); onDbl(field); }}>{it[field]}</div>
    );

  const footer = it.type !== "text" && it.type !== "emoji" && (
    <div className="flex items-center gap-1.5 mt-auto pt-1.5 text-[10.5px] font-bold" style={{ color: it.type === "card" ? "rgba(43,43,38,.55)" : "rgba(43,43,38,.6)" }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-display shrink-0" style={{ background: it.authorColor }}>{it.authorName.slice(0, 1)}</span>
      <span className="truncate">{it.editedByName && it.editedByName !== it.authorName ? `${it.authorName} · ✏️ ${it.editedByName}` : it.authorName}</span>
      <span className="ml-auto flex items-center gap-1.5 shrink-0">
        <button className="flex items-center gap-0.5 rounded-md px-1 py-0.5 transition-transform active:scale-90 hover:bg-black/5"
          style={{ color: myVote ? "#b98a24" : undefined }}
          onClick={(e) => { e.stopPropagation(); onVote(); setVoting(true); setTimeout(() => setVoting(false), 420); }}>
          <ThumbsUp size={11} className={voting ? "vote-pop" : ""} fill={myVote ? "currentColor" : "none"} />
          <span key={it.votes.length} className={voting ? "vote-pop" : ""}>{it.votes.length}</span>
        </button>
        {it.comments.length > 0 && <button className="flex items-center gap-0.5 hover:bg-black/5 rounded-md px-1 py-0.5" onClick={(e) => { e.stopPropagation(); onOpen(); }}><MessageCircle size={11} /> {it.comments.length}</button>}
      </span>
    </div>
  );

  let body: React.ReactNode = null;
  if (it.type === "emoji") {
    body = (
      <div className="w-full h-full flex items-center justify-center pointer-events-none" style={{ fontSize: Math.min(it.w, it.h) * 0.72 }}>{it.emoji}</div>
    );
  } else if (it.type === "text") {
    body = <div className="w-full">{editable("body", "font-display font-bold text-[19px] leading-snug", "พิมพ์ข้อความ...")}</div>;
  } else if (it.type === "shape") {
    body = (
      <div className="relative w-full h-full">
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${it.w} ${it.h}`} preserveAspectRatio="none">
          {it.shape === "diamond"
            ? <polygon points={`${it.w / 2},2 ${it.w - 2},${it.h / 2} ${it.w / 2},${it.h - 2} 2,${it.h / 2}`} fill={it.color} stroke="rgba(20,30,50,.28)" strokeWidth={1.6} />
            : it.shape === "ellipse"
              ? <ellipse cx={it.w / 2} cy={it.h / 2} rx={it.w / 2 - 2} ry={it.h / 2 - 2} fill={it.color} stroke="rgba(20,30,50,.28)" strokeWidth={1.6} />
              : <rect x={2} y={2} width={it.w - 4} height={it.h - 4} rx={13} fill={it.color} stroke="rgba(20,30,50,.28)" strokeWidth={1.6} />}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-[16%] text-center">
          {editable("body", "text-[13.5px] font-semibold leading-snug w-full", "ป้ายกำกับ...")}
        </div>
      </div>
    );
  } else if (it.type === "sticky") {
    body = (
      <div className="w-full h-full flex flex-col p-3.5" style={{ color: "var(--card-ink)" }}>
        {editable("body", "text-[14px] font-medium leading-snug flex-1", "พิมพ์ไอเดีย...")}
        {footer}
      </div>
    );
  } else {
    body = (
      <div className="w-full h-full flex flex-col p-3.5 pl-4 bg-white rounded-[14px]" style={{ color: "var(--card-ink)" }}>
        {meta && <span className="w-fit text-[10px] font-bold px-2 py-0.5 rounded-md mb-1.5" style={{ background: meta.color }}>{meta.label} · {meta.en}</span>}
        {editable("title", "font-display font-bold text-[14.5px] leading-snug", "หัวข้อการ์ด...")}
        <div className="mt-1 flex-1 min-h-0">{editable("body", "text-[12.5px] leading-snug", "รายละเอียด...")}</div>
        {it.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {it.tags.map((t, i) => <span key={i} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(0,0,0,.06)" }}>#{t}</span>)}
          </div>
        )}
        {footer}
      </div>
    );
  }

  return (
    <div className={`absolute pop-in ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
      style={{
        left: it.x, top: it.y, width: it.w, height: it.type === "text" ? undefined : it.h, minHeight: it.type === "text" ? 30 : undefined,
        transform: rot ? `rotate(${rot}deg)` : undefined, zIndex: 10 + it.z,
      }}
      onPointerDown={onDown} onContextMenu={onCtx}
      onClick={(e) => { if (it.type === "card" && e.detail === 1) { /* single click noop */ } }}>
      <div className={`w-full h-full transition-shadow ${it.type === "sticky" ? "rounded-[7px] card-shadow" : it.type === "card" ? "rounded-[14px] card-shadow" : ""} ${selected ? "card-shadow-lift" : ""}`}
        style={{ background: it.type === "sticky" ? it.color : it.type === "card" ? "#fff" : "transparent", height: it.type === "text" ? undefined : "100%" }}>
        {body}
      </div>
      {ring}{handles}
      {pending && <div className="absolute rounded-[10px] pointer-events-none ring-ping" style={{ inset: -4, border: "2px solid var(--info)" }} />}
    </div>
  );
}

function EditableText({ initial, className, onDone, darkCard }: { initial: string; className: string; onDone: (v: string) => void; darkCard?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (el.dataset.init !== "1") { el.textContent = initial; el.dataset.init = "1"; }
    el.focus();
    const range = document.createRange(); range.selectNodeContents(el);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(range);
  }, [initial]);
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning className={`${className} item-body`}
      style={{ cursor: "text", userSelect: "text", background: darkCard ? "rgba(255,255,255,.35)" : "color-mix(in srgb, var(--panel) 60%, transparent)", borderRadius: 6, outline: "2px solid var(--gold)", outlineOffset: 2 }}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone((e.target as HTMLElement).textContent || "")}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur(); }
        if (e.key === "Escape") { (e.target as HTMLElement).textContent = initial; (e.target as HTMLElement).blur(); }
      }} />
  );
}

/* ================= frame view ================= */
function FrameView({ f, selected, renaming, onDown, onRenameDone, onRename, onResize, onColor, onDelete }: {
  f: Frame; selected: boolean; renaming: boolean;
  onDown: (e: React.PointerEvent) => void; onRenameDone: (v: string) => void; onRename: () => void;
  onResize: (e: React.PointerEvent) => void; onColor: (c: string) => void; onDelete: () => void;
}) {
  return (
    <div className="absolute" style={{ left: f.x, top: f.y, width: f.w, height: f.h }} onPointerDown={onDown} onDoubleClick={(e) => { e.stopPropagation(); onRename(); }}>
      <div className="absolute inset-0 rounded-[18px]" style={{ background: `color-mix(in srgb, ${f.color} 16%, transparent)`, border: `2px solid color-mix(in srgb, ${f.color} 75%, transparent)` }} />
      <div className="absolute -top-4 left-3 flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ background: f.color, color: "var(--card-ink)", boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}>
        {renaming ? (
          <input autoFocus className="bg-transparent outline-none font-display font-bold text-[13px] w-[150px]" defaultValue={f.title}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => onRenameDone(e.target.value || f.title)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <span className="font-display font-bold text-[13px] cursor-pointer no-select">{f.title}</span>
        )}
      </div>
      {selected && (
        <>
          <div className="absolute rounded-[18px] pointer-events-none" style={{ inset: -5, border: "2px dashed var(--gold)" }} />
          <div className="absolute -top-12 left-3 flex items-center gap-1 panel !rounded-xl px-2 py-1.5 pop-in" onPointerDown={(e) => e.stopPropagation()}>
            {FRAME_COLORS.map((c) => (
              <button key={c} className="rounded-md transition-transform hover:scale-110" style={{ width: 18, height: 18, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} onClick={() => onColor(c)} />
            ))}
            <span className="w-px h-4 mx-0.5" style={{ background: "var(--line)" }} />
            <button className="icon-btn !w-7 !h-7" style={{ color: "var(--danger)" }} onClick={onDelete}><Trash2 size={13} /></button>
          </div>
          <div onPointerDown={onResize} className="absolute w-4 h-4 rounded-full" style={{ right: -8, bottom: -8, background: "var(--panel)", border: "2px solid var(--gold)", cursor: "nwse-resize" }} />
        </>
      )}
    </div>
  );
}

/* ================= remote cursor ================= */
function RemoteCursor({ peer, zoom }: { peer: Peer; zoom: number }) {
  if (!peer.cursor) return null;
  return (
    <motion.div className="absolute z-[70] pointer-events-none" initial={false}
      animate={{ x: peer.cursor.x, y: peer.cursor.y }} transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.6 }}>
      <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" }}>
          <path d="M4 2l16 8.5-7.3 1.6L9 19.5 4 2z" fill={peer.color} stroke="white" strokeWidth="1.4" />
        </svg>
        <span className="ml-3.5 -mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white whitespace-nowrap" style={{ background: peer.color, boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
          {peer.name}{peer.bot && <span title="เพื่อนร่วมทีมจำลอง">✨</span>}
        </span>
      </div>
    </motion.div>
  );
}

/* ================= chat panel ================= */
function ChatPanel({ projectId, me, onClose, msgs }: { projectId: string; me: User; onClose: () => void; msgs: ReturnType<typeof useApp>["chat"] }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: 9e5, behavior: "smooth" }); }, [msgs.length]);
  const send = () => {
    if (!text.trim()) return;
    sendChat({ projectId, userId: me.id, name: me.name, color: me.color, text: text.trim() });
    setText("");
  };
  return (
    <motion.div initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute z-40 top-[58px] right-0 bottom-0 w-[300px] flex flex-col" style={{ background: "var(--panel)", borderLeft: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
      <div className="flex items-center gap-2 px-4 h-[50px] border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <MessageCircle size={16} style={{ color: "var(--gold-strong)" }} />
        <span className="font-display font-bold text-[14px]">แชททีม</span>
        <span className="chip !text-[10px]">สด · เรียลไทม์</span>
        <button className="icon-btn !w-8 !h-8 ml-auto" onClick={onClose}><X size={15} /></button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {msgs.length === 0 && <div className="text-center text-[12.5px] mt-8" style={{ color: "var(--muted)" }}>เริ่มคุยกับทีมเลย 💬<br />ข้อความซิงก์ข้ามแท็บทันที</div>}
        {msgs.map((m) => {
          const mine = m.userId === me.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar user={{ name: m.name, color: m.color }} size={26} />
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                <div className="text-[10.5px] font-bold mb-0.5" style={{ color: "var(--muted)" }}>{mine ? "คุณ" : m.name} · {timeAgo(m.at)}</div>
                <div className="inline-block px-3 py-2 rounded-2xl text-[13px] leading-snug text-left"
                  style={mine ? { background: "var(--gold-soft)", color: "var(--gold-strong)", borderBottomRightRadius: 5 } : { background: "var(--panel-2)", borderBottomLeftRadius: 5 }}>
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--line)" }}>
        <div className="flex gap-1 mb-2">
          {["👍", "🔥", "💡", "❤️", "😂", "🎯"].map((e) => (
            <button key={e} className="text-[16px] hover:scale-125 transition-transform" onClick={() => setText((t) => t + e)}>{e}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input className="input !py-2" placeholder="พิมพ์ข้อความ..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="btn btn-gold !px-3" onClick={send}><Send size={15} /></button>
        </div>
      </div>
    </motion.div>
  );
}

/* ================= geometry helpers ================= */
function pointsToPath(pts: number[]): string {
  if (pts.length < 4) return `M${pts[0]},${pts[1]} L${pts[pts.length - 2] ?? pts[0]},${pts[pts.length - 1] ?? pts[1]}`;
  let d = `M${pts[0]},${pts[1]}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
    d += ` Q${pts[i]},${pts[i + 1]} ${mx},${my}`;
  }
  d += ` L${pts[pts.length - 2]},${pts[pts.length - 1]}`;
  return d;
}
function edgePoint(it: { x: number; y: number; w: number; h: number }, tx: number, ty: number) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = dx !== 0 ? it.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? it.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}
function strokeHit(s: Stroke, x: number, y: number, th: number): boolean {
  for (let i = 0; i < s.points.length - 2; i += 2) {
    const d = distToSeg(x, y, s.points[i], s.points[i + 1], s.points[i + 2], s.points[i + 3]);
    if (d < th + s.size) return true;
  }
  return false;
}
function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/* ================= shape & emoji tool buttons ================= */
function ShapeToolButton({ kind, onKind, active, onPick }: { kind: string; onKind: (k: any) => void; active: boolean; onPick: () => void }) {
  const [open, setOpen] = useState(false);
  const Icon = kind === "diamond" ? DiamondIcon : kind === "ellipse" ? Circle : Square;
  return (
    <div className="relative">
      <div className="flex items-center">
        <button className={`tl-btn ${active ? "on" : ""}`} onClick={() => { onPick(); }} onPointerDown={() => setOpen(false)}>
          <Icon size={19} /><span className="tl-tip">รูปทรง · X</span>
        </button>
        <button className="w-4 self-stretch flex items-center justify-center rounded-r-lg hover:bg-[var(--panel-2)]" style={{ color: "var(--muted)" }} onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={11} />
        </button>
      </div>
      {open && (
        <div className="menu-panel absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pop-in flex gap-1 !p-2">
          {([["rect", Square, "กล่อง"], ["diamond", DiamondIcon, "ตัดสินใจ"], ["ellipse", Circle, "เริ่มต้น/สิ้นสุด"]] as const).map(([k, Ic, lb]) => (
            <button key={k} className={`tl-btn ${kind === k ? "on" : ""}`} onClick={() => { onKind(k); onPick(); setOpen(false); }}>
              <Ic size={17} /><span className="tl-tip">{lb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmojiToolButton({ emoji, onEmoji, active }: { emoji: string; onEmoji: (e: string) => void; active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className={`tl-btn ${active ? "on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="text-[19px] leading-none">{emoji}</span><span className="tl-tip">สติกเกอร์อีโมจิ</span>
      </button>
      {open && (
        <div className="menu-panel absolute bottom-full mb-2 right-0 pop-in grid grid-cols-6 gap-1 !p-2.5" style={{ width: 250 }}>
          {EMOJIS.map((e) => (
            <button key={e} className="text-[19px] w-9 h-9 rounded-lg hover:bg-[var(--panel-2)] hover:scale-115 transition-transform" onClick={() => { onEmoji(e); setOpen(false); }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
