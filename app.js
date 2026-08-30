const API =
  "https://bse-rss-reader.daksheshpatelin.workers.dev";


/* ============================================================
   STATE
   ============================================================ */

let allItems = [];

let currentItems = [];

let categories = [];

let watchlist = [];

let alerts = [];

let currentFeed = "all";


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
  document.getElementById(
    "totalCount"
  );

const alertCount =
  document.getElementById(
    "alertCount"
  );

const watchCount =
  document.getElementById(
    "watchCount"
  );

const whitelist =
  document.getElementById(
    "whitelist"
  );



/* ============================================================
   API HELPER
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
   LOAD WATCHLIST
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
      "Watchlist error:",
      error
    );
  }
}



/* ============================================================
   SAVE WATCHLIST
   ============================================================ */

async function saveWatchlist() {

  const response =
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
    response.watchlist ||
    watchlist;


  renderWatchlist();
}



/* ============================================================
   ADD WATCHLIST ITEM
   ============================================================ */

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
   * If it is a six-digit BSE scrip,
   * save it as scrip.
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
            item.scrip
          ) === value
      )
    ) {

      watchlist.push({
        scrip:
          value,
      });
    }

  } else {

    /*
     * Otherwise save as company name.
     */
    if (
      !watchlist.some(
        item =>
          String(
            item.name || ""
          ).toLowerCase() ===
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

    setStatus(
      "Could not save whitelist."
    );

    console.error(
      error
    );
  }
}



/* ============================================================
   REMOVE WATCHLIST ITEM
   ============================================================ */

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



/* ============================================================
   RENDER WATCHLIST
   ============================================================ */

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
         No companies whitelisted.
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
          data-index="${index}"
          class="remove-watch"
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
   LOAD ALL DATA
   ============================================================ */

async function loadData() {

  setStatus(
    "Loading BSE announcements..."
  );


  try {

    /*
     * Get the actual announcements.
     */
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


    /*
     * Get category counts.
     */
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


    /*
     * Get alerts.
     */
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
      allItems.length;


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
   RENDER CATEGORY BUTTONS
   ============================================================ */

function renderCategories() {

  categoryList.innerHTML =
    "";


  /*
   * ALL ANNOUNCEMENTS button.
   */
  const allButton =
    document.createElement(
      "button"
    );


  allButton.className =
    "category-button all-category";


  allButton.innerHTML = `
    <span>All Announcements</span>
    <b>${allItems.length}</b>
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
   * Category buttons.
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



/* ============================================================
   CATEGORY SELECT
   ============================================================ */

function renderCategoryFilter() {

  categoryFilter.innerHTML =
    `<option value="all">
       Current Feed: All
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
        `Current Feed: ${category.name}`;


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


  if (
    feed === "all"
  ) {

    currentItems =
      [...allItems];


    currentFeedTitle.textContent =
      "All Announcements";


    currentFeedCount.textContent =
      `${currentItems.length.toLocaleString()} announcements`;


    categoryFilter.value =
      "all";

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


    currentFeedCount.textContent =
      `${currentItems.length.toLocaleString()} announcements`;


    categoryFilter.value =
      feed;
  }


  /*
   * Highlight selected button.
   */
  document
    .querySelectorAll(
      ".category-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          (
            feed ===
            button.dataset.category
          ) ||
          (
            feed === "all" &&
            button.classList.contains(
              "all-category"
            )
          )
        );
      }
    );


  renderItems();
}



/* ============================================================
   FILTER CURRENT FEED
   ============================================================ */

function filterItems() {

  const query =
    searchInput.value
      .trim()
      .toLowerCase();


  let filtered =
    currentItems;


  if (query) {

    filtered =
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


  renderItems(
    filtered
  );
}



/* ============================================================
   RENDER ANNOUNCEMENTS
   ============================================================ */

function renderItems(
  suppliedItems
) {

  const items =
    suppliedItems ||
    currentItems;


  results.innerHTML =
    "";


  if (
    items.length === 0
  ) {

    empty.classList.remove(
      "hidden"
    );

    return;
  }


  empty.classList.add(
    "hidden"
  );


  /*
   * Newest first.
   */
  const sorted =
    [...items].sort(
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


  sorted.forEach(
    item => {

      results.appendChild(
        createAnnouncementCard(
          item
        )
      );
    }
  );
}



/* ============================================================
   ANNOUNCEMENT CARD
   ============================================================ */

function createAnnouncementCard(
  item
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


  card.innerHTML = `

    <div class="announcement-top">

      <div class="company">

        ${escapeHtml(
          item.company ||
          "Unknown Company"
        )}

        ${
          item.scrip
            ? `<span class="scrip">
                 ${escapeHtml(
                   item.scrip
                 )}
               </span>`
            : ""
        }

      </div>


      ${
        whitelisted
          ? `<span class="watch-badge">
               ⭐ Whitelisted
             </span>`
          : ""
      }

    </div>


    <div class="category-tags">

      ${categoriesText
        .split(" • ")
        .map(
          category =>
            `<span class="tag">
               ${escapeHtml(
                 category
               )}
             </span>`
        )
        .join("")}

    </div>


    <h3>

      ${
        item.link
          ? `<a
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
             </a>`
          : escapeHtml(
              item.title ||
              "BSE Announcement"
            )
      }

    </h3>


    ${
      item.description
        ? `<div class="description">
             ${escapeHtml(
               item.description
             )}
           </div>`
        : ""
    }


    <div class="announcement-bottom">

      <span>
        ${escapeHtml(
          date
        )}
      </span>


      ${
        item.isFinancialResult
          ? `<span class="result-badge">
               Financial Result
             </span>`
          : ""
      }

    </div>

  `;


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

      if (
        watch.scrip &&
        item.scrip
      ) {

        return (
          String(
            watch.scrip
          ) ===
          String(
            item.scrip
          )
        );
      }


      if (
        watch.name &&
        item.company
      ) {

        return (
          watch.name
            .trim()
            .toLowerCase() ===
          item.company
            .trim()
            .toLowerCase()
        );
      }


      return false;
    }
  );
}



/* ============================================================
   ALERTS VIEW
   ============================================================ */

async function showAlerts() {

  try {

    const data =
      await api(
        "/alerts"
      );


    alerts =
      data.items || [];


    alertCount.textContent =
      alerts.length;


    currentFeed =
      "alerts";


    currentItems =
      alerts;


    currentFeedTitle.textContent =
      "⭐ Alerts / Special Bundle";


    currentFeedCount.textContent =
      `${alerts.length} alerts`;


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


    categoryFilter.value =
      "all";


    renderItems();

  } catch (error) {

    console.error(
      error
    );


    setStatus(
      "Could not load alerts."
    );
  }
}



/* ============================================================
   HELPERS
   ============================================================ */

function setStatus(
  text
) {

  statusEl.textContent =
    text;
}


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

    return value;
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

      await loadData();

      await loadWatchlist();

    }
  );


document
  .getElementById(
    "allBtn"
  )
  .addEventListener(
    "click",
    () =>
      selectFeed(
        "all"
      )
  );


document
  .getElementById(
    "alertsBtn"
  )
  .addEventListener(
    "click",
    showAlerts
  );


searchInput
  .addEventListener(
    "input",
    filterItems
  );


categoryFilter
  .addEventListener(
    "change",
    event => {

      selectFeed(
        event.target.value
      );
    }
  );



/* ============================================================
   INITIAL LOAD
   ============================================================ */

(async function init() {

  await loadWatchlist();

  await loadData();

})();