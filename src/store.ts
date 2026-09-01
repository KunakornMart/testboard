import { useSyncExternalStore } from "react";
import type { AppState, Board, ChatMsg, LogEntry, Peer, Project, ThemePref, User } from "./types";
import { DOMAIN, seedState, templateBoard, uid } from "./data";

const LS_KEY = "mts-brainspace-v1";
export const TAB_ID = uid("TAB");

/* ---------------- core store ---------------- */
let state: AppState = load();
const listeners = new Set<() => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length) return { ...seedState(), ...parsed };
    }
  } catch { /* ignore */ }
  const seeded = seedState();
  try { localStorage.setItem(LS_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
  return seeded;
}

let saveTimer: any = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, 250);
}

function setState(patch: Partial<AppState>, broadcast: boolean) {
  state = { ...state, ...patch };
  persist();
  if (broadcast) post({ t: "patch", patch, from: TAB_ID });
  listeners.forEach((l) => l());
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state
  );
}
export const getState = () => state;

/* ---------------- realtime channel ---------------- */
type Msg = { t: "patch"; patch: Partial<AppState>; from: string } | { t: "presence"; peer: Peer } | { t: "bye"; tabId: string };
let channel: BroadcastChannel | null = null;
try { channel = new BroadcastChannel("mts-brainspace-sync"); } catch { channel = null; }

const remoteLogListeners = new Set<(log: LogEntry) => void>();
export function onRemoteLog(cb: (log: LogEntry) => void) { remoteLogListeners.add(cb); return () => remoteLogListeners.delete(cb); }

if (channel) {
  channel.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data;
    if (!m || m.t === "bye") { if (m) presenceRemove(m.tabId); return; }
    if (m.t === "presence") { presenceUpsert(m.peer); return; }
    if (m.t === "patch" && m.from !== TAB_ID) {
      const incomingLogs = m.patch.logs;
      state = { ...state, ...m.patch };
      persist();
      if (incomingLogs) incomingLogs.forEach((l) => remoteLogListeners.forEach((cb) => cb(l)));
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("beforeunload", () => post({ t: "bye", tabId: TAB_ID }));
}
function post(m: Msg) { try { channel?.postMessage(m); } catch { /* ignore */ } }

/* ---------------- presence (runtime only) ---------------- */
let peers: Record<string, Peer> = {};
const presenceListeners = new Set<() => void>();
function presenceUpsert(p: Peer) {
  if (p.tabId === TAB_ID) return;
  peers = { ...peers, [p.tabId]: p };
  presenceListeners.forEach((l) => l());
}
function presenceRemove(tabId: string) {
  if (!peers[tabId]) return;
  const next = { ...peers }; delete next[tabId]; peers = next;
  presenceListeners.forEach((l) => l());
}
export function usePeers(boardId: string | null): Peer[] {
  const all = useSyncExternalStore(
    (cb) => { presenceListeners.add(cb); return () => presenceListeners.delete(cb); },
    () => peers
  );
  return Object.values(all).filter((p) => Date.now() - p.at < 8000 && (!boardId || p.boardId === boardId));
}
export function announcePresence(boardId: string, user: User, cursor: { x: number; y: number } | null) {
  post({ t: "presence", peer: { tabId: TAB_ID, userId: user.id, name: user.name, color: user.color, boardId, cursor, at: Date.now() } });
}
export function addBotPeer(peer: Peer) { presenceUpsert(peer); }
export function removeBotPeer(tabId: string) { presenceRemove(tabId); }

setInterval(() => {
  const stale = Object.values(peers).filter((p) => Date.now() - p.at > 8000 && !p.bot);
  stale.forEach((p) => presenceRemove(p.tabId));
}, 3000);

/* ---------------- permissions ---------------- */
export const currentUser = (): User | null => state.users.find((u) => u.id === state.sessionUserId) || null;
export const isAdmin = (u: User | null) => !!u && u.role === "admin";
export const canView = (p: Project, u: User | null): boolean => {
  if (!u) return false;
  if (u.role === "admin" || p.owner === u.id) return true;
  if (p.visibility === "public") return true;
  return p.members.includes(u.id);
};
export const canEdit = (p: Project, u: User | null): boolean => {
  if (!u) return false;
  if (p.visibility === "locked") return u.role === "admin" || p.owner === u.id;
  return canView(p, u);
};
export const canManage = (p: Project, u: User | null): boolean => !!u && (u.role === "admin" || p.owner === u.id);

/* ---------------- auth ---------------- */
export function login(email: string, name?: string): { ok: boolean; error?: string; user?: User } {
  const clean = email.trim().toLowerCase();
  if (!/^[a-z0-9._-]+@mtsgoldgroup\.com$/.test(clean)) return { ok: false, error: `อนุญาตเฉพาะอีเมล @${DOMAIN} เท่านั้น` };
  let user = state.users.find((u) => u.email === clean);
  if (!user) {
    const fallback = clean.split("@")[0].replace(/[._-]/g, " ");
    user = {
      id: uid("U"), email: clean, name: name?.trim() || fallback.charAt(0).toUpperCase() + fallback.slice(1),
      dept: "OIA", role: "member", active: true, color: ["#e0912f", "#3f8f6b", "#5577c2", "#b06ab0", "#c25e5e", "#3fa7a0"][state.users.length % 6],
      createdAt: Date.now(),
    };
    setState({ users: [...state.users, user], sessionUserId: user.id }, true);
    addLog({ projectId: "SYSTEM", type: "USER_JOINED", text: `สมาชิกใหม่เข้าร่วม: ${user.name}`, userId: user.id, userName: user.name, userColor: user.color });
  } else {
    if (!user.active) return { ok: false, error: "inactive", user };
    setState({ sessionUserId: user.id }, false);
  }
  return { ok: true, user };
}
export function logout() { setState({ sessionUserId: null }, false); }

/* ---------------- logs ---------------- */
export function addLog(partial: Omit<LogEntry, "id" | "at"> & { at?: number }) {
  const entry: LogEntry = { id: uid("EVT"), at: Date.now(), ...partial };
  setState({ logs: [entry, ...state.logs].slice(0, 600) }, true);
  return entry;
}

/* ---------------- users ---------------- */
export function updateUser(id: string, patch: Partial<User>, logText?: string) {
  setState({ users: state.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }, true);
  const me = currentUser();
  if (logText && me) addLog({ projectId: "SYSTEM", type: "USER_UPDATED", userId: me.id, userName: me.name, userColor: me.color, text: logText });
}

/* ---------------- projects ---------------- */
export function createProject(input: { name: string; description: string; dept: Project["dept"]; visibility: Project["visibility"]; members: string[]; icon: string; color: string; template: string }, me: User): Project {
  const p: Project = {
    id: uid("PRJ"), name: input.name.trim() || "โปรเจกต์ใหม่", description: input.description.trim(),
    dept: input.dept, visibility: input.visibility, members: input.visibility === "private" ? input.members : [],
    owner: me.id, icon: input.icon, color: input.color, favoriteBy: [me.id], archived: false,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  const boards = { ...state.boards, [p.id]: templateBoard(input.template, me.id, me.name, me.color) };
  setState({ projects: [p, ...state.projects], boards }, true);
  addLog({ projectId: p.id, type: "PROJECT_CREATED", userId: me.id, userName: me.name, userColor: me.color, text: `สร้างโปรเจกต์ "${p.name}"` });
  return p;
}

export function updateProject(id: string, patch: Partial<Project>, logText?: string) {
  const projects = state.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
  setState({ projects }, true);
  const me = currentUser();
  if (logText && me) addLog({ projectId: id, type: "PROJECT_UPDATED", userId: me.id, userName: me.name, userColor: me.color, text: logText });
}

export function deleteProject(id: string) {
  const me = currentUser();
  const p = state.projects.find((x) => x.id === id);
  const boards = { ...state.boards }; delete boards[id];
  setState({ projects: state.projects.filter((x) => x.id !== id), boards, logs: state.logs.filter((l) => l.projectId !== id) }, true);
  if (me && p) addLog({ projectId: "SYSTEM", type: "PROJECT_DELETED", userId: me.id, userName: me.name, userColor: me.color, text: `ลบโปรเจกต์ "${p.name}"` });
}

export function toggleFavorite(projectId: string, userId: string) {
  setState({
    projects: state.projects.map((p) =>
      p.id === projectId
        ? { ...p, favoriteBy: p.favoriteBy.includes(userId) ? p.favoriteBy.filter((x) => x !== userId) : [...p.favoriteBy, userId] }
        : p
    ),
  }, true);
}

/* ---------------- boards ---------------- */
export function setBoard(projectId: string, board: Board, opts: { broadcast?: boolean } = {}) {
  setState({ boards: { ...state.boards, [projectId]: board }, projects: state.projects.map((p) => (p.id === projectId ? { ...p, updatedAt: Date.now() } : p)) }, opts.broadcast !== false);
}
export const emptyBoard = (): Board => ({ items: [], frames: [], strokes: [], connectors: [] });

/* ---------------- chat ---------------- */
export function sendChat(msg: Omit<ChatMsg, "id" | "at">) {
  const m: ChatMsg = { ...msg, id: uid("MSG"), at: Date.now() };
  setState({ chat: [...state.chat, m].slice(-400) }, true);
}

/* ---------------- theme ---------------- */
export function setTheme(t: ThemePref) {
  setState({ theme: t }, false);
  applyTheme(t);
}
export function applyTheme(t: ThemePref) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (state.theme === "system") applyTheme("system");
});

/* ---------------- utils ---------------- */
export function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 45_000) return "เมื่อครู่";
  if (d < 3600_000) return `${Math.floor(d / 60_000)} นาทีที่แล้ว`;
  if (d < 86_400_000) return `${Math.floor(d / 3600_000)} ชม.ที่แล้ว`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)} วันก่อน`;
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
export function fullTime(ts: number): string {
  return new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* reset demo data */
export function resetAll() {
  const seeded = seedState();
  state = { ...seeded, sessionUserId: state.sessionUserId, theme: state.theme };
  persist();
  post({ t: "patch", patch: { users: state.users, projects: state.projects, boards: state.boards, logs: state.logs, chat: state.chat }, from: TAB_ID });
  listeners.forEach((l) => l());
}
