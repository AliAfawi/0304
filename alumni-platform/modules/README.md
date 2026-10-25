# بوابة الخريجين – module contract

The site is one HTML page built from `page.html` + every `modules/*.js` (concatenated in file-name order into a
single classic `<script>`, so all top-level names are shared globals) + every `modules/*.css`.
Run `node build.js` to produce `index.html`. Never edit `index.html` by hand.

Audience: Arab high-school students and alumni of one school (Negev, southern Israel), all cohorts.
UI language: Arabic, RTL, the colloquial Palestinian register already used in the page
("بدك"، "هلّق"، "شو"، "لسا"). Short, direct sentences. No emoji as decoration.

## Ownership (do not edit files you don't own)
| Files | Owner |
|---|---|
| `00-data.js`, `01-core.js`, `20-home-uni.js`, `21-tools.js`, `99-boot.js`, `page.html`, `ideas.js`, `institutions.js`, `build.js` | lead (ask in your report if you need a core change) |
| `22-community.js`, `24-alumni-ideas.js` (alumni part), `30-*` | community team |
| `23-learn.js`, `31-*` | learning team |
| `32-*`, `33-*`, `34-*` | career, events and mentoring team |
| `35-*`, `36-*` | tools and AI team |
| `37-*`, `38-*` | guides, content and scholarships team |
| `40-*` … `44-*` | platform team (my space, admin, points, accessibility, search) |

Each module may have a matching `.css` file (e.g. `33-events.css`). Prefix new CSS classes with your module
name (`.ev-…`) to avoid collisions. Reuse the shared classes below before inventing new ones.

## Core API (globals from 01-core.js)
- `h(tag, props, ...children)` — build DOM. ALWAYS put user/shared text in via `text:` or child strings
  (they become text nodes). Never use `innerHTML` with data.
- `$(sel, root)`, `opt(value, label, selected)`, `toast(msg)`, `rel(ts)` (relative Arabic time),
  `fmt(n)`, `safeUrl(u)` (returns an http(s) href or null; use it for every user-supplied link),
  `hue(s)`, `avatar(name, key)`, `lsGet(k, d)`, `lsSet(k, v)` (per-browser conveniences only),
  `norm(s)` / `matches(haystack, q)` (Arabic-insensitive search).
- Layout helpers: `eyebrow(text)`, `head(eyebrow, title, lede)`, `empty(title, text)`, `writeBanner()`,
  `modal(title, bodyEl)` → returns `close()`, `confirmBox(text, onYes)`, `rowActions(col, row)` (delete button for owner/admin),
  `reqList(arrayOfStrings)`.
- State `S`: `S.uid` (viewer id or null), `S.isAdmin`, `S.canWrite`, `S.mode` ("db" | "local" | "loading"),
  `S.alumni` (map uid → profile {name, year, status, place, field, city, contact, bio, mentor}),
  `S.posts`, `S.materials`, `S.tutors`, `S.mod` (map docId → map, admin-managed moderation docs in collection `mod`).
  `nameOf(uid)`, `isMod(key, id)`, `canDelete(row)`, `guardWrite()`, `needProfile()`.
- Data (works with the shared db or falls back to this browser's storage):
  - `subscribe(collection, {order="createdAt", dir="desc", limit=300}, cb(rows))` → unsubscribe. Rows are `{id, ...data}`.
  - `subscribeDoc(collection, id, cb(rowOrNull))` → unsubscribe.
  - `addDoc(col, data)` → true/false, `setDoc(col, id, data)` → true/false (full replace), `getDoc(col, id)`, `delDoc(col, id)`.
  - Always include `uid: S.uid` and `createdAt: Date.now()` in new docs. Store ids, never names.
  - Collection paths have an odd number of segments: `events`, `events/<id>/regs`.
  - Private per-viewer data: collection `myCol()` (= `data/users/<uid>`). Nobody else can read it.
  - `admin`-only collections (only editors can write): `mod`, `announcements`, `scholarships`, `config`.
  - Everything else: any contributor can write. Keep one doc per thing; for votes/ratings use doc id `${targetId}__${S.uid}`.
  - Budget: max 64 live subscriptions per page; subscribe inside your view and register cleanup with `onLeave(unsub)`,
    or once globally from `HOOKS.boot` only if the data is needed everywhere. Never subscribe inside render loops.
  - The store caps at 25,000 docs per artifact. Don't create one doc per keystroke/event.
- Navigation:
  - `registerView(id, section, label, renderFn, {order, admin})` — `renderFn()` returns an element.
    Sections: `home, uni, tools, community, learn, grants, career, events, guides, me, admin, ideas`.
    A section with 2+ views gets a sub-navigation automatically. `admin: true` hides the view from non-editors.
  - `go(viewIdOrSectionId)`; any element with `data-go="id"` navigates on click.
  - `registerTool(id, title, desc, renderFn(el), order)` adds a card to the «أدوات» section; renderFn fills `el`.
  - `registerHome(fn, order)` — `fn()` returns a home-page widget element or null.
  - `HOOKS.boot.push(fn)` (data layer ready), `HOOKS.lists.push(fn)` (shared data changed: refresh your
    lists if their container exists), `onLeave(fn)` (current view is closing).
  - `renderView()` rebuilds the current view; `renderLists()` refreshes lists without losing form input.
- Capabilities (each may be null — hide the feature or show a short note when null):
  - `CAP.sample` → use `ai(input, opts)` / `aiJson(input, opts)` (Claude). `input` is a string or
    `[{role, content}]` ending with role "user". The model has no memory: send instructions + data every call.
    Stream with `opts.onText = ({text}) => el.textContent = text` (text is the whole answer so far).
    Show `aiError(e)` on failure. Call only from a click, never on load or in a loop.
    Type definitions: /tmp/claude-0/bundled-skills/2.1.310/06f7fe39188773f1512b3bb570655680/artifact-capabilities/0.2.90/sample.d.ts
  - `CAP.downloads` → `saveFile(filename, stringOrBlob)` (only on an explicit click).
  - `CAP.assets` → `uploadFile(file)` → `{id, url}` or null (images / PDF; contributors may upload). Store the `id` and `url` in your doc.
  - `CAP.room` → live presence/events (room.d.ts in the same folder). Optional.
  - `window.print()`, `alert/confirm/prompt`, iframes, mailto/tel links, external fetches do NOT work. Use `confirmBox`.

## Shared data contracts between teams
- `mod` (admin-only, platform team writes, everyone reads via `S.mod`): docs `verified` {map:{uid:true}}, `pinned` {map:{postId:true}},
  `hidden` {map:{"<collection>:<docId>":true}}, `roles` {map:{uid:"moderator"}}; each doc also has `updatedAt`.
  Community/learning lists must skip hidden items (`isMod("hidden", col + ":" + id)`), float pinned posts first,
  and show a «موثّق» pill next to verified names (`isMod("verified", uid)`).
- `reports` {uid, target:"<collection>:<docId>", reason, createdAt} — any team adds a «إبلاغ» action; platform team shows the queue.
- `notes` {to: uid, from: uid, kind: "reply"|"mention"|"thanks"|"booking"|"event"|…, text, go: viewId, createdAt} —
  in-app notifications. Any team writes one when it affects another person; platform team shows them in «مساحتي».
- `announcements` (admin-only) {uid, title, text, createdAt} — platform team writes and shows them.
- `thanks` {uid, to, text, createdAt} — platform team (points, badges, thank-you notes).
- `registerSearch(label, fn)` — add your content to the global search (platform team builds the search UI).

## Shared CSS classes (from page.html)
`view` (vertical page stack), `section`, `head`, `card` (elevated object), `plain` (flat box), `grid` (auto-fill cards),
`grid-3`, `stack`, `row`, `spread`, `chips` + `chip` (`aria-pressed="true"` = selected), `pill` (+ `good`, `warn`, `grey`),
`btn` (+ `blue`, `ghost`, `sm`), `link` (+ `danger`), `field` (label wrapper: `<span>` caption + control), `form` (auto grid of fields, `.full` spans),
`check`, `item`, `meta`, `who`, `empty`, `banner` (+ `warn`), `result`, `table-wrap`, `tag` (+ `hit`), `req`, `muted`, `small`, `num`.
Headings: `h1` page title (use `head()`), `h2` section, `h3` card title, `h4` small blue label.
Colors only through tokens: `--bg --surface --surface-2 --ink --muted --line --accent --accent-soft --on-accent --good --warn --bad`.
Fonts: `--f-display` (Alexandria) for headings/numbers, `--f-body`. Must work at 390px wide with no horizontal scroll,
in light and dark. Give every form control an `id` (prefix with your module name). Visible focus is global.

## Content rules
- Never invent people, testimonials, statistics, prices, dates or URLs. Empty states explain how to add the first item.
- Facts about institutions/scholarships/exams: only general, stable guidance. If a number may change yearly, say so.
- Links: only well-known official domains (e.g. nite.org.il, gov.il, kolzchut.org.il) or Google search links
  (`https://www.google.com/search?q=` + encodeURIComponent(q)). Prefer search links when unsure.

## Definition of done for your module
1. `GP_ONLY=<your prefixes> ./check.sh` passes (syntax, every view renders, no console errors, no overflow at 390px).
2. Each feature has a working empty state and works in local mode (no db) as well.
3. Your final report lists: files created/changed, the IDEAS.md numbers you implemented, ideas you could not
   implement and why, and 10+ NEW ideas (Arabic, one line each) with a "*" on the ones you also implemented.
