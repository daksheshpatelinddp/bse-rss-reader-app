/*
 * BSE Alert Monitor – frontend for alert-first worker V6
 * Uses: /alerts, /watchlist, /notification-settings, /monitor
 */

const WORKER_URL = "https://bse-rss-reader.daksheshpatelin.workers.dev";

let watchlist = [];
let alerts = [];

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("telegramToggle").addEventListener("change", saveNotificationSettings);
  document.getElementById("ntfyToggle").addEventListener("change", saveNotificationSettings);
  document.getElementById("refreshBtn").addEventListener("click", () => {
    loadAlerts();
    loadWatchlist();
  });
  document.getElementById("checkNowBtn").addEventListener("click", checkNow);
  document.getElementById("addWatchBtn").addEventListener("click", addWatchlistItem);
  document.getElementById("watchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addWatchlistItem();
  });
  document.getElementById("clearWatchlistBtn").addEventListener("click", clearWatchlist);
  document.getElementById("csvFileInput").addEventListener("change", handleFileUpload);

  loadNotificationSettings();
  loadWatchlist();
  loadAlerts();
});

/* ---------- notifications ---------- */

async function loadNotificationSettings() {
  try {
    const res = await fetch(`${WORKER_URL}/notification-settings`);
    const data = await res.json();
    const s = data.settings || {};
    document.getElementById("telegramToggle").checked = s.telegram !== false;
    document.getElementById("ntfyToggle").checked = s.ntfy !== false;
  } catch (err) {
    console.error(err);
  }
}

async function saveNotificationSettings() {
  const body = {
    telegram: document.getElementById("telegramToggle").checked,
    ntfy: document.getElementById("ntfyToggle").checked,
  };
  try {
    await fetch(`${WORKER_URL}/notification-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(err);
  }
}

/* ---------- watchlist ---------- */

async function loadWatchlist() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`);
    const data = await res.json();
    watchlist = data.watchlist || [];
    renderWatchlist();
  } catch (err) {
    console.error(err);
  }
}

async function saveWatchlist() {
  renderWatchlist();
  try {
    await fetch(`${WORKER_URL}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist }),
    });
  } catch (err) {
    console.error(err);
  }
}

function addWatchlistItem() {
  const raw = document.getElementById("watchInput").value.trim();
  if (!raw) return;
  const isScrip = /^\d{6}$/.test(raw);
  const newItem = isScrip ? { scrip: raw, name: "" } : { scrip: "", name: raw };
  const exists = watchlist.some(
    (w) =>
      (w.scrip && newItem.scrip && w.scrip === newItem.scrip) ||
      (w.name && newItem.name && w.name.toLowerCase() === newItem.name.toLowerCase())
  );
  if (!exists) {
    watchlist.push(newItem);
    saveWatchlist();
  }
  document.getElementById("watchInput").value = "";
}

function removeWatchlistItem(index) {
  watchlist.splice(index, 1);
  saveWatchlist();
}

function clearWatchlist() {
  if (!confirm("Clear entire watchlist?")) return;
  watchlist = [];
  saveWatchlist();
}

function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const lines = String(event.target.result || "").split(/\r?\n/);
    lines.forEach((line) => {
      line.split(",").forEach((entry) => {
        const clean = entry.trim();
        if (!clean) return;
        const isScrip = /^\d{6}$/.test(clean);
        const newItem = isScrip ? { scrip: clean, name: "" } : { scrip: "", name: clean };
        if (
          !watchlist.some(
            (w) =>
              (w.scrip && newItem.scrip && w.scrip === newItem.scrip) ||
              (w.name && newItem.name && w.name.toLowerCase() === newItem.name.toLowerCase())
          )
        ) {
          watchlist.push(newItem);
        }
      });
    });
    saveWatchlist();
  };
  reader.readAsText(file);
  e.target.value = "";
}

function renderWatchlist() {
  const countEl = document.getElementById("watchlistCount");
  if (countEl) countEl.textContent = `(${watchlist.length})`;
  const container = document.getElementById("whitelistContainer");
  if (!watchlist.length) {
    container.innerHTML = '<span class="muted">No scrips yet. Add 6-digit code or name.</span>';
    return;
  }
  container.innerHTML = watchlist
    .map(
      (item, index) => `
    <div class="watch-item">
      <span>${escapeHtml(item.name || item.scrip)}</span>
      <button type="button" class="remove-watch" data-index="${index}">&times;</button>
    </div>`
    )
    .join("");
  container.querySelectorAll(".remove-watch").forEach((btn) => {
    btn.addEventListener("click", () => removeWatchlistItem(Number(btn.dataset.index)));
  });
}

/* ---------- alerts ---------- */

async function loadAlerts() {
  const feedCount = document.getElementById("feedCount");
  feedCount.textContent = "Loading…";
  try {
    const res = await fetch(`${WORKER_URL}/alerts`);
    const data = await res.json();
    alerts = data.items || [];
    renderAlerts();
  } catch (err) {
    console.error(err);
    feedCount.textContent = "Failed to load alerts.";
  }
}

function renderAlerts() {
  const feedCount = document.getElementById("feedCount");
  const results = document.getElementById("results");
  feedCount.textContent = `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;

  if (!alerts.length) {
    results.innerHTML =
      '<p class="muted empty">No alerts yet. Add scrips to the watchlist — new matching announcements will appear here and on Telegram/ntfy.</p>';
    return;
  }

  results.innerHTML = alerts
    .map((item) => {
      const time = item.fetchedAt || item.alertCreatedAt
        ? new Date(item.fetchedAt || item.alertCreatedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "";
      const link = item.link
        ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Attachment / details</a>`
        : "";
      return `
      <article class="alert-card">
        <div class="alert-top">
          <strong>${escapeHtml(item.company || "Company")} ${item.scrip ? `(${escapeHtml(item.scrip)})` : ""}</strong>
          <span class="time">${escapeHtml(time)}</span>
        </div>
        <p class="title">${escapeHtml(item.title || "Announcement")}</p>
        ${link}
      </article>`;
    })
    .join("");
}

/* ---------- manual poll ---------- */

async function checkNow() {
  const btn = document.getElementById("checkNowBtn");
  const last = document.getElementById("lastCheckText");
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    const res = await fetch(`${WORKER_URL}/monitor`);
    const data = await res.json();
    last.textContent = `Last check: ${new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
    })} · new ${data.newAnnouncements || 0} · alerts ${data.newAlerts || 0}`;
    await loadAlerts();
  } catch (err) {
    console.error(err);
    last.textContent = "Last check failed.";
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Check now";
  }
}
