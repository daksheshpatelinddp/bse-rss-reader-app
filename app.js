/**
 * BSE Announcement Reader - Front-end JavaScript (app.js)
 * Supports single inputs (e.g. 500325) and bulk list inputs (textarea/input)
 */

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

function getInputContainer() {
  // Broad selector to capture input, textarea, or elements by ID/class
  return (
    document.getElementById("whitelistInput") ||
    document.getElementById("watchlistInput") ||
    document.querySelector("textarea") ||
    document.querySelector("input[type='text']")
  );
}

function setupEventListeners() {
  const addBtn =
    document.getElementById("addBtn") ||
    document.querySelector("button.add-btn") ||
    document.querySelector(".add-btn") ||
    document.querySelector("button[type='submit']");

  const inputEl = getInputContainer();
  const refreshBtn = document.getElementById("refreshBtn");

  if (addBtn && inputEl) {
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleAddWatchlist();
    });
  }

  if (inputEl) {
    inputEl.addEventListener("keypress", (e) => {
      // Allow Enter to submit only for single-line inputs, not textareas
      if (e.key === "Enter" && inputEl.tagName !== "TEXTAREA") {
        e.preventDefault();
        handleAddWatchlist();
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshAll);
  }
}

// Watchlist operations
async function handleAddWatchlist() {
  const inputEl = getInputContainer();
  if (!inputEl) {
    alert("Could not find input box on page.");
    return;
  }

  const rawValue = inputEl.value;
  if (!rawValue || !rawValue.trim()) return;

  // Split comma, newline, tab, or space separated inputs
  const parsedItems = rawValue
    .split(/[\n,\r\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parsedItems.length === 0) return;

  // Merge with local state
  const updatedWatchlist = Array.from(new Set([...watchlist, ...parsedItems]));
  
  // Clear input box
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
  const container =
    document.getElementById("watchlistContainer") ||
    document.getElementById("whitelistContainer") ||
    document.querySelector(".watchlist-tags") ||
    document.querySelector(".whitelisted-chips") ||
    document.querySelector(".tags-container");

  const countBadge =
    document.getElementById("watchlistCount") ||
    document.getElementById("whitelistCount") ||
    document.querySelector(".whitelisted-count");

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