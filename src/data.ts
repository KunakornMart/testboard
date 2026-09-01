import type { Board, ItemKind, Project, User, LogEntry, ChatMsg, AppState } from "./types";

export const DOMAIN = "mtsgoldgroup.com";

export const PASTELS = ["#FFE06B", "#A9E8C5", "#A5D8F6", "#D3C4F5", "#FFB59E", "#FFC7DE", "#FFFFFF", "#DCE3ED"];
export const DRAW_COLORS = ["#212a3c", "#b98a24", "#cf5252", "#37926c", "#4f7fb5", "#8a6fc9"];
export const CONNECTOR_COLORS = ["#b98a24", "#4f7fb5", "#cf5252", "#37926c", "#8a6fc9"];
export const FRAME_COLORS = ["#FFE06B", "#A9E8C5", "#A5D8F6", "#D3C4F5", "#FFB59E", "#FFC7DE", "#DCE3ED"];
export const EMOJIS = ["💡", "🔥", "⭐", "❤️", "🎯", "🚀", "✅", "❓", "⚠️", "🧠", "📌", "🏆", "💰", "📊", "🤖", "🧪", "👀", "🎉", "☕", "🍀", "⏰", "🔗", "📎", "🖼️"];

export const USER_COLORS = ["#e0912f", "#3f8f6b", "#5577c2", "#b06ab0", "#c25e5e", "#3fa7a0", "#8a6fc9", "#c98a3d"];

export const KIND_META: Record<ItemKind, { label: string; en: string; color: string; icon: string }> = {
  idea: { label: "ไอเดีย", en: "Idea", color: "#FFE06B", icon: "bulb" },
  problem: { label: "ปัญหา", en: "Problem", color: "#FFB59E", icon: "alert" },
  question: { label: "คำถาม", en: "Question", color: "#A5D8F6", icon: "help" },
  solution: { label: "วิธีแก้", en: "Solution", color: "#A9E8C5", icon: "check" },
  data: { label: "ข้อมูล", en: "Data", color: "#D3C4F5", icon: "chart" },
  ai: { label: "AI Insight", en: "AI", color: "#FFC7DE", icon: "spark" },
  action: { label: "ลงมือทำ", en: "Action", color: "#DCE3ED", icon: "flag" },
};

export const VIS_META = {
  public: { label: "Public", th: "สาธารณะ — ทุกคนเห็นและแก้ได้", icon: "globe", tone: "#37926c" },
  private: { label: "Private", th: "ส่วนตัว — เฉพาะสมาชิกที่เพิ่ม", icon: "lock", tone: "#b98a24" },
  locked: { label: "Locked", th: "ล็อค — เฉพาะ Admin/เจ้าของ", icon: "shield", tone: "#c25e5e" },
} as const;

export const TEMPLATES: { id: string; name: string; desc: string; icon: string; color: string }[] = [
  { id: "blank", name: "Blank Canvas", desc: "กระดานเปล่า เริ่มต้นอิสระ", icon: "🗒️", color: "#DCE3ED" },
  { id: "free", name: "Free Brainstorm", desc: "โยนไอเดียให้ทั่วบอร์ด", icon: "🧠", color: "#FFE06B" },
  { id: "problem", name: "Problem Solving", desc: "ปัญหา → สาเหตุ → ไอเดีย → วิธีแก้", icon: "🔥", color: "#FFB59E" },
  { id: "ai", name: "AI Use Case", desc: "หาโอกาสใช้ AI ตั้งแต่ต้นจนจบ", icon: "🤖", color: "#D3C4F5" },
  { id: "flow", name: "Flowchart", desc: "วาดโฟลว์งานแบบ draw.io", icon: "🔀", color: "#A5D8F6" },
  { id: "retro", name: "Retrospective", desc: " retrospective ทีม 4 ช่อง", icon: "🔁", color: "#A9E8C5" },
];

export const uid = (p = "ID") => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

const now = Date.now();
const H = 3600_000;
const D = 24 * H;

export function seedState(): AppState {
  const users: User[] = [
    { id: "U-MART", email: `mart@${DOMAIN}`, name: "Mart", dept: "OIA", role: "admin", active: true, color: "#e0912f", createdAt: now - 40 * D },
    { id: "U-GAME", email: `game@${DOMAIN}`, name: "Game", dept: "FIA", role: "member", active: true, color: "#3f8f6b", createdAt: now - 38 * D },
    { id: "U-NUT", email: `nut@${DOMAIN}`, name: "Nut", dept: "OIA", role: "member", active: true, color: "#5577c2", createdAt: now - 35 * D },
    { id: "U-PLE", email: `ple@${DOMAIN}`, name: "Ple", dept: "FIA", role: "admin", active: true, color: "#b06ab0", createdAt: now - 30 * D },
    { id: "U-YOTA", email: `yota@${DOMAIN}`, name: "Yota", dept: "FIA", role: "member", active: false, color: "#3fa7a0", createdAt: now - 22 * D },
  ];

  const p1: Project = {
    id: "PRJ-AIRECON", name: "AI Reconciliation", description: "ระดมไอเดียใช้ AI ตรวจยอด Reconciliation ระหว่าง KPLUS กับ GoldPort",
    dept: "OIA", visibility: "public", members: [], owner: "U-MART", icon: "🤖", color: "#D3C4F5",
    favoriteBy: ["U-MART", "U-GAME"], archived: false, createdAt: now - 6 * D, updatedAt: now - 25 * 60_000,
  };
  const p2: Project = {
    id: "PRJ-FLOW", name: "Ticket Flow Redesign", description: "ออกแบบโฟลว์ Ticket System ใหม่ให้ลื่นขึ้น (เฉพาะทีม FIA)",
    dept: "FIA", visibility: "private", members: ["U-MART", "U-GAME", "U-PLE"], owner: "U-PLE", icon: "🎫", color: "#A5D8F6",
    favoriteBy: [], archived: false, createdAt: now - 3 * D, updatedAt: now - 5 * H,
  };
  const p3: Project = {
    id: "PRJ-RETRO", name: "Retrospective Q3", description: "振り返อร์ quý 3 — ผู้บริหารดูได้อย่างเดียว (Locked)",
    dept: "OIA", visibility: "locked", members: [], owner: "U-MART", icon: "🔁", color: "#A9E8C5",
    favoriteBy: [], archived: false, createdAt: now - 10 * D, updatedAt: now - 2 * D,
  };

  const board1: Board = {
    frames: [
      { id: "FR-1", x: -40, y: -60, w: 620, h: 560, title: "1 · Problem Space", color: "#FFB59E", z: 0 },
      { id: "FR-2", x: 660, y: -60, w: 620, h: 560, title: "2 · Solutions", color: "#A9E8C5", z: 0 },
      { id: "FR-3", x: 300, y: 580, w: 700, h: 380, title: "3 · POC Candidates", color: "#A5D8F6", z: 0 },
    ],
    items: [
      {
        id: "CARD-001", type: "card", kind: "problem", x: 20, y: 30, w: 250, h: 170, color: "#FFB59E",
        title: "ยอดไม่ตรง KPLUS ↔ GoldPort", body: "KPLUS มีเงินเข้า แต่ GoldPort ไม่มี transaction — เกิดเกือบทุกวันศุกร์",
        authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f",
        editedBy: "U-NUT", editedByName: "Nut", editedAt: now - 4 * H,
        votes: ["U-GAME", "U-NUT", "U-PLE"], tags: ["recon", "urgent"],
        comments: [
          { id: "COM-1", userId: "U-GAME", name: "Game", color: "#3f8f6b", text: "สงสัย bank settlement delay T+1", at: now - 5 * H },
          { id: "COM-2", userId: "U-NUT", name: "Nut", color: "#5577c2", text: "ลองดึง statement มาเทียบ time-based ดู", at: now - 4 * H },
        ],
        versions: [], z: 3,
      },
      {
        id: "CARD-002", type: "card", kind: "ai", x: 330, y: 40, w: 250, h: 190, color: "#FFC7DE",
        title: "AI Explain Diff ✨", body: "ให้ AI วิเคราะห์ unmatched transaction พร้อมอธิบาย root cause + confidence score",
        authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f",
        editedBy: "U-MART", editedByName: "Mart", editedAt: now - 26 * H,
        votes: ["U-MART", "U-GAME", "U-NUT", "U-PLE"], tags: ["AI", "RAG", "FIA"],
        comments: [{ id: "COM-3", userId: "U-PLE", name: "Ple", color: "#b06ab0", text: "ถ้ามี confidence score จะตัดสินใจง่ายขึ้นมาก", at: now - 20 * H }],
        versions: [
          { at: now - 26 * H, by: "U-NUT", byName: "Nut", field: "body", before: "ใช้ AI ช่วยตรวจยอด", after: "ให้ AI วิเคราะห์ unmatched transaction พร้อมอธิบาย root cause + confidence score" },
        ],
        z: 4,
      },
      {
        id: "CARD-003", type: "sticky", x: 60, y: 280, w: 190, h: 190, color: "#FFE06B", title: "", body: "Bank delay T+1 จริงไหม?\nต้องขอ statement ย้อนหลัง 3 เดือน",
        authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: ["U-MART"], tags: [], comments: [], versions: [], z: 2,
      },
      {
        id: "CARD-004", type: "sticky", x: 300, y: 300, w: 190, h: 190, color: "#A5D8F6", title: "", body: "Schema ของ 2 ระบบไม่เหมือนกัน → ต้อง map field ก่อน",
        authorId: "U-NUT", authorName: "Nut", authorColor: "#5577c2", votes: [], tags: [], comments: [], versions: [], z: 2,
      },
      {
        id: "CARD-005", type: "card", kind: "solution", x: 700, y: 30, w: 250, h: 160, color: "#A9E8C5",
        title: "Historical Case RAG", body: "เก็บ case เก่าที่แก้แล้ว ทำ RAG ให้ AI อ้างอิง pattern เดิม",
        authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: ["U-MART", "U-NUT"], tags: ["RAG"], comments: [], versions: [], z: 3,
      },
      {
        id: "CARD-006", type: "card", kind: "solution", x: 990, y: 60, w: 250, h: 160, color: "#A9E8C5",
        title: "Auto Matching Engine", body: "กฎ fuzzy matching amount ± เวลา ก่อนส่งให้ AI ตรวจซ้ำ",
        authorId: "U-PLE", authorName: "Ple", authorColor: "#b06ab0", votes: ["U-GAME"], tags: ["matching"], comments: [], versions: [], z: 3,
      },
      {
        id: "CARD-007", type: "card", kind: "data", x: 730, y: 280, w: 240, h: 150, color: "#D3C4F5",
        title: "ข้อมูลที่มี", body: "• KPLUS statement API\n• GoldPort ledger\n• Ticket ย้อนหลัง 2 ปี",
        authorId: "U-NUT", authorName: "Nut", authorColor: "#5577c2", votes: [], tags: ["data"], comments: [], versions: [], z: 2,
      },
      {
        id: "CARD-008", type: "sticky", x: 1010, y: 300, w: 190, h: 190, color: "#FFC7DE", title: "", body: "ถามทีม dev: latency budget ของ reconciliation job คือเท่าไร?",
        authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f", votes: [], tags: [], comments: [], versions: [], z: 2,
      },
      {
        id: "CARD-009", type: "card", kind: "action", x: 420, y: 660, w: 260, h: 150, color: "#DCE3ED",
        title: "POC: AI Explain Diff", body: "สัปดาห์นี้ — เก็บ sample 50 cases มาทำ prompt testing",
        authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f", votes: ["U-GAME", "U-PLE"], tags: ["POC"], comments: [], versions: [], z: 3,
      },
      {
        id: "CARD-010", type: "text", x: 60, y: -140, w: 500, h: 46, color: "transparent", title: "", body: "เป้าหมาย: ลด unmatched transactions ให้เหลือ < 1% ใน Q4 🎯",
        authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f", votes: [], tags: [], comments: [], versions: [], z: 1,
      },
      { id: "CARD-011", type: "emoji", emoji: "🧠", x: 1150, y: -160, w: 110, h: 110, color: "transparent", title: "", body: "", authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: [], tags: [], comments: [], versions: [], z: 1 },
    ],
    strokes: [
      {
        id: "ST-1", tool: "pen", color: "#b98a24", size: 3,
        points: (() => { const pts: number[] = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(340 + t * 300, 560 + Math.sin(t * Math.PI) * -46 + t * 90); } return pts; })(),
      },
    ],
    connectors: [
      { id: "CN-1", from: "CARD-001", to: "CARD-002", color: "#b98a24", label: "root cause?" },
      { id: "CN-2", from: "CARD-002", to: "CARD-009", color: "#37926c", label: "promoted" },
      { id: "CN-3", from: "CARD-007", to: "CARD-005", color: "#4f7fb5" },
    ],
  };

  const board2: Board = {
    frames: [{ id: "FR-F1", x: -20, y: -60, w: 1200, h: 620, title: "Ticket Lifecycle", color: "#A5D8F6", z: 0 }],
    items: [
      { id: "SH-1", type: "shape", shape: "ellipse", x: 20, y: 120, w: 190, h: 110, color: "#A9E8C5", title: "", body: "User เปิด Ticket", authorId: "U-PLE", authorName: "Ple", authorColor: "#b06ab0", votes: [], tags: [], comments: [], versions: [], z: 2 },
      { id: "SH-2", type: "shape", shape: "rect", x: 300, y: 120, w: 190, h: 110, color: "#A5D8F6", title: "", body: "Auto classify ประเภท", authorId: "U-PLE", authorName: "Ple", authorColor: "#b06ab0", votes: [], tags: [], comments: [], versions: [], z: 2 },
      { id: "SH-3", type: "shape", shape: "diamond", x: 580, y: 100, w: 220, h: 150, color: "#FFE06B", title: "", body: "AI ตอบได้เลย?", authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: ["U-PLE"], tags: [], comments: [], versions: [], z: 2 },
      { id: "SH-4", type: "shape", shape: "rect", x: 900, y: 20, w: 200, h: 110, color: "#A9E8C5", title: "", body: "ปิด Ticket อัตโนมัติ", authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: [], tags: [], comments: [], versions: [], z: 2 },
      { id: "SH-5", type: "shape", shape: "rect", x: 900, y: 220, w: 200, h: 110, color: "#FFB59E", title: "", body: "ส่งต่อทีมที่เกี่ยวข้อง", authorId: "U-PLE", authorName: "Ple", authorColor: "#b06ab0", votes: [], tags: [], comments: [], versions: [], z: 2 },
      { id: "TX-F1", type: "text", x: 20, y: -30, w: 520, h: 40, color: "transparent", title: "", body: "Flow ใหม่ — เป้าหมาย first response < 5 นาที ⚡", authorId: "U-PLE", authorName: "Ple", authorColor: "#b06ab0", votes: [], tags: [], comments: [], versions: [], z: 1 },
    ],
    strokes: [],
    connectors: [
      { id: "CN-F1", from: "SH-1", to: "SH-2", color: "#4f7fb5" },
      { id: "CN-F2", from: "SH-2", to: "SH-3", color: "#4f7fb5" },
      { id: "CN-F3", from: "SH-3", to: "SH-4", color: "#37926c", label: "ใช่" },
      { id: "CN-F4", from: "SH-3", to: "SH-5", color: "#cf5252", label: "ไม่ใช่" },
    ],
  };

  const board3: Board = {
    frames: [
      { id: "FR-R1", x: 0, y: 0, w: 560, h: 460, title: "😊 Went Well", color: "#A9E8C5", z: 0 },
      { id: "FR-R2", x: 620, y: 0, w: 560, h: 460, title: "😣 Didn't Go Well", color: "#FFB59E", z: 0 },
      { id: "FR-R3", x: 0, y: 520, w: 560, h: 420, title: "💡 Ideas", color: "#FFE06B", z: 0 },
      { id: "FR-R4", x: 620, y: 520, w: 560, h: 420, title: "🎯 Actions", color: "#A5D8F6", z: 0 },
    ],
    items: [
      { id: "RT-1", type: "sticky", x: 60, y: 80, w: 190, h: 190, color: "#A9E8C5", title: "", body: "ปล่อย Ticket v4 ได้ตามแผน 🎉", authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f", votes: ["U-NUT"], tags: [], comments: [], versions: [], z: 2 },
      { id: "RT-2", type: "sticky", x: 700, y: 90, w: 190, h: 190, color: "#FFB59E", title: "", body: "ประชุมยาวเกินไป บางวาระไม่จำเป็น", authorId: "U-NUT", authorName: "Nut", authorColor: "#5577c2", votes: ["U-MART", "U-GAME"], tags: [], comments: [], versions: [], z: 2 },
      { id: "RT-3", type: "sticky", x: 80, y: 610, w: 190, h: 190, color: "#FFE06B", title: "", body: "ลองทำ no-meeting Wednesday", authorId: "U-GAME", authorName: "Game", authorColor: "#3f8f6b", votes: [], tags: [], comments: [], versions: [], z: 2 },
      { id: "RT-4", type: "sticky", x: 700, y: 610, w: 190, h: 190, color: "#A5D8F6", title: "", body: "ตั้ง timebox 25 นาทีต่อวาระ เริ่มเดือนหน้า", authorId: "U-MART", authorName: "Mart", authorColor: "#e0912f", votes: ["U-PLE"], tags: [], comments: [], versions: [], z: 2 },
    ],
    strokes: [],
    connectors: [],
  };

  const logs: LogEntry[] = [
    { id: "EVT-1", projectId: "PRJ-AIRECON", type: "CARD_UPDATED", userId: "U-NUT", userName: "Nut", userColor: "#5577c2", at: now - 26 * H, text: "แก้ไขเนื้อหาการ์ด", before: "ใช้ AI ช่วยตรวจยอด", after: "ให้ AI วิเคราะห์ unmatched transaction พร้อมอธิบาย root cause + confidence score", objectId: "CARD-002" },
    { id: "EVT-2", projectId: "PRJ-AIRECON", type: "CARD_CREATED", userId: "U-MART", userName: "Mart", userColor: "#e0912f", at: now - 5 * D, text: 'สร้างการ์ด "ยอดไม่ตรง KPLUS ↔ GoldPort"', objectId: "CARD-001" },
    { id: "EVT-3", projectId: "PRJ-AIRECON", type: "COMMENT_ADDED", userId: "U-GAME", userName: "Game", userColor: "#3f8f6b", at: now - 5 * H, text: 'คอมเมนต์ในการ์ด "ยอดไม่ตรง KPLUS ↔ GoldPort"', objectId: "CARD-001" },
    { id: "EVT-4", projectId: "PRJ-AIRECON", type: "VOTE_ADDED", userId: "U-PLE", userName: "Ple", userColor: "#b06ab0", at: now - 3 * H, text: 'โหวตให้ "AI Explain Diff ✨"', objectId: "CARD-002" },
    { id: "EVT-5", projectId: "PRJ-FLOW", type: "PROJECT_CREATED", userId: "U-PLE", userName: "Ple", userColor: "#b06ab0", at: now - 3 * D, text: 'สร้างโปรเจกต์ "Ticket Flow Redesign"' },
    { id: "EVT-6", projectId: "PRJ-RETRO", type: "PROJECT_UPDATED", userId: "U-MART", userName: "Mart", userColor: "#e0912f", at: now - 2 * D, text: "เปลี่ยนสิทธิ์เป็น Locked (เฉพาะ Admin)" },
    { id: "EVT-7", projectId: "PRJ-AIRECON", type: "CONNECTION_CREATED", userId: "U-MART", userName: "Mart", userColor: "#e0912f", at: now - 4 * H, text: "เชื่อมต่อ ปัญหา → AI Explain Diff", objectId: "CN-1" },
  ];

  const chat: ChatMsg[] = [
    { id: "MSG-1", projectId: "PRJ-AIRECON", userId: "U-GAME", name: "Game", color: "#3f8f6b", text: "โยน sticky เรื่อง bank delay ไว้ใน Problem Space แล้วนะ", at: now - 5 * H },
    { id: "MSG-2", projectId: "PRJ-AIRECON", userId: "U-MART", name: "Mart", color: "#e0912f", text: "เห็นแล้ว 👍 เดี๋ยวขอ statement จากทีม finance ก่อน", at: now - 4.6 * H },
  ];

  return {
    sessionUserId: null,
    users,
    projects: [p1, p2, p3],
    boards: { "PRJ-AIRECON": board1, "PRJ-FLOW": board2, "PRJ-RETRO": board3 },
    logs,
    chat,
    theme: "system",
  };
}

export function templateBoard(templateId: string, userId: string, userName: string, color: string): Board {
  const mk = (partial: any) => ({
    id: uid("CARD"), type: "sticky", title: "", votes: [], tags: [], comments: [], versions: [], z: 2,
    authorId: userId, authorName: userName, authorColor: color, ...partial,
  });
  const fr = (x: number, y: number, w: number, h: number, title: string, c: string) => ({ id: uid("FR"), x, y, w, h, title, color: c, z: 0 });
  const W = 560, H = 480, G = 70;
  if (templateId === "problem") {
    const frames = [
      fr(0, 0, W, H, "1 · Problem", "#FFB59E"), fr(W + G, 0, W, H, "2 · Root Cause", "#FFE06B"),
      fr(0, H + G, W, H, "3 · Ideas", "#A5D8F6"), fr(W + G, H + G, W, H, "4 · Solutions", "#A9E8C5"),
    ];
    return { frames, items: [mk({ x: 60, y: 90, color: "#FFB59E", body: "ปัญหาหลักคืออะไร? เขียนให้ชัดใน 1 ประโยค", type: "sticky" })], strokes: [], connectors: [] };
  }
  if (templateId === "ai") {
    const names = ["Business Problem", "Current Process", "Available Data", "AI Opportunity", "Expected Impact", "POC Candidate"];
    const colors = ["#FFB59E", "#DCE3ED", "#D3C4F5", "#FFE06B", "#A9E8C5", "#A5D8F6"];
    const frames = names.map((n, i) => fr((i % 3) * (W + G), Math.floor(i / 3) * (H + G), W, H, `${i + 1} · ${n}`, colors[i]));
    return { frames, items: [], strokes: [], connectors: [] };
  }
  if (templateId === "flow") {
    return {
      frames: [fr(0, -80, 1150, 560, "Process Flow", "#A5D8F6")],
      items: [
        mk({ id: uid("SH"), type: "shape", shape: "ellipse", x: 20, y: 140, w: 200, h: 120, color: "#A9E8C5", body: "Start" }),
        mk({ id: uid("SH"), type: "shape", shape: "rect", x: 330, y: 140, w: 200, h: 120, color: "#A5D8F6", body: "ขั้นตอนที่ 1" }),
        mk({ id: uid("SH"), type: "shape", shape: "diamond", x: 640, y: 120, w: 230, h: 160, color: "#FFE06B", body: "ตัดสินใจ?" }),
        mk({ id: uid("SH"), type: "shape", shape: "ellipse", x: 970, y: 140, w: 200, h: 120, color: "#FFB59E", body: "End" }),
      ],
      strokes: [],
      connectors: [],
    };
  }
  if (templateId === "retro") {
    return {
      frames: [fr(0, 0, W, 420, "😊 Went Well", "#A9E8C5"), fr(W + G, 0, W, 420, "😣 Didn't Go Well", "#FFB59E"), fr(0, 490, W, 420, "💡 Ideas", "#FFE06B"), fr(W + G, 490, W, 420, "🎯 Actions", "#A5D8F6")],
      items: [], strokes: [], connectors: [],
    };
  }
  if (templateId === "free") {
    return {
      frames: [fr(0, 0, 900, 620, "Ideas 💡", "#FFE06B")],
      items: [
        mk({ x: 60, y: 80, color: "#FFE06B", body: "โยนไอเดียมาเลย! ดับเบิลคลิกที่ว่างเพื่อสร้างสติ๊กกี้" }),
        mk({ x: 290, y: 140, color: "#A9E8C5", body: "ลากการ์ดได้อิสระ\nซูมด้วย scroll + Ctrl" }),
        mk({ x: 120, y: 330, color: "#FFC7DE", body: "ลองใช้เครื่องมือวาด 🖊️ ขีดเขียนได้เลย" }),
      ],
      strokes: [], connectors: [],
    };
  }
  return { items: [], frames: [], strokes: [], connectors: [] };
}
