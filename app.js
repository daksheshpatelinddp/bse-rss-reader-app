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

    throw new Error(
      `HTTP ${response.status}`
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

  statusEl.textContent =
    text;
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
      "Watchlist:",
      error
    );
  }
}


async function saveWatchlist() {

  const data =
    await api(
      "/watchlist",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            watchlist,
          }),
      }
    );


  watchlist =
    Array.isArray(
      data.watchlist
    )
      ? data.watchlist
      : watchlist;


  renderWatchlist();
}


async function addWatch() {

  const input =
    document.getElementById(
      "companyInput"
    );


  const value =
    input.value.trim();


  if (!value) {
    return;
  }


  /*
   * Six digits = BSE scrip.
   */
  if (
    /^\d{6}$/.test(
      value
    )
  ) {

    if (
      !watchlist.some(
        item =>
          String(
            item.scrip || ""
          ) === value
      )
    ) {

      watchlist.push({
        scrip:
          value,
      });
    }

  } else {

    if (
      !watchlist.some(
        item =>
          String(
            item.name || ""
          )
            .toLowerCase() ===
          value.toLowerCase()
      )
    ) {

      watchlist.push({
        name:
          value,
      });
    }
  }


  input.value =
    "";


  try {

    await saveWatchlist();

    setStatus(
      "Whitelist updated."
    );

  } catch (error) {

    console.error(
      error
    );

    setStatus(
      "Could not save whitelist."
    );
  }
}


async function removeWatch(
  index
) {

  watchlist.splice(
    index,
    1
  );


  try {

    await saveWatchlist();

  } catch (error) {

    console.error(
      error
    );
  }
}


function renderWatchlist() {

  watchlist =
    Array.isArray(
      watchlist
    )
      ? watchlist
      : [];


  watchCount.textContent =
    watchlist.length;


  whitelist.innerHTML =
    "";


  if (
    watchlist.length === 0
  ) {

    whitelist.innerHTML =
      `<div class="muted">
        No companies whitelisted yet.
       </div>`;

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
          : item.name;


      div.innerHTML = `

        <span>
          ${escapeHtml(label)}
        </span>

        <button
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


  document
    .querySelectorAll(
      ".remove-watch"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () =>
            removeWatch(
              Number(
                button.dataset.index
              )
            )
        );
      }
    );
}


/* ============================================================
   LOAD DATA
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
        announcementData.items
      )
        ? announcementData.items
        : [];


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
        alertData.items
      )
        ? alertData.items
        : [];


    totalCount.textContent =
      allItems.length.toLocaleString();


    alertCount.textContent =
      alerts.length;


    renderCategories();

    renderCategoryFilter();


    selectFeed(
      "all"
    );


    setStatus(
      `Loaded ${allItems.length.toLocaleString()} BSE announcements.`
    );


    lastUpdated.textContent =
      new Date().toLocaleTimeString();

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

  categoryList.innerHTML =
    "";


  /*
   * ALL
   */
  const allButton =
    document.createElement(
      "button"
    );


  allButton.className =
    "category-button all-category";


  allButton.dataset.category =
    "all";


  allButton.innerHTML = `
    <span>All Announcements</span>
    <b>${allItems.length.toLocaleString()}</b>
  `;


  allButton.addEventListener(
    "click",
    () =>
      selectFeed(
        "all"
      )
  );


  categoryList.appendChild(
    allButton
  );


  /*
   * EVERY CATEGORY
   *
   * These remain visible even when
   * All Announcements is selected.
   */
  categories.forEach(
    category => {

      const button =
        document.createElement(
          "button"
        );


      button.className =
        "category-button";


      button.dataset.category =
        category.name;


      button.innerHTML = `
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
        () =>
          selectFeed(
            category.name
          )
      );


      categoryList.appendChild(
        button
      );
    }
  );
}


function renderCategoryFilter() {

  categoryFilter.innerHTML =
    `<option value="all">
      All Categories
     </option>`;


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


    currentFeedTitle.textContent =
      "All BSE Announcements";

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


    currentFeedTitle.textContent =
      feed;
  }


  currentFeedCount.textContent =
    `${currentItems.length.toLocaleString()} announcements`;


  categoryFilter.value =
    feed === "all"
      ? "all"
      : feed;


  updateCategoryHighlight();

  applySearch();
}


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
    searchInput.value
      .trim()
      .toLowerCase();


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

    /*
     * We deliberately use company +
     * title + description.
     *
     * Different BSE announcements
     * remain separate.
     */
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
          items: [item],
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

  results.innerHTML =
    "";


  if (
    displayedItems.length === 0
  ) {

    empty.classList.remove(
      "hidden"
    );


    renderPagination(
      0,
      0
    );

    return;
  }


  empty.classList.add(
    "hidden"
  );


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


  card.innerHTML = `

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
              ⭐ Whitelisted
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


  /*
   * Expand duplicate announcements.
   */
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


    button.addEventListener(
      "click",
      () => {

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
       * SCRIP IS THE PRIMARY
       * WHITELIST METHOD.
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
       * Name matching remains
       * available as a secondary
       * option.
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
        data.items
      )
        ? data.items
        : [];


    alertCount.textContent =
      alerts.length;


    currentFeed =
      "alerts";


    currentItems =
      [...alerts];


    currentFeedTitle.textContent =
      "⭐ Alerts / Special Bundle";


    currentFeedCount.textContent =
      `${alerts.length} alerts`;


    categoryFilter.value =
      "all";


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


    results.parentNode.insertBefore(
      old,
      results.nextSibling
    );
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
      "start",
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

document
  .getElementById(
    "addBtn"
  )
  .addEventListener(
    "click",
    addWatch
  );


document
  .getElementById(
    "companyInput"
  )
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        addWatch();
      }
    }
  );


document
  .getElementById(
    "refreshBtn"
  )
  .addEventListener(
    "click",
    async () => {

      await loadWatchlist();

      await loadData();

    }
  );


document
  .getElementById(
    "allBtn"
  )
  .addEventListener(
    "click",
    () => {

      selectFeed(
        "all"
      );

      scrollToResults();
    }
  );


document
  .getElementById(
    "alertsBtn"
  )
  .addEventListener(
    "click",
    () => {

      showAlerts();

      scrollToResults();
    }
  );


searchInput
  .addEventListener(
    "input",
    () => {

      applySearch();
    }
  );


categoryFilter
  .addEventListener(
    "change",
    event => {

      selectFeed(
        event.target.value
      );

      scrollToResults();
    }
  );



/* ============================================================
   INITIAL LOAD
   ============================================================ */

(async function init() {

  await loadWatchlist();

  await loadData();

})();