const CACHE_NAME = "nhatky-v1";
// Danh sách các file cần lưu trữ offline
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/drive.js",
  "./manifest.json",
];

// Sự kiện cài đặt: Lưu các file vào Cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

// Sự kiện fetch: Ưu tiên lấy file từ Cache nếu không có mạng
self.addEventListener("fetch", (event) => {
  // Bỏ qua các request gọi đến Google API (vì nó cần mạng thật)
  if (
    event.request.url.includes("googleapis.com") ||
    event.request.url.includes("accounts.google.com")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Trả về file trong cache nếu có, nếu không thì gọi mạng tải về
      return response || fetch(event.request);
    }),
  );
});
