export type Dept = "OIA" | "FIA";
export type Role = "admin" | "member";
export type Visibility = "public" | "private" | "locked";
export type ThemePref = "light" | "dark" | "system";

export interface User {
  id: string;
  email: string;
  name: string;
  dept: Dept;
  role: Role;
  active: boolean;
  color: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  dept: Dept;
  visibility: Visibility;
  members: string[]; // user ids — ใช้กับ private
  owner: string; // user id
  icon: string; // emoji
  color: string; // pastel cover
  favoriteBy: string[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ItemType = "sticky" | "card" | "text" | "emoji" | "shape";
export type ItemKind = "idea" | "problem" | "question" | "solution" | "data" | "ai" | "action";
export type ShapeKind = "rect" | "diamond" | "ellipse";
export type DrawTool = "pen" | "marker" | "pencil";

export interface Comment {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface Version {
  at: number;
  by: string;
  byName: string;
  field: "title" | "body";
  before: string;
  after: string;
}

export interface Item {
  id: string;
  type: ItemType;
  kind?: ItemKind;
  shape?: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  title: string;
  body: string;
  emoji?: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  editedBy?: string;
  editedByName?: string;
  editedAt?: number;
  votes: string[];
  tags: string[];
  comments: Comment[];
  versions: Version[];
  z: number;
}

export interface Frame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  color: string;
  z: number;
}

export interface Stroke {
  id: string;
  tool: DrawTool;
  color: string;
  size: number;
  points: number[]; // [x0,y0,x1,y1,...]
}

export type Side = "n" | "e" | "s" | "w";

export interface Connector {
  id: string;
  from: string;
  to: string;
  color: string;
  label?: string;
  fromSide?: Side;
  toSide?: Side;
}

export interface Board {
  items: Item[];
  frames: Frame[];
  strokes: Stroke[];
  connectors: Connector[];
}

export interface LogEntry {
  id: string;
  projectId: string;
  type: string;
  userId: string;
  userName: string;
  userColor: string;
  at: number;
  text: string;
  before?: string;
  after?: string;
  objectId?: string;
}

export interface ChatMsg {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface Peer {
  tabId: string;
  userId: string;
  name: string;
  color: string;
  boardId: string;
  cursor: { x: number; y: number } | null;
  at: number;
  bot?: boolean;
}

export interface AppState {
  sessionUserId: string | null;
  users: User[];
  projects: Project[];
  boards: Record<string, Board>;
  logs: LogEntry[];
  chat: ChatMsg[];
  theme: ThemePref;
}
