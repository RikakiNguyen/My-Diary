// ================================================================
// [ĐIỀU CHỈNH] CẤU HÌNH GOOGLE DRIVE
// -> Bạn cần dán đúng mã Client ID lấy từ Cloud Console của bạn vào đây
// ================================================================
const CLIENT_ID = "990904829675-2oa479cb2cfpljqgish50st8tfv61ad2.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILE_NAME = "nhatky_data.json";
const DISCOVERY = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// Trạng thái cục bộ của Drive
let gapiReady = false;
let gisReady = false;
let tokenClient = null;
let driveFileId = localStorage.getItem("drive_file_id") || null;
let isSignedIn = false;

// Thiết lập trạng thái mặc định ban đầu là offline
window.addEventListener("DOMContentLoaded", () => {
  setDriveStatus("offline");
});

function gapiLoaded() {
  gapi.load("client", async () => {
    await gapi.client.init({ discoveryDocs: [DISCOVERY] });
    gapiReady = true;
    tryAutoLogin();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
  gisReady = true;
  tryAutoLogin();
}

function tryAutoLogin() {
  if (!gapiReady || !gisReady) return;

  const savedToken = localStorage.getItem("gapi_token");
  if (savedToken) {
    try {
      const token = JSON.parse(savedToken);
      if (token.expires_at && Date.now() < token.expires_at) {
        gapi.client.setToken(token);
        onSignInSuccess(false);
        return;
      }
    } catch (e) {}
    localStorage.removeItem("gapi_token");
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      setDriveStatus("offline");
      return;
    }
    saveToken(resp);
    await onSignInSuccess(true);
  };
  tokenClient.requestAccessToken({ prompt: "" });
}

async function handleDriveClick() {
  if (!gapiReady || !gisReady) {
    showToast("⏳ Đang tải thư viện Google...");
    return;
  }

  if (isSignedIn) {
    await syncToDrive();
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error) {
      showToast("❌ Đăng nhập thất bại: " + resp.error);
      setDriveStatus("offline");
      return;
    }
    saveToken(resp);
    await onSignInSuccess(true);
  };
  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function onSignInSuccess(fetchFromDrive) {
  isSignedIn = true;
  setDriveStatus("syncing");

  try {
    if (fetchFromDrive) {
      await loadFromDrive();
    }
    setDriveStatus("online");
    showToast("✅ Đã kết nối Google Drive!");
  } catch (e) {
    console.error("Drive error:", e);
    setDriveStatus("online");
    showToast("⚠️ Kết nối Drive nhưng không đọc được dữ liệu cũ");
  }
}

function saveToken(tokenResp) {
  const expiresIn = parseInt(tokenResp.expires_in || 3600) * 1000;
  const token = {
    ...tokenResp,
    expires_at: Date.now() + expiresIn - 60000,
  };
  localStorage.setItem("gapi_token", JSON.stringify(token));
  gapi.client.setToken(token);
}

async function syncToDrive() {
  if (!isSignedIn) return;
  setDriveStatus("syncing");

  // Biến entries ở đây sẽ tự động liên kết với biến entries khai báo ở app.js
  const data = JSON.stringify(entries, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const reader = new FileReader();

  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];
    try {
      if (driveFileId) {
        await gapi.client.request({
          path: `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}`,
          method: "PATCH",
          params: { uploadType: "media" },
          headers: { "Content-Type": "application/json" },
          body: data,
        });
      } else {
        const meta = await gapi.client.request({
          path: "https://www.googleapis.com/upload/drive/v3/files",
          method: "POST",
          params: { uploadType: "multipart" },
          headers: {
            "Content-Type": "multipart/related; boundary=boundary_nhatky",
          },
          body: [
            "--boundary_nhatky",
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify({
              name: DRIVE_FILE_NAME,
              mimeType: "application/json",
            }),
            "--boundary_nhatky",
            "Content-Type: application/json",
            "",
            data,
            "--boundary_nhatky--",
          ].join("\r\n"),
        });
        driveFileId = meta.result.id;
        localStorage.setItem("drive_file_id", driveFileId);
      }
      setDriveStatus("online");
      showToast("☁️ Đã đồng bộ lên Drive!");
    } catch (e) {
      console.error("Sync error:", e);
      if (e.status === 401) {
        localStorage.removeItem("gapi_token");
        isSignedIn = false;
        setDriveStatus("offline");
        showToast("🔑 Phiên hết hạn, vui lòng kết nối lại Drive");
      } else {
        setDriveStatus("online");
        showToast("❌ Lỗi đồng bộ Drive");
      }
    }
  };
  reader.readAsDataURL(blob);
}

async function loadFromDrive() {
  const search = await gapi.client.drive.files.list({
    q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    spaces: "drive",
  });

  const files = search.result.files;
  if (!files || files.length === 0) return;

  driveFileId = files[0].id;
  localStorage.setItem("drive_file_id", driveFileId);

  const res = await gapi.client.drive.files.get({
    fileId: driveFileId,
    alt: "media",
  });

  const driveEntries =
    typeof res.result === "string" ? JSON.parse(res.result) : res.result;

  if (Array.isArray(driveEntries)) {
    const map = {};
    // Kết hợp dữ liệu (Merge)
    [...entries, ...driveEntries].forEach((e) => {
      if (!map[e.id] || e.updatedAt > map[e.id].updatedAt) map[e.id] = e;
    });
    // Gán lại cho mảng entries của ứng dụng (nằm bên app.js)
    entries = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
    saveToStorage(); // Hàm này từ app.js
    renderAll(); // Hàm này từ app.js
  }
}

function setDriveStatus(state) {
  const dot = document.getElementById("drive-dot");
  const text = document.getElementById("drive-text");
  const btn = document.getElementById("btn-drive");

  if (!dot || !text || !btn) return;

  if (state === "online") {
    dot.className = "drive-dot";
    dot.style.background = "#4ade80";
    dot.style.boxShadow = "0 0 6px #4ade80";
    text.textContent = "✅ Đã kết nối Google Drive — nhật ký tự động đồng bộ";
    btn.textContent = "☁️";
    btn.title = "Bấm để đồng bộ ngay";
  } else if (state === "syncing") {
    dot.style.background = "#facc15";
    dot.style.boxShadow = "0 0 6px #facc15";
    text.textContent = "⏳ Đang đồng bộ với Drive...";
    btn.textContent = "🔄";
  } else {
    dot.className = "drive-dot offline";
    dot.style.background = "";
    dot.style.boxShadow = "";
    text.textContent = "☁️ Chưa kết nối Drive — bấm nút ☁️ để đăng nhập Google";
    btn.textContent = "☁️";
    btn.title = "Kết nối Google Drive";
  }
}

// Bắt sự kiện nút bấm cho Drive khi file vừa load xong
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("btn-drive")
    .addEventListener("click", handleDriveClick);
});
