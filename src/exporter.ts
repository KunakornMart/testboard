import type { Board, Item, Project } from "./types";
import { KIND_META } from "./data";

export interface ExportOpts {
  scale: number; // 1..4
  format: "png" | "jpg";
  grid: boolean;
  dark: boolean;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = [];
  for (const rawLine of (text || "").split("\n")) {
    let line = "";
    for (const word of rawLine.split(" ")) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width <= maxW) { line = candidate; continue; }
      if (line) { out.push(line); line = ""; }
      if (ctx.measureText(word).width <= maxW) { line = word; continue; }
      // break long word (Thai) char by char
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
        else line += ch;
      }
    }
    out.push(line);
    if (out.length >= maxLines) break;
  }
  return out.slice(0, maxLines);
}

function edgePoint(it: { x: number; y: number; w: number; h: number }, tx: number, ty: number) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = dx !== 0 ? (it.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (it.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/* ---------- connector geometry (ใช้ทั้งบน canvas และ exporter) ---------- */
export type Rect = { x: number; y: number; w: number; h: number };
export type Side = "n" | "e" | "s" | "w";
export const sidePoint = (it: Rect, side: Side) =>
  side === "n" ? { x: it.x + it.w / 2, y: it.y }
  : side === "s" ? { x: it.x + it.w / 2, y: it.y + it.h }
  : side === "e" ? { x: it.x + it.w, y: it.y + it.h / 2 }
  : { x: it.x, y: it.y + it.h / 2 };
export const sideVec = (side: Side) =>
  side === "n" ? { x: 0, y: -1 } : side === "s" ? { x: 0, y: 1 } : side === "e" ? { x: 1, y: 0 } : { x: -1, y: 0 };
export function nearestSide(it: Rect, p: { x: number; y: number }): Side {
  let best: Side = "n", bd = Infinity;
  (["n", "e", "s", "w"] as Side[]).forEach((s) => {
    const m = sidePoint(it, s);
    const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2;
    if (d < bd) { bd = d; best = s; }
  });
  return best;
}
export function connectorGeometry(a: Rect, b: Rect, conn: { fromSide?: Side; toSide?: Side }) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const norm = (v: { x: number; y: number }) => {
    const l = Math.hypot(v.x, v.y);
    return l ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
  };
  const p1 = conn.fromSide ? sidePoint(a, conn.fromSide) : edgePoint(a, bc.x, bc.y);
  const v1 = conn.fromSide ? sideVec(conn.fromSide) : norm({ x: p1.x - ac.x, y: p1.y - ac.y });
  const p2 = conn.toSide ? sidePoint(b, conn.toSide) : edgePoint(b, ac.x, ac.y);
  const v2 = conn.toSide ? sideVec(conn.toSide) : norm({ x: p2.x - bc.x, y: p2.y - bc.y });
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const k = Math.max(34, Math.min(150, dist * 0.45));
  const c1 = { x: p1.x + v1.x * k, y: p1.y + v1.y * k };
  const c2 = { x: p2.x + v2.x * k, y: p2.y + v2.y * k };
  const mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
  return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, p1, p2, c1, c2, mid };
}

function strokePath(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
  }
  if (pts.length > 2) ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
}

export function computeBounds(board: Board) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  };
  board.frames.forEach((f) => eat(f.x, f.y, f.w, f.h));
  board.items.forEach((i) => eat(i.x, i.y, i.w, i.h));
  board.strokes.forEach((s) => { for (let i = 0; i < s.points.length; i += 2) eat(s.points[i] - 10, s.points[i + 1] - 10, 20, 20); });
  if (!isFinite(minX)) { minX = -300; minY = -200; maxX = 900; maxY = 500; }
  return { minX: minX - 70, minY: minY - 70, maxX: maxX + 70, maxY: maxY + 70 };
}

export async function renderBoard(board: Board, project: Project | null, opts: ExportOpts): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const { minX, minY, maxX, maxY } = computeBounds(board);
  const s = opts.scale;
  const W = Math.min(Math.round((maxX - minX) * s), 9000);
  const H = Math.min(Math.round((maxY - minY) * s), 9000);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(s, s);
  ctx.translate(-minX, -minY);

  const bg = opts.dark ? "#0d1424" : "#f4f5ef";
  const ink = opts.dark ? "#e9edf6" : "#212a3c";
  const cardInk = "#2b2b26";

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  if (opts.grid) {
    ctx.fillStyle = opts.dark ? "#1e2b49" : "#d2d6c5";
    for (let gx = Math.ceil(minX / 26) * 26; gx < maxX; gx += 26)
      for (let gy = Math.ceil(minY / 26) * 26; gy < maxY; gy += 26) {
        ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, Math.PI * 2); ctx.fill();
      }
  }

  // watermark
  ctx.font = `600 ${13}px Prompt, Anuphan, sans-serif`;
  ctx.fillStyle = opts.dark ? "rgba(233,237,246,.4)" : "rgba(33,42,60,.4)";
  ctx.fillText(`MTS BrainSpace · ${project?.name || "Board"}`, minX + 18, maxY - 16);

  // frames
  for (const f of board.frames) {
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = f.color;
    roundedRect(ctx, f.x, f.y, f.w, f.h, 18); ctx.fill();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = f.color; ctx.lineWidth = 2;
    roundedRect(ctx, f.x, f.y, f.w, f.h, 18); ctx.stroke();
    ctx.restore();
    ctx.font = `700 17px Prompt, Anuphan, sans-serif`;
    ctx.fillStyle = cardInk;
    const tw = ctx.measureText(f.title).width;
    ctx.fillStyle = f.color;
    roundedRect(ctx, f.x + 14, f.y - 15, tw + 22, 30, 9); ctx.fill();
    ctx.fillStyle = cardInk;
    ctx.fillText(f.title, f.x + 25, f.y + 5.5);
  }

  // strokes
  for (const st of board.strokes) {
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (st.tool === "marker") { ctx.globalAlpha = 0.38; ctx.lineWidth = st.size * 3; }
    else if (st.tool === "pencil") { ctx.globalAlpha = 0.85; ctx.lineWidth = st.size * 0.7; }
    else ctx.lineWidth = st.size;
    ctx.strokeStyle = st.color;
    strokePath(ctx, st.points);
    ctx.stroke();
    ctx.restore();
  }

  // connectors
  const byId = new Map(board.items.map((i) => [i.id, i]));
  for (const c of board.connectors) {
    const a = byId.get(c.from), b = byId.get(c.to);
    if (!a || !b) continue;
    const g = connectorGeometry(a, b, c);
    ctx.save();
    ctx.strokeStyle = c.color; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.stroke(new Path2D(g.d));
    const ang = Math.atan2(g.p2.y - g.c2.y, g.p2.x - g.c2.x);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(g.p2.x, g.p2.y);
    ctx.lineTo(g.p2.x - 13 * Math.cos(ang - 0.42), g.p2.y - 13 * Math.sin(ang - 0.42));
    ctx.lineTo(g.p2.x - 13 * Math.cos(ang + 0.42), g.p2.y - 13 * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
    if (c.label) {
      ctx.font = `600 12px Anuphan, sans-serif`;
      const tw = ctx.measureText(c.label).width;
      ctx.fillStyle = bg;
      roundedRect(ctx, g.mid.x - tw / 2 - 8, g.mid.y - 12, tw + 16, 22, 8); ctx.fill();
      ctx.strokeStyle = c.color; ctx.lineWidth = 1.4;
      roundedRect(ctx, g.mid.x - tw / 2 - 8, g.mid.y - 12, tw + 16, 22, 8); ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(c.label, g.mid.x - tw / 2, g.mid.y + 3.5);
    }
    ctx.restore();
  }

  // items
  const items = [...board.items].sort((a, b) => a.z - b.z);
  for (const it of items) {
    ctx.save();
    if (it.type === "emoji") {
      ctx.font = `${Math.min(it.w, it.h) * 0.78}px "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(it.emoji || "💡", it.x + it.w / 2, it.y + it.h / 2);
      ctx.restore(); continue;
    }
    if (it.type === "text") {
      ctx.font = `700 19px Prompt, Anuphan, sans-serif`;
      ctx.fillStyle = ink;
      wrapText(ctx, it.body, it.w + 300, 10).forEach((l, i) => ctx.fillText(l, it.x, it.y + 20 + i * 26));
      ctx.restore(); continue;
    }
    if (it.type === "shape") {
      ctx.shadowColor = "rgba(20,30,50,.15)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.fillStyle = it.color;
      ctx.strokeStyle = "rgba(20,30,50,.25)"; ctx.lineWidth = 1.6;
      if (it.shape === "diamond") {
        ctx.beginPath();
        ctx.moveTo(it.x + it.w / 2, it.y); ctx.lineTo(it.x + it.w, it.y + it.h / 2);
        ctx.lineTo(it.x + it.w / 2, it.y + it.h); ctx.lineTo(it.x, it.y + it.h / 2);
        ctx.closePath(); ctx.fill(); ctx.shadowColor = "transparent"; ctx.stroke();
      } else if (it.shape === "ellipse") {
        ctx.beginPath(); ctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.shadowColor = "transparent"; ctx.stroke();
      } else {
        roundedRect(ctx, it.x, it.y, it.w, it.h, 14); ctx.fill(); ctx.shadowColor = "transparent"; ctx.stroke();
      }
      ctx.fillStyle = cardInk;
      ctx.font = `600 14px Anuphan, sans-serif`;
      ctx.textAlign = "center";
      const lines = wrapText(ctx, it.body, it.w * 0.72, 4);
      const lh = 19, startY = it.y + it.h / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, it.x + it.w / 2, startY + i * lh + 4));
      ctx.restore(); continue;
    }
    if (it.type === "sticky") {
      ctx.shadowColor = "rgba(20,30,50,.18)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      ctx.fillStyle = it.color === "transparent" ? "#FFE06B" : it.color;
      roundedRect(ctx, it.x, it.y, it.w, it.h, 6); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,.06)";
      ctx.fillRect(it.x, it.y + it.h - 14, it.w, 14);
      ctx.fillStyle = cardInk;
      ctx.font = `500 14.5px Anuphan, sans-serif`;
      wrapText(ctx, it.body, it.w - 28, Math.floor((it.h - 52) / 20)).forEach((l, i) => ctx.fillText(l, it.x + 14, it.y + 26 + i * 20));
      ctx.font = `600 11px Anuphan, sans-serif`;
      ctx.fillStyle = "rgba(43,43,38,.55)";
      ctx.fillText(`✍️ ${it.authorName}${it.votes.length ? `   👍 ${it.votes.length}` : ""}`, it.x + 14, it.y + it.h - 12 + 8 - 4);
      ctx.restore(); continue;
    }
    // card
    const meta = it.kind ? KIND_META[it.kind] : null;
    ctx.shadowColor = "rgba(20,30,50,.16)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, it.x, it.y, it.w, it.h, 14); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(20,30,50,.08)"; ctx.lineWidth = 1.2;
    roundedRect(ctx, it.x, it.y, it.w, it.h, 14); ctx.stroke();
    // kind bar
    if (meta) { ctx.fillStyle = meta.color; roundedRect(ctx, it.x, it.y, 6, it.h, 3); ctx.fill(); }
    let cy = it.y + 24;
    if (meta) {
      ctx.font = `700 10.5px Anuphan, sans-serif`;
      const label = `${meta.label}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = meta.color;
      roundedRect(ctx, it.x + 18, cy - 12, tw + 16, 18, 6); ctx.fill();
      ctx.fillStyle = cardInk;
      ctx.fillText(label, it.x + 26, cy + 1);
      cy += 16;
    }
    if (it.title) {
      ctx.font = `700 15px Prompt, Anuphan, sans-serif`;
      ctx.fillStyle = cardInk;
      wrapText(ctx, it.title, it.w - 36, 2).forEach((l) => { ctx.fillText(l, it.x + 18, cy + 4); cy += 20; });
      cy += 2;
    }
    ctx.font = `500 12.5px Anuphan, sans-serif`;
    ctx.fillStyle = "rgba(43,43,38,.75)";
    wrapText(ctx, it.body, it.w - 36, Math.max(1, Math.floor((it.y + it.h - 40 - cy) / 17))).forEach((l) => { ctx.fillText(l, it.x + 18, cy + 4); cy += 17; });
    ctx.font = `600 11px Anuphan, sans-serif`;
    ctx.fillStyle = "rgba(43,43,38,.55)";
    ctx.fillText(`${it.authorName}${it.editedByName && it.editedByName !== it.authorName ? ` · แก้ไขโดย ${it.editedByName}` : ""}`, it.x + 18, it.y + it.h - 13);
    ctx.textAlign = "right";
    ctx.fillText(`👍 ${it.votes.length}   💬 ${it.comments.length}`, it.x + it.w - 16, it.y + it.h - 13);
    ctx.textAlign = "left";
    ctx.restore();
  }

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, name: string, format: "png" | "jpg") {
  const url = canvas.toDataURL(format === "jpg" ? "image/jpeg" : "image/png", 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.${format}`;
  a.click();
}

export function copyCanvas(canvas: HTMLCanvasElement) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error("no blob"));
      (navigator.clipboard as any).write([new (window as any).ClipboardItem({ "image/png": b })]).then(resolve).catch(reject);
    }, "image/png");
  });
}
