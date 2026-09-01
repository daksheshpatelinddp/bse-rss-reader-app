document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

let allAnnouncements = [];
let whitelistedScrips = new Set(JSON.parse(localStorage.getItem("whitelistedScrips") || "[]"));

function initApp() {
  renderWhitelistedTags();
  
  const addBtn = document.getElementById("add-scrip-btn");
  const clearBtn = document.getElementById("clear-scrip-btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const searchInput = document.getElementById("search-input");

  if (addBtn) addBtn.addEventListener("click", addWhitelistedScrip);
  if (clearBtn) clearBtn.addEventListener("click", clearWhitelistedScrips);
  if (refreshBtn) refreshBtn.addEventListener("click", fetchAnnouncements);
  if (searchInput) searchInput.addEventListener("input", filterAndRenderAnnouncements);

  fetchAnnouncements();
}

/**
 * Constructs a fully qualified proxy URL for attachments to avoid 404
 */
function buildPdfUrl(attachmentPath) {
  if (!attachmentPath) return "#";

  let fullUrl = attachmentPath;
  if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
    const cleanPath = fullUrl.replace(/^(xml-data\/corpfiling\/AttachLive\/|AttachLive\/|\/)/, "");
    fullUrl = `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${cleanPath}`;
  }

  // Pass through worker proxy
  return `/?url=${encodeURIComponent(fullUrl)}`;
}

async function fetchAnnouncements() {
  const container = document.getElementById("announcements-container");
  const statusEl = document.getElementById("status-message");

  if (statusEl) statusEl.textContent = "Loading announcements...";

  const bseApiUrl = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=&strScrip=&strSearch=P&strToDate=";
  const proxyUrl = `/?url=${encodeURIComponent(bseApiUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const data = await response.json();
    const items = data.Table || data.Table1 || data;

    if (!Array.isArray(items) || items.length === 0) {
      if (statusEl) statusEl.textContent = "No announcements found.";
      allAnnouncements = [];
      renderAnnouncements([]);
      return;
    }

    allAnnouncements = items;
    if (statusEl) statusEl.textContent = "";
    filterAndRenderAnnouncements();

  } catch (error) {
    console.error("Fetch Error:", error);
    if (statusEl) statusEl.textContent = `Error loading data: ${error.message}`;
  }
}

function filterAndRenderAnnouncements() {
  const searchInput = document.getElementById("search-input");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let filtered = allAnnouncements;

  // Filter by whitelist if configured
  if (whitelistedScrips.size > 0) {
    filtered = filtered.filter((item) => {
      const scripCode = String(item.SCRIP_CD || "").toLowerCase();
      const companyName = String(item.SLONGNAME || item.NEWSSUB || "").toLowerCase();
      return Array.from(whitelistedScrips).some(
        (code) => scripCode.includes(code) || companyName.includes(code)
      );
    });
  }

  // Filter by search text
  if (query) {
    filtered = filtered.filter((item) => {
      const title = String(item.NEWSSUB || item.SLONGNAME || "").toLowerCase();
      const headline = String(item.HEADLINE || item.MORE || "").toLowerCase();
      const scrip = String(item.SCRIP_CD || "").toLowerCase();
      return title.includes(query) || headline.includes(query) || scrip.includes(query);
    });
  }

  renderAnnouncements(filtered);
}

function renderAnnouncements(items) {
  const container = document.getElementById("announcements-container");
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<p class="no-data">No announcements match your criteria.</p>`;
    return;
  }

  const listHtml = items.map((item) => {
    const title = escapeHtml(item.NEWSSUB || item.SLONGNAME || "Corporate Announcement");
    const category = escapeHtml(item.CATEGORYNAME || "General");
    const date = escapeHtml(item.NEWS_DT || item.Dis承d || "");
    const scripCode = escapeHtml(item.SCRIP_CD || "");
    const attachmentRaw = item.ATTACHMENTNAME || item.FILENAME || "";

    let pdfLinkHtml = "";
    if (attachmentRaw) {
      const validPdfUrl = buildPdfUrl(attachmentRaw);
      pdfLinkHtml = `<a href="${validPdfUrl}" target="_blank" rel="noopener noreferrer" class="pdf-button">View Attachment (PDF)</a>`;
    }

    return `
      <div class="announcement-card">
        <div class="card-header">
          <span class="category-tag">${category}</span>
          <span class="scrip-code">Scrip: ${scripCode}</span>
          <span class="date">${date}</span>
        </div>
        <h3 class="card-title">${title}</h3>
        <div class="card-body">
          <p>${escapeHtml(item.HEADLINE || item.MORE || "")}</p>
        </div>
        <div class="card-footer">
          ${pdfLinkHtml}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = listHtml;
}

function addWhitelistedScrip() {
  const input = document.getElementById("scrip-input");
  if (!input) return;

  const value = input.value.trim().toLowerCase();
  if (value) {
    whitelistedScrips.add(value);
    localStorage.setItem("whitelistedScrips", JSON.stringify(Array.from(whitelistedScrips)));
    input.value = "";
    renderWhitelistedTags();
    filterAndRenderAnnouncements();
  }
}

function clearWhitelistedScrips() {
  whitelistedScrips.clear();
  localStorage.removeItem("whitelistedScrips");
  renderWhitelistedTags();
  filterAndRenderAnnouncements();
}

function renderWhitelistedTags() {
  const container = document.getElementById("whitelisted-tags");
  if (!container) return;

  if (whitelistedScrips.size === 0) {
    container.innerHTML = `<span class="empty-tag">No whitelisted scrips added.</span>`;
    return;
  }

  container.innerHTML = Array.from(whitelistedScrips)
    .map(
      (code) => `
      <span class="scrip-tag">
        ${escapeHtml(code)}
        <button onclick="removeWhitelistedScrip('${escapeHtml(code)}')">&times;</button>
      </span>
    `
    )
    .join("");
}

function removeWhitelistedScrip(code) {
  whitelistedScrips.delete(code.toLowerCase());
  localStorage.setItem("whitelistedScrips", JSON.stringify(Array.from(whitelistedScrips)));
  renderWhitelistedTags();
  filterAndRenderAnnouncements();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}