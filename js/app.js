(function () {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const briefEl = document.getElementById("brief");
  const noteEl = document.getElementById("note");
  const metaEl = document.getElementById("meta");
  const footerEl = document.getElementById("disclaimer");
  const editionEl = document.getElementById("edition");
  const selectEl = document.getElementById("brief-date");

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isDate(value) {
    return typeof value === "string" && DATE_RE.test(value);
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Could not load " + url);
    return response.json();
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatSpot(value) {
    const n = numberOrNull(value);
    return n === null ? "—" : n.toFixed(2);
  }

  function formatLevel(value) {
    const n = numberOrNull(value);
    if (n === null) return "—";
    const rounded = Math.round(n * 100) / 100;
    if (Object.is(rounded, Math.round(rounded))) return String(Math.round(rounded));
    return rounded.toFixed(2);
  }

  function formatChange(value) {
    const n = numberOrNull(value);
    if (n === null) return null;
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return {
      text: sign + Math.abs(n).toFixed(2) + "%",
      dir: n > 0 ? "up" : n < 0 ? "down" : "flat",
    };
  }

  function formatGamma(value) {
    const n = numberOrNull(value);
    if (n === null) return { text: "—", dir: "flat", side: "" };
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    const abs = Math.abs(n);
    const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    let scaled = abs;
    let suffix = "";
    for (const [div, suf] of units) {
      if (abs >= div) {
        scaled = abs / div;
        suffix = suf;
        break;
      }
    }
    const rounded = Math.round((scaled + Number.EPSILON) * 100) / 100;
    const digits = rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return {
      text: sign + "$" + digits + suffix,
      dir: n > 0 ? "pos" : n < 0 ? "neg" : "flat",
      side: n > 0 ? "long" : n < 0 ? "short" : "",
    };
  }

  function formatLongDate(iso) {
    if (!isDate(iso)) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return MONTHS[m - 1] + " " + d + ", " + y;
  }

  function formatShortDate(iso) {
    if (!isDate(iso)) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    return MONTHS_SHORT[m - 1] + " " + d + ", " + y;
  }

  function formatGenerated(iso) {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "";
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
    return time + " ET";
  }

  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.href;
    } catch (err) {
      return "";
    }
  }

  function hostLabel(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch (err) {
      return "";
    }
  }

  function disclaimerHtml(text) {
    const domain = "dudediligence.club";
    const source = String(text || "");
    const index = source.indexOf(domain);
    if (index === -1) return esc(source);
    return (
      esc(source.slice(0, index)) +
      '<a href="https://dudediligence.club">' + domain + "</a>" +
      esc(source.slice(index + domain.length))
    );
  }

  function trackHtml(gex, spot) {
    const put = numberOrNull(gex.putWall);
    const call = numberOrNull(gex.callWall);
    const flip = numberOrNull(gex.flip);
    const px = numberOrNull(spot);
    if (put === null || call === null || put === call) return "";
    const lo = Math.min(put, call);
    const hi = Math.max(put, call);
    const pos = (value) => {
      if (value === null) return null;
      const t = (value - lo) / (hi - lo);
      return Math.min(96, Math.max(4, 4 + t * 92));
    };
    const marks = [
      ["put", "Put wall " + formatLevel(put), pos(put)],
      ["flip", "Gamma flip " + formatLevel(flip), pos(flip)],
      ["spot", "Last close " + formatSpot(px), pos(px)],
      ["call", "Call wall " + formatLevel(call), pos(call)],
    ];
    const dots = marks
      .filter((mark) => mark[2] !== null)
      .map((mark) => {
        return (
          '<span class="mark ' + mark[0] + '" style="left:' + mark[2].toFixed(2) + '%" title="' +
          esc(mark[1]) + '"></span>'
        );
      })
      .join("");
    const label = "Last close " + formatSpot(px) + " between put wall " + formatLevel(put) + " and call wall " + formatLevel(call);
    return (
      '<div class="track" role="img" aria-label="' + esc(label) + '">' +
      '<div class="track-line"></div>' + dots + "</div>" +
      '<p class="track-caption"><i class="swatch spot" aria-hidden="true"></i> Last close, from the put wall to the call wall.</p>'
    );
  }

  function newsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="empty">No headlines in this brief.</p>';
    }
    const lis = items.map((item) => {
      const text = item && item.text ? esc(item.text) : "";
      if (!text) return "";
      const href = safeUrl(item.url);
      if (!href) return "<li>" + text + "</li>";
      const host = esc(hostLabel(href));
      return (
        "<li><a href=\"" + esc(href) + "\" rel=\"noopener noreferrer\">" + text + "</a>" +
        (host ? "<span class=\"source\">" + host + "</span>" : "") +
        "</li>"
      );
    }).join("");
    return "<ul class=\"news\">" + lis + "</ul>";
  }

  function levelsHtml(gex) {
    const rows = [
      ["Call wall", gex.callWall],
      ["Put wall", gex.putWall],
      ["Gamma flip", gex.flip],
    ];
    return (
      "<dl class=\"levels\">" +
      rows.map((row) => "<div><dt>" + row[0] + "</dt><dd>" + formatLevel(row[1]) + "</dd></div>").join("") +
      "</dl>"
    );
  }

  function expirationsHtml(list) {
    const rows = (Array.isArray(list) ? list : []).slice(0, 3);
    if (!rows.length) return "";
    const body = rows.map((row) => {
      const gamma = formatGamma(row.netGamma);
      const side = gamma.side ? "<span class=\"side\">" + gamma.side + "</span>" : "";
      return (
        "<tr>" +
        "<td data-label=\"Expiry\">" + esc(formatShortDate(row.expiry)) + "</td>" +
        "<td data-label=\"Net gamma\" class=\"" + gamma.dir + "\">" + gamma.text + side + "</td>" +
        "<td data-label=\"Call wall\">" + formatLevel(row.callWall) + "</td>" +
        "<td data-label=\"Put wall\">" + formatLevel(row.putWall) + "</td>" +
        "<td data-label=\"Gamma flip\">" + formatLevel(row.flip) + "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      "<table class=\"gex-table\">" +
      "<caption>Expirations · net gamma in $ per 1% move</caption>" +
      "<thead><tr>" +
      "<th scope=\"col\">Expiry</th>" +
      "<th scope=\"col\">Net gamma</th>" +
      "<th scope=\"col\">Call wall</th>" +
      "<th scope=\"col\">Put wall</th>" +
      "<th scope=\"col\">Gamma flip</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table>"
    );
  }

  function fieldHtml(label, body, stacked) {
    if (stacked) {
      return "<h3 class=\"section-label\">" + label + "</h3>" + body;
    }
    return "<div class=\"line\"><h3 class=\"section-label\">" + label + "</h3>" + body + "</div>";
  }

  function tickerHtml(ticker) {
    const symbol = esc(ticker.symbol || "");
    const name = esc(ticker.name || "");
    const change = formatChange(ticker.changePct);
    const changeHtml = change ? "<span class=\"chg " + change.dir + "\">" + change.text + "</span>" : "";
    const takeaway = ticker.takeaway
      ? "<p class=\"takeaway\">" + esc(ticker.takeaway) + "</p>"
      : "<p class=\"empty\">No takeaway in this brief.</p>";
    const hasNews = Array.isArray(ticker.news) && ticker.news.length > 0;
    const gex = ticker.gex || {};
    return (
      "<article class=\"card\" data-symbol=\"" + symbol + "\">" +
      "<header class=\"card-top\"><h2 class=\"symbol\">" + symbol + "</h2><p class=\"name\">" + name + "</p></header>" +
      "<p class=\"price-row\"><span class=\"spot\">" + formatSpot(ticker.spot) + "</span>" + changeHtml + "</p>" +
      fieldHtml("Takeaway", takeaway, false) +
      fieldHtml("Headlines", newsHtml(ticker.news), hasNews) +
      "<h3 class=\"section-label\">Board</h3>" +
      levelsHtml(gex) +
      trackHtml(gex, ticker.spot) +
      expirationsHtml(gex.expirations) +
      "</article>"
    );
  }

  function renderPicker(dates, selected) {
    selectEl.innerHTML = ["<option value=\"\">Latest</option>"]
      .concat(dates.map((date) => "<option value=\"" + date + "\">" + esc(formatLongDate(date)) + "</option>"))
      .join("");
    selectEl.value = selected;
  }

  function render(data, view) {
    const generated = formatGenerated(data.generatedAt);
    const close = isDate(data.closeAsOf) ? "Last close " + formatLongDate(data.closeAsOf) : "";
    const briefDate = isDate(data.date) ? formatLongDate(data.date) : "";
    metaEl.textContent = [briefDate, generated ? "Generated " + generated : "", close].filter(Boolean).join(" · ");
    editionEl.textContent = view.archived ? "Archive" : "Latest";
    editionEl.classList.toggle("archive", Boolean(view.archived));
    if (data.note) {
      noteEl.hidden = false;
      noteEl.textContent = data.note;
    } else {
      noteEl.hidden = true;
      noteEl.textContent = "";
    }
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    briefEl.innerHTML = tickers.length
      ? tickers.map(tickerHtml).join("")
      : "<p class=\"empty\">No tickers in this brief.</p>";
    footerEl.innerHTML = disclaimerHtml(data.disclaimer);
  }

  function showError(message) {
    briefEl.innerHTML = "<p class=\"error\">" + esc(message) + "</p>";
    noteEl.hidden = true;
    footerEl.textContent = "";
    metaEl.textContent = "";
    editionEl.textContent = "";
    editionEl.classList.remove("archive");
  }

  async function show() {
    try {
      const index = await fetchJson("data/archive/index.json");
      const dates = (Array.isArray(index) ? index : []).filter(isDate);
      const requested = new URLSearchParams(location.search).get("date");
      const archived = Boolean(requested && dates.includes(requested));
      renderPicker(dates, archived ? requested : "");
      if (requested && !archived) {
        showError("No archived brief for that date.");
        editionEl.textContent = "";
        return;
      }
      const data = await fetchJson(archived ? "data/archive/" + requested + ".json" : "data/latest.json");
      render(data, { archived });
    } catch (err) {
      showError("This brief could not be loaded.");
    }
  }

  selectEl.addEventListener("change", () => {
    const url = new URL(location.href);
    if (selectEl.value) url.searchParams.set("date", selectEl.value);
    else url.searchParams.delete("date");
    history.pushState(null, "", url);
    show();
  });

  window.addEventListener("popstate", () => {
    show();
  });

  show();
})();
