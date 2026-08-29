/**
 * BSE Announcement Reader - Front-end JavaScript (app.js)
 * Project: bse-rss-reader-app
 */

// Targeted directly to the backend worker with the KV binding
const API_BASE = "https://bse-rss-reader.daksheshpatelin.workers.dev";

let watchlist = [];
let feeds = [];
let alerts = [];

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  setupEventListeners();
  await refreshAll();
}

function setupEventListeners() {
  const addBtn = document.getElementById("addBtn") || document.querySelector("button.add-btn") || document.querySelector(".add-btn");
  const inputEl = document.getElementById("whitelistInput") || document.querySelector("input[type='text']");
  const refreshBtn = document.getElementById("refreshBtn");

  if (addBtn && inputEl) {
    addBtn.addEventListener("click", () => handleAddWatchlist(inputEl));
    inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddWatchlist(inputEl);
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshAll);
  }
}

// Watchlist operations
async function handleAddWatchlist(inputEl) {
  const rawValue = inputEl.value.trim();
  if (!rawValue) return;

  const parsedItems = rawValue
    .split(/[\n,\r\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parsedItems.length === 0) return;

  const updatedWatchlist = Array.from(new Set([...watchlist, ...parsedItems]));
  inputEl.value = "";

  watchlist = updatedWatchlist;
  renderWatchlist();
  await saveWatchlistToBackend(watchlist);
}

async function removeWatchlistItem(itemToRemove) {
  watchlist = watchlist.filter((item) => item !== itemToRemove);
  renderWatchlist();
  await saveWatchlistToBackend(watchlist);
}

async function saveWatchlistToBackend(updatedList) {
  try {
    const res = await fetch(`${API_BASE}/watchlist`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(updatedList),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    
    if (data && Array.isArray(data.watchlist)) {
      watchlist = data.watchlist;
    } else if (Array.isArray(data)) {
      watchlist = data;
    }
    
    renderWatchlist();
    await loadFeeds();
  } catch (err) {
    alert(`Could not save whitelist: ${err.message}`);
  }
}

// Data Loaders
async function refreshAll() {
  await loadWatchlist();
  await loadFeeds();
  await loadAlerts();
}

async function loadWatchlist() {
  try {
    const res = await fetch(`${API_BASE}/watchlist`);
    if (res.ok) {
      const data = await res.json();
      watchlist = Array.isArray(data) ? data : (data.watchlist || []);
      renderWatchlist();
    }
  } catch (e) {
    console.error("Failed to load watchlist:", e);
  }
}

async function loadFeeds() {
  try {
    const res = await fetch(`${API_BASE}/feeds`);
    if (res.ok) {
      feeds = await res.json();
      renderFeeds();
    }
  } catch (e) {
    console.error("Failed to load feeds:", e);
  }
}

async function loadAlerts() {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (res.ok) {
      alerts = await res.json();
      renderAlerts();
    }
  } catch (e) {
    console.error("Failed to load alerts:", e);
  }
}

// UI Rendering
function renderWatchlist() {
  const container = document.getElementById("watchlistContainer") || document.querySelector(".watchlist-tags") || document.querySelector(".whitelisted-chips");
  const countBadge = document.getElementById("watchlistCount") || document.querySelector(".whitelisted-count");

  if (countBadge) countBadge.textContent = watchlist.length;
  if (!container) return;

  container.innerHTML = "";

  if (watchlist.length === 0) {
    container.innerHTML = `<p class="empty-msg">No companies whitelisted yet.</p>`;
    return;
  }

  watchlist.forEach((item) => {
    const tag = document.createElement("div");
    tag.className = "tag-chip";
    tag.innerHTML = `
      <span>${escapeHtml(item)}</span>
      <button class="remove-btn" title="Remove">&times;</button>
    `;

    tag.querySelector(".remove-btn").addEventListener("click", () => {
      removeWatchlistItem(item);
    });

    container.appendChild(tag);
  });
}

function renderFeeds() {
  const container = document.getElementById("feedContainer") || document.querySelector(".feed-list");
  const countBadge = document.getElementById("feedCount");

  if (countBadge) countBadge.textContent = feeds.length;
  if (!container) return;

  container.innerHTML = "";

  if (feeds.length === 0) {
    container.innerHTML = `<p class="empty-msg">No announcements found.</p>`;
    return;
  }

  feeds.forEach((item) => {
    const card = document.createElement("div");
    card.className = `feed-card ${item.isWatchlisted ? "highlighted" : ""}`;
    card.innerHTML = `
      <div class="feed-header">
        <strong>${escapeHtml(item.company || "Company")}</strong>
        <span class="scrip-code">${escapeHtml(item.scrip || "N/A")}</span>
      </div>
      <div class="feed-body">
        <p>${escapeHtml(item.title)}</p>
      </div>
      <div class="feed-footer">
        <span class="category-badge">${escapeHtml(item.category || "Other")}</span>
        <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">View Notice</a>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAlerts() {
  const countBadge = document.getElementById("alertCount");
  if (countBadge) countBadge.textContent = alerts.length;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}