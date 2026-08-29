/* ============================================================
   BSE ANNOUNCEMENT READER - APP.JS
   ============================================================ */

// Global State
let watchlist = [];
let announcements = [];
let activeCategory = "all";

// Configuration & Endpoints
const API_BASE = "https://bse-rss-reader-app.daksheshpatelin.workers.dev"; // Your Cloudflare Worker URL
const WATCHLIST_ENDPOINT = `${API_BASE}/watchlist`;
const RSS_ENDPOINT = `${API_BASE}/rss`;

// DOM Elements
const watchlistInput = document.getElementById("watchlistInput");
const addBtn = document.getElementById("addBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const fileInput = document.getElementById("fileInput");
const uploadTrigger = document.getElementById("uploadTrigger");
const watchlistTags = document.getElementById("watchlistTags");
const watchlistCount = document.getElementById("watchlistCount");
const refreshBtn = document.getElementById("refreshBtn");
const feedContainer = document.getElementById("feedContainer");
const categoryButtons = document.querySelectorAll(".category-btn");

/* ============================================================
   INITIALIZATION & EVENT LISTENERS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  fetchWatchlist();
  fetchAnnouncements();

  // Button Listeners
  if (addBtn) addBtn.addEventListener("click", handleAddInput);
  if (clearAllBtn) clearAllBtn.addEventListener("click", handleClearAll);
  if (refreshBtn) refreshBtn.addEventListener("click", fetchAnnouncements);

  // Enter Key Listener for Input
  if (watchlistInput) {
    watchlistInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddInput();
      }
    });
  }

  // File Upload Handlers
  if (uploadTrigger && fileInput) {
    uploadTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener("change", handleFileUpload);
  }

  // Category Filtering Listeners
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      categoryButtons.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      activeCategory = e.target.getAttribute("data-category") || "all";
      renderAnnouncements();
    });
  });
});

/* ============================================================
   PARSING & MATCHING LOGIC
   ============================================================ */

/**
 * Parses inputs like:
 * - "500325"
 * - "Reliance"
 * - "RIL"
 * - "500325 (Reliance)"
 * - "Reliance (500325)"
 * - "Reliance Industries Limited"
 */
function parseCompanyInput(rawInput) {
  const text = rawInput.trim();
  if (!text) return null;

  let scrip = "";
  let name = "";

  // Extract 6-digit scrip code if present
  const scripMatch = text.match(/\b(\d{6})\b/);
  if (scripMatch) {
    scrip = scripMatch[1];
    // Remove code, "BSE", and parentheses to clean up name
    name = text
      .replace(scripMatch[0], "")
      .replace(/\bbse\b/gi, "")
      .replace(/[()]/g, "")
      .trim();
  } else {
    // If no 6-digit code, clean prefix and store full text as name/alias
    name = text.replace(/\bbse\b/gi, "").trim();
  }

  return {
    scrip: scrip,
    name: name,
    raw: text // Original string for search comparison
  };
}

/**
 * Flexible Multi-Pattern Matcher
 * Matches announcement if ANY of the whitelisted variations match:
 * - Scrip code (e.g. 500325)
 * - Company name (e.g. Reliance / Reliance Industries)
 * - Ticker symbol / Short code (e.g. RIL)
 */
function isWhitelisted(item) {
  if (!watchlist || watchlist.length === 0) return false;

  const companyText = String(item.company || "").toLowerCase();
  const scripText = String(item.scrip || "").toLowerCase();
  const titleText = String(item.title || "").toLowerCase();
  const descText = String(item.description || "").toLowerCase();

  const fullAnnouncementText = `${companyText} ${scripText} ${titleText} ${descText}`;

  return watchlist.some((watch) => {
    // 1. Exact Scrip Code Match
    if (watch.scrip && scripText.includes(String(watch.scrip).trim().toLowerCase())) {
      return true;
    }

    // 2. Name / Alias Substring Match
    if (watch.name && watch.name.trim().length > 0) {
      const cleanName = watch.name.trim().toLowerCase();
      if (companyText.includes(cleanName) || titleText.includes(cleanName)) {
        return true;
      }
    }

    // 3. Raw Input Fallback (Handles symbols like "RIL" or "BSE 500325")
    if (watch.raw && watch.raw.trim().length > 0) {
      const cleanRaw = watch.raw
        .replace(/\bbse\b/gi, "")
        .replace(/[()]/g, "")
        .trim()
        .toLowerCase();

      if (cleanRaw && fullAnnouncementText.includes(cleanRaw)) {
        return true;
      }
    }

    return false;
  });
}

/* ============================================================
   WATCHLIST API & DATA MANAGERS
   ============================================================ */

async function fetchWatchlist() {
  try {
    const res = await fetch(WATCHLIST_ENDPOINT);
    if (res.ok) {
      const data = await res.json();
      watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];
      renderWatchlist();
      renderAnnouncements();
    }
  } catch (err) {
    console.error("Failed to fetch watchlist:", err);
  }
}

async function saveWatchlist() {
  renderWatchlist();
  renderAnnouncements();

  try {
    await fetch(WATCHLIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist })
    });
  } catch (err) {
    console.error("Failed to save watchlist:", err);
  }
}

function handleAddInput() {
  const inputVal = watchlistInput.value.trim();
  if (!inputVal) return;

  // Split comma-separated entries if multiple were entered
  const entries = inputVal.split(",").map((s) => s.trim()).filter(Boolean);

  entries.forEach((entry) => {
    const parsed = parseCompanyInput(entry);
    if (parsed) {
      // Avoid exact duplicates
      const exists = watchlist.some(
        (w) =>
          (parsed.scrip && w.scrip === parsed.scrip) ||
          (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase())
      );

      if (!exists) {
        watchlist.push(parsed);
      }
    }
  });

  watchlistInput.value = "";
  saveWatchlist();
}

function removeWatchlistItem(index) {
  watchlist.splice(index, 1);
  saveWatchlist();
}

function handleClearAll() {
  if (watchlist.length === 0) return;
  if (confirm("Are you sure you want to clear all whitelisted companies?")) {
    watchlist = [];
    saveWatchlist();
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const content = evt.target.result;
    const lines = content.split(/[\r\n,]+/);

    lines.forEach((line) => {
      const parsed = parseCompanyInput(line);
      if (parsed) {
        const exists = watchlist.some(
          (w) =>
            (parsed.scrip && w.scrip === parsed.scrip) ||
            (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase())
        );
        if (!exists) {
          watchlist.push(parsed);
        }
      }
    });

    fileInput.value = "";
    saveWatchlist();
  };

  reader.readAsText(file);
}

/* ============================================================
   UI RENDERING FUNCTIONS
   ============================================================ */

function renderWatchlist() {
  if (watchlistCount) watchlistCount.textContent = watchlist.length;
  if (!watchlistTags) return;

  if (watchlist.length === 0) {
    watchlistTags.innerHTML = `<span class="empty-msg">No companies whitelisted yet.</span>`;
    return;
  }

  watchlistTags.innerHTML = watchlist
    .map((item, index) => {
      let displayName = "";
      if (item.scrip && item.name) {
        displayName = `${item.scrip} (${item.name})`;
      } else if (item.scrip) {
        displayName = item.scrip;
      } else {
        displayName = item.name || item.raw;
      }

      return `
        <span class="tag">
          ${displayName}
          <button onclick="removeWatchlistItem(${index})" title="Remove">&times;</button>
        </span>
      `;
    })
    .join("");
}

async function fetchAnnouncements() {
  if (!feedContainer) return;
  feedContainer.innerHTML = `<div class="loading">Loading announcements...</div>`;

  try {
    const res = await fetch(RSS_ENDPOINT);
    if (res.ok) {
      const data = await res.json();
      announcements = Array.isArray(data.items) ? data.items : [];
      renderAnnouncements();
    } else {
      feedContainer.innerHTML = `<div class="error">Failed to load feed data.</div>`;
    }
  } catch (err) {
    console.error("Error fetching announcements:", err);
    feedContainer.innerHTML = `<div class="error">Unable to connect to announcement service.</div>`;
  }
}

function renderAnnouncements() {
  if (!feedContainer) return;

  // Filter based on Whitelist
  let filtered = announcements.filter((item) => isWhitelisted(item));

  // Filter based on Active Category
  if (activeCategory !== "all") {
    filtered = filtered.filter((item) => {
      const cat = String(item.category || "").toLowerCase();
      return cat.includes(activeCategory.toLowerCase());
    });
  }

  if (filtered.length === 0) {
    feedContainer.innerHTML = `
      <div class="empty-feed">
        <p>No matching announcements found for your current whitelist and filter.</p>
      </div>
    `;
    return;
  }

  feedContainer.innerHTML = filtered
    .map((item) => {
      const title = item.title || "No Title";
      const company = item.company || "BSE Listed Company";
      const scrip = item.scrip ? `(${item.scrip})` : "";
      const date = item.pubDate ? new Date(item.pubDate).toLocaleString() : "";
      const link = item.link || "#";
      const category = item.category || "General";
      const description = item.description || "";

      return `
        <div class="announcement-card">
          <div class="card-header">
            <div>
              <span class="company-name">${company}</span>
              <span class="scrip-code">${scrip}</span>
            </div>
            <span class="badge">${category}</span>
          </div>
          <h3 class="card-title">${title}</h3>
          <p class="card-desc">${description}</p>
          <div class="card-footer">
            <span class="date">${date}</span>
            <a href="${link}" target="_blank" rel="noopener" class="pdf-link">View Attachment &rarr;</a>
          </div>
        </div>
      `;
    })
    .join("");
}