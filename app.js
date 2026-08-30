const API = "https://bse-rss-reader.daksheshpatelin.workers.dev";

/* ============================================================
   SETTINGS & STATE
   ============================================================ */

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

/* ============================================================
   DOM ELEMENTS
   ============================================================ */

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
const whitelistEl = document.getElementById("whitelist");

/* ============================================================
   API HELPER
   ============================================================ */

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

/* ============================================================
   FLEXIBLE PATTERN PARSING & WATCHLIST MANAGEMENT
   ============================================================ */

/**
 * Extracts scrip code and company name from formats:
 * - "500325"
 * - "Reliance"
 * - "500325, Reliance"
 * - "500325 (Reliance)"
 * - "Reliance (500325)"
 */
function parseCompanyInput(rawInput) {
  const text = rawInput.trim();
  if (!text) return null;

  let scrip = "";
  let name = "";

  const scripMatch = text.match(/\b(\d{6})\b/);
  if (scripMatch) {
    scrip = scripMatch[1];
    name = text.replace(scripMatch[0], "").replace(/[()]/g, "").trim();
  } else {
    name = text;
  }

  return { scrip, name };
}

async function loadWatchlist() {
  try {
    const data = await api("/watchlist");
    watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];
    renderWatchlist();
  } catch (error) {
    console.error("Watchlist load:", error);
    setStatus("Could not load whitelist.");
  }
}

async function saveWatchlist() {
  try {
    const data = await api("/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchlist: Array.isArray(watchlist) ? watchlist : [] }),
    });

    if (data && Array.isArray(data.watchlist)) {
      watchlist = data.watchlist;
    }
    renderWatchlist();
  } catch (error) {
    console.error("Save watchlist error:", error);
    throw error;
  }
}

async function processBulkInput(rawText) {
  if (!rawText || !rawText.trim()) return;

  const entries = rawText
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  let addedCount = 0;

  entries.forEach((entry) => {
    const parsed = parseCompanyInput(entry);
    if (!parsed) return;

    const exists = watchlist.some((item) => {
      if (parsed.scrip && item.scrip) {
        return String(item.scrip).trim() === parsed.scrip;
      }
      if (parsed.name && item.name) {
        return (
          String(item.name).trim().toLowerCase() === parsed.name.toLowerCase()
        );
      }
      return false;
    });

    if (!exists) {
      watchlist.push(parsed);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    try {
      setStatus("Saving whitelist...");
      await saveWatchlist();
      setStatus(`Added ${addedCount} item(s) to whitelist.`);
    } catch (error) {
      console.error("Bulk add error:", error);
      setStatus("Could not save whitelist.");
    }
  } else {
    setStatus("No new items added (duplicates or invalid format).");
  }
}

async function clearAllWatchlist() {
  if (!watchlist || watchlist.length === 0) return;

  if (!confirm("Are you sure you want to clear all whitelisted companies?")) {
    return;
  }

  const oldWatchlist = [...watchlist];
  watchlist = [];
  renderWatchlist();
  setStatus("Clearing whitelist...");

  try {
    await saveWatchlist();
    setStatus("Whitelist cleared successfully.");
  } catch (error) {
    console.error("Clear watchlist error:", error);
    watchlist = oldWatchlist;
    renderWatchlist();
    setStatus("Could not clear whitelist from server.");
  }
}

async function removeWatch(index) {
  if (index < 0 || index >= watchlist.length) return;

  const oldWatchlist = [...watchlist];
  watchlist.splice(index, 1);
  renderWatchlist();

  try {
    setStatus("Saving whitelist...");
    await saveWatchlist();
    setStatus("Whitelist updated.");
  } catch (error) {
    console.error("Whitelist remove error:", error);
    watchlist = oldWatchlist;
    renderWatchlist();
    setStatus("Could not update whitelist.");
  }
}

function renderWatchlist() {
  if (!whitelistEl) return;

  watchlist = Array.isArray(watchlist) ? watchlist : [];
  if (watchCount) watchCount.textContent = watchlist.length;

  whitelistEl.innerHTML = "";

  if (watchlist.length === 0) {
    whitelistEl.innerHTML = `<div class="muted">No companies whitelisted yet.</div>`;
    return;
  }

  watchlist.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "watch-item";

    let label = "";
    if (item.scrip && item.name) {
      label = `${item.name} (${item.scrip})`;
    } else if (item.scrip) {
      label = `${item.scrip}`;
    } else {
      label = item.name || "Unknown";
    }

    div.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <button type="button" class="remove-watch" data-index="${index}" title="Remove">×</button>
    `;

    whitelistEl.appendChild(div);
  });

  whitelistEl.querySelectorAll(".remove-watch").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeWatch(Number(button.dataset.index));
    });
  });
}

/* ============================================================
   LOAD & RENDER BSE DATA
   ============================================================ */

async function loadData() {
  setStatus("Loading BSE announcements...");

  try {
    const announcementData = await api("/bse-announcements");
    allItems = Array.isArray(announcementData.items) ? announcementData.items : [];

    const categoryData = await api("/categories");
    categories = Array.isArray(categoryData.categories) ? categoryData.categories : [];

    const alertData = await api("/alerts");
    alerts = Array.isArray(alertData.items) ? alertData.items : [];

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
  allButton.addEventListener("click", () => {
    selectFeed("all");
    scrollToResults();
  });
  categoryList.appendChild(allButton);

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = category.name;
    button.innerHTML = `<span>${escapeHtml(category.name)}</span><b>${Number(category.count).toLocaleString()}</b>`;
    button.addEventListener("click", () => {
      selectFeed(category.name);
      scrollToResults();
    });
    categoryList.appendChild(button);
  });
}

function renderCategoryFilter() {
  if (!categoryFilter) return;
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach((category) => {
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
    currentItems = allItems.filter((item) => {
      if (item.category === feed) return true;
      if (Array.isArray(item.categories)) return item.categories.includes(feed);
      return false;
    });
    if (currentFeedTitle) currentFeedTitle.textContent = feed;
  }

  if (currentFeedCount) {
    currentFeedCount.textContent = `${currentItems.length.toLocaleString()} announcements`;
  }
  if (categoryFilter) categoryFilter.value = feed === "all" ? "all" : feed;

  updateCategoryHighlight();
  applySearch();
}

function updateCategoryHighlight() {
  document.querySelectorAll(".category-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === currentFeed);
  });
}

function applySearch() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!query) {
    displayedItems = [...currentItems];
  } else {
    displayedItems = currentItems.filter((item) => {
      const text = [
        item.company,
        item.scrip,
        item.title,
        item.description,
        item.category,
        ...(Array.isArray(item.categories) ? item.categories : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }

  currentPage = 1;
  renderPage();
}

function sortedItems(items) {
  return [...items].sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
}

function groupDuplicates(items) {
  const map = new Map();
  for (const item of items) {
    const key = [item.company || "", item.title || "", item.description || ""].join("|").trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { item, items: [item] });
    } else {
      map.get(key).items.push(item);
    }
  }
  return Array.from(map.values());
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

  const sorted = sortedItems(displayedItems);
  totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);
  const groups = groupDuplicates(pageItems);

  groups.forEach((group) => {
    results.appendChild(createAnnouncementCard(group.item, group.items));
  });

  renderPagination(sorted.length, totalPages);
}

function createAnnouncementCard(item, groupedItems = [item]) {
  const card = document.createElement("article");
  card.className = "announcement-card";

  const whitelisted = isWhitelisted(item);
  const categoriesText = Array.isArray(item.categories) ? item.categories.join(" • ") : item.category || "Other";
  const date = formatDate(item.pubDate);
  const duplicateCount = groupedItems.length;

  card.innerHTML = `
    <div class="announcement-top">
      <div class="company">
        ${escapeHtml(item.company || "Unknown Company")}
        ${item.scrip ? `<span class="scrip">${escapeHtml(item.scrip)}</span>` : ""}
      </div>
      ${whitelisted ? `<span class="watch-badge">⭐ Whitelisted</span>` : ""}
    </div>

    <div class="category-tags">
      ${categoriesText.split(" • ").map((cat) => `<span class="tag">${escapeHtml(cat)}</span>`).join("")}
    </div>

    <h3>
      ${item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || "BSE Announcement")}</a>` : escapeHtml(item.title || "BSE Announcement")}
    </h3>

    ${item.description ? `<div class="description">${escapeHtml(item.description)}</div>` : ""}

    <div class="announcement-bottom">
      <span>${escapeHtml(date)}</span>
      <span class="bottom-right">
        ${item.isFinancialResult ? `<span class="result-badge">Financial Result</span>` : ""}
        ${duplicateCount > 1 ? `<button type="button" class="duplicate-btn">${duplicateCount} similar announcements</button>` : ""}
      </span>
    </div>

    ${
      duplicateCount > 1
        ? `<div class="duplicate-list hidden">
            ${groupedItems
              .map(
                (dup, idx) => `
                <div class="duplicate-item">
                  <div>${idx + 1}. ${escapeHtml(formatDate(dup.pubDate))}</div>
                  ${dup.link ? `<a href="${escapeAttr(dup.link)}" target="_blank" rel="noopener noreferrer">Open announcement</a>` : ""}
                </div>`
              )
              .join("")}
          </div>`
        : ""
    }
  `;

  if (duplicateCount > 1) {
    const button = card.querySelector(".duplicate-btn");
    const list = card.querySelector(".duplicate-list");
    if (button && list) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        list.classList.toggle("hidden");
        button.textContent = list.classList.contains("hidden")
          ? `${duplicateCount} similar announcements`
          : "Hide similar announcements";
      });
    }
  }

  return card;
}

function isWhitelisted(item) {
  return watchlist.some((watch) => {
    if (watch.scrip && item.scrip) {
      if (String(watch.scrip).trim() === String(item.scrip).trim()) return true;
    }
    if (watch.name && item.company) {
      const watchName = String(watch.name).trim().toLowerCase();
      const companyName = String(item.company).trim().toLowerCase();
      if (watchName.length >= 3 && companyName.includes(watchName)) return true;
    }
    return false;
  });
}

async function showAlerts() {
  try {
    const data = await api("/alerts");
    alerts = Array.isArray(data.items) ? data.items : [];

    if (alertCount) alertCount.textContent = alerts.length;

    currentFeed = "alerts";
    currentItems = [...alerts];

    if (currentFeedTitle) currentFeedTitle.textContent = "⭐ Alerts / Special Bundle";
    if (currentFeedCount) currentFeedCount.textContent = `${alerts.length} alerts`;
    if (categoryFilter) categoryFilter.value = "all";

    document.querySelectorAll(".category-button").forEach((btn) => btn.classList.remove("active"));
    currentPage = 1;
    applySearch();
  } catch (error) {
    console.error("Alerts:", error);
    setStatus("Could not load alerts.");
  }
}

function renderPagination(total, pages) {
  let old = document.getElementById("pagination");
  if (!old) {
    old = document.createElement("div");
    old.id = "pagination";
    old.className = "pagination";
    if (results && results.parentNode) {
      results.parentNode.insertBefore(old, results.nextSibling);
    }
  }

  old.innerHTML = "";
  if (total === 0 || pages <= 1) return;

  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "‹ Previous";
  previous.disabled = currentPage <= 1;
  previous.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
      scrollToResults();
    }
  });
  old.appendChild(previous);

  const info = document.createElement("span");
  info.textContent = `Page ${currentPage} of ${pages}`;
  old.appendChild(info);

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next ›";
  next.disabled = currentPage >= pages;
  next.addEventListener("click", () => {
    if (currentPage < pages) {
      currentPage++;
      renderPage();
      scrollToResults();
    }
  });
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

/* ============================================================
   EVENTS & BINDINGS
   ============================================================ */

function setupWatchlistHandlers() {
  const addButton = document.getElementById("addBtn");
  const companyInput = document.getElementById("companyInput");
  const clearBtn = document.getElementById("clearWatchlistBtn");
  const fileInput = document.getElementById("fileUploadInput");
  const fileLabel = document.querySelector(".file-upload-label");

  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (companyInput && companyInput.value) {
        processBulkInput(companyInput.value);
        companyInput.value = "";
      }
    });
  }

  if (companyInput) {
    companyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        processBulkInput(companyInput.value);
        companyInput.value = "";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearAllWatchlist();
    });
  }

  if (fileLabel && fileInput) {
    fileLabel.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        processBulkInput(event.target.result);
        fileInput.value = "";
      };
      reader.readAsText(file);
    });
  }
}

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await loadWatchlist();
    await loadData();
  });
}

const allBtn = document.getElementById("allBtn");
if (allBtn) {
  allBtn.addEventListener("click", (e) => {
    e.preventDefault();
    selectFeed("all");
    scrollToResults();
  });
}

const alertsBtn = document.getElementById("alertsBtn");
if (alertsBtn) {
  alertsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showAlerts();
    scrollToResults();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => applySearch());
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", (e) => {
    selectFeed(e.target.value);
    scrollToResults();
  });
}

/* ============================================================
   INIT
   ============================================================ */

(async function init() {
  setupWatchlistHandlers();
  await loadWatchlist();
  await loadData();
})();