// Replace this with your deployed Cloudflare Worker domain if applicable
const WORKER_BASE_URL = window.location.origin.includes("localhost")
  ? "https://bse-rss-reader.daksheshpatelin.workers.dev" 
  : ""; 

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  const fetchBtn = document.getElementById("fetch-btn");
  if (fetchBtn) {
    fetchBtn.addEventListener("click", fetchAnnouncements);
  }
}

/**
 * Constructs a fully qualified proxied URL for BSE attachments
 */
function buildPdfUrl(attachmentPath) {
  if (!attachmentPath) return "#";

  let fullUrl = attachmentPath;

  // Handle relative attachment paths from BSE
  if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
    if (fullUrl.startsWith("xml-data/") || fullUrl.startsWith("AttachLive/")) {
      fullUrl = `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${fullUrl.replace(/^(xml-data\/corpfiling\/AttachLive\/|AttachLive\/)/, "")}`;
    } else {
      fullUrl = `https://www.bseindia.com/${fullUrl.replace(/^\//, "")}`;
    }
  }

  // Route through Cloudflare Worker proxy to preserve headers
  const workerProxy = WORKER_BASE_URL ? `${WORKER_BASE_URL}/?url=` : "/?url=";
  return `${workerProxy}${encodeURIComponent(fullUrl)}`;
}

async function fetchAnnouncements() {
  const container = document.getElementById("announcements-container");
  const statusEl = document.getElementById("status-message");

  if (statusEl) statusEl.textContent = "Loading announcements...";
  if (container) container.innerHTML = "";

  // Target BSE corporate announcements API
  const bseApiUrl = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=&strScrip=&strSearch=P&strToDate=";
  const proxyUrl = `${WORKER_BASE_URL}/?url=${encodeURIComponent(bseApiUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.Table || data.Table1 || data;

    if (!Array.isArray(items) || items.length === 0) {
      if (statusEl) statusEl.textContent = "No announcements found.";
      return;
    }

    if (statusEl) statusEl.textContent = "";
    renderAnnouncements(items);

  } catch (error) {
    console.error("Fetch Error:", error);
    if (statusEl) statusEl.textContent = `Error loading data: ${error.message}`;
  }
}

function renderAnnouncements(items) {
  const container = document.getElementById("announcements-container");
  if (!container) return;

  const listHtml = items.map((item) => {
    const title = escapeHtml(item.NEWSSUB || item.SLONGNAME || "Corporate Announcement");
    const category = escapeHtml(item.CATEGORYNAME || "General");
    const date = escapeHtml(item.NEWS_DT || item.Dis承d || "");
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}