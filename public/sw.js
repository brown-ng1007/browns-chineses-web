/* Service worker của Brown's Chinenes.
 * - Không đụng vào /api/* và mọi yêu cầu khác trang web (Supabase, ...).
 * - File giao diện /_next/static/*: lấy từ bộ nhớ đệm trước (tên file có mã băm, không đổi).
 * - Trang web (điều hướng): ưu tiên mạng, quá 4 giây hoặc mất mạng thì dùng bản đã lưu.
 * - Chỉ lưu trang thành công, không phải chuyển hướng (vd chuyển về /login).
 */

const STATIC_CACHE = "bc-static-v1";
const PAGES_CACHE = "bc-pages-v1";
const META_CACHE = "bc-meta-v1";
const KEEP = [STATIC_CACHE, PAGES_CACHE, META_CACHE];

const WARM_PATHS = ["/", "/vocab", "/review", "/skills", "/write", "/settings"];
const WARM_EVERY_MS = 6 * 60 * 60 * 1000; // làm mới bản lưu sẵn tối đa 6 giờ một lần
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

function fetchWithTimeout(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function isCacheable(res) {
  return res && res.ok && !res.redirected && res.type === "basic";
}

function offlineResponse() {
  const html =
    '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Ngoại tuyến</title></head>" +
    '<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">' +
    "<h1>Chưa có mạng</h1>" +
    "<p>Trang này chưa được lưu trên máy. Hãy kết nối mạng và mở lại một lần.</p>" +
    "</body></html>";
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Tải sẵn các trang chính (cần đã đăng nhập), để mất mạng vẫn mở được
async function warmPages() {
  const meta = await caches.open(META_CACHE);
  const stamp = await meta.match("warm-stamp");
  if (stamp) {
    const last = Number(await stamp.text());
    if (Number.isFinite(last) && Date.now() - last < WARM_EVERY_MS) return;
  }

  const cache = await caches.open(PAGES_CACHE);
  let okCount = 0;
  for (const path of WARM_PATHS) {
    try {
      const res = await fetch(path, {
        credentials: "same-origin",
        headers: { Accept: "text/html" },
      });
      if (isCacheable(res)) {
        await cache.put(self.location.origin + path, res);
        okCount++;
      }
    } catch (e) {
      // Bỏ qua trang không tải được
    }
  }
  if (okCount === WARM_PATHS.length) {
    await meta.put("warm-stamp", new Response(String(Date.now())));
  }
}

async function handleNavigation(event) {
  const request = event.request;
  const url = new URL(request.url);
  const key = url.origin + url.pathname;
  const cache = await caches.open(PAGES_CACHE);

  try {
    const res = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

    if (isCacheable(res)) {
      await cache.put(key, res.clone());
      if (url.pathname !== "/login") {
        event.waitUntil(warmPages());
      }
      return res;
    }

    if (!res.ok && res.type === "basic") {
      // Máy chủ báo lỗi: nếu có bản đã lưu thì dùng tạm
      const cached = await cache.match(key, { ignoreVary: true });
      if (cached) return cached;
    }
    return res;
  } catch (e) {
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) return cached;
    return offlineResponse();
  }
}

async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg") {
    event.respondWith(handleStatic(request));
  }
});
