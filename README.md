# ATLAS Static v0.8.1

Complete standalone static website for GitHub Pages. No backend, API keys, AI, package installation or build step required.

## Publish on GitHub Pages

1. Create a GitHub repository (for example `ATLAS`).
2. Extract this ZIP and upload **index.html** into the repository root, replacing the old index.html. It now contains the entire application, styles and icon. Other files are included for editing but are not needed to run the website.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, then `main` and `/ (root)`. Save.
5. Wait for the Pages deployment to finish. Open the URL displayed by GitHub, usually `https://YOUR-USERNAME.github.io/ATLAS/`.

Keep relative paths intact. To update, replace the files in the same repository. GitHub Pages access depends on the repository/account settings; this application has no sign-in or shared data service.

## What searches do

- Exact usernames: direct browser API requests to GitHub, Bluesky, Mastodon.social, Hacker News, Lichess, Chess.com, DEV.to and GitLab. Each is treated as an ordinary public-profile source. CORS, source limits or network errors can make a source unavailable.
- Display-name candidates: Stack Overflow is queried automatically for the supplied username and/or name. Display names are not unique usernames. Up to five results per term are returned; absence from this page is not proof that no account exists.
- Names: Wikidata label search and Wikipedia EN/FR name queries, with an extra city/organization query when supplied. These databases are not a general web index.
- Other sites: suggested profile addresses for 20 sites plus the three API sources, and Google/Bing search links. **Generated links are not evidence of an existing account.** ATLAS never fetches the manual-check pages in the background. No automatic scraping of search engines, proxies or CORS bypasses.
- Open a check link, inspect it and use **Record observation** to save what you actually saw. These records are explicitly marked manual, with unconfirmed identity.
- Email and notes are context only. They are not automatically queried. Submitted public profile links can trigger supported profile APIs; other links remain manual checks.

New search, graph, evidence, history and settings remain available. Three themes: Arctic Steel (default), Midnight Intelligence, Obsidian Gold. History, observations and theme settings stay in your own browser. JSON import/export moves history between devices or website addresses. No shared history or server cache. At most four requests run concurrently, with requests serialized by API origin. HTTP 429 pauses the source for at least a minute; Stack Exchange backoff hints are honored. Source cooldowns last only for the current page session. Refresh starts a new search; it retains existing search history.

Queries are sent to the selected public APIs when you search. Clicking a manual search/profile link sends you to that external service. Source responses are provisional matches, never confirmed identities.

## Development

Serve the folder using a static HTTP server; opening `index.html` as a `file://` URL can prevent module loading. Optional controlled tests: `node scripts/test-static.mjs` and `node scripts/test-extra.mjs` (Node.js 24). Node is not required by visitors or GitHub Pages. Tests do not establish live source availability or browser rendering.

## Attribution

Code: MIT, see LICENSE. Profile URL templates in `js/profile-links.js` are adapted from the selected WhatsMyName dataset, revision `f41ac77069f194490b35f4101154c690908c0978`, https://github.com/WebBreacher/WhatsMyName. Copyright 2015–2026 Micah Hoffman and contributors; CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). This version retains only suggested URL templates, removes detection rules and adds Reddit, GitHub, Bluesky and Mastodon links. Adapted template data remains under CC BY-SA 4.0.

## v0.8 collection notes

Automatic API results go directly to the graph and evidence library. Manual checks start collapsed. The five new username adapters validate returned identifiers; null Hacker News responses mean no public activity record, not proven account absence. Malformed responses, rate limits and browser access failures produce no evidence. APIs may have upstream caches. ATLAS is not affiliated with Chess.com.

Endpoint documentation:
- Hacker News: https://github.com/HackerNews/API
- Lichess: https://lichess.org/api and https://lichess.org/page/api-tips
- Chess.com: https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it
- Forem/DEV: https://developers.forem.com/api/v0
- GitLab: https://docs.gitlab.com/api/users/
- Stack Exchange: https://api.stackexchange.com/docs/users

Source access from a deployed browser has not been verified in this environment. Configured automatic checks are not a guarantee of source availability; blocked requests remain unavailable. The static app does not bypass CORS or source limits.

## Startup fix in v0.8.1

The deployed page was stuck because js/app.js returned 404. The supplied index.html now embeds all application code, CSS and SVG icon; only one file needs uploading. No source APIs changed in this fix. Browser history keeps the same database and origin. Storage initialization has a five-second timeout so it cannot hold the interface indefinitely. Startup failures show a message instead of remaining on the opening screen.

To edit: modify js/ and styles.css, then run node scripts/build-single.mjs. source-index.html is the editable HTML template, not the upload entry point. Run node scripts/test-boot.mjs to validate the generated entry page.
