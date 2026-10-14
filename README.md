# IBIT · SPCX · NVDA Daily Market Brief with Options

Weekday pre-market brief for IBIT (iShares Bitcoin Trust), SPCX (SpaceX), and NVDA (Nvidia). The page is static HTML, CSS, and JavaScript. Daily updates change data files only. There is no build step.

Live site, once GitHub Pages is publishing from Actions:

https://nobyar.github.io/IBIT-SPCX-NVDA-Morning-Brief/

## File layout

```
index.html                      Page shell, title, and social meta tags
css/styles.css                  Layout and dark theme
js/app.js                       Renders the brief from JSON
data/latest.json                The brief the page shows by default
data/archive/index.json         Archive dates, newest first
data/archive/YYYY-MM-DD.json    One file per brief date
assets/og.png                   Static Open Graph / Twitter card image
assets/favicon.svg
assets/fonts/                   Fraunces, Outfit, IBM Plex Mono (OFL)
.github/workflows/pages.yml     Publishes the repo root to GitHub Pages
```

`index.html` keeps the page title and the Open Graph / Twitter tags, because link previews do not run JavaScript. Everything in the brief itself — date, timestamp, note, tickers, and disclaimer — is read from JSON.

Opening the page with no query shows `data/latest.json`. Choosing a date, or opening `?date=YYYY-MM-DD`, shows `data/archive/YYYY-MM-DD.json` when that date is listed in the archive index.

## Weekday update

1. Write the new brief to `data/latest.json`.
2. Copy that file to `data/archive/YYYY-MM-DD.json`, using the brief `date`.
3. Add that date to the front of `data/archive/index.json` if it is not already there.
4. Commit and push to `main`.

Do not invent strikes, expiries, headlines, or percentages. If an expiration's call wall, put wall, or gamma flip is unknown, omit those keys. Do not copy the board levels into an expiration unless they are actually that expiration's levels. Keep at most three expirations, nearest first. Leave `takeaway` null and `news` as `[]` when there is nothing to say, and set `note` only when the brief needs a banner.

The social image is a static title card. Daily edits do not need a new image.

## JSON schema

`data/latest.json` and each `data/archive/YYYY-MM-DD.json` use the same object. `changePct` is in percent points: `0.58` means +0.58%, not 0.0058. `netGamma` is US dollars of net gamma per 1% move: `-1580000` means −$1.58 million. `generatedAt` is ISO-8601 with a US Eastern offset (`-04:00` for EDT, `-05:00` for EST).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Daily market brief",
  "type": "object",
  "additionalProperties": false,
  "required": ["date", "generatedAt", "disclaimer", "tickers"],
  "properties": {
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
      "description": "Brief date (YYYY-MM-DD). The morning the brief is for."
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the brief was generated, ISO-8601 with a US Eastern offset."
    },
    "closeAsOf": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
      "description": "Session of the last close. spot and changePct refer to this date."
    },
    "disclaimer": {
      "type": "string",
      "description": "Footer line. Use: Not financial advice. Options data via dudediligence.club."
    },
    "note": {
      "type": ["string", "null"],
      "description": "Optional banner under the masthead. Omit or null when there is nothing to flag."
    },
    "tickers": {
      "type": "array",
      "minItems": 1,
      "description": "Rendered in array order.",
      "items": { "$ref": "#/$defs/ticker" }
    }
  },
  "$defs": {
    "ticker": {
      "type": "object",
      "additionalProperties": false,
      "required": ["symbol", "name", "spot", "changePct", "takeaway", "news", "gex"],
      "properties": {
        "symbol": { "type": "string" },
        "name": { "type": "string" },
        "spot": { "type": "number", "description": "Last close, in US dollars." },
        "changePct": {
          "type": ["number", "null"],
          "description": "Percent change on that close, in percent points."
        },
        "takeaway": {
          "type": ["string", "null"],
          "description": "One line. Null when the brief has no takeaway."
        },
        "news": {
          "type": "array",
          "items": { "$ref": "#/$defs/newsItem" }
        },
        "gex": { "$ref": "#/$defs/gex" }
      }
    },
    "newsItem": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "url"],
      "properties": {
        "text": { "type": "string" },
        "url": { "type": "string", "format": "uri" }
      }
    },
    "gex": {
      "type": "object",
      "additionalProperties": false,
      "required": ["callWall", "putWall", "flip", "expirations"],
      "properties": {
        "callWall": { "type": ["number", "null"], "description": "Board-level call wall." },
        "putWall": { "type": ["number", "null"], "description": "Board-level put wall." },
        "flip": { "type": ["number", "null"], "description": "Board-level gamma flip." },
        "expirations": {
          "type": "array",
          "maxItems": 3,
          "description": "Nearest expiry first. At most three. Leave unknown expiries out.",
          "items": { "$ref": "#/$defs/expiration" }
        }
      }
    },
    "expiration": {
      "type": "object",
      "additionalProperties": false,
      "required": ["expiry", "netGamma"],
      "properties": {
        "expiry": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
        "netGamma": {
          "type": ["number", "null"],
          "description": "Net gamma in US dollars per 1% move. Negative is net short gamma."
        },
        "callWall": { "type": ["number", "null"], "description": "This expiry's call wall. Omit if unknown." },
        "putWall": { "type": ["number", "null"], "description": "This expiry's put wall. Omit if unknown." },
        "flip": { "type": ["number", "null"], "description": "This expiry's gamma flip. Omit if unknown." }
      }
    }
  }
}
```

Archive index, `data/archive/index.json`:

```json
{
  "title": "Archive index",
  "type": "array",
  "description": "Brief dates, newest first. Each date needs data/archive/YYYY-MM-DD.json.",
  "items": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" }
}
```

A headline, when there is one, looks like this. This sample is the shape only, not a story from the seed brief:

```json
{ "text": "Headline as published", "url": "https://example.com/story" }
```

## Publish

The workflow `.github/workflows/pages.yml` deploys the repository root with `actions/deploy-pages` on every push to `main`.

In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** if that is not already selected. The first push of this workflow to `main` publishes the site after that setting is on.

## Fonts

Fraunces, Outfit, and IBM Plex Mono are under the SIL Open Font License. See `assets/fonts/OFL.txt` and `assets/fonts/NOTICE.md`.
