// ================================================================
// TRẠNG THÁI CHUNG CỦA ỨNG DỤNG (Được chia sẻ với drive.js)
// ================================================================
let entries = JSON.parse(localStorage.getItem("diary_entries") || "[]");
let selectedMood = "";
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let currentModalId = null;

const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS_VI = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];
const WEEKDAYS_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

// ================================================================
// [ĐIỀU CHỈNH] HÀM XỬ LÝ MARKDOWN: Biến ký tự thành định dạng HTML
// ================================================================
function parseMarkdown(text) {
  let html = escHtml(text);
  // Chuyển in đậm: **chữ**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Chuyển in nghiêng: *chữ*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Chuyển danh sách: - chữ
  html = html.replace(/^\- (.*$)/gim, "<li>$1</li>");
  // Chuyển trích dẫn: > chữ
  html = html.replace(
    /^\> (.*$)/gim,
    '<blockquote style="border-left: 3px solid var(--accent); padding-left: 10px; margin-left: 0; color: var(--text-muted); font-style: italic;">$1</blockquote>',
  );
  // Chuyển dòng kẻ: ---
  html = html.replace(
    /^---$/gim,
    '<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;">',
  );
  // Xử lý xuống dòng
  html = html.replace(/\n/g, "<br>");
  return html;
}

// ================================================================
// CÁC HÀM XỬ LÝ GIAO DIỆN (UI)
// ================================================================
function init() {
  updateDateBanner();
  loadTodayEntry();
  renderAll();
  setupListeners();
  // setDriveStatus("offline"); -> Đã chuyển việc gọi hàm này sang drive.js để quản lý logic gọn hơn
}

function renderAll() {
  renderEntries();
  renderCalendar();
  renderStats();
}

function updateDateBanner() {
  const now = new Date();
  document.getElementById("date-day").textContent = now.getDate();
  document.getElementById("date-weekday").textContent =
    WEEKDAYS_VI[now.getDay()];
  document.getElementById("date-month").textContent =
    MONTHS_VI[now.getMonth()] + ", " + now.getFullYear();
  document.getElementById("date-full").textContent =
    `${MONTHS_VI[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function loadTodayEntry() {
  const today = entries.find((e) => e.date === todayKey());
  if (!today) return;
  document.getElementById("diary-content").value = today.content;
  selectedMood = today.mood || "";
  document
    .querySelectorAll(".mood-btn")
    .forEach((b) =>
      b.classList.toggle("selected", b.dataset.mood === selectedMood),
    );
  updateCharCount();
}

async function saveEntry() {
  const content = document.getElementById("diary-content").value.trim();
  if (!content) {
    showToast("✏️ Hãy viết gì đó trước nhé!");
    return;
  }

  const key = todayKey();
  const idx = entries.findIndex((e) => e.date === key);
  const entry = {
    id: key,
    date: key,
    content,
    mood: selectedMood,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);

  entries.sort((a, b) => b.date.localeCompare(a.date));
  saveToStorage();
  renderAll();
  showToast("✅ Đã lưu!");

  // Biến isSignedIn và hàm syncToDrive được khai báo bên file drive.js
  if (typeof isSignedIn !== "undefined" && isSignedIn) await syncToDrive();
}

function saveToStorage() {
  localStorage.setItem("diary_entries", JSON.stringify(entries));
}

function clearEditor() {
  if (!document.getElementById("diary-content").value) return;
  if (confirm("Bạn có chắc muốn xóa nội dung đang viết?")) {
    document.getElementById("diary-content").value = "";
    updateCharCount();
  }
}

// Xử lý Hiển thị Danh sách Nhật ký
function renderEntries() {
  const q = (document.getElementById("search-input").value || "").toLowerCase();
  const filtered = entries.filter(
    (e) =>
      !q ||
      e.content.toLowerCase().includes(q) ||
      (e.mood || "").toLowerCase().includes(q),
  );
  const el = document.getElementById("entries-list");

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🌙</div><div class="empty-title">Chưa có nhật ký nào</div><div class="empty-desc">${q ? "Không tìm thấy kết quả phù hợp." : "Bắt đầu viết nhật ký đầu tiên của bạn!"}</div></div>`;
    return;
  }
  el.innerHTML = filtered
    .map(
      (e) => `
    <div class="entry-card" onclick="openEntry('${e.id}')">
      <div class="entry-header">
        <div class="entry-date">${formatDateVI(e.date)}</div>
        <div class="entry-mood">${e.mood ? e.mood.split(" ")[0] : ""}</div>
      </div>
      <div class="entry-preview">${escHtml(e.content)}</div>
      <div class="entry-actions">
        <button class="btn btn-danger" onclick="event.stopPropagation();deleteEntry('${e.id}')">🗑️ Xóa</button>
      </div>
    </div>`,
    )
    .join("");
}

// Xử lý Lịch
function renderCalendar() {
  document.getElementById("cal-title").textContent =
    `${MONTHS_VI[calMonth]} ${calYear}`;
  const grid = document.getElementById("cal-grid");
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const entryDates = new Set(entries.map((e) => e.date));
  const today = todayKey();

  let html = DAYS_VI.map((d) => `<div class="cal-header">${d}</div>`).join("");
  for (let i = 0; i < firstDay; i++)
    html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cls = [
      "cal-day",
      key === today ? "today" : "",
      entryDates.has(key) ? "has-entry" : "",
    ]
      .filter(Boolean)
      .join(" ");
    html += `<div class="${cls}" onclick="showCalEntries('${key}')">${d}</div>`;
  }
  grid.innerHTML = html;
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
  document.getElementById("cal-entries").innerHTML = "";
}

function showCalEntries(dateStr) {
  const dayEntries = entries.filter((e) => e.date === dateStr);
  const el = document.getElementById("cal-entries");
  if (!dayEntries.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Không có nhật ký ngày ${formatDateVI(dateStr)}</div>`;
    return;
  }
  el.innerHTML =
    `<div class="section-title" style="font-size:15px">📅 ${formatDateVI(dateStr)}</div>` +
    dayEntries
      .map(
        (e) =>
          `<div class="entry-card" onclick="openEntry('${e.id}')"><div class="entry-mood" style="margin-bottom:8px">${e.mood || ""}</div><div class="entry-preview">${escHtml(e.content)}</div></div>`,
      )
      .join("");
}

// Xử lý Tổng kết
function renderStats() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const totalWords = entries.reduce(
    (s, e) => s + e.content.split(/\s+/).filter(Boolean).length,
    0,
  );

  document.getElementById("stat-total").textContent = entries.length;
  document.getElementById("stat-words").textContent =
    totalWords > 999 ? (totalWords / 1000).toFixed(1) + "k" : totalWords;
  document.getElementById("stat-month").textContent = entries.filter((e) =>
    e.date.startsWith(thisMonth),
  ).length;
  document.getElementById("stat-streak").textContent = calcStreak();

  const moodCount = {};
  entries.forEach((e) => {
    if (e.mood) moodCount[e.mood] = (moodCount[e.mood] || 0) + 1;
  });
  document.getElementById("mood-stats").innerHTML =
    Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([m, c]) =>
          `<div class="mood-btn selected" style="cursor:default">${m} <span style="opacity:.6;margin-left:4px">${c}</span></div>`,
      )
      .join("") ||
    '<div style="color:var(--text-muted);font-size:13px">Chưa có dữ liệu cảm xúc</div>';

  document.getElementById("recent-entries").innerHTML =
    entries
      .slice(0, 5)
      .map(
        (e) => `
    <div class="entry-card" onclick="openEntry('${e.id}')">
      <div class="entry-header">
        <div class="entry-date">${formatDateVI(e.date)}</div>
        <div class="entry-mood">${e.mood ? e.mood.split(" ")[0] : ""}</div>
      </div>
      <div class="entry-preview">${escHtml(e.content)}</div>
    </div>`,
      )
      .join("") ||
    '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">Chưa có nhật ký</div></div>';
}

function calcStreak() {
  if (!entries.length) return 0;
  const dates = new Set(entries.map((e) => e.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!dates.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Xử lý Modal & Xóa
function openEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  currentModalId = id;
  document.getElementById("modal-title").textContent = formatDateVI(e.date);
  document.getElementById("modal-meta").textContent =
    (e.mood || "") +
    (e.updatedAt
      ? "  •  " +
        new Date(e.updatedAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "");

  // [ĐIỀU CHỈNH] Đã tích hợp hàm parseMarkdown để hiển thị Markdown trong Modal
  document.getElementById("modal-content").innerHTML = parseMarkdown(e.content);
  document.getElementById("modal-view").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-view").classList.remove("open");
  currentModalId = null;
}

async function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  saveToStorage();
  renderAll();
  if (id === todayKey()) {
    document.getElementById("diary-content").value = "";
    updateCharCount();
  }
  showToast("🗑️ Đã xóa nhật ký");
  if (typeof isSignedIn !== "undefined" && isSignedIn) await syncToDrive();
}

// Xử lý Toolbar viết
function insertText(before, after) {
  const ta = document.getElementById("diary-content");
  const s = ta.selectionStart,
    e = ta.selectionEnd;
  const sel = ta.value.substring(s, e);
  ta.value =
    ta.value.substring(0, s) + before + sel + after + ta.value.substring(e);
  ta.focus();
  ta.selectionStart = ta.selectionEnd =
    s + before.length + sel.length + after.length;
  updateCharCount();
}

function updateCharCount() {
  document.getElementById("char-num").textContent =
    document.getElementById("diary-content").value.length;
}

function switchTab(tabId) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === "view-" + tabId));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.toggle("active", n.dataset.nav === tabId));
  if (tabId === "stats") renderStats();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function formatDateVI(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} tháng ${parseInt(m)}, ${y}`;
}

function escHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupListeners() {
  document
    .getElementById("diary-content")
    .addEventListener("input", updateCharCount);

  document.querySelectorAll(".mood-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const same = b.classList.contains("selected");
      document
        .querySelectorAll(".mood-btn")
        .forEach((x) => x.classList.remove("selected"));
      if (!same) {
        b.classList.add("selected");
        selectedMood = b.dataset.mood;
      } else selectedMood = "";
    });
  });

  document
    .querySelectorAll(".tab")
    .forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)),
    );
  document
    .querySelectorAll(".nav-item")
    .forEach((n) =>
      n.addEventListener("click", () => switchTab(n.dataset.nav)),
    );

  document.getElementById("btn-search-toggle").addEventListener("click", () => {
    switchTab("entries");
    const sw = document.getElementById("search-wrap");
    sw.style.display = sw.style.display === "none" ? "block" : "none";
    if (sw.style.display === "block")
      document.getElementById("search-input").focus();
  });

  document.getElementById("modal-delete").addEventListener("click", () => {
    if (currentModalId && confirm("Xóa nhật ký này?")) {
      deleteEntry(currentModalId);
      closeModal();
    }
  });
  document.getElementById("modal-view").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-view")) closeModal();
  });
}

// Khởi chạy App
init();
