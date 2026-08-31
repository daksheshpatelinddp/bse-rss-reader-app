const API =
  "https://bse-rss-reader.daksheshpatelin.workers.dev";


/* ============================================================
   SETTINGS
   ============================================================ */

const PAGE_SIZE = 50;


/* ============================================================
   STATE
   ============================================================ */

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
   DOM
   ============================================================ */

const results =
  document.getElementById("results");

const empty =
  document.getElementById("empty");

const statusEl =
  document.getElementById("status");

const lastUpdated =
  document.getElementById("lastUpdated");

const categoryList =
  document.getElementById("categoryList");

const categoryFilter =
  document.getElementById("categoryFilter");

const searchInput =
  document.getElementById("searchInput");

const currentFeedTitle =
  document.getElementById(
    "currentFeedTitle"
  );

const currentFeedCount =
  document.getElementById(
    "currentFeedCount"
  );

const totalCount =
  document.getElementById("totalCount");

const alertCount =
  document.getElementById("alertCount");

const watchCount =
  document.getElementById("watchCount");

const whitelist =
  document.getElementById("whitelist");


/* ============================================================
   API
   ============================================================ */

async function api(
  path,
  options = {}
) {

  const response =
    await fetch(
      API + path,
      options
    );

  if (!response.ok) {

    let message =
      `HTTP ${response.status}`;

    try {

      const data =
        await response.json();

      if (data.error) {
        message =
          data.error;
      }

    } catch (_) {}

    throw new Error(
      message
    );
  }

  return response.json();
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
  text
) {

  if (statusEl) {
    statusEl.textContent =
      text;
  }
}


/* ============================================================
   WATCHLIST
   ============================================================ */

async function loadWatchlist() {

  try {

    const data =
      await api(
        "/watchlist"
      );

    watchlist =
      Array.isArray(
        data.watchlist
      )
        ? data.watchlist
        : [];

    renderWatchlist();

  } catch (error) {

    console.error(
      "Watchlist load:",
      error
    );

    setStatus(
      "Could not load whitelist."
    );
  }
}


/* ============================================================
   ADD WATCHLIST COMPANY
   ============================================================ */

async function addWatch() {

  const input =
    document.getElementById(
      "companyInput"
    );

  if (!input) {
    return;
  }


  const value =
    input.value.trim();


  if (!value) {

    setStatus(
      "Enter a BSE scrip code."
    );

    input.focus();

    return;
  }

  let payload = {};

  if (/^\d{6}$/.test(value)) {
    const alreadyExists = watchlist.some(
      item => String(item.scrip || "").trim() === value
    );

    if (alreadyExists) {
      setStatus("This scrip is already whitelisted.");
      input.value = "";
      return;
    }

    payload = { scrip: value };
  } else {
    const name = value.toLowerCase();

    const alreadyExists = watchlist.some(
      item => String(item.name || "").trim().toLowerCase() === name
    );

    if (alreadyExists) {
      setStatus("This company is already whitelisted.");
      input.value = "";
      return;
    }

    payload = { name: value };
  }

  try {

    setStatus("Saving whitelist...");

    const response = await api("/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (Array.isArray(response.watchlist)) {
      watchlist = response.watchlist;
    }

    renderWatchlist();

    input.value = "";

    setStatus("Whitelist saved successfully.");

  } catch (error) {

    console.error(
      "Whitelist save:",
      error
    );

    renderWatchlist();

    setStatus(
      "Could not save whitelist."
    );

    alert(
      "Could not save whitelist.\n\n" +
      String(
        error?.message ||
        error
      )
    );

  }

}


/* ============================================================
   REMOVE WATCHLIST COMPANY
   ============================================================ */

async function removeWatch(
  index
) {

  if (
    index < 0 ||
    index >= watchlist.length
  ) {
    return;
  }

  const target = watchlist[index];
  const scripToRemove = target ? target.scrip : null;

  if (!scripToRemove) {
    setStatus("Invalid scrip to remove.");
    return;
  }

  try {

    setStatus(
      "Saving whitelist..."
    );

    const response = await api(
      `/watchlist?scrip=${encodeURIComponent(scripToRemove)}`,
      {
        method: "DELETE"
      }
    );

    if (Array.isArray(response.watchlist)) {
      watchlist = response.watchlist;
    } else {
      watchlist.splice(index, 1);
    }

    renderWatchlist();

    setStatus(
      "Whitelist updated."
    );

  } catch (error) {

    console.error(
      "Whitelist remove:",
      error
    );

    renderWatchlist();

    setStatus(
      "Could not update whitelist."
    );

    alert(
      "Could not update whitelist.\n\n" +
      String(
        error?.message ||
        error
      )
    );

  }

}


/* ============================================================
   DISPLAY WHITELIST
   ============================================================ */

function renderWatchlist() {

  if (!whitelist) {
    return;
  }


  watchlist =
    Array.isArray(
      watchlist
    )
      ? watchlist
      : [];


  if (watchCount) {

    watchCount.textContent =
      watchlist.length;

  }


  whitelist.innerHTML =
    "";


  if (
    watchlist.length === 0
  ) {

    whitelist.innerHTML =
      `
      <div class="muted">
        No companies whitelisted yet.
      </div>
      `;

    return;
  }


  watchlist.forEach(
    (item, index) => {

      const div =
        document.createElement(
          "div"
        );


      div.className =
        "watch-item";


      const label =
        item.scrip
          ? `BSE ${item.scrip}`
          : (
              item.name ||
              "Unknown"
            );


      div.innerHTML =
        `
        <span>
          ${escapeHtml(
            label
          )}
        </span>

        <button
          type="button"
          class="remove-watch"
          data-index="${index}"
          title="Remove"
        >
          ×
        </button>
        `;


      whitelist.appendChild(
        div
      );

    }
  );


  whitelist
    .querySelectorAll(
      ".remove-watch"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          function(event) {

            event.preventDefault();

            event.stopPropagation();

            removeWatch(
              Number(
                button.dataset.index
              )
            );

          }
        );

      }
    );

}


/* ============================================================
   LOAD BSE DATA
   ============================================================ */

async function loadData() {

  setStatus(
    "Loading BSE announcements..."
  );


  try {

    const announcementData =
      await api(
        "/bse-announcements"
      );


    allItems =
      Array.isArray(
        announcementData.announcements
      )
        ? announcementData.announcements
        : (Array.isArray(announcementData.items) ? announcementData.items : []);


    const categoryData =
      await api(
        "/categories"
      );


    categories =
      Array.isArray(
        categoryData.categories
      )
        ? categoryData.categories
        : [];


    const alertData =
      await api(
        "/alerts"
      );


    alerts =
      Array.isArray(
        alertData.alerts
      )
        ? alertData.alerts
        : (Array.isArray(alertData.items) ? alertData.items : []);


    if (totalCount) {

      totalCount.textContent =
        allItems.length
          .toLocaleString();

    }


    if (alertCount) {

      alertCount.textContent =
        alerts.length;

    }


    renderCategories();

    renderCategoryFilter();


    selectFeed(
      "all"
    );


    setStatus(
      `Loaded ${allItems.length.toLocaleString()} BSE announcements.`
    );


    if (lastUpdated) {

      lastUpdated.textContent =
        new Date()
          .toLocaleTimeString();

    }

  } catch (error) {

    console.error(
      "Load error:",
      error
    );

    setStatus(
      "Error loading BSE announcements."
    );

  }

}


/* ============================================================
   CATEGORIES
   ============================================================ */

function renderCategories() {

  if (!categoryList) {
    return;
  }


  categoryList.innerHTML =
    "";


  /*
   * ALL ANNOUNCEMENTS
   */

  const allButton =
    document.createElement(
      "button"
    );


  allButton.type =
    "button";


  allButton.className =
    "category-button all-category";


  allButton.dataset.category =
    "all";


  allButton.innerHTML =
    `
    <span>
      All Announcements
    </span>

    <b>
      ${allItems.length.toLocaleString()}
    </b>
    `;


  allButton.addEventListener(
    "click",
    () => {

      selectFeed(
        "all"
      );

      scrollToResults();

    }
  );


  categoryList.appendChild(
    allButton
  );


  /*
   * EVERY CATEGORY
   */

  categories.forEach(
    category => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "category-button";


      button.dataset.category =
        category.name;


      button.innerHTML =
        `
        <span>
          ${escapeHtml(
            category.name
          )}
        </span>

        <b>
          ${Number(
            category.count
          ).toLocaleString()}
        </b>
        `;


      button.addEventListener(
        "click",
        () => {

          selectFeed(
            category.name
          );

          scrollToResults();

        }
      );


      categoryList.appendChild(
        button
      );

    }
  );

}


/* ============================================================
   CATEGORY FILTER
   ============================================================ */

function renderCategoryFilter() {

  if (!categoryFilter) {
    return;
  }


  categoryFilter.innerHTML =
    `
    <option value="all">
      All Categories
    </option>
    `;


  categories.forEach(
    category => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        category.name;


      option.textContent =
        category.name;


      categoryFilter.appendChild(
        option
      );

    }
  );

}


/* ============================================================
   SELECT FEED
   ============================================================ */

function selectFeed(
  feed
) {

  currentFeed =
    feed;


  currentPage =
    1;


  if (
    feed === "all"
  ) {

    currentItems =
      [...allItems];


    if (currentFeedTitle) {

      currentFeedTitle.textContent =
        "All BSE Announcements";

    }

  } else {

    currentItems =
      allItems.filter(
        item => {

          if (
            item.category ===
            feed
          ) {

            return true;

          }


          if (
            Array.isArray(
              item.categories
            )
          ) {

            return item.categories.includes(
              feed
            );

          }


          return false;

        }
      );


    if (currentFeedTitle) {

      currentFeedTitle.textContent =
        feed;

    }

  }


  if (currentFeedCount) {

    currentFeedCount.textContent =
      `${currentItems.length.toLocaleString()} announcements`;

  }


  if (categoryFilter) {

    categoryFilter.value =
      feed === "all"
        ? "all"
        : feed;

  }


  updateCategoryHighlight();

  applySearch();

}


/* ============================================================
   CATEGORY HIGHLIGHT
   ============================================================ */

function updateCategoryHighlight() {

  document
    .querySelectorAll(
      ".category-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.category ===
          currentFeed
        );

      }
    );

}


/* ============================================================
   SEARCH
   ============================================================ */

function applySearch() {

  const query =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";


  if (!query) {

    displayedItems =
      [...currentItems];

  } else {

    displayedItems =
      currentItems.filter(
        item => {

          const text =
            [
              item.company,
              item.scrip,
              item.title,
              item.description,
              item.category,

              ...(Array.isArray(
                item.categories
              )
                ? item.categories
                : [])

            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


          return text.includes(
            query
          );

        }
      );

  }


  currentPage =
    1;


  renderPage();

}


/* ============================================================
   SORT
   ============================================================ */

function sortedItems(
  items
) {

  return [...items].sort(
    (a, b) => {

      const da =
        new Date(
          a.pubDate ||
          0
        ).getTime();


      const db =
        new Date(
          b.pubDate ||
          0
        ).getTime();


      return db - da;

    }
  );

}


/* ============================================================
   GROUP EXACT DUPLICATES
   ============================================================ */

function groupDuplicates(
  items
) {

  const map =
    new Map();


  for (
    const item of items
  ) {

    const key =
      [
        item.company || "",
        item.title || "",
        item.description || ""
      ]
        .join("|")
        .trim()
        .toLowerCase();


    if (
      !map.has(key)
    ) {

      map.set(
        key,
        {
          item,
          items: [item]
        }
      );

    } else {

      map
        .get(key)
        .items
        .push(item);

    }

  }


  return Array.from(
    map.values()
  );

}


/* ============================================================
   RENDER CURRENT PAGE
   ============================================================ */

function renderPage() {

  if (!results) {
    return;
  }


  results.innerHTML =
    "";


  if (
    displayedItems.length ===
    0
  ) {

    if (empty) {

      empty.classList.remove(
        "hidden"
      );

    }


    renderPagination(
      0,
      0
    );

    return;

  }


  if (empty) {

    empty.classList.add(
      "hidden"
    );

  }


  const sorted =
    sortedItems(
      displayedItems
    );


  totalPages =
    Math.max(
      1,
      Math.ceil(
        sorted.length /
        PAGE_SIZE
      )
    );


  if (
    currentPage >
    totalPages
  ) {

    currentPage =
      totalPages;

  }


  const start =
    (
      currentPage -
      1
    ) *
    PAGE_SIZE;


  const pageItems =
    sorted.slice(
      start,
      start +
      PAGE_SIZE
    );


  const groups =
    groupDuplicates(
      pageItems
    );


  groups.forEach(
    group => {

      results.appendChild(
        createAnnouncementCard(
          group.item,
          group.items
        )
      );

    }
  );


  renderPagination(
    sorted.length,
    totalPages
  );

}


/* ============================================================
   ANNOUNCEMENT CARD
   ============================================================ */

function createAnnouncementCard(
  item,
  groupedItems = [item]
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "announcement-card";


  const whitelisted =
    isWhitelisted(
      item
    );


  const categoriesText =
    Array.isArray(
      item.categories
    )
      ? item.categories.join(
          " • "
        )
      : (
          item.category ||
          "Other"
        );


  const date =
    formatDate(
      item.pubDate
    );


  const duplicateCount =
    groupedItems.length;


  card.innerHTML =
    `
    <div class="announcement-top">

      <div class="company">

        ${escapeHtml(
          item.company ||
          "Unknown Company"
        )}

        ${
          item.scrip
            ? `
              <span class="scrip">
                ${escapeHtml(
                  item.scrip
                )}
              </span>
            `
            : ""
        }

      </div>


      ${
        whitelisted
          ? `
            <span class="watch-badge">
               Whitelisted
            </span>
          `
          : ""
      }

    </div>


    <div class="category-tags">

      ${categoriesText
        .split(" • ")
        .map(
          category =>
            `
            <span class="tag">
              ${escapeHtml(
                category
              )}
            </span>
            `
        )
        .join("")}

    </div>


    <h3>

      ${
        item.link
          ? `
            <a
              href="${escapeAttr(
                item.link
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${escapeHtml(
                item.title ||
                "BSE Announcement"
              )}
            </a>
          `
          : escapeHtml(
              item.title ||
              "BSE Announcement"
            )
      }

    </h3>


    ${
      item.description
        ? `
          <div class="description">
            ${escapeHtml(
              item.description
            )}
          </div>
        `
        : ""
    }


    <div class="announcement-bottom">

      <span>
        ${escapeHtml(
          date
        )}
      </span>


      <span class="bottom-right">

        ${
          item.isFinancialResult
            ? `
              <span class="result-badge">
                Financial Result
              </span>
            `
            : ""
        }


        ${
          duplicateCount > 1
            ? `
              <button
                type="button"
                class="duplicate-btn"
              >
                ${duplicateCount}
                similar announcements
              </button>
            `
            : ""
        }

      </span>

    </div>


    ${
      duplicateCount > 1
        ? `
          <div
            class="duplicate-list hidden"
          >

            ${groupedItems
              .map(
                (duplicate, index) => {

                  return `
                    <div
                      class="duplicate-item"
                    >

                      <div>
                        ${index + 1}.
                        ${escapeHtml(
                          formatDate(
                            duplicate.pubDate
                          )
                        )}
                      </div>


                      ${
                        duplicate.link
                          ? `
                            <a
                              href="${escapeAttr(
                                duplicate.link
                              )}"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open announcement
                            </a>
                          `
                          : ""
                      }

                    </div>
                  `;

                }
              )
              .join("")}

          </div>
        `
        : ""
    }

    `;


  if (
    duplicateCount > 1
  ) {

    const button =
      card.querySelector(
        ".duplicate-btn"
      );


    const list =
      card.querySelector(
        ".duplicate-list"
      );


    if (
      button &&
      list
    ) {

      button.addEventListener(
        "click",
        function(event) {

          event.preventDefault();

          list.classList.toggle(
            "hidden"
          );


          button.textContent =
            list.classList.contains(
              "hidden"
            )
              ? `${duplicateCount} similar announcements`
              : "Hide similar announcements";

        }
      );

    }

  }


  return card;

}


/* ============================================================
   WHITELIST MATCH
   ============================================================ */

function isWhitelisted(
  item
) {

  return watchlist.some(
    watch => {

      /*
       * SCRIP = PRIMARY MATCH
       */

      if (
        watch.scrip &&
        item.scrip
      ) {

        return (
          String(
            watch.scrip
          ).trim() ===
          String(
            item.scrip
          ).trim()
        );

      }


      /*
       * NAME = SECONDARY MATCH
       */

      if (
        watch.name &&
        item.company
      ) {

        return (
          String(
            watch.name
          )
            .trim()
            .toLowerCase() ===

          String(
            item.company
          )
            .trim()
            .toLowerCase()
        );

      }


      return false;

    }
  );

}


/* ============================================================
   ALERTS / SPECIAL BUNDLE
   ============================================================ */

async function showAlerts() {

  try {

    const data =
      await api(
        "/alerts"
      );


    alerts =
      Array.isArray(
        data.alerts
      )
        ? data.alerts
        : (Array.isArray(data.items) ? data.items : []);


    if (alertCount) {

      alertCount.textContent =
        alerts.length;

    }


    currentFeed =
      "alerts";


    currentItems =
      [...alerts];


    if (currentFeedTitle) {

      currentFeedTitle.textContent =
        " Alerts / Special Bundle";

    }


    if (currentFeedCount) {

      currentFeedCount.textContent =
        `${alerts.length} alerts`;

    }


    if (categoryFilter) {

      categoryFilter.value =
        "all";

    }


    document
      .querySelectorAll(
        ".category-button"
      )
      .forEach(
        button =>
          button.classList.remove(
            "active"
          )
      );


    currentPage =
      1;


    applySearch();

  } catch (error) {

    console.error(
      "Alerts:",
      error
    );


    setStatus(
      "Could not load alerts."
    );

  }

}


/* ============================================================
   PAGINATION
   ============================================================ */

function renderPagination(
  total,
  pages
) {

  let old =
    document.getElementById(
      "pagination"
    );


  if (!old) {

    old =
      document.createElement(
        "div"
      );


    old.id =
      "pagination";


    old.className =
      "pagination";


    if (
      results &&
      results.parentNode
    ) {

      results.parentNode.insertBefore(
        old,
        results.nextSibling
      );

    }

  }


  old.innerHTML =
    "";


  if (
    total === 0 ||
    pages <= 1
  ) {

    return;

  }


  const previous =
    document.createElement(
      "button"
    );


  previous.type =
    "button";


  previous.textContent =
    "‹ Previous";


  previous.disabled =
    currentPage <= 1;


  previous.addEventListener(
    "click",
    () => {

      if (
        currentPage > 1
      ) {

        currentPage--;

        renderPage();

        scrollToResults();

      }

    }
  );


  old.appendChild(
    previous
  );


  const info =
    document.createElement(
      "span"
    );


  info.textContent =
    `Page ${currentPage} of ${pages}`;


  old.appendChild(
    info
  );


  const next =
    document.createElement(
      "button"
    );


  next.type =
    "button";


  next.textContent =
    "Next ›";


  next.disabled =
    currentPage >= pages;


  next.addEventListener(
    "click",
    () => {

      if (
        currentPage <
        pages
      ) {

        currentPage++;

        renderPage();

        scrollToResults();

      }

    }
  );


  old.appendChild(
    next
  );

}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollToResults() {

  const element =
    document.getElementById(
      "results"
    );


  if (!element) {
    return;
  }


  element.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });

}


/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );

  }


  return date.toLocaleString();

}


function escapeHtml(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );

}


/* ============================================================
   EVENTS
   ============================================================ */

const addButton =
  document.getElementById(
    "addBtn"
  );


if (addButton) {

  addButton.type =
    "button";


  addButton.addEventListener(
    "click",
    function(event) {

      event.preventDefault();

      event.stopPropagation();

      addWatch();

    }
  );

}


const companyInput =
  document.getElementById(
    "companyInput"
  );


if (companyInput) {

  companyInput.addEventListener(
    "keydown",
    function(event) {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        event.stopPropagation();

        addWatch();

      }

    }
  );

}


const refreshBtn =
  document.getElementById(
    "refreshBtn"
  );


if (refreshBtn) {

  refreshBtn.addEventListener(
    "click",
    async function(event) {

      event.preventDefault();

      await loadWatchlist();

      await loadData();

    }
  );

}


const allBtn =
  document.getElementById(
    "allBtn"
  );


if (allBtn) {

  allBtn.addEventListener(
    "click",
    function(event) {

      event.preventDefault();

      selectFeed(
        "all"
      );

      scrollToResults();

    }
  );

}


const alertsBtn =
  document.getElementById(
    "alertsBtn"
  );


if (alertsBtn) {

  alertsBtn.addEventListener(
    "click",
    function(event) {

      event.preventDefault();

      showAlerts();

      scrollToResults();

    }
  );

}


if (searchInput) {

  searchInput.addEventListener(
    "input",
    function() {

      applySearch();

    }
  );

}


if (categoryFilter) {

  categoryFilter.addEventListener(
    "change",
    function(event) {

      selectFeed(
        event.target.value
      );

      scrollToResults();

    }
  );

}


/* ============================================================
   INITIAL LOAD
   ============================================================ */

(async function init() {

  await loadWatchlist();

  await loadData();

})();