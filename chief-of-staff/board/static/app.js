const POLL_MS = 10000;
const COLUMNS = [
  { key: "needs", title: "Needs you" },
  { key: "glance", title: "To glance" },
  { key: "questions", title: "Questions / fix" },
  { key: "ready", title: "Ready" },
  { key: "waiting", title: "Waiting" },
  { key: "progress", title: "In progress" },
  { key: "done", title: "Done" },
];
const KINDS = ["agent", "human", "grill"];
const RISKS = ["high", "medium", "low", "none"];
const RISK_RANK = { high: 0, medium: 1, low: 2 };
const MARKS = { ok: "✓", fix: "✗", question: "?" };
const GLANCE_KEYS = { 1: "ok", 2: "fix", 3: "question", 0: null };
const FILTER_KEY = "board-filters";
const SEEN_KEY = "board-seen";
const EMPTY_FILTERS = { q: "", tracks: [], kinds: [], risks: [], flag: false, startable: false, proposed: [], onlyNew: false };
const STATUS_LABELS = { "in-progress": "in progress", "pr-open": "PR open", "needs-you": "needs you", done: "done" };

const ICONS = {
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 1 0-3 0v2Z"/></svg>',
  comment: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.2 2.6A.5.5 0 0 1 3 13.2V11h0A1.5 1.5 0 0 1 2 9.5v-6Z"/></svg>',
};

const $ = (selector) => document.querySelector(selector);
const els = {
  board: $("#board"),
  brandName: $("#brand-name"),
  progress: $("#progress"),
  refreshed: $("#refreshed"),
  refreshBtn: $("#refresh-btn"),
  signals: $("#signals"),
  search: $("#search"),
  fTrack: $("#f-track"),
  fKind: $("#f-kind"),
  fRisk: $("#f-risk"),
  fFlag: $("#f-flag"),
  fStartable: $("#f-startable"),
  fClear: $("#f-clear"),
  visibleCount: $("#visible-count"),
  drawer: $("#drawer"),
  dPos: $("#d-pos"),
  dPrev: $("#d-prev"),
  dNext: $("#d-next"),
  dClose: $("#d-close"),
  dScroll: $("#d-scroll"),
  dHead: $("#d-head"),
  dAsk: $("#d-ask"),
  dAskBox: $("#d-ask-box"),
  dComposer: $("#d-composer"),
  dComments: $("#d-comments"),
  dGlance: $("#d-glance"),
  dCard: $("#d-card"),
  dThread: $("#d-thread"),
  dComment: $("#d-comment"),
  dSend: $("#d-send"),
  dRel: $("#d-rel"),
  dBody: $("#d-body"),
  confirm: $("#confirm"),
  confirmTitle: $("#confirm-title"),
  confirmText: $("#confirm-text"),
  confirmIds: $("#confirm-ids"),
  toast: $("#toast"),
};

const app = {
  meta: null,
  data: null,
  signature: "",
  byId: new Map(),
  columns: {},
  selectedId: null,
  openId: null,
  flow: [],
  flowColumn: null,
  drawerSignature: "",
  bodyOpen: false,
  drafts: new Map(),
  filters: { ...EMPTY_FILTERS },
  seen: null,
  pending: 0,
};

const storageKey = (name) => `${app.meta.slug}-${name}`;

function store(name, value) {
  if (app.meta) localStorage.setItem(storageKey(name), JSON.stringify(value));
}

function loadSeen() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(SEEN_KEY)) || "null");
    if (value && value.at) return { at: value.at, statuses: value.statuses || {}, marks: value.marks || {} };
  } catch {}
  return null;
}

function saveSeen() {
  store(SEEN_KEY, app.seen);
}

const statusSignature = (issue) => `${issue.status || ""}|${issue.prs.join(",")}`;
const timeOf = (iso) => {
  const value = Date.parse(iso || "");
  return Number.isNaN(value) ? null : value;
};

function seenBaseline(issue) {
  const mark = app.seen.marks[issue.id];
  if (mark && timeOf(mark.at) > timeOf(app.seen.at)) return { at: timeOf(mark.at), sig: mark.sig };
  return { at: timeOf(app.seen.at), sig: app.seen.statuses[issue.id] };
}

function changesOf(issue) {
  if (!app.seen) return [];
  const base = seenBaseline(issue);
  const changes = [];
  for (const comment of issue.comments) {
    if (comment.by === "orchestrator" && timeOf(comment.at) > base.at) changes.push("comment");
  }
  if (issue.ask && timeOf(issue.ask.at) > base.at) changes.push("ask");
  const statusAt = timeOf(issue.statusAt);
  const sig = statusSignature(issue);
  if (statusAt !== null ? statusAt > base.at : base.sig === undefined ? Boolean(issue.status || issue.prs.length) : base.sig !== sig) changes.push("status");
  return changes;
}

function snapshotStatuses() {
  return Object.fromEntries(app.data.issues.map((issue) => [issue.id, statusSignature(issue)]));
}

function markAllSeen() {
  app.seen = { at: new Date().toISOString(), statuses: snapshotStatuses(), marks: {} };
  app.filters.onlyNew = false;
  saveSeen();
  saveFilters();
  app.signature = "";
  renderAll();
}

function markIssueSeen(id) {
  const issue = app.byId.get(id);
  if (!issue || !app.seen || !changesOf(issue).length) return false;
  app.seen.marks[id] = { at: new Date().toISOString(), sig: statusSignature(issue) };
  saveSeen();
  return true;
}

function loadFilters() {
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(localStorage.getItem(storageKey(FILTER_KEY)) || "{}") };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

function saveFilters() {
  store(FILTER_KEY, app.filters);
}

function tracksOf() {
  if (!app.data) return [];
  return [...new Set(app.data.issues.map((issue) => issue.track).filter((track) => track && track !== "?"))].sort();
}

function applyMeta(meta) {
  app.meta = { name: "Board", slug: "board", epics: [], repos: {}, ...meta };
  els.brandName.textContent = app.meta.name;
  document.title = `${app.meta.name} glance board`;
  app.filters = loadFilters();
  app.seen = loadSeen();
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function relativeTime(iso) {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function absoluteTime(iso) {
  return iso ? new Date(iso).toLocaleString() : "";
}

function toast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), isError ? 6000 : 2600);
}

async function api(path, body) {
  const response = await fetch(path, body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

const cardOf = (issue) => (issue.card && !issue.card.unreadable ? issue.card : null);
const riskOf = (issue) => {
  const risk = cardOf(issue)?.risk;
  return RISK_RANK[risk] === undefined ? "none" : risk;
};
const flagCount = (issue) => (cardOf(issue)?.assumes || []).filter((a) => a && a.flag).length;
const isOpen = (issue) => issue.state === "open";

function columnOf(issue) {
  if (issue.askOpen || issue.status === "needs-you") return "needs";
  if (!isOpen(issue) || issue.status === "done") return "done";
  if (issue.status === "in-progress" || issue.status === "pr-open") return "progress";
  if (issue.glance === "fix" || issue.glance === "question") return "questions";
  if (issue.glance === "ok") return issue.openBlockers.length ? "waiting" : "ready";
  return "glance";
}

function compareAsks(a, b) {
  const at = (issue) => (issue.askOpen ? timeOf(issue.ask.at) ?? 0 : Infinity);
  return at(a) - at(b) || compareIssues(a, b);
}

function compareIssues(a, b) {
  const risk = (RISK_RANK[riskOf(a)] ?? 3) - (RISK_RANK[riskOf(b)] ?? 3);
  if (risk) return risk;
  const unblocks = b.unblocksTotal - a.unblocksTotal;
  if (unblocks) return unblocks;
  const phase = a.phase - b.phase;
  if (phase) return phase;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function matchesFilters(issue) {
  const f = app.filters;
  if (f.tracks.length && !f.tracks.includes(issue.track)) return false;
  if (f.kinds.length && !f.kinds.includes(issue.kind)) return false;
  if (f.risks.length && !f.risks.includes(riskOf(issue))) return false;
  if (f.flag && !flagCount(issue)) return false;
  if (f.startable && !(isOpen(issue) && issue.openBlockers.length === 0)) return false;
  if (f.proposed.length && !f.proposed.includes(issue.proposed)) return false;
  if (f.onlyNew && !changesOf(issue).length) return false;
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const card = cardOf(issue);
    const haystack = [
      issue.id, `#${issue.num}`, issue.title, issue.labels.join(" "), issue.phaseName,
      card?.does, card?.skips, card?.riskWhy, (card?.touches || []).join(" "),
      (card?.assumes || []).map((a) => a?.text).join(" "), issue.proposed, issue.status, issue.ask?.text,
    ].join(" ").toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}

function buildColumns() {
  const columns = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
  let visible = 0;
  for (const issue of app.data.issues) {
    if (!matchesFilters(issue)) continue;
    visible += 1;
    columns[columnOf(issue)].push(issue);
  }
  for (const [key, list] of Object.entries(columns)) list.sort(key === "needs" ? compareAsks : compareIssues);
  app.columns = columns;
  els.visibleCount.textContent = `${visible} of ${app.data.issues.length} shown`;
}

function batchCandidates() {
  return (app.columns.glance || []).filter((issue) => {
    const card = cardOf(issue);
    return card && card.risk === "low" && flagCount(issue) === 0 && !issue.cardStale;
  });
}

function prLabel(url) {
  const match = String(url).match(/\/pull\/(\d+)/);
  return match ? `PR #${match[1]}` : "PR";
}

function prLinksHtml(issue, className) {
  return issue.prs.map((url) => `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(url)}">${escapeHtml(prLabel(url))} ↗</a>`).join("");
}

function tileHtml(issue) {
  const card = cardOf(issue);
  const risk = riskOf(issue);
  const flags = flagCount(issue);
  const comments = issue.comments.length;
  const lastBy = comments ? issue.comments[comments - 1].by : null;
  const mark = issue.glance ? `<span class="mark m-${issue.glance}" title="Marked ${issue.glance}">${MARKS[issue.glance]}</span>` : "";
  const foot = [`<span class="kind"><i></i>${issue.kind}</span>`];
  if (issue.proposed) foot.push(`<span class="chip prop" title="Proposed for the ${escapeHtml(issue.proposed)} run">▸ ${escapeHtml(issue.proposed)}</span>`);
  if (issue.status && issue.status !== "in-progress") foot.push(`<span class="chip st-${escapeHtml(issue.status)}">${escapeHtml(STATUS_LABELS[issue.status] || issue.status)}</span>`);
  if (issue.prs.length) foot.push(prLinksHtml(issue, "chip pr"));
  if (flags) foot.push(`<span class="chip warn" title="${flags} flagged assumption${flags > 1 ? "s" : ""}">⚠ ${flags}</span>`);
  if (isOpen(issue) && issue.openBlockers.length) foot.push(`<span class="chip" title="Open blockers: ${escapeHtml(issue.openBlockers.join(", "))}">${ICONS.lock}${issue.openBlockers.length}</span>`);
  if (comments) foot.push(`<span class="chip${lastBy === "orchestrator" ? " orch" : ""}" title="${comments} comment${comments > 1 ? "s" : ""}${lastBy === "orchestrator" ? ", last from orchestrator" : ""}">${ICONS.comment}${comments}</span>`);
  if (issue.cardStale) foot.push('<span class="chip stale" title="Issue changed after this card was written">stale card</span>');
  if (!card) foot.push(`<span class="chip nocard">${issue.card?.unreadable ? "card unreadable" : "no card yet"}</span>`);
  const classes = ["tile", `k-${issue.kind}`];
  if (!isOpen(issue) || issue.status === "done") classes.push("done");
  const fresh = changesOf(issue);
  const newDot = fresh.length ? `<span class="new-dot" title="New since you looked: ${escapeHtml([...new Set(fresh)].join(", "))}"></span>` : "";
  const ask = issue.askOpen ? `<div class="t-ask"><b>Ask</b> ${escapeHtml(issue.ask.text)}</div>` : "";
  if (issue.id === app.selectedId) classes.push("sel");
  if (issue.id === app.openId) classes.push("open-now");
  return `<article class="${classes.join(" ")}" data-id="${escapeHtml(issue.id)}" tabindex="${issue.id === app.selectedId ? 0 : -1}" role="button" aria-label="${escapeHtml(`${issue.id} ${issue.title}`)}">
    <div class="t-top">${newDot}<span class="t-id">${escapeHtml(issue.id)}</span><span class="t-meta" title="Track ${escapeHtml(issue.track)} · size ${escapeHtml(issue.size)} · phase ${issue.phase}">${escapeHtml(issue.track)} · ${escapeHtml(issue.size)}</span><span class="spacer"></span>${mark}${risk !== "none" ? `<span class="risk r-${risk}">${risk}</span>` : ""}</div>
    <div class="t-title">${escapeHtml(issue.title)}</div>
    ${ask}
    <div class="t-foot">${foot.join("")}</div>
  </article>`;
}

function renderBoard() {
  const scrolls = {};
  els.board.querySelectorAll(".col-list").forEach((list) => { scrolls[list.dataset.col] = list.scrollTop; });
  const hadFocus = document.activeElement?.classList?.contains("tile");
  const html = COLUMNS.map(({ key, title }) => {
    const list = app.columns[key];
    let batch = "";
    if (key === "glance") {
      const count = batchCandidates().length;
      batch = `<button type="button" class="btn batch" data-batch ${count ? "" : "disabled"} title="Mark ✓ every visible low-risk card with no ⚠ (stale cards excluded)">✓ low-risk (${count})</button>`;
    }
    const tiles = list.length ? list.map(tileHtml).join("") : '<div class="col-empty">Nothing here</div>';
    return `<section class="col" data-col="${key}" aria-label="${title}">
      <header class="col-head"><h2>${title}</h2><span class="count">${list.length}</span>${batch}</header>
      <div class="col-list" data-col="${key}">${tiles}</div>
    </section>`;
  }).join("");
  els.board.style.gridTemplateColumns = COLUMNS.map(({ key }) => {
    const weight = 1 + Math.min(2, app.columns[key].length / 24);
    return `minmax(${app.columns[key].length > 24 ? 280 : 140}px, ${weight.toFixed(2)}fr)`;
  }).join(" ");
  els.board.innerHTML = html;
  els.board.querySelectorAll(".col-list").forEach((list) => { list.scrollTop = scrolls[list.dataset.col] || 0; });
  if (!els.board.querySelector('.tile[tabindex="0"]')) {
    const first = els.board.querySelector(".tile");
    if (first) first.tabIndex = 0;
  }
  if (hadFocus && app.selectedId && !app.openId) focusTile(app.selectedId, false);
}

function renderHeader() {
  const open = app.data.issues.filter(isOpen);
  const counts = { ok: 0, fix: 0, question: 0 };
  open.forEach((issue) => { if (issue.glance) counts[issue.glance] += 1; });
  const glanced = counts.ok + counts.fix + counts.question;
  const pct = (n) => (open.length ? (100 * n) / open.length : 0);
  els.progress.innerHTML = `<span><b>${glanced}</b> / ${open.length} open glanced</span>
    <span class="bar" role="img" aria-label="${glanced} of ${open.length} glanced"><i class="b-ok" style="width:${pct(counts.ok)}%"></i><i class="b-fix" style="width:${pct(counts.fix)}%"></i><i class="b-q" style="width:${pct(counts.question)}%"></i></span>
    <span class="split"><span>✓ ${counts.ok}</span><span>✗ ${counts.fix}</span><span>? ${counts.question}</span><span>${app.data.cardCount} cards</span></span>`;
  renderSignals();
  renderRefreshed();
}

function renderSignals() {
  const batches = new Map();
  for (const issue of app.data.issues) {
    if (issue.proposed) batches.set(issue.proposed, (batches.get(issue.proposed) || 0) + 1);
  }
  const known = app.filters.proposed.filter((name) => batches.has(name));
  if (known.length !== app.filters.proposed.length) {
    app.filters.proposed = known;
    saveFilters();
  }
  let fresh = 0;
  let freshIssues = 0;
  for (const issue of app.data.issues) {
    const count = changesOf(issue).length;
    fresh += count;
    if (count) freshIssues += 1;
  }
  const since = app.seen ? ` title="Orchestrator comments, asks and status changes since ${escapeHtml(absoluteTime(app.seen.at))}"` : "";
  const newBtn = fresh
    ? `<button type="button" class="toggle new-toggle" data-signal="new" aria-pressed="${app.filters.onlyNew}"${since}><span class="new-dot"></span>${fresh} new on ${freshIssues} issue${freshIssues > 1 ? "s" : ""}</button><button type="button" class="link-btn" data-signal="seen">mark seen</button>`
    : `<span class="muted"${since}>nothing new</span>`;
  const chips = [...batches.entries()].sort().map(([name, count]) =>
    `<button type="button" class="toggle prop-toggle" data-signal="proposed" data-value="${escapeHtml(name)}" aria-pressed="${app.filters.proposed.includes(name)}">Proposed: ${escapeHtml(name)} (${count})</button>`).join("");
  els.signals.innerHTML = newBtn + chips;
}

function renderRefreshed() {
  if (!app.data) return;
  const at = app.data.refreshedAt;
  els.refreshed.textContent = at ? `GitHub ${relativeTime(at)}` : "GitHub not fetched yet";
  els.refreshed.title = at ? `Issues fetched ${absoluteTime(at)}` : "";
}

function renderFilters() {
  const seg = (container, values, selected, label) => {
    container.innerHTML = values.map((value) => `<button type="button" data-value="${value}" aria-pressed="${selected.includes(value)}"${label ? ` class="k-${value}"` : ""}>${label ? label(value) : value}</button>`).join("");
  };
  const tracks = tracksOf();
  seg(els.fTrack, tracks, app.filters.tracks);
  els.fTrack.hidden = !tracks.length;
  seg(els.fKind, KINDS, app.filters.kinds, (k) => `<span class="kind"><i></i>${k}</span>`);
  seg(els.fRisk, RISKS, app.filters.risks, (r) => (r === "none" ? "no card" : r));
  els.fFlag.setAttribute("aria-pressed", app.filters.flag);
  els.fStartable.setAttribute("aria-pressed", app.filters.startable);
  if (document.activeElement !== els.search) els.search.value = app.filters.q;
}

function renderAll() {
  if (!app.data) return;
  buildColumns();
  renderHeader();
  renderBoard();
  if (app.openId) renderDrawer(false);
}

function applyData(data) {
  const signature = JSON.stringify({ ...data, generatedAt: null });
  if (!app.meta) applyMeta(data.meta);
  app.data = data;
  app.byId = new Map(data.issues.map((issue) => [issue.id, issue]));
  if (!app.seen) {
    app.seen = { at: new Date().toISOString(), statuses: snapshotStatuses(), marks: {} };
    saveSeen();
  }
  if (signature === app.signature) {
    renderRefreshed();
    return;
  }
  app.signature = signature;
  renderFilters();
  renderAll();
}

async function loadData() {
  try {
    applyData(await api("/api/data"));
  } catch (error) {
    toast(`Could not load data: ${error.message}`, true);
  }
}

function columnIds(key) {
  return (app.columns[key] || []).map((issue) => issue.id);
}

function selectedColumn() {
  const issue = app.byId.get(app.selectedId);
  return issue ? columnOf(issue) : null;
}

function focusTile(id, scroll = true) {
  const tile = els.board.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
  if (!tile) return;
  els.board.querySelectorAll(".tile.sel").forEach((t) => { t.classList.remove("sel"); t.tabIndex = -1; });
  tile.classList.add("sel");
  tile.tabIndex = 0;
  tile.focus({ preventScroll: !scroll });
  if (scroll) tile.scrollIntoView({ block: "nearest" });
}

function select(id) {
  app.selectedId = id;
  focusTile(id);
}

function moveSelection(delta) {
  const key = selectedColumn();
  const ids = key ? columnIds(key) : [];
  if (!ids.length) {
    const first = COLUMNS.map((c) => columnIds(c.key)).find((list) => list.length);
    if (first) select(first[0]);
    return;
  }
  const index = ids.indexOf(app.selectedId);
  select(ids[Math.max(0, Math.min(ids.length - 1, index + delta))]);
}

function moveColumn(delta) {
  const keys = COLUMNS.map((c) => c.key);
  let index = keys.indexOf(selectedColumn());
  if (index < 0) index = 0;
  const current = columnIds(keys[index]);
  const row = Math.max(0, current.indexOf(app.selectedId));
  for (let step = index + delta; step >= 0 && step < keys.length; step += delta) {
    const ids = columnIds(keys[step]);
    if (ids.length) {
      select(ids[Math.min(row, ids.length - 1)]);
      return;
    }
  }
}

function openDrawer(id, fromColumn) {
  const issue = app.byId.get(id);
  if (!issue) {
    toast(`${id} is not on this board`, true);
    return;
  }
  const column = fromColumn || columnOf(issue);
  if (app.openId === null || app.flowColumn !== column || !app.flow.includes(id)) {
    app.flowColumn = column;
    app.flow = columnIds(column);
    if (!app.flow.includes(id)) app.flow = [id];
  }
  showIssue(id);
}

function showIssue(id) {
  const previous = app.openId;
  if (previous && previous !== id) app.drafts.set(previous, els.dComment.value);
  app.openId = id;
  app.selectedId = id;
  els.drawer.hidden = false;
  if (previous !== id) {
    els.dComment.value = app.drafts.get(id) || "";
    app.bodyOpen = false;
    app.drawerSignature = "";
    els.dScroll.scrollTop = 0;
  }
  renderDrawer(true);
  renderBoard();
  const tile = els.board.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
  tile?.scrollIntoView({ block: "nearest" });
  if (!els.drawer.contains(document.activeElement)) els.drawer.querySelector(".g-btn")?.focus({ preventScroll: true });
}

function closeDrawer() {
  if (!app.openId) return;
  app.drafts.set(app.openId, els.dComment.value);
  const id = app.openId;
  app.openId = null;
  els.drawer.hidden = true;
  renderBoard();
  focusTile(id);
}

function stepFlow(delta) {
  if (!app.openId || !app.flow.length) return;
  const index = app.flow.indexOf(app.openId);
  const next = app.flow[index + delta];
  if (next && app.byId.has(next)) showIssue(next);
}

function relChip(id, extra = "") {
  const issue = app.byId.get(id);
  const known = Boolean(issue);
  const closed = issue ? !isOpen(issue) : false;
  const kind = issue ? `k-${issue.kind}` : "";
  const title = issue ? issue.title : id;
  return `<button type="button" class="rel ${kind}${closed ? " closed" : ""}" data-open="${escapeHtml(id)}" title="${escapeHtml(title)}"${known ? "" : " disabled"}>${escapeHtml(id)}${extra}</button>`;
}

function cardHtml(issue) {
  const card = cardOf(issue);
  if (!card) {
    return `<div class="card-box missing">${issue.card?.unreadable ? "Card file exists but is not valid JSON yet." : "No card yet. An agent will write <code>data/cards/" + escapeHtml(issue.id) + ".json</code>."}</div>`;
  }
  const stale = issue.cardStale
    ? `<div class="stale-note">Stale card: written from the issue as of ${escapeHtml(absoluteTime(card.issueUpdatedAt))}; the issue changed ${escapeHtml(absoluteTime(issue.updatedAt))}.</div>`
    : "";
  const assumes = (card.assumes || []).filter(Boolean).map((a) => {
    const text = typeof a === "string" ? a : a.text;
    const flag = typeof a === "object" && a.flag;
    return `<li class="${flag ? "flag" : ""}">${escapeHtml(text)}</li>`;
  }).join("");
  const touches = (card.touches || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("");
  const risk = riskOf(issue);
  const rows = [
    ["Does", `<div class="c-does">${escapeHtml(card.does || "")}</div>`],
    ["Assumes", assumes ? `<ul class="assumes">${assumes}</ul>` : '<span class="muted">nothing listed</span>'],
    ["Touches", touches ? `<div class="touches">${touches}</div>` : '<span class="muted">nothing listed</span>'],
    ["Skips", `<div class="c-text">${escapeHtml(card.skips || "") || '<span class="muted">nothing listed</span>'}</div>`],
    ["Risk", `<div class="c-risk">${risk !== "none" ? `<span class="risk r-${risk}">${risk}</span>` : '<span class="muted">unrated</span>'}<span>${escapeHtml(card.riskWhy || "")}</span></div>`],
  ];
  return `${stale}<div class="card-box">${rows.map(([label, body]) => `<div class="c-row"><div class="c-label">${label}</div><div>${body}</div></div>`).join("")}</div>`;
}

function headHtml(issue) {
  const status = [];
  if (!isOpen(issue)) status.push('<span class="pill closed">closed</span>');
  if (issue.status) status.push(`<span class="pill st-${escapeHtml(issue.status)}">${escapeHtml(STATUS_LABELS[issue.status] || issue.status)}</span>`);
  if (issue.proposed) status.push(`<span class="pill prop">proposed: ${escapeHtml(issue.proposed)}</span>`);
  if (issue.prs.length) status.push(prLinksHtml(issue, "pill pr"));
  if (issue.glance) status.push(`<span class="pill">marked ${MARKS[issue.glance]} ${relativeTime(issue.glanceAt)}</span>`);
  return `<div class="d-ids k-${issue.kind}">
      <span class="t-id">${escapeHtml(issue.id)}</span>
      <a href="${escapeHtml(issue.url)}" target="_blank" rel="noopener">${escapeHtml(issue.repo)}#${issue.num} ↗</a>
      <span class="kind"><i></i>${issue.kind}</span>
      <span>Track ${escapeHtml(issue.track)}</span>
      <span>Phase ${issue.phase} · ${escapeHtml(issue.phaseName)}</span>
      <span>Size ${escapeHtml(issue.size)}</span>
      <span>${escapeHtml(issue.priority)}</span>
      <span class="d-status">${status.join("")}</span>
    </div>
    <h1 class="d-title">${escapeHtml(issue.title)}</h1>`;
}

function askHtml(issue) {
  if (!issue.ask) return "";
  const when = issue.ask.at ? `<span title="${escapeHtml(absoluteTime(issue.ask.at))}">${escapeHtml(relativeTime(issue.ask.at))}</span>` : "";
  return `<div class="ask-box${issue.askOpen ? "" : " answered"}">
      <div class="ask-meta"><b>${issue.askOpen ? "Orchestrator asks" : "Orchestrator asked · answered"}</b>${when}</div>
      <div class="ask-text">${escapeHtml(issue.ask.text)}</div>
    </div>`;
}

function placeComposer(issue) {
  const target = issue.askOpen ? els.dAsk : els.dComments;
  if (els.dComposer.parentElement !== target) target.appendChild(els.dComposer);
  els.dComment.placeholder = issue.askOpen
    ? "Reply to the orchestrator  (Enter sends, Shift+Enter newline)"
    : "Comment for the orchestrator  (Enter sends, Shift+Enter newline)";
}

function threadHtml(issue) {
  if (!issue.comments.length) return '<div class="muted" style="margin-bottom:8px">No comments yet.</div>';
  return `<div class="thread">${issue.comments.map((c) => `<div class="cmt by-${c.by === "orchestrator" ? "orchestrator" : "you"}">
      <div class="cmt-meta"><span class="cmt-by">${escapeHtml(c.by)}</span><span title="${escapeHtml(absoluteTime(c.at))}">${escapeHtml(relativeTime(c.at))}</span></div>
      <div class="cmt-text">${escapeHtml(c.text)}</div>
    </div>`).join("")}</div>`;
}

function relHtml(issue) {
  const blockers = issue.blockedBy.length
    ? issue.blockedBy.map((b) => relChip(b.id, b.state === "open" ? "" : "<small>closed</small>")).join("")
    : '<span class="none">none</span>';
  const unblocks = issue.unblocks.length ? issue.unblocks.map((id) => relChip(id)).join("") : '<span class="none">none</span>';
  const total = issue.unblocksTotal > issue.unblocks.length ? ` <span class="muted">· ${issue.unblocksTotal} transitively</span>` : "";
  const labels = issue.labels.map((l) => `<span>${escapeHtml(l)}</span>`).join("");
  return `<section class="d-sec rel-grid">
      <div><h3>Blocked by</h3><div class="rel-list">${blockers}</div></div>
      <div><h3>Unblocks${total}</h3><div class="rel-list">${unblocks}</div></div>
    </section>
    <section class="d-sec"><h3>Labels</h3><div class="meta-row"><div class="labels">${labels || '<span class="muted">none</span>'}</div>
      <a href="${escapeHtml(issue.url)}" target="_blank" rel="noopener">Open on GitHub ↗</a>
      ${issue.updatedAt ? `<span class="muted" title="${escapeHtml(absoluteTime(issue.updatedAt))}">updated ${relativeTime(issue.updatedAt)}</span>` : ""}</div></section>`;
}

function bodyHtml(issue) {
  const content = issue.body ? renderMarkdown(issue.body, issue.repo) : `<p class="muted">${issue.live ? "Empty body." : "Not fetched yet. Press Refresh."}</p>`;
  return `<details class="body-box"${app.bodyOpen ? " open" : ""}><summary>Issue body</summary><div class="md">${content}</div></details>`;
}

function renderDrawer(force) {
  const issue = app.byId.get(app.openId);
  if (!issue) {
    closeDrawer();
    return;
  }
  const index = app.flow.indexOf(issue.id);
  const columnTitle = COLUMNS.find((c) => c.key === app.flowColumn)?.title || "";
  els.dPos.textContent = index >= 0 ? `${index + 1} / ${app.flow.length} · ${columnTitle}` : columnTitle;
  els.dPrev.disabled = index <= 0;
  els.dNext.disabled = index < 0 || index >= app.flow.length - 1;
  const signature = JSON.stringify(issue);
  if (!force && signature === app.drawerSignature) return;
  app.drawerSignature = signature;
  els.dHead.innerHTML = headHtml(issue);
  els.dAskBox.innerHTML = askHtml(issue);
  els.dAsk.hidden = !issue.ask;
  placeComposer(issue);
  if (markIssueSeen(issue.id)) requestAnimationFrame(() => { renderSignals(); renderBoard(); });
  els.dGlance.querySelectorAll(".g-btn").forEach((button) => {
    const value = button.dataset.value || null;
    button.setAttribute("aria-pressed", value !== null && issue.glance === value);
  });
  els.dCard.innerHTML = cardHtml(issue);
  els.dThread.innerHTML = threadHtml(issue);
  els.dRel.innerHTML = relHtml(issue);
  els.dBody.innerHTML = bodyHtml(issue);
}

function patchLocal(ids, mutate) {
  for (const id of ids) {
    const issue = app.byId.get(id);
    if (issue) mutate(issue);
  }
  app.signature = "";
  renderAll();
}

async function setGlance(ids, value) {
  const before = ids.map((id) => [id, app.byId.get(id)?.glance, app.byId.get(id)?.glanceAt]);
  const at = new Date().toISOString();
  patchLocal(ids, (issue) => { issue.glance = value; issue.glanceAt = value ? at : null; });
  try {
    await api("/api/glance", ids.length === 1 ? { id: ids[0], value } : { ids, value });
  } catch (error) {
    before.forEach(([id, glance, glanceAt]) => {
      const issue = app.byId.get(id);
      if (issue) { issue.glance = glance; issue.glanceAt = glanceAt; }
    });
    app.signature = "";
    renderAll();
    toast(`Mark failed: ${error.message}`, true);
    return false;
  }
  loadData();
  return true;
}

async function sendComment() {
  const id = app.openId;
  const text = els.dComment.value.trim();
  if (!id || !text) return;
  els.dSend.disabled = true;
  try {
    await api("/api/comment", { id, text });
    els.dComment.value = "";
    app.drafts.delete(id);
    patchLocal([id], (issue) => { issue.comments = [...issue.comments, { by: "you", at: new Date().toISOString(), text }]; issue.askOpen = false; });
    loadData();
  } catch (error) {
    toast(`Comment failed: ${error.message}`, true);
  } finally {
    els.dSend.disabled = false;
  }
}

async function refresh() {
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Refreshing…";
  try {
    const data = await api("/api/refresh", {});
    applyData(data);
    toast(`Fetched ${data.issues.filter((i) => i.live).length} issues from GitHub`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Refresh";
  }
}

function confirmBatch() {
  const candidates = batchCandidates();
  if (!candidates.length) return;
  els.confirmTitle.textContent = `Mark ${candidates.length} issue${candidates.length > 1 ? "s" : ""} ✓ Looks right?`;
  els.confirmText.textContent = "Every visible tile in To glance with a low-risk card and no ⚠ assumption. Stale cards are left out.";
  els.confirmIds.textContent = candidates.map((issue) => issue.id).join("  ");
  els.confirm.returnValue = "";
  els.confirm.showModal();
  els.confirm.querySelector("#confirm-cancel").focus();
  els.confirm.onclose = async () => {
    if (els.confirm.returnValue !== "ok") return;
    const ok = await setGlance(candidates.map((issue) => issue.id), "ok");
    if (ok) toast(`Marked ${candidates.length} ✓`);
  };
}

function inlineMarkdown(text, repo) {
  const slots = [];
  const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  const safeUrl = (url) => (/^(https?:|mailto:|#|\/)/i.test(url) ? url : null);
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));
  out = out.replace(/!?\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (match, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    if (!href) return match;
    return hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${inlineMarkdown(label.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), repo)}</a>`);
  });
  out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => hold(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`));
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,:;)\]'"!?])/g, (_, lead, url) => lead + hold(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`));
  out = out.replace(/(^|[\s(])((?:([\w.-]+\/[\w.-]+))?#(\d+))\b/g, (match, lead, label, fullRepo, num) => {
    const targetRepo = fullRepo || repo;
    if (!targetRepo) return match;
    const prefix = app.meta.repos[targetRepo];
    const id = prefix ? `${prefix}${num}` : `${targetRepo}#${num}`;
    const known = app.byId.has(id);
    return lead + hold(`<a class="ref" href="https://github.com/${targetRepo}/issues/${num}" target="_blank" rel="noopener"${known ? ` data-open="${id}" title="${escapeHtml(app.byId.get(id).title)}"` : ""}>${label}</a>`);
  });
  out = out.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^\w])__([^_]+?)__(?!\w)/g, "$1<strong>$2</strong>");
  out = out.replace(/(^|[^*\w])\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^\w])_([^_\s](?:[^_]*?[^_\s])?)_(?!\w)/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+?)~~/g, "<del>$1</del>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[Number(n)]);
}

function renderMarkdown(source, repo) {
  const lines = source.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const html = [];
  let i = 0;
  const isBlank = (line) => !line || !line.trim();
  const listRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const startsBlock = (line) =>
    /^\s{0,3}(#{1,6}\s|```|~~~|>|(\*\s*){3,}$|(-\s*){3,}$|(_\s*){3,}$)/.test(line) || listRe.test(line);
  const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i += 1; continue; }

    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) { body.push(lines[i]); i += 1; }
      i += 1;
      html.push(`<pre><code${fence[2] ? ` data-lang="${escapeHtml(fence[2])}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const level = Math.min(6, heading[1].length + 1);
      html.push(`<h${level}>${inlineMarkdown(heading[2], repo)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) { html.push("<hr>"); i += 1; continue; }

    if (/^\s{0,3}>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) { quote.push(lines[i].replace(/^\s{0,3}>\s?/, "")); i += 1; }
      html.push(`<blockquote>${renderMarkdown(quote.join("\n"), repo)}</blockquote>`);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes("|")) { rows.push(splitRow(lines[i])); i += 1; }
      const cell = (tag, text, n) => `<${tag}${aligns[n] ? ` style="text-align:${aligns[n]}"` : ""}>${inlineMarkdown(text || "", repo)}</${tag}>`;
      html.push(`<table><thead><tr>${head.map((c, n) => cell("th", c, n)).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, n) => cell("td", r[n], n)).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }

    if (listRe.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const match = current.match(listRe);
        if (match) {
          items.push({ indent: match[1].replace(/\t/g, "    ").length, ordered: /\d/.test(match[2]), start: parseInt(match[2], 10), text: match[3] });
          i += 1;
          continue;
        }
        if (isBlank(current)) {
          const next = lines[i + 1];
          if (next !== undefined && (listRe.test(next) || /^\s{2,}\S/.test(next))) { i += 1; continue; }
          break;
        }
        if (/^\s+\S/.test(current) || !startsBlock(current)) {
          if (!items.length) break;
          items[items.length - 1].text += "\n" + current.trim();
          i += 1;
          continue;
        }
        break;
      }
      html.push(renderList(items, repo));
      continue;
    }

    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !(para.length && startsBlock(lines[i]))) {
      if (para.length === 0 && startsBlock(lines[i])) break;
      para.push(lines[i].trim());
      i += 1;
    }
    if (!para.length) { para.push(lines[i].trim()); i += 1; }
    html.push(`<p>${para.map((p) => inlineMarkdown(p, repo)).join("<br>")}</p>`);
  }
  return html.join("\n");
}

function renderList(items, repo) {
  let index = 0;
  const build = (indent) => {
    const first = items[index];
    const tag = first.ordered ? "ol" : "ul";
    const start = first.ordered && first.start !== 1 ? ` start="${first.start}"` : "";
    const parts = [];
    while (index < items.length && items[index].indent >= indent) {
      const item = items[index];
      if (item.indent > indent && parts.length) {
        parts[parts.length - 1] = parts[parts.length - 1].replace(/<\/li>$/, `${build(item.indent)}</li>`);
        continue;
      }
      index += 1;
      const task = item.text.match(/^\[([ xX])\]\s+([\s\S]*)$/);
      const body = (task ? task[2] : item.text).split("\n").map((t) => inlineMarkdown(t, repo)).join("<br>");
      parts.push(task
        ? `<li class="task"><input type="checkbox" disabled${task[1] !== " " ? " checked" : ""}>${body}</li>`
        : `<li>${body}</li>`);
    }
    return `<${tag}${start}>${parts.join("")}</${tag}>`;
  };
  const out = [];
  while (index < items.length) out.push(build(items[index].indent));
  return out.join("");
}

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function onKeyDown(event) {
  if (els.confirm.open) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;

  if (target === els.dComment) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendComment();
    } else if (event.key === "Escape") {
      event.preventDefault();
      els.dComment.blur();
      els.drawer.querySelector(".g-btn")?.focus();
    }
    return;
  }
  if (target === els.search) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (els.search.value) {
        els.search.value = "";
        app.filters.q = "";
        saveFilters();
        renderAll();
      } else {
        els.search.blur();
      }
    } else if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      els.search.blur();
      const first = COLUMNS.map((c) => columnIds(c.key)).find((list) => list.length);
      if (first) select(first[0]);
    }
    return;
  }
  if (isTyping(target)) return;

  if (event.key === "/") {
    event.preventDefault();
    els.search.focus();
    els.search.select();
    return;
  }

  if (app.openId) {
    if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; }
    if (event.key === "j" || event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); stepFlow(1); return; }
    if (event.key === "k" || event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); stepFlow(-1); return; }
    if (event.key in GLANCE_KEYS) { event.preventDefault(); setGlance([app.openId], GLANCE_KEYS[event.key]); return; }
    if (event.key === "c") { event.preventDefault(); els.dComment.focus(); return; }
    if (event.key === "o") { event.preventDefault(); const issue = app.byId.get(app.openId); if (issue?.url) window.open(issue.url, "_blank", "noopener"); return; }
    return;
  }

  if (event.key === "j" || event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); return; }
  if (event.key === "k" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); return; }
  if (event.key === "h" || event.key === "ArrowLeft") { event.preventDefault(); moveColumn(-1); return; }
  if (event.key === "l" || event.key === "ArrowRight") { event.preventDefault(); moveColumn(1); return; }
  if ((event.key === "Enter" || event.key === " ") && app.selectedId && app.byId.has(app.selectedId)) {
    event.preventDefault();
    openDrawer(app.selectedId);
    return;
  }
  if (event.key in GLANCE_KEYS && app.selectedId && target.classList?.contains("tile")) {
    event.preventDefault();
    setGlance([app.selectedId], GLANCE_KEYS[event.key]);
  }
}

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function bindEvents() {
  document.addEventListener("keydown", onKeyDown);
  els.board.addEventListener("click", (event) => {
    if (event.target.closest("[data-batch]")) { confirmBatch(); return; }
    if (event.target.closest("a[href]")) return;
    const tile = event.target.closest(".tile");
    if (!tile) return;
    const column = tile.closest(".col-list")?.dataset.col;
    app.flow = [];
    openDrawer(tile.dataset.id, column);
  });
  els.board.addEventListener("focusin", (event) => {
    const tile = event.target.closest(".tile");
    if (tile && tile.dataset.id !== app.selectedId && !app.openId) {
      app.selectedId = tile.dataset.id;
      els.board.querySelectorAll(".tile.sel").forEach((t) => { t.classList.remove("sel"); t.tabIndex = -1; });
      tile.classList.add("sel");
      tile.tabIndex = 0;
    }
  });
  els.drawer.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open]");
    if (open && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      app.flow = [];
      openDrawer(open.dataset.open);
      return;
    }
    const glance = event.target.closest(".g-btn");
    if (glance && app.openId) setGlance([app.openId], glance.dataset.value || null);
  });
  els.dBody.addEventListener("toggle", (event) => {
    if (event.target.matches("details.body-box")) app.bodyOpen = event.target.open;
  }, true);
  els.signals.addEventListener("click", (event) => {
    const button = event.target.closest("[data-signal]");
    if (!button) return;
    const signal = button.dataset.signal;
    if (signal === "seen") { markAllSeen(); return; }
    if (signal === "new") app.filters.onlyNew = !app.filters.onlyNew;
    if (signal === "proposed") app.filters.proposed = toggleIn(app.filters.proposed, button.dataset.value);
    saveFilters();
    renderAll();
  });
  els.dComment.addEventListener("input", () => { if (app.openId) app.drafts.set(app.openId, els.dComment.value); });
  els.dSend.addEventListener("click", sendComment);
  els.dPrev.addEventListener("click", () => stepFlow(-1));
  els.dNext.addEventListener("click", () => stepFlow(1));
  els.dClose.addEventListener("click", closeDrawer);
  els.refreshBtn.addEventListener("click", refresh);

  let searchTimer;
  els.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { app.filters.q = els.search.value; saveFilters(); renderAll(); }, 80);
  });
  const segHandler = (field) => (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    app.filters[field] = toggleIn(app.filters[field], button.dataset.value);
    saveFilters();
    renderFilters();
    renderAll();
  };
  els.fTrack.addEventListener("click", segHandler("tracks"));
  els.fKind.addEventListener("click", segHandler("kinds"));
  els.fRisk.addEventListener("click", segHandler("risks"));
  els.fFlag.addEventListener("click", () => { app.filters.flag = !app.filters.flag; saveFilters(); renderFilters(); renderAll(); });
  els.fStartable.addEventListener("click", () => { app.filters.startable = !app.filters.startable; saveFilters(); renderFilters(); renderAll(); });
  els.fClear.addEventListener("click", () => {
    app.filters = { ...EMPTY_FILTERS };
    els.search.value = "";
    saveFilters();
    renderFilters();
    renderAll();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadData(); });
  setInterval(() => { if (!document.hidden) loadData(); }, POLL_MS);
  setInterval(renderRefreshed, 30000);
}

renderFilters();
bindEvents();
loadData();
