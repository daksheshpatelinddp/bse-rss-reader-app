/*
 * BSE RSS READER - CLIENT APP
 * Features: Watchlist management (with comma-separated splitting), category filtering,
 * search, duplicate grouping, and dual top/bottom pagination.
 */

const WORKER_URL = "https://bse-rss-reader.daksheshpatelin.workers.dev";
const ITEMS_PER_PAGE = 50;

let rawAnnouncements = [];
let filteredAnnouncements = [];
let watchlist = [];
let currentCategory = "ALL";
let currentPage = 1;
let totalPages = 1;

/* ============================================================
   INITIALIZATION & EVENT LISTENERS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadWatchlist();
  fetchCategories();
  fetchAnnouncements();
});

function initEventListeners() {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    fetchAnnouncements();
    fetchCategories();
  });

  document.getElementById("addWatchBtn").addEventListener("click", addWatchlistItem);
  document.getElementById("watchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") addWatchlistItem();
  });
  document.getElementById("clearWatchlistBtn").addEventListener("click", clearWatchlist);
  document.getElementById("csvFileInput").addEventListener("change", handleFileUpload);

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("feedSelect").addEventListener("change", fetchAnnouncements);
  document.getElementById("showAllBtn").addEventListener("click", () => {
    selectCategory("ALL");
  });

  document.getElementById("prevBtnTop").addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("nextBtnTop").addEventListener("click", () => goToPage(currentPage + 1));

  document.getElementById("prevBtnBottom").addEventListener("click", () => goToPage(currentPage - 1));
  document.getElementById("nextBtnBottom").addEventListener("click", () => goToPage(currentPage + 1));
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

  document.getElementById("pageInfoTop").textContent = pageText;
  document.getElementById("prevBtnTop").disabled = currentPage <= 1;
  document.getElementById("nextBtnTop").disabled = currentPage >= totalPages;

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
   WATCHLIST OPERATIONS (COMMA-SEPARATED SUPPORT)
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
  const value = input.value.trim();
  if (!value) return;

  // Splits comma-separated inputs (e.g., RELIANCE, TCS, 500325) into separate items
  const items = value.split(",").map(item => item.trim()).filter(Boolean);

  items.forEach(clean => {
    const isScrip = /^\d{6}$/.test(clean);
    const newItem = isScrip ? { scrip: clean, name: "" } : { scrip: "", name: clean };

    if (!watchlist.some(w => 
      (w.scrip && newItem.scrip && w.scrip === newItem.scrip) || 
      (w.name && newItem.name && w.name.toLowerCase() === newItem.name.toLowerCase())
    )) {
      watchlist.push(newItem);
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
      const entries = line.split(",").map(item => item.trim()).filter(Boolean);
      entries.forEach(clean => {
        const isScrip = /^\d{6}$/.test(clean);
        const newItem = isScrip ? { scrip: clean, name: "" } : { scrip: "", name: clean };
        if (!watchlist.some(w => 
          (w.scrip && newItem.scrip && w.scrip === newItem.scrip) || 
          (w.name && newItem.name && w.name.toLowerCase() === newItem.name.toLowerCase())
        )) {
          watchlist.push(newItem);
        }
      });
    });
    saveWatchlist();
  };
  reader.readAsText(file);
}

function renderWatchlist() {
  const container = document.getElementById("whitelistContainer");
  if (watchlist.length === 0) {
    container.innerHTML = '<span class="muted">No whitelisted companies added yet.</span>';
    return;
  }

  container.innerHTML = watchlist.map((item, index) => `
    <div class="watch-item">
      <span>${item.name || item.scrip}</span>
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

  let html = `
    <button class="category-button all-category ${currentCategory === 'ALL' ? 'active' : ''}" onclick="selectCategory('ALL')">
      <span>All Announcements</span>
      <b>${totalCount}</b>
    </button>
  `;

  categories.forEach(cat => {
    html += `
      <button class="category-button ${currentCategory === cat.name ? 'active' : ''}" onclick="selectCategory('${cat.name}')">
        <span>${cat.name}</span>
        <b>${cat.count}</b>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectCategory(category) {
  currentCategory = category;
  document.getElementById("feedTitle").textContent = category === "ALL" ? "All Announcements" : category;
  
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

function applyFilters() {
  const searchText = document.getElementById("searchInput").value.toLowerCase().trim();

  filteredAnnouncements = rawAnnouncements.filter(item => {
    if (currentCategory !== "ALL" && !item.categories?.includes(currentCategory)) {
      return false;
    }

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
    const bseLink = item.scrip 
      ? `https://www.bseindia.com/stock-share-price/${item.scrip}`
      : (item.link || "https://www.bseindia.com");

    const categoryTags = (item.categories || [item.category || "General"])
      .map(c => `<span class="tag">${c}</span>`)
      .join("");

    return `
      <article class="announcement-card">
        <div class="announcement-top">
          <div>
            <span class="company">${item.company || "Unknown Company"}</span>
            ${item.scrip ? `<span class="scrip">${item.scrip}</span>` : ""}
          </div>
          ${isWhitelisted ? '<span class="watch-badge">⭐ Watchlist</span>' : ""}
        </div>

        <div class="category-tags">
          ${categoryTags}
        </div>

        <h3>
          <a href="${bseLink}" target="_blank" rel="noopener noreferrer">
            ${item.title || "Untitled Announcement"}
          </a>
        </h3>

        ${item.description ? `<div class="description">${item.description}</div>` : ""}

        <div class="announcement-bottom">
          <span>📅 ${item.pubDate ? new Date(item.pubDate).toLocaleString() : "Recently"}</span>
          <div class="bottom-right">
            ${item.isFinancialResult ? '<span class="result-badge">📊 Financial Result</span>' : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  updatePaginationUI();
}