/* ============================================================
   BSE ANNOUNCEMENT READER - APP.JS
   ============================================================ */

let watchlist = [];
let announcements = [];
let activeCategory = "all";

const API_BASE = "https://bse-rss-reader-app.daksheshpatelin.workers.dev";
const WATCHLIST_ENDPOINT = `${API_BASE}/watchlist`;
const RSS_ENDPOINT = `${API_BASE}/rss`;

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

function parseCompanyInput(rawInput) {
  const text = rawInput.trim();
  if (!text) return null;

  let scrip = "";
  let name = "";

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

  return { scrip, name, raw: text };
}

function isWhitelisted(item) {
  if (!watchlist || watchlist.length === 0) return true; // Show all if watchlist is empty

  const companyText = String(item.company || "").toLowerCase();
  const scripText = String(item.scrip || "").toLowerCase();
  const titleText = String(item.title || "").toLowerCase();
  const descText = String(item.description || "").toLowerCase();
  const fullText = `${companyText} ${scripText} ${titleText} ${descText}`;

  return watchlist.some((watch) => {
    if (watch.scrip && (scripText.includes(watch.scrip) || fullText.includes(watch.scrip))) {
      return true;
    }
    if (watch.name && watch.name.trim().length > 0) {
      if (fullText.includes(watch.name.trim().toLowerCase())) return true;
    }
    if (watch.raw && watch.raw.trim().length > 0) {
      const cleanRaw = watch.raw.replace(/\bbse\b/gi, "").replace(/[()]/g, "").trim().toLowerCase();
      if (cleanRaw && fullText.includes(cleanRaw)) return true;
    }
    return false;
  });
}

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
      console.error("Backend failed to save watchlist");
    }
  } catch (err) {
    console.error("Network error while saving watchlist:", err);
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
          (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase())
      );
      if (!exists) watchlist.push(parsed);
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
    const lines = evt.target.result.split(/[\r\n,]+/);
    lines.forEach((line) => {
      const parsed = parseCompanyInput(line);
      if (parsed) {
        const exists = watchlist.some(
          (w) =>
            (parsed.scrip && w.scrip === parsed.scrip) ||
            (parsed.name && w.name.toLowerCase() === parsed.name.toLowerCase())
        );
        if (!exists) watchlist.push(parsed);
      }
    });
    fileInput.value = "";
    saveWatchlist();
  };
  reader.readAsText(file);
}

function renderWatchlist() {
  if (watchlistCount) watchlistCount.textContent = watchlist.length;
  if (!watchlistTags) return;

  if (watchlist.length === 0) {
    watchlistTags.innerHTML = `<span class="empty-msg">No companies whitelisted yet. Showing all feed items.</span>`;
    return;
  }

  watchlistTags.innerHTML = watchlist
    .map((item, index) => {
      let displayName = item.scrip && item.name ? `${item.scrip} (${item.name})` : item.scrip || item.name || item.raw;
      return `
        <span class="tag">
          ${displayName}
          <button onclick="removeWatchlistItem(${index})">&times;</button>
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
      feedContainer.innerHTML = `<div class="error">Failed to load RSS feed.</div>`;
    }
  } catch (err) {
    feedContainer.innerHTML = `<div class="error">Unable to connect to service.</div>`;
  }
}

function renderAnnouncements() {
  if (!feedContainer) return;

  let filtered = announcements.filter((item) => isWhitelisted(item));

  if (activeCategory !== "all") {
    filtered = filtered.filter((item) =>
      String(item.category || "").toLowerCase().includes(activeCategory.toLowerCase())
    );
  }

  if (filtered.length === 0) {
    feedContainer.innerHTML = `
      <div class="empty-feed">
        <p>No announcements matching your whitelisted companies in this category.</p>
        <p><em>Total raw announcements loaded: ${announcements.length}</em></p>
      </div>
    `;
    return;
  }

  feedContainer.innerHTML = filtered
    .map((item) => `
      <div class="announcement-card">
        <div class="card-header">
          <div>
            <span class="company-name">${item.company || "BSE Company"}</span>
            <span class="scrip-code">${item.scrip ? `(${item.scrip})` : ""}</span>
          </div>
          <span class="badge">${item.category || "General"}</span>
        </div>
        <h3 class="card-title">${item.title || "No Title"}</h3>
        <p class="card-desc">${item.description || ""}</p>
        <div class="card-footer">
          <span class="date">${item.pubDate ? new Date(item.pubDate).toLocaleString() : ""}</span>
          <a href="${item.link || "#"}" target="_blank" rel="noopener" class="pdf-link">View Attachment &rarr;</a>
        </div>
      </div>
    `)
    .join("");
}