/*
 * BSE RSS READER - CLIENT APP
 * Features: Watchlist management, category filtering, search, 
 *           duplicate grouping, dual top/bottom pagination,
 *           and Telegram/ntfy notification toggles.
 */

const WORKER_URL = "https://bse-rss-reader.daksheshpatelin.workers.dev"; // Update if your worker URL differs
const ITEMS_PER_PAGE = 50;

let rawAnnouncements = [];
let filteredAnnouncements = [];
let watchlist = [];
let currentCategory = "ALL";
let currentPage = 1;
let totalPages = 1;

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   INITIALIZATION & EVENT LISTENERS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadNotificationSettings();
  loadWatchlist();
  fetchCategories();
  fetchAnnouncements();
});

function initEventListeners() {
  // Notification Toggles
  document.getElementById("telegramToggle").addEventListener("change", saveNotificationSettings);
  document.getElementById("ntfyToggle").addEventListener("change", saveNotificationSettings);

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", () => {
    fetchAnnouncements();
    fetchCategories();
  });

  // Watchlist controls
  document.getElementById("addWatchBtn").addEventListener("click", addWatchlistItem);
  document.getElementById("watchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addWatchlistItem();
  });
  document.getElementById("clearWatchlistBtn").addEventListener("click", clearWatchlist);
  document.getElementById("csvFileInput").addEventListener("change", handleFileUpload);

  // Filter & Feed Select
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("feedSelect").addEventListener("change", fetchAnnouncements);
  document.getElementById("showAllBtn").addEventListener("click", () => {
    selectCategory("ALL");
  });

  // Top Pagination Controls
  document.getElementById("prevBtnTop").addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("nextBtnTop").addEventListener("click", () => goToPage(currentPage + 1));

  // Bottom Pagination Controls
  document.getElementById("prevBtnBottom").addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("nextBtnBottom").addEventListener("click", () => goToPage(currentPage + 1));
}

/* ============================================================
   NOTIFICATION SETTINGS OPERATIONS
   ============================================================ */

async function loadNotificationSettings() {
  try {
    const res = await fetch(`${WORKER_URL}/notification-settings`);
    const data = await res.json();
    if (data.ok && data.settings) {
      document.getElementById("telegramToggle").checked = !!data.settings.telegram;
      document.getElementById("ntfyToggle").checked = !!data.settings.ntfy;
    }
  } catch (err) {
    console.error("Error loading notification settings:", err);
  }
}

async function saveNotificationSettings() {
  const settings = {
    telegram: document.getElementById("telegramToggle").checked,
    ntfy: document.getElementById("ntfyToggle").checked
  };

  try {
    await fetch(`${WORKER_URL}/notification-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  } catch (err) {
    console.error("Error saving notification settings:", err);
  }
}

/* ============================================================
   SCROLL & PAGINATION HELPERS
   ============================================================ */

function scrollToAnnouncements() {
  const target = document.querySelector(".current-feed");
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderAnnouncements();
  scrollToAnnouncements();
}

function updatePaginationUI() {
  const pageText = `Page ${currentPage} of ${totalPages || 1}`;

  // Update Top Bar
  document.getElementById("pageInfoTop").textContent = pageText;
  document.getElementById("prevBtnTop").disabled = currentPage <= 1;
  document.getElementById("nextBtnTop").disabled = currentPage >= totalPages;

  // Update Bottom Bar
  document.getElementById("pageInfoBottom").textContent = pageText;
  document.getElementById("prevBtnBottom").disabled = currentPage <= 1;
  document.getElementById("nextBtnBottom").disabled = currentPage >= totalPages;
}

/* ============================================================
   DATA FETCHING
   ============================================================ */

async function fetchAnnouncements() {
  const feedType = document.getElementById("feedSelect").value;
  const endpoint = feedType === "results" ? "/monitor" : "/bse-announcements";

  document.getElementById("feedCount").textContent = "Loading announcements...";

  try {
    const res = await fetch(`${WORKER_URL}${endpoint}`);
    const data = await res.json();

    rawAnnouncements = data.items || data.newItems || [];
    document.getElementById("lastUpdatedText").textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    
    applyFilters();
    fetchCategories();
  } catch (err) {
    console.error("Error fetching announcements:", err);
    document.getElementById("feedCount").textContent = "Failed to load announcements.";
  }
}

async function fetchCategories() {
  try {
    const res = await fetch(`${WORKER_URL}/categories`);
    const data = await res.json();
    renderCategories(data.categories || []);
  } catch (err) {
    console.error("Error fetching categories:", err);
  }
}

/* ============================================================
   WATCHLIST OPERATIONS
   ============================================================ */

async function loadWatchlist() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`);
    const data = await res.json();
    watchlist = data.watchlist || [];
    renderWatchlist();
  } catch (err) {
    console.error("Error loading watchlist:", err);
  }
}

async function saveWatchlist() {
  renderWatchlist();
  applyFilters();

  try {
    await fetch(`${WORKER_URL}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist }),
    });
  } catch (err) {
    console.error("Error saving watchlist:", err);
  }
}

function addWatchlistItem() {
  const input = document.getElementById("watchInput");
  const rawValue = input.value.trim();
  if (!rawValue) return;

  const entries = rawValue.split(",");
  entries.forEach(entry => {
    const clean = entry.trim();
    if (clean) {
      const isScrip = /^\d{6}$/.test(clean);
      const newItem = isScrip ? { scrip: clean, name: "" } : { scrip: "", name: clean };

      if (!watchlist.some(w => (w.scrip && w.scrip === newItem.scrip) || (w.name && w.name.toLowerCase() === newItem.name.toLowerCase()))) {
        watchlist.push(newItem);
      }
    }
  });

  saveWatchlist();
  input.value = "";
}

function removeWatchlistItem(index) {
  watchlist.splice(index, 1);
  saveWatchlist();
}

function clearWatchlist() {
  if (confirm("Are you sure you want to clear your entire watchlist?")) {
    watchlist = [];
    saveWatchlist();
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const lines = event.target.result.split(/\r?\n/);
    lines.forEach(line => {
      const entries = line.split(",");
      entries.forEach(entry => {
        const clean = entry.trim();
        if (clean) {
          const isScrip = /^\d{6}$/.test(clean);
          const newItem = isScrip ? { scrip: clean, name: "" } : { scrip: "", name: clean };
          if (!watchlist.some(w => (w.scrip && w.scrip === newItem.scrip) || (w.name && w.name.toLowerCase() === newItem.name.toLowerCase()))) {
            watchlist.push(newItem);
          }
        }
      });
    });
    saveWatchlist();
  };
  reader.readAsText(file);
}

function renderWatchlist() {
  const countEl = document.getElementById("watchlistCount");
  if (countEl) {
    countEl.textContent = `(${watchlist.length})`;
  }

  const container = document.getElementById("whitelistContainer");
  if (watchlist.length === 0) {
    container.innerHTML = '<span class="muted">No whitelisted companies added yet.</span>';
    return;
  }

  container.innerHTML = watchlist.map((item, index) => `
    <div class="watch-item">
      <span>${escapeHtml(item.name || item.scrip)}</span>
      <button class="remove-watch" onclick="removeWatchlistItem(${index})">&times;</button>
    </div>
  `).join("");
}

/* ============================================================
   CATEGORIES & FILTERS
   ============================================================ */

function renderCategories(categories) {
  const container = document.getElementById("categoryList");
  const totalCount = rawAnnouncements.length;
  const whitelistedCount = rawAnnouncements.filter(matchesWatchlistClient).length;

  let html = `
    <button class="category-button special ${currentCategory === 'WHITELISTED' ? 'active' : ''}" onclick="selectCategory('WHITELISTED')">
      <span>⭐ Whitelisted Scrips</span>
      <b>${whitelistedCount}</b>
    </button>
    <button class="category-button all-category ${currentCategory === 'ALL' ? 'active' : ''}" onclick="selectCategory('ALL')">
      <span>All Announcements</span>
      <b>${totalCount}</b>
    </button>
  `;

  categories.forEach(cat => {
    html += `
      <button class="category-button ${currentCategory === cat.name ? 'active' : ''}" onclick="selectCategory('${escapeHtml(cat.name)}')">
        <span>${escapeHtml(cat.name)}</span>
        <b>${cat.count}</b>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(category) {
  currentCategory = category;
  if (category === "WHITELISTED") {
    document.getElementById("feedTitle").textContent = "⭐ Whitelisted Scrips";
  } else if (category === "ALL") {
    document.getElementById("feedTitle").textContent = "All Announcements";
  } else {
    document.getElementById("feedTitle").textContent = category;
  }
  
  const showAllBtn = document.getElementById("showAllBtn");
  if (category === "ALL") {
    showAllBtn.classList.add("hidden");
  } else {
    showAllBtn.classList.remove("hidden");
  }

  fetchCategories();
  applyFilters();
}

function matchesWatchlistClient(item) {
  if (watchlist.length === 0) return false;
  const scrip = String(item.scrip || "").trim();
  const company = String(item.company || "").toLowerCase().trim();

  return watchlist.some(w => {
    if (w.scrip && scrip && w.scrip === scrip) return true;
    if (w.name && company && company.includes(w.name.toLowerCase().trim())) return true;
    return false;
  });
}

function getBseDirectLink(item) {
  var rawLink = String(item.link || "").trim();
  if (rawLink.indexOf("AttachLive") !== -1 || rawLink.indexOf("AttachHis") !== -1) {
    var fileName = rawLink.split("/").pop();
    if (fileName) {
      return "https://www.bseindia.com/xml-data/corpfiling/AttachLive/" + fileName;
    }
  }
  if (rawLink.indexOf("http") === 0) {
    return rawLink;
  }
  if (item.scrip) {
    return "https://www.bseindia.com/stock-share-price/" + item.scrip;
  }
  return "https://www.bseindia.com";
}

function applyFilters() {
  const searchText = document.getElementById("searchInput").value.toLowerCase().trim();

  filteredAnnouncements = rawAnnouncements.filter(item => {
    // Whitelisted special bundle match
    if (currentCategory === "WHITELISTED") {
      if (!matchesWatchlistClient(item)) return false;
    }
    // Standard Category match
    else if (currentCategory !== "ALL" && !item.categories?.includes(currentCategory)) {
      return false;
    }

    // Search match
    if (searchText) {
      const title = String(item.title || "").toLowerCase();
      const desc = String(item.description || "").toLowerCase();
      const company = String(item.company || "").toLowerCase();
      const scrip = String(item.scrip || "");

      return title.includes(searchText) || desc.includes(searchText) || company.includes(searchText) || scrip.includes(searchText);
    }

    return true;
  });

  currentPage = 1;
  totalPages = Math.ceil(filteredAnnouncements.length / ITEMS_PER_PAGE) || 1;

  document.getElementById("feedCount").textContent = `${filteredAnnouncements.length} item(s) found`;
  renderAnnouncements();
}

/* ============================================================
   RENDER ANNOUNCEMENTS
   ============================================================ */

function renderAnnouncements() {
  const container = document.getElementById("results");

  if (filteredAnnouncements.length === 0) {
    container.innerHTML = '<div class="empty">No announcements found matching your criteria.</div>';
    updatePaginationUI();
    return;
  }

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredAnnouncements.slice(start, end);

  container.innerHTML = pageItems.map(item => {
    const isWhitelisted = matchesWatchlistClient(item);
    const bseLink = getBseDirectLink(item);

    const categoryTags = (item.categories || [item.category || "General"])
      .map(c => `<span class="tag">${escapeHtml(c)}</span>`)
      .join("");

    const parsedDate = item.pubDate ? new Date(item.pubDate) : null;
    const formattedDate = (parsedDate && !isNaN(parsedDate.getTime())) 
      ? parsedDate.toLocaleString() 
      : "Recently";

    const parsedFetchDate = item.fetchedAt ? new Date(item.fetchedAt) : null;
    const formattedFetchDate = (parsedFetchDate && !isNaN(parsedFetchDate.getTime()))
      ? parsedFetchDate.toLocaleString()
      : "N/A";

    return `
      <article class="announcement-card">
        <div class="announcement-top">
          <div>
            <span class="company">${escapeHtml(item.company || "Unknown Company")}</span>
            ${item.scrip ? `<span class="scrip">${escapeHtml(item.scrip)}</span>` : ""}
          </div>
          ${isWhitelisted ? '<span class="watch-badge">⭐ Watchlist</span>' : ""}
        </div>

        <div class="category-tags">
          ${categoryTags}
        </div>

        <h3>
          <a href="${escapeHtml(bseLink)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(item.title || "Untitled Announcement")}
          </a>
        </h3>

        ${item.description ? `<div class="description">${escapeHtml(item.description)}</div>` : ""}

        <div class="announcement-bottom">
          <span>📅 Pub: ${formattedDate} | ⚡ Fetched: ${formattedFetchDate}</span>
          <div class="bottom-right">
            ${item.isFinancialResult ? '<span class="result-badge">📊 Financial Result</span>' : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  updatePaginationUI();
}