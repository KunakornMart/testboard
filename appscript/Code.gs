/**
 * ═══════════════════════════════════════════════════════════════
 *  MTS BrainSpace — Google Apps Script Backend (Reference)
 *  ไฟล์นี้อ้างอิงโครงสร้าง data layer เดียวกับเว็บ (src/store.ts)
 *  เพื่อให้สลับจาก localStorage/BroadcastChannel → google.script.run ได้ทันที
 *
 *  วิธีใช้:
 *  1) วาง Code.gs + Index.html (นำ dist/index.html จาก `npm run build`
 *     ไป inline JS/CSS ให้เป็นไฟล์เดียว หรือ deploy เป็น Web App แบบ serve ไฟล์)
 *  2) รัน initSheets() ครั้งแรกเพื่อสร้างชีตทั้งหมด
 *  3) Deploy → New deployment → Web app → Execute as: Me,
 *     Who has access: Anyone within mtsgoldgroup.com
 * ═══════════════════════════════════════════════════════════════
 */

var CONFIG = {
  SHEET_ID: "", // 👉 วาง ID ของ Google Sheet ที่จะใช้เป็นฐานข้อมูล
  DOMAIN: "mtsgoldgroup.com",
  BOARD_CACHE_SEC: 120,
};

/* ---------- Web App entry ---------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("MTS BrainSpace")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* ---------- สร้างชีตทั้งหมด (รันครั้งเดียว) ---------- */
function initSheets() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheets = {
    // ผูกกับ user ที่ login ครั้งแรก (เหมือนระบบ Ticket) — email = คีย์หลัก
    USERS: ["user_id", "email", "name", "dept", "role", "active", "color", "created_at"],
    PROJECTS: ["project_id", "name", "description", "dept", "visibility", "owner", "icon", "color", "archived", "created_at", "updated_at"],
    PROJECT_MEMBERS: ["project_id", "user_id", "added_by", "added_at"], // สำหรับ private
    // เก็บ state ของบอร์ดทั้งบอร์ดเป็น JSON 1 แถว/โปรเจกต์ → เขียนน้อยครั้งแม้ลากการ์ดถี่
    // (เหมือน Firestore doc ต่อ board — เหมาะกับ Apps Script กว่าแถวการ์ดแยก)
    BOARDS: ["project_id", "board_json", "rev", "updated_by", "updated_at"],
    ACTIVITY_LOG: ["event_id", "project_id", "type", "user_email", "user_name", "at", "text", "before", "after", "object_id"],
    CARD_VERSIONS: ["card_id", "project_id", "field", "before", "after", "by", "at"],
    CHAT: ["msg_id", "project_id", "user_email", "name", "text", "at"],
    SETTINGS: ["key", "value"],
  };
  Object.keys(sheets).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, sheets[name].length).setValues([sheets[name]])
        .setFontWeight("bold").setBackground("#1b2b4d").setFontColor("#e2b64e");
      sh.setFrozenRows(1);
    }
  });
  // users ตั้งต้น (หรือให้ระบบเพิ่มอัตโนมัติตอน login ครั้งแรก)
  var users = ss.getSheetByName("USERS");
  if (users.getLastRow() < 2) {
    users.getRange(2, 1, 3, 8).setValues([
      ["U-MART", "mart@mtsgoldgroup.com", "Mart", "OIA", "admin", true, "#e0912f", new Date().toISOString()],
      ["U-GAME", "game@mtsgoldgroup.com", "Game", "FIA", "member", true, "#3f8f6b", new Date().toISOString()],
      ["U-PLE", "ple@mtsgoldgroup.com", "Ple", "FIA", "admin", true, "#b06ab0", new Date().toISOString()],
    ]);
  }
}

/* ---------- auth: validate ทุก request ฝั่ง server ---------- */
function requireUser_() {
  var email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  if (!email || email.indexOf("@" + CONFIG.DOMAIN) !== email.length - CONFIG.DOMAIN.length - 1) {
    throw new Error("UNAUTHORIZED: ต้องใช้อีเมล @" + CONFIG.DOMAIN);
  }
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("USERS");
  var rows = shToObjects_(ss);
  var user = null;
  rows.forEach(function (r) { if (r.email === email) user = r; });
  if (!user) { // สมัครอัตโนมัติครั้งแรก (active = true, role = member)
    user = { user_id: "U-" + Date.now().toString(36).toUpperCase(), email: email, name: email.split("@")[0], dept: "OIA", role: "member", active: true, color: "#5577c2", created_at: new Date().toISOString() };
    ss.appendRow([user.user_id, user.email, user.name, user.dept, user.role, true, user.color, user.created_at]);
  }
  if (String(user.active).toLowerCase() === "false") throw new Error("SUSPENDED: บัญชีถูกระงับ ติดต่อ Admin");
  return user;
}

/* ---------- API เดียวจากหน้าเว็บ: google.script.run.api("getBoard", {...}) ---------- */
function api(action, payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    var user = requireUser_(); // ✅ validate domain + active ทุก action
    var out;
    switch (action) {
      case "getCurrentUser": out = { user: user, users: getUsers_() }; break;
      case "getProjects": out = { projects: getProjects_(user) }; break; // กรองตาม visibility/private members แล้ว
      case "createProject": out = createProject_(user, payload); break;
      case "updateProject": out = updateProject_(user, payload); break;
      case "deleteProject": out = deleteProject_(user, payload); break; // owner/admin เท่านั้น
      case "getBoard": out = getBoard_(user, payload.projectId); break;
      case "saveBoard": out = saveBoard_(user, payload.projectId, payload.boardJson, payload.rev); break;
      case "addLog": out = addLog_(user, payload); break; // audit log แก้ไม่ได้จาก user
      case "updateUser": out = updateUser_(user, payload); break; // admin เท่านั้น
      case "getChat": out = getChat_(payload.projectId); break;
      case "sendChat": out = sendChat_(user, payload); break;
      case "poll": out = poll_(user, payload); break; // presence + board rev + chat ใหม่ (เรียกทุก ~5 วิ)
      default: throw new Error("UNKNOWN_ACTION: " + action);
    }
    return { ok: true, data: out };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ---------- helpers ---------- */
function shToObjects_(sh) {
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0];
  return v.slice(1).map(function (row) {
    var o = {};
    head.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}
function getUsers_() {
  return shToObjects_(SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("USERS"));
}
function getProjects_(user) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var projects = shToObjects_(ss.getSheetByName("PROJECTS")).filter(function (p) { return String(p.archived) !== "true"; });
  var members = shToObjects_(ss.getSheetByName("PROJECT_MEMBERS"));
  return projects.filter(function (p) {
    if (user.role === "admin" || p.owner === user.user_id || p.visibility === "public") return true;
    return members.some(function (m) { return m.project_id === p.project_id && m.user_id === user.user_id; });
  });
}
function getBoard_(user, projectId) {
  var cache = CacheService.getScriptCache();
  var key = "board:" + projectId;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var rows = shToObjects_(SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("BOARDS"));
  var row = null;
  rows.forEach(function (r) { if (r.project_id === projectId) row = r; });
  var out = row ? { boardJson: row.board_json, rev: Number(row.rev || 0) } : { boardJson: '{"items":[],"frames":[],"strokes":[],"connectors":[]}', rev: 0 };
  cache.put(key, JSON.stringify(out), CONFIG.BOARD_CACHE_SEC);
  return out;
}
function saveBoard_(user, projectId, boardJson, rev) {
  // Optimistic concurrency: ถ้า rev ในชีตใหม่กว่า → ส่งกลับให้ client merge/refresh
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName("BOARDS");
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === projectId) {
      var cur = Number(rows[i][2] || 0);
      if (cur > Number(rev)) return { conflict: true, rev: cur, boardJson: rows[i][1] };
      sh.getRange(i + 1, 2, 1, 4).setValues([[boardJson, cur + 1, user.email, new Date().toISOString()]]);
      CacheService.getScriptCache().remove("board:" + projectId);
      return { conflict: false, rev: cur + 1 };
    }
  }
  sh.appendRow([projectId, boardJson, 1, user.email, new Date().toISOString()]);
  return { conflict: false, rev: 1 };
}
function addLog_(user, p) {
  var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("ACTIVITY_LOG");
  sh.appendRow(["EVT-" + Date.now().toString(36).toUpperCase(), p.projectId, p.type, user.email, user.name, new Date().toISOString(), p.text, p.before || "", p.after || "", p.objectId || ""]);
  return { ok: true };
}
function updateUser_(user, p) {
  if (user.role !== "admin") throw new Error("FORBIDDEN: ต้องเป็น Admin");
  var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("USERS");
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.userId) {
      if (p.dept) sh.getRange(i + 1, 4).setValue(p.dept);
      if (p.role) sh.getRange(i + 1, 5).setValue(p.role);
      if (p.active !== undefined) sh.getRange(i + 1, 6).setValue(p.active);
      return { ok: true };
    }
  }
  throw new Error("USER_NOT_FOUND");
}
function createProject_(user, p) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var id = "PRJ-" + Date.now().toString(36).toUpperCase();
  ss.getSheetByName("PROJECTS").appendRow([id, p.name, p.description || "", p.dept, p.visibility, user.user_id, p.icon || "🧠", p.color || "#FFE06B", false, new Date().toISOString(), new Date().toISOString()]);
  (p.members || []).forEach(function (uid) {
    ss.getSheetByName("PROJECT_MEMBERS").appendRow([id, uid, user.user_id, new Date().toISOString()]);
  });
  addLog_(user, { projectId: id, type: "PROJECT_CREATED", text: 'สร้างโปรเจกต์ "' + p.name + '"' });
  return { projectId: id };
}
function updateProject_(user, p) { /* แก้แถว PROJECTS ตาม p.projectId + log PROJECT_UPDATED */ return { ok: true }; }
function deleteProject_(user, p) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName("PROJECTS");
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.projectId) {
      var isOwner = rows[i][5] === user.user_id;
      if (!isOwner && user.role !== "admin") throw new Error("FORBIDDEN: ผู้ลบต้องเป็นคนสร้างหรือ Admin");
      sh.getRange(i + 1, 9).setValue(true); // soft delete → audit trail คงอยู่
      addLog_(user, { projectId: p.projectId, type: "PROJECT_DELETED", text: 'ลบโปรเจกต์ "' + rows[i][1] + '"' });
      return { ok: true };
    }
  }
  throw new Error("PROJECT_NOT_FOUND");
}
function getChat_(projectId) {
  return shToObjects_(SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("CHAT"))
    .filter(function (m) { return m.project_id === projectId; }).slice(-100);
}
function sendChat_(user, p) {
  var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("CHAT");
  sh.appendRow(["MSG-" + Date.now().toString(36).toUpperCase(), p.projectId, user.email, user.name, p.text, new Date().toISOString()]);
  return { ok: true };
}
/* presence + realtime polling (แทน WebSocket — เรียกทุก 5 วิจาก client) */
function poll_(user, p) {
  var cache = CacheService.getScriptCache();
  cache.put("presence:" + user.user_id, JSON.stringify({ name: user.name, color: user.color, boardId: p.boardId || "", at: Date.now() }), 15);
  var keys = cache.getAll(Object.keys(cache.getAll ? {} : {}).concat([])); // note: ใช้ CacheService key list ผ่าน PropertiesService ใน production
  var board = p.boardId ? getBoard_(user, p.boardId) : null;
  return { presence: JSON.parse("[" + Object.keys(keys).map(function (k) { return keys[k]; }).join(",") + "]", function (k, v) { return v === "" ? [] : v; }), board: board, chat: p.boardId ? getChat_(p.boardId) : [] };
}
