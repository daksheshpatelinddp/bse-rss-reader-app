// ==========================================
// BSE RSS READER
// ==========================================


// ==========================================
// CLOUDFLARE WORKER
// ==========================================

const WORKER_URL =
  "https://bse-rss-reader.daksheshpatelin.workers.dev";


const RESULTS_API =
  WORKER_URL + "/bse-results";


const WATCHLIST_API =
  WORKER_URL + "/watchlist";



// ==========================================
// STATE
// ==========================================

let allResults = [];

let whitelist = [];



// ==========================================
// ELEMENTS
// ==========================================

const companyInput =
  document.getElementById(
    "companyInput"
  );


const addBtn =
  document.getElementById(
    "addBtn"
  );


const whitelistEl =
  document.getElementById(
    "whitelist"
  );


const watchCount =
  document.getElementById(
    "watchCount"
  );


const resultsEl =
  document.getElementById(
    "results"
  );


const emptyEl =
  document.getElementById(
    "empty"
  );


const statusEl =
  document.getElementById(
    "status"
  );


const lastUpdatedEl =
  document.getElementById(
    "lastUpdated"
  );


const searchInput =
  document.getElementById(
    "searchInput"
  );


const resultTypeFilter =
  document.getElementById(
    "resultTypeFilter"
  );


const refreshBtn =
  document.getElementById(
    "refreshBtn"
  );



// ==========================================
// CHECK WATCHED COMPANY
// ==========================================

function isWatched(
  scrip
) {

  return whitelist.some(
    item =>
      String(item.scrip) ===
      String(scrip)
  );

}



// ==========================================
// LOAD WATCHLIST
// ==========================================

async function loadWatchlist() {

  try {

    const response =
      await fetch(
        WATCHLIST_API +
        "?t=" +
        Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.error ||
        "Could not load watchlist"
      );

    }


    whitelist =
      Array.isArray(
        data.watchlist
      )
        ? data.watchlist
        : [];


    renderWhitelist();

    renderResults();


  } catch (error) {

    console.error(
      "Watchlist load error:",
      error
    );


    statusEl.textContent =
      "Could not load Watchlist";

  }

}



// ==========================================
// DISPLAY WATCHLIST
// ==========================================

function renderWhitelist() {

  whitelistEl.innerHTML =
    "";


  watchCount.textContent =
    whitelist.length;


  if (
    whitelist.length === 0
  ) {

    whitelistEl.innerHTML =
      '<span style="color:#777;font-size:13px">' +
      'No companies in Watchlist yet.' +
      '</span>';

    return;

  }


  whitelist.forEach(
    item => {

      const div =
        document.createElement(
          "div"
        );


      div.className =
        "watch-item";


      div.innerHTML = `

        <span>

          ⭐

          ${escapeHtml(
            item.name
          )}

          (${escapeHtml(
            item.scrip
          )})

        </span>


        <button

          class="remove-watch"

          data-scrip="${escapeAttribute(
            item.scrip
          )}"

        >

          ×

        </button>

      `;


      whitelistEl.appendChild(
        div
      );

    }
  );

}



// ==========================================
// ADD COMPANY
// ==========================================

addBtn.addEventListener(
  "click",
  addCompany
);


companyInput.addEventListener(
  "keydown",
  function(event) {

    if (
      event.key === "Enter"
    ) {

      addCompany();

    }

  }
);



async function addCompany() {

  const value =
    companyInput.value.trim();


  if (!value) {

    return;

  }


  const searchValue =
    value.toLowerCase();


  /*
   * Find company or scrip
   * in current BSE feed.
   */

  const matches =
    allResults.filter(
      item => {

        const company =
          String(
            item.company || ""
          ).toLowerCase();


        const scrip =
          String(
            item.scrip || ""
          );


        return (

          company.includes(
            searchValue
          ) ||

          scrip === value

        );

      }
    );


  if (
    matches.length === 0
  ) {

    alert(
      "Company or BSE scrip was not found in the current BSE feed."
    );

    return;

  }


  const item =
    matches[0];


  const exists =
    whitelist.some(
      watch =>
        String(
          watch.scrip
        ) ===
        String(
          item.scrip
        )
    );


  if (exists) {

    alert(
      item.company +
      " is already in your Watchlist."
    );

    return;

  }


  addBtn.disabled =
    true;


  try {

    const response =
      await fetch(
        WATCHLIST_API,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              name:
                item.company,

              scrip:
                item.scrip

            })

        }
      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.error ||
        "Could not add company"
      );

    }


    whitelist =
      Array.isArray(
        data.watchlist
      )
        ? data.watchlist
        : [];


    companyInput.value =
      "";


    renderWhitelist();

    renderResults();


    statusEl.textContent =
      item.company +
      " added to Watchlist";


  } catch (error) {

    console.error(
      "Add watchlist error:",
      error
    );


    alert(
      "Could not add company to Watchlist.\n\n" +
      error.message
    );


  } finally {

    addBtn.disabled =
      false;

  }

}



// ==========================================
// REMOVE COMPANY
// ==========================================

whitelistEl.addEventListener(
  "click",
  async function(event) {

    if (
      !event.target.classList.contains(
        "remove-watch"
      )
    ) {

      return;

    }


    const scrip =
      event.target.dataset.scrip;


    if (!scrip) {

      return;

    }


    if (
      !confirm(
        "Remove this company from your Watchlist?"
      )
    ) {

      return;

    }


    try {

      const response =
        await fetch(

          WATCHLIST_API +
          "?scrip=" +
          encodeURIComponent(
            scrip
          ),

          {
            method:
              "DELETE"
          }

        );


      if (!response.ok) {

        throw new Error(
          "HTTP " +
          response.status
        );

      }


      const data =
        await response.json();


      if (!data.ok) {

        throw new Error(
          data.error ||
          "Could not remove company"
        );

      }


      whitelist =
        Array.isArray(
          data.watchlist
        )
          ? data.watchlist
          : [];


      renderWhitelist();

      renderResults();


      statusEl.textContent =
        "Company removed from Watchlist";


    } catch (error) {

      console.error(
        "Remove watchlist error:",
        error
      );


      alert(
        "Could not remove company.\n\n" +
        error.message
      );

    }

  }
);



// ==========================================
// LOAD BSE RESULTS
// ==========================================

async function loadResults() {

  statusEl.textContent =
    "Loading BSE results...";


  refreshBtn.disabled =
    true;


  try {

    const response =
      await fetch(

        RESULTS_API +
        "?t=" +
        Date.now(),

        {
          method:
            "GET",

          cache:
            "no-store"
        }

      );


    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }


    const data =
      await response.json();


    if (!data.ok) {

      throw new Error(
        data.error ||
        "BSE Worker returned an error"
      );

    }


    allResults =
      Array.isArray(
        data.items
      )
        ? data.items
        : [];


    statusEl.textContent =
      allResults.length +
      " BSE results received";


    lastUpdatedEl.textContent =
      "Updated " +
      new Date()
        .toLocaleTimeString();


    renderResults();


  } catch (error) {

    console.error(
      "BSE Reader error:",
      error
    );


    statusEl.textContent =
      "Unable to load BSE results";


    lastUpdatedEl.textContent =
      error.message;


    resultsEl.innerHTML =
      "";


    emptyEl.classList.remove(
      "hidden"
    );


    emptyEl.textContent =
      "Could not connect to BSE Worker.";


  } finally {

    refreshBtn.disabled =
      false;

  }

}



// ==========================================
// FILTER RESULTS
// ==========================================

function getFilteredResults() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const resultType =
    resultTypeFilter.value;


  /*
   * IMPORTANT:
   *
   * ALL BSE RESULTS ARE SHOWN.
   *
   * Watchlist is NOT a visibility filter.
   *
   * It is used for:
   *
   * - ⭐ marking
   * - alerts
   * - notifications
   * - special watchlist bundle
   */


  let results =
    [
      ...allResults
    ];



  // ----------------------------------------
  // RESULT TYPE
  // ----------------------------------------

  if (
    resultType !== "all"
  ) {

    results =
      results.filter(
        item =>
          String(
            item.resultType || ""
          ).toLowerCase() ===
          String(
            resultType
          ).toLowerCase()
      );

  }



  // ----------------------------------------
  // SEARCH
  // ----------------------------------------

  if (search) {

    results =
      results.filter(
        item => {

          const company =
            String(
              item.company || ""
            ).toLowerCase();


          const scrip =
            String(
              item.scrip || ""
            ).toLowerCase();


          const periodStart =
            String(
              item.periodStart || ""
            ).toLowerCase();


          const periodEnd =
            String(
              item.periodEnd || ""
            ).toLowerCase();


          const resultTypeText =
            String(
              item.resultType || ""
            ).toLowerCase();


          return (

            company.includes(
              search
            ) ||

            scrip.includes(
              search
            ) ||

            periodStart.includes(
              search
            ) ||

            periodEnd.includes(
              search
            ) ||

            resultTypeText.includes(
              search
            )

          );

        }
      );

  }


  return results;

}



// ==========================================
// DISPLAY RESULTS
// ==========================================

function renderResults() {

  resultsEl.innerHTML =
    "";


  const results =
    getFilteredResults();


  if (
    results.length === 0
  ) {

    emptyEl.classList.remove(
      "hidden"
    );


    if (
      allResults.length === 0
    ) {

      emptyEl.textContent =
        "No BSE results available.";

    } else {

      emptyEl.textContent =
        "No results match the current filter.";

    }


    return;

  }


  emptyEl.classList.add(
    "hidden"
  );


  results.forEach(
    item => {

      const card =
        document.createElement(
          "div"
        );


      card.className =
        "result-card";


      const watched =
        isWatched(
          item.scrip
        );


      const watchedBadge =
        watched

          ? `

            <span

              class="badge"

              style="
                background:#fff3cd;
                color:#856404
              "

            >

              ⭐ WATCHED

            </span>

          `

          : "";


      card.innerHTML = `

        <div class="company">

          ${watched ? "⭐ " : ""}

          ${escapeHtml(
            item.company
          )}

        </div>


        <div class="scrip">

          BSE:
          ${escapeHtml(
            item.scrip
          )}

        </div>


        <div class="meta">

          ${watchedBadge}


          <span class="badge">

            ${escapeHtml(
              item.resultType
            )}

          </span>


          <span class="badge">

            ${escapeHtml(
              item.basis
            )}

          </span>


          <span class="badge">

            ${escapeHtml(
              item.indAs
            )}

          </span>

        </div>


        <div class="period">

          ${escapeHtml(
            item.periodStart
          )}

          →

          ${escapeHtml(
            item.periodEnd
          )}

        </div>


        <a

          class="open-btn"

          href="${escapeAttribute(
            item.link
          )}"

          target="_blank"

          rel="noopener noreferrer"

        >

          Open BSE Result

        </a>

      `;


      resultsEl.appendChild(
        card
      );

    }
  );

}



// ==========================================
// FILTER EVENTS
// ==========================================

searchInput.addEventListener(
  "input",
  renderResults
);


resultTypeFilter.addEventListener(
  "change",
  renderResults
);



// ==========================================
// REFRESH
// ==========================================

refreshBtn.addEventListener(
  "click",
  async function() {

    await loadWatchlist();

    await loadResults();

  }
);



// ==========================================
// AUTOMATIC FRONTEND REFRESH
//
// Runs only while webpage is open.
//
// Background monitoring will be handled
// separately by Cloudflare Worker.
// ==========================================

setInterval(

  async function() {

    await loadWatchlist();

    await loadResults();

  },

  5 * 60 * 1000

);



// ==========================================
// SECURITY
// ==========================================

function escapeHtml(
  value
) {

  return String(
    value ?? ""
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



function escapeAttribute(
  value
) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    );

}



// ==========================================
// START
// ==========================================

async function startApp() {

  renderWhitelist();

  await loadWatchlist();

  await loadResults();

}


startApp();