// ==========================================
// BSE FINANCIAL RESULTS READER
// ==========================================

const API_URL =
  "https://bse-rss-reader.daksheshpatelin.workers.dev/bse-results";


// ==========================================
// STATE
// ==========================================

let allResults = [];

let whitelist = JSON.parse(
  localStorage.getItem("bseWhitelist") || "[]"
);


// ==========================================
// COMMON BSE SCRIP MAP
// ==========================================

const COMMON_SCRIPS = {

  "infosys": "500209",
  "tcs": "532540",
  "tata consultancy services": "532540",

  "reliance": "500325",
  "reliance industries": "500325",

  "hdfc bank": "500180",
  "icici bank": "532174",
  "sbi": "500112",
  "state bank of india": "500112",

  "itc": "500875",

  "hcl tech": "532281",
  "hcl technologies": "532281",

  "wipro": "507685",

  "bharti airtel": "532454",
  "airtel": "532454",

  "larsen toubro": "500510",
  "l&t": "500510",

  "axis bank": "532215",

  "kotak mahindra bank": "500247",

  "maruti suzuki": "532500",
  "maruti": "532500",

  "tata motors": "500570",

  "tata steel": "500470",

  "sun pharma": "524715",
  "sun pharmaceutical": "524715",

  "asian paints": "500820",

  "hindustan unilever": "500696",
  "hul": "500696",

  "bajaj finance": "500034",

  "bajaj finserv": "532978",

  "adani enterprises": "512599",

  "adani ports": "532921",

  "ntpc": "532555",

  "ongc": "500312",

  "power grid": "532898",
  "power grid corporation": "532898",

  "coal india": "533278",

  "titan": "500114",

  "ultratech cement": "532538",

  "nestle india": "500790",

  "britannia": "500825"

};


// ==========================================
// ELEMENTS
// ==========================================

const companyInput =
  document.getElementById("companyInput");

const addBtn =
  document.getElementById("addBtn");

const whitelistEl =
  document.getElementById("whitelist");

const watchCount =
  document.getElementById("watchCount");

const resultsEl =
  document.getElementById("results");

const emptyEl =
  document.getElementById("empty");

const statusEl =
  document.getElementById("status");

const lastUpdatedEl =
  document.getElementById("lastUpdated");

const searchInput =
  document.getElementById("searchInput");

const resultTypeFilter =
  document.getElementById("resultTypeFilter");

const refreshBtn =
  document.getElementById("refreshBtn");


// ==========================================
// SAVE WHITELIST
// ==========================================

function saveWhitelist() {

  localStorage.setItem(
    "bseWhitelist",
    JSON.stringify(whitelist)
  );

}


// ==========================================
// DISPLAY WHITELIST
// ==========================================

function renderWhitelist() {

  whitelistEl.innerHTML = "";

  watchCount.textContent =
    whitelist.length;


  if (whitelist.length === 0) {

    whitelistEl.innerHTML =
      '<span style="color:#777;font-size:13px">' +
      'No companies whitelisted yet.' +
      '</span>';

    return;
  }


  whitelist.forEach(item => {

    const div =
      document.createElement("div");

    div.className =
      "watch-item";


    const scriptText =
      item.scrip
        ? ` (${item.scrip})`
        : " (name match)";


    div.innerHTML =
      `
      <span>
        ${escapeHtml(item.name)}
        ${escapeHtml(scriptText)}
      </span>

      <button
        class="remove-watch"
        data-scrip="${escapeAttribute(item.scrip || "")}"
        data-name="${escapeAttribute(item.name)}"
      >
        ×
      </button>
      `;


    whitelistEl.appendChild(div);

  });

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

    if (event.key === "Enter") {

      event.preventDefault();

      addCompany();

    }

  }
);


function addCompany() {

  const value =
    companyInput.value.trim();


  if (!value) {

    alert("Enter a company name or BSE scrip.");

    return;

  }


  const searchValue =
    value.toLowerCase();


  // ----------------------------------------
  // 1. Try current RSS feed
  // ----------------------------------------

  const currentMatch =
    allResults.find(item => {

      const company =
        String(item.company || "")
          .toLowerCase();

      const scrip =
        String(item.scrip || "");

      return (
        company.includes(searchValue) ||
        scrip === value
      );

    });


  // ----------------------------------------
  // 2. Try known BSE scrip list
  // ----------------------------------------

  let guessedScrip = "";


  if (!currentMatch) {

    guessedScrip =
      COMMON_SCRIPS[searchValue] || "";

  }


  // ----------------------------------------
  // 3. If input itself looks like scrip
  // ----------------------------------------

  if (
    !currentMatch &&
    !guessedScrip &&
    /^\d{6}$/.test(value)
  ) {

    guessedScrip = value;

  }


  // ----------------------------------------
  // Determine saved company name
  // ----------------------------------------

  let companyName = value;


  if (currentMatch) {

    companyName =
      currentMatch.company;

    guessedScrip =
      currentMatch.scrip;

  }


  // ----------------------------------------
  // Check duplicate
  // ----------------------------------------

  const exists =
    whitelist.some(item => {

      if (
        guessedScrip &&
        item.scrip
      ) {

        return (
          String(item.scrip) ===
          String(guessedScrip)
        );

      }


      return (
        String(item.name)
          .toLowerCase() ===
        String(companyName)
          .toLowerCase()
      );

    });


  if (exists) {

    alert(
      companyName +
      " is already whitelisted."
    );

    return;

  }


  // ----------------------------------------
  // Save watchlist entry
  // ----------------------------------------

  whitelist.push({

    name: companyName,

    scrip: guessedScrip || "",

    addedAt: Date.now()

  });


  saveWhitelist();

  renderWhitelist();

  companyInput.value = "";

  renderResults();


  // ----------------------------------------
  // Inform user what was saved
  // ----------------------------------------

  if (guessedScrip) {

    statusEl.textContent =
      companyName +
      " added to watchlist — BSE " +
      guessedScrip;

  } else {

    statusEl.textContent =
      companyName +
      " added — future results will be matched by company name";

  }

}


// ==========================================
// REMOVE COMPANY
// ==========================================

whitelistEl.addEventListener(
  "click",
  function(event) {

    if (
      !event.target.classList.contains(
        "remove-watch"
      )
    ) {

      return;

    }


    const scrip =
      event.target.dataset.scrip;

    const name =
      event.target.dataset.name;


    whitelist =
      whitelist.filter(item => {

        if (
          scrip &&
          item.scrip
        ) {

          return (
            String(item.scrip) !==
            String(scrip)
          );

        }


        return (
          String(item.name) !==
          String(name)
        );

      });


    saveWhitelist();

    renderWhitelist();

    renderResults();

  }
);


// ==========================================
// CHECK WHETHER RESULT IS WHITELISTED
// ==========================================

function isWhitelisted(item) {

  const itemScrip =
    String(item.scrip || "");

  const itemCompany =
    String(item.company || "")
      .trim()
      .toLowerCase();


  return whitelist.some(watch => {

    const watchScrip =
      String(watch.scrip || "");

    const watchName =
      String(watch.name || "")
        .trim()
        .toLowerCase();


    // Prefer exact BSE scrip match

    if (
      watchScrip &&
      itemScrip
    ) {

      if (
        watchScrip ===
        itemScrip
      ) {

        return true;

      }

    }


    // Fallback to company-name match

    if (
      watchName &&
      itemCompany
    ) {

      if (
        itemCompany ===
        watchName
      ) {

        return true;

      }


      if (
        itemCompany.includes(
          watchName
        )
      ) {

        return true;

      }

    }


    return false;

  });

}


// ==========================================
// LOAD BSE RESULTS
// ==========================================

async function loadResults() {

  statusEl.textContent =
    "Loading BSE results...";


  refreshBtn.disabled = true;


  try {

    const response =
      await fetch(
        API_URL +
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
        "BSE Worker returned an error"
      );

    }


    allResults =
      Array.isArray(data.items)
        ? data.items
        : [];


    const watchedCount =
      allResults.filter(
        isWhitelisted
      ).length;


    statusEl.textContent =
      allResults.length +
      " BSE results received • " +
      watchedCount +
      " matching watchlist";


    lastUpdatedEl.textContent =
      "Updated " +
      new Date().toLocaleTimeString();


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


    resultsEl.innerHTML = "";


    emptyEl.classList.remove(
      "hidden"
    );


    emptyEl.textContent =
      "Could not connect to BSE Worker.";

  } finally {

    refreshBtn.disabled = false;

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
   * Show ALL BSE results.
   *
   * Whitelisted companies are marked
   * separately instead of hiding other
   * results.
   */

  let results =
    [...allResults];


  // ----------------------------------------
  // Result type
  // ----------------------------------------

  if (
    resultType !==
    "all"
  ) {

    results =
      results.filter(
        item =>
          item.resultType ===
          resultType
      );

  }


  // ----------------------------------------
  // Search
  // ----------------------------------------

  if (search) {

    results =
      results.filter(item => {

        const company =
          String(item.company || "")
            .toLowerCase();

        const scrip =
          String(item.scrip || "")
            .toLowerCase();

        const periodStart =
          String(item.periodStart || "")
            .toLowerCase();

        const periodEnd =
          String(item.periodEnd || "")
            .toLowerCase();


        return (
          company.includes(search) ||
          scrip.includes(search) ||
          periodStart.includes(search) ||
          periodEnd.includes(search)
        );

      });

  }


  return results;

}


// ==========================================
// DISPLAY RESULTS
// ==========================================

function renderResults() {

  resultsEl.innerHTML = "";


  const results =
    getFilteredResults();


  if (
    results.length === 0
  ) {

    emptyEl.classList.remove(
      "hidden"
    );


    emptyEl.textContent =
      "No BSE results found.";


    return;

  }


  emptyEl.classList.add(
    "hidden"
  );


  results.forEach(item => {

    const card =
      document.createElement("div");


    card.className =
      "result-card";


    const watched =
      isWhitelisted(item);


    if (watched) {

      card.style.border =
        "2px solid #198754";

      card.style.background =
        "#f1fff6";

    }


    card.innerHTML = `

      ${
        watched
          ? `
            <div style="
              color:#198754;
              font-size:12px;
              font-weight:bold;
              margin-bottom:6px;
            ">
              ⭐ WATCHLIST RESULT
            </div>
          `
          : ""
      }

      <div class="company">
        ${escapeHtml(item.company)}
      </div>

      <div class="scrip">
        BSE: ${escapeHtml(item.scrip)}
      </div>

      <div class="meta">

        <span class="badge">
          ${escapeHtml(item.resultType)}
        </span>

        <span class="badge">
          ${escapeHtml(item.basis)}
        </span>

        <span class="badge">
          ${escapeHtml(item.indAs)}
        </span>

      </div>

      <div class="period">
        ${escapeHtml(item.periodStart)}
        →
        ${escapeHtml(item.periodEnd)}
      </div>

      <a
        class="open-btn"
        href="${escapeAttribute(item.link)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open BSE Result
      </a>

    `;


    resultsEl.appendChild(card);

  });

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
// REFRESH BUTTON
// ==========================================

refreshBtn.addEventListener(
  "click",
  loadResults
);


// ==========================================
// AUTOMATIC REFRESH
//
// Currently every 5 minutes.
// We will later move the real alert
// monitoring to the Cloudflare Worker.
// ==========================================

setInterval(
  loadResults,
  5 * 60 * 1000
);


// ==========================================
// HTML SECURITY
// ==========================================

function escapeHtml(value) {

  return String(value ?? "")
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


function escapeAttribute(value) {

  return String(value ?? "")
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
// START APPLICATION
// ==========================================

renderWhitelist();

loadResults();