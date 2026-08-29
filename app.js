/* ============================================================
   PARSE & ADD ENTRYS (FLEXIBLE PATTERNS)
   ============================================================ */

/**
 * Extracts scrip code and company name from inputs like:
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

  // Check for 6-digit scrip code inside parentheses or standalone
  const scripMatch = text.match(/\b(\d{6})\b/);
  if (scripMatch) {
    scrip = scripMatch[1];
    // Remove the scrip code and remaining parenthetical artifacts to get the name
    name = text
      .replace(scripMatch[0], "")
      .replace(/[()]/g, "")
      .trim();
  } else {
    // If no 6-digit code exists, treat the entire string as company name
    name = text;
  }

  return { scrip, name };
}

/**
 * Adds multiple items provided as a comma-separated string or array
 */
async function processBulkInput(rawText) {
  if (!rawText || !rawText.trim()) return;

  // Split by commas or newlines
  const entries = rawText
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  let addedCount = 0;

  entries.forEach((entry) => {
    const parsed = parseCompanyInput(entry);
    if (!parsed) return;

    // Avoid duplicates by scrip or name
    const exists = watchlist.some((item) => {
      if (parsed.scrip && item.scrip) {
        return String(item.scrip).trim() === parsed.scrip;
      }
      if (parsed.name && item.name) {
        return (
          String(item.name).trim().toLowerCase() ===
          parsed.name.toLowerCase()
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
    setStatus("No new items were added (duplicates or invalid input).");
  }
}

/* ============================================================
   CLEAR ALL WHITELIST
   ============================================================ */

async function clearAllWatchlist() {
  if (watchlist.length === 0) return;

  if (!confirm("Are you sure you want to clear the entire whitelist?")) {
    return;
  }

  const previousWatchlist = [...watchlist];
  watchlist = [];
  renderWatchlist();

  try {
    setStatus("Clearing whitelist...");
    await saveWatchlist();
    setStatus("Whitelist cleared successfully.");
  } catch (error) {
    console.error("Clear error:", error);
    watchlist = previousWatchlist;
    renderWatchlist();
    setStatus("Could not clear whitelist.");
  }
}

/* ============================================================
   EVENT HANDLERS & FILE UPLOAD
   ============================================================ */

function setupWatchlistHandlers() {
  const addBtn = document.getElementById("addBtn");
  const input = document.getElementById("companyInput");
  const clearBtn = document.getElementById("clearWatchlistBtn");
  const fileInput = document.getElementById("fileUploadInput");

  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (input && input.value) {
        processBulkInput(input.value);
        input.value = "";
      }
    });
  }

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        processBulkInput(input.value);
        input.value = "";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearAllWatchlist();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        processBulkInput(event.target.result);
        fileInput.value = ""; // Reset file input
      };
      reader.readAsText(file);
    });
  }
}

// Ensure handlers are registered on page initialisation
document.addEventListener("DOMContentLoaded", setupWatchlistHandlers);