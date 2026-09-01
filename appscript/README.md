# MTS BrainSpace → Google Apps Script Deployment

เว็บที่เห็นรัน data layer ผ่าน `src/store.ts` (localStorage + BroadcastChannel = เรียลไทม์ข้ามแท็บ)
โครงสร้าง state ถูกออกแบบให้ **map 1:1 กับ Google Sheets** ผ่าน `google.script.run.api(action, payload)`

## การย้ายขึ้น Apps Script (ทีละขั้น)

1. `npm run build` → นำ `dist/index.html` (inline JS/CSS แล้ว) ไปวางเป็น `Index.html` ใน Apps Script project
2. วาง `Code.gs` จากโฟลเดอร์นี้ → แก้ `CONFIG.SHEET_ID` → รัน `initSheets()` 1 ครั้ง
3. Deploy → Web app → *Execute as: Me* · *Access: Anyone within mtsgoldgroup.com*
4. ใน `src/store.ts` สลับฟังก์ชัน persist จาก `localStorage.setItem(...)` เป็นการเรียก `google.script.run.api(...)`
   (action ตรงชื่ออยู่แล้ว: getProjects / createProject / saveBoard / addLog / poll ...)

## โครงสร้างชีต (สร้างอัตโนมัติโดย initSheets)

| ชีต | ใช้เก็บ | เทียบกับ state ในเว็บ |
|---|---|---|
| USERS | email, dept(OIA/FIA), role, active | `users[]` — login ครั้งแรกบันทึกอัตโนมัติแบบ ticket |
| PROJECTS | name, visibility(public/private/locked), owner | `projects[]` |
| PROJECT_MEMBERS | สมาชิกที่เห็นโปรเจกต์ private | `projects[].members` |
| BOARDS | **JSON ของบอร์ดทั้งบอร์ด 1 แถว/โปรเจกต์** + rev | `boards{}` — เขียนครั้งเดียวตอนปล่อยการ์ด (ไม่เขียนระหว่างลาก) |
| ACTIVITY_LOG | ใครแก้อะไร ก่อน/หลัง | `logs[]` (immutable สำหรับ user ปกติ) |
| CARD_VERSIONS | version history ของการ์ด | `items[].versions` |
| CHAT | ข้อความแชททีม | `chat[]` |

## เรียลไทม์บน Apps Script
ใช้ `api("poll", {boardId})` ทุก ~5 วินาที (ในเว็บนี้คือ BroadcastChannel ที่ทำงานทันทีข้ามแท็บ)
— presence, board rev (optimistic concurrency), chat ใหม่ ครบใน call เดียวเพื่อประหยัด quota
