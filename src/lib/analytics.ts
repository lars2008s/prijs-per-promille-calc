// Cookie-less visit counter. Sends nothing personal: the server only keeps a daily-rotating hash.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
export const OPT_OUT_KEY = "ppp:no-track";

export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOptOut(off: boolean) {
  try {
    if (off) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* ignore */
  }
}

export function track(type: "pageview" | "scan") {
  // Automated browsers (tests, crawlers) and the owner's opted-out devices are not counted.
  if (navigator.webdriver || isOptedOut()) return;
  const body = JSON.stringify({ type, ref: type === "pageview" ? document.referrer : "" });
  const url = `${API_BASE}/api/hit`;
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
}
