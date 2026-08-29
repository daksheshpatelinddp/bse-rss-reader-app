const API = "https://bse-rss-reader.daksheshpatelin.workers.dev";
const PAGE_SIZE = 50;

let allItems = [];
let currentItems = [];
let displayedItems = [];
let categories = [];
let watchlist = [];
let alerts = [];
let currentFeed = "all";
let currentPage = 1;
let totalPages = 1;

const results = document.getElementById("results");
const empty = document.getElementById("empty");
const statusEl = document.getElementById("status");
const lastUpdated = document.getElementById("lastUpdated");
const categoryList = document.getElementById("categoryList");
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const currentFeedTitle = document.getElementById("currentFeedTitle");
const currentFeedCount = document.getElementById("currentFeedCount");
const totalCount = document.getElementById("totalCount");
const alertCount = document.getElementById("alertCount");
const watchCount = document.getElementById("watchCount");
const whitelist = document.getElementById("whitelist");

async function api(path, options = {}) {
  const response = await fetch(API + path, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch (_) {}
    throw new Error(message);
  }
  return response.json();
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function loadWatchlist() {
  try {
    const data = await api("/watchlist");
    watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];
    renderWatchlist();
  } catch (error) {
    console.error("Watchlist load:", error);
    setStatus("Could not load watchlist.");
  }
}

async function saveWatchlist() {
  const data = await api("/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watchlist }),
  });
  if (Array.isArray(data.watchlist)) watchlist = data.watchlist;
  renderWatchlist();
}

async function addWatch() {
  const input = document.getElementById("companyInput");
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    setStatus("Enter a BSE scrip code or company name.");
    input.focus();
    return;
  }

  if (/^\d{6}$/.test(value)) {
    if (watchlist.some(item => String(item.scrip || "").trim() === value)) {
      setStatus("This scrip is already whitelisted.");
      input.value = "";
      return;
    }
    watchlist.push({ scrip: value });
  } else {
    if (watchlist.some(item => String(item.name || "").trim().toLowerCase() === value.toLowerCase())) {
      setStatus("This company is already whitelisted.");
      input.value = "";
      return;
    }
    watchlist.push({ name: value });
  }

  try {
    setStatus("Saving whitelist...");
    await saveWatchlist();
    input.value = "";
    setStatus("Whitelist saved successfully.");
  } catch (error) {
    console.error("Whitelist save:", error);
    await loadWatchlist();
    setStatus("Could not save whitelist.");
  }
}

async function removeWatch(index) {
  if (index < 0 || index >= watchlist.length) return;
  watchlist.splice(index, 1);
  renderWatchlist();

  try {
    setStatus("Updating whitelist...");
    await saveWatchlist();
    setStatus("Whitelist updated.");
  } catch (error) {
    console.error("Whitelist remove:", error);
    await loadWatchlist();
    setStatus("Could not update whitelist.");
  }
}

function renderWatchlist() {
  if (!whitelist) return;
  if (watchCount) watchCount.textContent = watchlist.length;
  whitelist.innerHTML = "";

  if (watchlist.length === 0) {
    whitelist.innerHTML = `<div class="muted">No companies whitelisted yet.</div>`;
    return;
  }

  watchlist.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "watch-item";
    const label = item.scrip ? `BSE ${item.scrip}` : (item.name || "Unknown");

    div.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <button type="button" class="remove-watch" data-index="${index}" title="Remove">×</button>
    `;
    whitelist.appendChild(div);
  });

  whitelist.querySelectorAll(".remove-watch").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      removeWatch(Number(button.dataset.index));
    });
  });
}

async function loadData() {
  setStatus("Loading BSE announcements...");
  try {
    const [announcementsRes, categoriesRes, alertsRes] = await Promise.all([
      api("/bse-announcements"),
      api("/categories"),
      api("/alerts")
    ]);

    allItems = Array.isArray(announcementsRes.items) ? announcementsRes.items : [];
    categories = Array.isArray(categoriesRes.categories) ? categoriesRes.categories : [];
    alerts = Array.isArray(alertsRes.items) ? alertsRes.items : [];

    if (totalCount) totalCount.textContent = allItems.length.toLocaleString();
    if (alertCount) alertCount.textContent = alerts.length;

    renderCategories();
    renderCategoryFilter();
    selectFeed("all");

    setStatus(`Loaded ${allItems.length.toLocaleString()} BSE announcements.`);
    if (lastUpdated) lastUpdated.textContent = new Date().toLocaleTimeString();
  } catch (error) {
    console.error("Load error:", error);
    setStatus("Error loading BSE announcements.");
  }
}

function renderCategories() {
  if (!categoryList) return;
  categoryList.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "category-button all-category";
  allButton.dataset.category = "all";
  allButton.innerHTML = `<span>All Announcements</span><b>${allItems.length.toLocaleString()}</b>`;
  allButton.addEventListener("click", () => { selectFeed("all"); scrollToResults(); });
  categoryList.appendChild(allButton);

  categories.forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = category.name;
    button.innerHTML = `<span>${escapeHtml(category.name)}</span><b>${Number(category.count).toLocaleString()}</b>`;
    button.addEventListener("click", () => { selectFeed(category.name); scrollToResults(); });
    categoryList.appendChild(button);
  });
}

function renderCategoryFilter() {
  if (!categoryFilter) return;
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    categoryFilter.appendChild(option);
  });
}

function selectFeed(feed) {
  currentFeed = feed;
  currentPage = 1;

  if (feed === "all") {
    currentItems = [...allItems];
    if (currentFeedTitle) currentFeedTitle.textContent = "All BSE Announcements";
  } else {
    currentItems = allItems.filter(item => 
      item.category === feed || (Array.isArray(item.categories) && item.categories.includes(feed))
    );
    if (currentFeedTitle) currentFeedTitle.textContent = feed;
  }

  if (currentFeedCount) currentFeedCount.textContent = `${currentItems.length.toLocaleString()} announcements`;
  if (categoryFilter) categoryFilter.value = feed === "all" ? "all" : feed;

  updateCategoryHighlight();
  applySearch();
}

function updateCategoryHighlight() {
  document.querySelectorAll(".category-button").forEach(button => {
    button.classList.toggle("active", button.dataset.category === currentFeed);
  });
}

function applySearch() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!query) {
    displayedItems = [...currentItems];
  } else {
    displayedItems = currentItems.filter(item => {
      const text = [
        item.company,
        item.scrip,
        item.title,
        item.description,
        item.category,
        ...(Array.isArray(item.categories) ? item.categories : [])
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(query);
    });
  }

  currentPage = 1;
  renderPage();
}

function renderPage() {
  if (!results) return;
  results.innerHTML = "";

  if (displayedItems.length === 0) {
    if (empty) empty.classList.remove("hidden");
    renderPagination(0, 0);
    return;
  }

  if (empty) empty.classList.add("hidden");

  const sorted = [...displayedItems].sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  pageItems.forEach(item => {
    results.appendChild(createAnnouncementCard(item));
  });

  renderPagination(sorted.length, totalPages);
}

function createAnnouncementCard(item) {
  const card = document.createElement("article");
  card.className = "announcement-card";

  const whitelisted = isWhitelisted(item);
  const categoriesText = Array.isArray(item.categories) ? item.categories.join(" • ") : (item.category || "Other");
  const date = formatDate(item.pubDate);

  card.innerHTML = `
    <div class="announcement-top">
      <div class="company">
        ${escapeHtml(item.company || "Unknown Company")}
        ${item.scrip ? `<span class="scrip">${escapeHtml(item.scrip)}</span>` : ""}
      </div>
      ${whitelisted ? `<span class="watch-badge">⭐ Whitelisted</span>` : ""}
    </div>

    <div class="category-tags">
      ${categoriesText.split(" • ").map(cat => `<span class="tag">${escapeHtml(cat)}</span>`).join("")}
    </div>

    <h3>
      ${item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || "BSE Announcement")}</a>` : escapeHtml(item.title || "BSE Announcement")}
    </h3>

    ${item.description ? `<div class="description">${escapeHtml(item.description)}</div>` : ""}

    <div class="announcement-bottom">
      <span>${escapeHtml(date)}</span>
      ${item.isFinancialResult ? `<span class="result-badge">Financial Result</span>` : ""}
    </div>
  `;

  return card;
}

function isWhitelisted(item) {
  return watchlist.some(watch => {
    if (watch.scrip && item.scrip) return String(watch.scrip).trim() === String(item.scrip).trim();
    if (watch.name && item.company) return String(watch.name).trim().toLowerCase() === String(item.company).trim().toLowerCase();
    return false;
  });
}

function showAlerts() {
  currentFeed = "alerts";
  currentItems = [...alerts];
  if (currentFeedTitle) currentFeedTitle.textContent = "⭐ Alerts / Special Bundle";
  if (currentFeedCount) currentFeedCount.textContent = `${alerts.length} alerts`;
  if (categoryFilter) categoryFilter.value = "all";
  
  document.querySelectorAll(".category-button").forEach(b => b.classList.remove("active"));
  currentPage = 1;
  applySearch();
}

function renderPagination(total, pages) {
  let old = document.getElementById("pagination");
  if (!old) {
    old = document.createElement("div");
    old.id = "pagination";
    old.className = "pagination";
    if (results && results.parentNode) results.parentNode.insertBefore(old, results.nextSibling);
  }

  old.innerHTML = "";
  if (total === 0 || pages <= 1) return;

  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "‹ Previous";
  previous.disabled = currentPage <= 1;
  previous.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderPage(); scrollToResults(); }
  });

  const info = document.createElement("span");
  info.textContent = `Page ${currentPage} of ${pages}`;

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next ›";
  next.disabled = currentPage >= pages;
  next.addEventListener("click", () => {
    if (currentPage < pages) { currentPage++; renderPage(); scrollToResults(); }
  });

  old.appendChild(previous);
  old.appendChild(info);
  old.appendChild(next);
}

function scrollToResults() {
  if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) { return escapeHtml(value); }

/* ============================================================
   INIT
   ============================================================ */

document.getElementById("addBtn")?.addEventListener("click", addWatch);
document.getElementById("companyInput")?.addEventListener("keydown", e => { if (e.key === "Enter") addWatch(); });
document.getElementById("refreshBtn")?.addEventListener("click", async () => { await loadWatchlist(); await loadData(); });
document.getElementById("allBtn")?.addEventListener("click", () => { selectFeed("all"); scrollToResults(); });
document.getElementById("alertsBtn")?.addEventListener("click", () => { showAlerts(); scrollToResults(); });
document.getElementById("searchInput")?.addEventListener("input", applySearch);
document.getElementById("categoryFilter")?.addEventListener("change", e => { selectFeed(e.target.value); scrollToResults(); });

(async function init() {
  await loadWatchlist();
  await loadData();
})();