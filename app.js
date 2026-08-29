/* ============================================================
   BSE ANNOUNCEMENT READER - APP.JS (FIXED)
   ============================================================ */

// Global State
let watchlist = [];
let announcements = [];
let activeCategory = "all";

// Configuration & Endpoints
const API_BASE = "https://bse-rss-reader-app.daksheshpatelin.workers.dev";
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

  if (addBtn) addBtn.addEventListener("click", handleAddInput);
  if (clearAllBtn) clearAllBtn.addEventListener("click", handleClearAll);
  if (refreshBtn) refreshBtn.addEventListener("click", fetchAnnouncements);

  if (watchlistInput) {
    watchlistInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddInput();
      }
    });
  }

  if (uploadTrigger && fileInput) {
    uploadTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener("change", handleFileUpload);
  }

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
   ROBUST PARSING & FLEXIBLE MATCHING
   ============================================================ */

function parseCompanyInput(rawInput) {
  if (!rawInput) return null;
  // Clean whitespace and quotes
  let text = String(rawInput).replace(/["']/g, "").trim();
  if (!text) return null;

  let scrip = "";
  let name = "";

  // Extract 6-digit scrip code if present
  const scripMatch = text.match(/\b(\d{6})\b/);
  if (scripMatch) {
    scrip = scripMatch[1];
    name = text
      .replace(scripMatch[0], "")
      .replace(/\bbse\b/gi, "")
      .replace(/[()]/g, "")
      .trim();
  } else {
    name = text.replace(/\bbse\b/gi, "").trim();
  }

  return {
    scrip: scrip,
    name: name,
    raw: text
  };
}

function isWhitelisted(item) {
  // IF NO WHITELISTED COMPANIES, SHOW ALL 1900+ ANNOUNCEMENTS
  if (!watchlist || watchlist.length === 0) return true;

  // Handle all common RSS property variations safely
  const companyText = String(item.company || item.companyName || item.NEWSSUB || "").toLowerCase();
  const scripText = String(item.scrip || item.scripCode || item.SCRIP_CD || "").toLowerCase();
  const titleText = String(item.title || item.HEADLINE || "").toLowerCase();
  const descText = String(item.description || item.MORE || "").toLowerCase();

  const fullText = `${companyText} ${scripText} ${titleText} ${descText}`;

  return watchlist.some((watch) => {
    // 1. Check Scrip Code match
    if (watch.scrip && (scripText.includes(watch.scrip.toLowerCase()) || fullText.includes(watch.scrip.toLowerCase()))) {
      return true;
    }

    // 2. Check Name / Alias match
    if (watch.name && watch.name.length > 0) {
      const cleanName = watch.name.toLowerCase();
      if (fullText.includes(cleanName)) {
        return true;
      }
    }

    // 3. Raw Fallback Check (handles RIL, BSE 500325, etc.)
    if (watch.raw && watch.raw.length > 0) {
      const cleanRaw = watch.raw.replace(/\bbse\b/gi, "").replace(/[()]/g, "").trim().toLowerCase();
      if (cleanRaw && fullText.includes(cleanRaw)) {
        return true;
      }
    }

    return false;
  });
}

/* ============================================================
   WATCHLIST API & STATE PERSISTENCE
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
    const res = await fetch(WATCHLIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist })
    });

    if (!res.ok) {
      console.error("Server refused watchlist update:", res.statusText);
    }
  } catch (err) {
    console.error("Failed to save watchlist to backend worker:", err);
  }
}

function handleAddInput() {
  const inputVal = watchlistInput.value.trim();
  if (!inputVal) return;

  const entries = inputVal.split(",").map((s) => s.trim()).filter(Boolean);

  entries.forEach((entry) => {
    const parsed = parseCompanyInput(entry);
    if (parsed) {
      const exists = watchlist.some(
        (w) =>
          (parsed.scrip && w.scrip === parsed.scrip) ||
          (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase()) ||
          (parsed.raw && w.raw && w.raw.toLowerCase() === parsed.raw.toLowerCase())
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
    // Split by newlines or commas
    const lines = content.split(/[\r\n,]+/);

    lines.forEach((line) => {
      const parsed = parseCompanyInput(line);
      if (parsed) {
        const exists = watchlist.some(
          (w) =>
            (parsed.scrip && w.scrip === parsed.scrip) ||
            (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase()) ||
            (parsed.raw && w.raw && w.raw.toLowerCase() === parsed.raw.toLowerCase())
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
    watchlistTags.innerHTML = `<span class="empty-msg">No companies whitelisted yet. (Showing all announcements)</span>`;
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
      announcements = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
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

  let filtered = announcements.filter((item) => isWhitelisted(item));

  if (activeCategory !== "all") {
    filtered = filtered.filter((item) => {
      const cat = String(item.category || item.CATEGORYNAME || "").toLowerCase();
      return cat.includes(activeCategory.toLowerCase());
    });
  }

  if (filtered.length === 0) {
    feedContainer.innerHTML = `
      <div class="empty-feed">
        <p>No matching announcements found for your current whitelist filter.</p>
      </div>
    `;
    return;
  }

  feedContainer.innerHTML = filtered
    .map((item) => {
      const title = item.title || item.HEADLINE || "No Title";
      const company = item.company || item.companyName || item.NEWSSUB || "BSE Listed Company";
      const scrip = item.scrip || item.scripCode || item.SCRIP_CD ? `(${item.scrip || item.scripCode || item.SCRIP_CD})` : "";
      const date = item.pubDate || item.NEWS_DT ? new Date(item.pubDate || item.NEWS_DT).toLocaleString() : "";
      const link = item.link || item.ATTACHMENTNAME || "#";
      const category = item.category || item.CATEGORYNAME || "General";
      const description = item.description || item.MORE || "";

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