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
    const morningChange = change ? change.text : "";
    const morningDir = change ? change.dir : "flat";
    const changeHtml = change
      ? "<span class=\"chg " + change.dir + "\" data-quote-change data-morning=\"" + esc(morningChange) + "\" data-dir=\"" + morningDir + "\">" + morningChange + "</span>"
      : "<span class=\"chg flat\" data-quote-change data-morning=\"\" data-dir=\"flat\" hidden></span>";
    const closeChange = morningChange ? " · " + morningChange : "";
    const takeaway = ticker.takeaway
      ? "<p class=\"takeaway\">" + esc(ticker.takeaway) + "</p>"
      : "<p class=\"empty\">No takeaway in this brief.</p>";
    const hasNews = Array.isArray(ticker.news) && ticker.news.length > 0;
    const gex = ticker.gex || {};
    return (
      "<article class=\"card\" data-symbol=\"" + symbol + "\">" +
      "<header class=\"card-top\"><h2 class=\"symbol\">" + symbol + "</h2><p class=\"name\">" + name + "</p></header>" +
      "<p class=\"price-row\">" +
      "<span class=\"spot\" data-quote-price data-morning=\"" + esc(formatSpot(ticker.spot)) + "\">" + formatSpot(ticker.spot) + "</span>" +
      changeHtml +
      "<span class=\"quote-state\" data-quote-state hidden></span>" +
      "</p>" +
      "<p class=\"last-close\" data-last-close hidden>Last close <b>" + formatSpot(ticker.spot) + "</b>" + esc(closeChange) + "</p>" +
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
    stopQuotes();
    briefEl.innerHTML = "<p class=\"error\">" + esc(message) + "</p>";
    noteEl.hidden = true;
    footerEl.textContent = "";
    metaEl.textContent = "";
    editionEl.textContent = "";
    editionEl.classList.remove("archive");
  }

  async function show() {
    stopQuotes();
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
      if (!archived) startQuotes();
    } catch (err) {
      showError("This brief could not be loaded.");
    }
  }

  // Public CNBC quote page. partnerId=2 is their site's public query flag, not a key.
  const QUOTE_INTERVAL_MS = 45000;
  const SESSION_START = 4 * 60;
  const SESSION_END = 20 * 60;
  const QUOTE_LABELS = { live: "Live", delayed: "Delayed", closed: "Market closed" };
  let quoteGeneration = 0;
  let quoteTimer = 0;

  function stopQuotes() {
    quoteGeneration += 1;
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = 0;
  }

  function quoteSymbols() {
    return Array.from(briefEl.querySelectorAll(".card[data-symbol]"))
      .map((card) => card.getAttribute("data-symbol") || "")
      .filter((symbol) => /^[A-Z0-9.\-]{1,12}$/.test(symbol));
  }

  function etSessionOpen(date) {
    const parts = {};
    for (const part of new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)) {
      parts[part.type] = part.value;
    }
    if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(parts.weekday)) return false;
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    return minutes >= SESSION_START && minutes < SESSION_END;
  }

  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function parseQuoteDate(iso) {
    if (typeof iso !== "string" || !iso) return null;
    const dt = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatQuoteTime(iso) {
    const dt = parseQuoteDate(iso);
    if (!dt) return "";
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dt);
    return time + " ET";
  }

  function pickPrint(quote) {
    const status = String(quote.curmktstatus || "").toUpperCase();
    const extended = quote.ExtendedMktQuote && typeof quote.ExtendedMktQuote === "object" ? quote.ExtendedMktQuote : null;
    const extendedType = extended ? String(extended.type || "").toUpperCase() : "";
    const regular = { price: parsePrice(quote.last), time: quote.last_time };
    const extendedPrint = extended ? { price: parsePrice(extended.last), time: extended.last_time || quote.last_time } : null;
    const session = status === "PRE_MKT" || status === "REG_MKT" || status === "POST_MKT";
    let print = regular;
    if ((status === "PRE_MKT" || status === "POST_MKT") && extendedPrint && extendedPrint.price !== null && extendedType === status) {
      print = extendedPrint;
    } else if (!session && extendedPrint && extendedPrint.price !== null) {
      const extendedMs = parseQuoteDate(extendedPrint.time);
      const regularMs = parseQuoteDate(regular.time);
      if (extendedMs && (!regularMs || extendedMs >= regularMs)) print = extendedPrint;
    }
    if (print.price === null) return null;
    const previous = parsePrice(quote.previous_day_closing);
    const realtime = quote.realTime === true || quote.realTime === "true";
    return {
      price: print.price,
      changePct: previous ? ((print.price - previous) / previous) * 100 : null,
      time: print.time,
      state: session ? (realtime ? "live" : "delayed") : "closed",
    };
  }

  function restoreMorning(card) {
    const price = card.querySelector("[data-quote-price]");
    const change = card.querySelector("[data-quote-change]");
    const state = card.querySelector("[data-quote-state]");
    const close = card.querySelector("[data-last-close]");
    if (price) price.textContent = price.dataset.morning || "—";
    if (change) {
      const morning = change.dataset.morning || "";
      change.textContent = morning;
      change.className = "chg " + (change.dataset.dir || "flat");
      change.hidden = !morning;
    }
    if (state) {
      state.hidden = true;
      state.textContent = "";
      state.className = "quote-state";
    }
    if (close) close.hidden = true;
  }

  function paintQuote(card, print) {
    const price = card.querySelector("[data-quote-price]");
    const change = card.querySelector("[data-quote-change]");
    const state = card.querySelector("[data-quote-state]");
    const close = card.querySelector("[data-last-close]");
    if (!price || !state) return;
    price.textContent = formatSpot(print.price);
    if (change) {
      const formatted = formatChange(print.changePct);
      if (formatted) {
        change.hidden = false;
        change.textContent = formatted.text;
        change.className = "chg " + formatted.dir;
      } else {
        change.hidden = true;
        change.textContent = "";
      }
    }
    const when = formatQuoteTime(print.time);
    state.hidden = false;
    state.className = "quote-state " + print.state;
    state.textContent = QUOTE_LABELS[print.state] + (when ? " · " + when : "");
    if (close) close.hidden = false;
  }

  async function refreshQuotes(generation) {
    const symbols = quoteSymbols();
    if (!symbols.length || generation !== quoteGeneration) return;
    let payload = null;
    try {
      const response = await fetch(
        "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" +
          symbols.join("|") +
          "&requestMethod=itv&noCache=true&partnerId=2&fund=1&exthrs=1&output=json&events=1&t=" +
          Date.now(),
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("quote " + response.status);
      payload = await response.json();
    } catch (err) {
      return;
    }
    if (generation !== quoteGeneration) return;
    let list = payload && payload.FormattedQuoteResult && payload.FormattedQuoteResult.FormattedQuote;
    if (!list) return;
    if (!Array.isArray(list)) list = [list];
    const bySymbol = {};
    list.forEach((quote) => {
      if (!quote || Number(quote.code) !== 0 || !quote.symbol) return;
      const print = pickPrint(quote);
      if (print) bySymbol[String(quote.symbol).toUpperCase()] = print;
    });
    symbols.forEach((symbol) => {
      const card = briefEl.querySelector('.card[data-symbol="' + symbol + '"]');
      if (!card) return;
      if (bySymbol[symbol]) paintQuote(card, bySymbol[symbol]);
      else restoreMorning(card);
    });
  }

  function startQuotes() {
    if (quoteTimer) clearInterval(quoteTimer);
    const generation = quoteGeneration;
    const run = () => {
      if (generation !== quoteGeneration || document.hidden) return;
      refreshQuotes(generation);
    };
    run();
    quoteTimer = setInterval(() => {
      if (!etSessionOpen(new Date())) return;
      run();
    }, QUOTE_INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && quoteTimer) refreshQuotes(quoteGeneration);
  });

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
