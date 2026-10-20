#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
STATIC = Path(__file__).resolve().parent / "static"
ROOT = None
DATA = None
CARDS = None
PLAN_FILE = None
ISSUES_FILE = None
STATE_FILE = None
EVENTS_FILE = None
MAP_NOTES_FILE = None
META = {}
EPICS = []
KIND_LABELS = {"ready-for-agent": "agent", "ready-for-human": "human", "needs-grilling": "grill"}
GLANCE_VALUES = {"ok", "fix", "question", None}
MAX_BODY = 1_000_000

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
}

SUB_ISSUES_QUERY = """
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      subIssues(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title state body updatedAt url
          repository { nameWithOwner }
          subIssuesSummary { total }
          labels(first: 30) { nodes { name } }
          blockedBy(first: 50) { nodes { number state repository { nameWithOwner } } }
        }
      }
    }
  }
}
"""

state_lock = threading.Lock()
refresh_lock = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_time(value):
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def issue_id(name_with_owner, number):
    prefix = META["repos"].get(name_with_owner)
    return f"{prefix}{number}" if prefix else f"{name_with_owner}#{number}"


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return default


def write_json_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def append_events(events):
    if not events:
        return
    lines = "".join(json.dumps(event, ensure_ascii=False) + "\n" for event in events)
    with open(EVENTS_FILE, "a", encoding="utf-8") as handle:
        handle.write(lines)
        handle.flush()
        os.fsync(handle.fileno())


def gh_graphql(owner, repo, number, after):
    args = ["gh", "api", "graphql", "-f", f"query={SUB_ISSUES_QUERY}",
            "-f", f"owner={owner}", "-f", f"repo={repo}", "-F", f"number={number}"]
    if after:
        args += ["-f", f"after={after}"]
    result = subprocess.run(args, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip() or "gh api graphql failed")
    payload = json.loads(result.stdout)
    if payload.get("errors"):
        raise RuntimeError("; ".join(error.get("message", "") for error in payload["errors"]))
    return payload["data"]["repository"]["issue"]["subIssues"]


def fetch_issues():
    issues = {}
    queue = list(EPICS)
    seen = set()
    while queue:
        owner, repo, number = queue.pop(0)
        if (owner, repo, number) in seen:
            continue
        seen.add((owner, repo, number))
        after = None
        while True:
            page = gh_graphql(owner, repo, number, after)
            for node in page["nodes"]:
                repo_name = node["repository"]["nameWithOwner"]
                key = issue_id(repo_name, node["number"])
                issues[key] = {
                    "id": key,
                    "repo": repo_name,
                    "num": node["number"],
                    "title": node["title"],
                    "state": node["state"].lower(),
                    "body": node["body"] or "",
                    "url": node["url"],
                    "labels": [label["name"] for label in node["labels"]["nodes"]],
                    "updatedAt": node["updatedAt"],
                    "parent": f"{owner}/{repo}#{number}",
                    "blockedBy": [
                        {
                            "id": issue_id(b["repository"]["nameWithOwner"], b["number"]),
                            "repo": b["repository"]["nameWithOwner"],
                            "num": b["number"],
                            "state": b["state"].lower(),
                        }
                        for b in node["blockedBy"]["nodes"]
                    ],
                }
                if (node.get("subIssuesSummary") or {}).get("total"):
                    child_owner, child_repo = repo_name.split("/", 1)
                    queue.append((child_owner, child_repo, node["number"]))
            if not page["pageInfo"]["hasNextPage"]:
                break
            after = page["pageInfo"]["endCursor"]
    return issues


def refresh_issues():
    with refresh_lock:
        issues = fetch_issues()
        payload = {"refreshedAt": now_iso(), "issues": issues}
        write_json_atomic(ISSUES_FILE, payload)
        return payload


def read_cards():
    cards = {}
    if not CARDS.is_dir():
        return cards
    for path in CARDS.glob("*.json"):
        card = read_json(path, None)
        if isinstance(card, dict):
            cards[card.get("id") or path.stem] = card
        else:
            cards[path.stem] = {"id": path.stem, "unreadable": True}
    return cards


def kind_from_labels(labels):
    for label in labels or []:
        if label in KIND_LABELS:
            return KIND_LABELS[label]
    return None


def pr_links(entry):
    links = []
    candidates = [entry.get("pr")] + (entry.get("prs") if isinstance(entry.get("prs"), list) else [])
    for link in candidates:
        if isinstance(link, str) and link.strip() and link.strip() not in links:
            links.append(link.strip())
    return links


def ask_of(entry):
    ask = entry.get("ask")
    if isinstance(ask, dict) and isinstance(ask.get("text"), str) and ask["text"].strip():
        return {"text": ask["text"], "at": ask.get("at")}
    return None


def ask_is_open(entry):
    ask = ask_of(entry)
    if not ask:
        return False
    asked = parse_time(ask["at"])
    for comment in entry.get("comments") or []:
        if not isinstance(comment, dict) or comment.get("by") != "you":
            continue
        replied = parse_time(comment.get("at"))
        if asked is None or (replied and replied > asked):
            return False
    return True


def count_descendants(graph, start, memo, visiting):
    if start in memo:
        return memo[start]
    visiting.add(start)
    reached = set()
    for child in graph.get(start, ()):
        if child in visiting:
            continue
        reached.add(child)
        reached |= count_descendants(graph, child, memo, visiting)
    visiting.discard(start)
    memo[start] = reached
    return reached


def build_data():
    plan = read_json(PLAN_FILE, [])
    if not isinstance(plan, list):
        plan = []
    live = read_json(ISSUES_FILE, {})
    live_issues = live.get("issues", {}) if isinstance(live, dict) else {}
    state = read_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    cards = read_cards()
    plan_by_id = {record["id"]: record for record in plan}

    ids = list(plan_by_id)
    ids += [key for key in live_issues if key not in plan_by_id]

    records = {}
    for key in ids:
        planned = plan_by_id.get(key, {})
        current = live_issues.get(key)
        record = {
            "id": key,
            "repo": (current or planned).get("repo"),
            "num": (current or planned).get("num"),
            "title": (current or planned).get("title", key),
            "url": (current or planned).get("url"),
            "labels": (current or planned).get("labels", []),
            "kind": kind_from_labels((current or {}).get("labels")) or planned.get("kind") or "agent",
            "phase": planned.get("phase", 99),
            "phaseName": planned.get("phaseName", "Unplanned"),
            "size": planned.get("size", "?"),
            "priority": planned.get("priority", "?"),
            "track": planned.get("track", "?"),
            "inPlan": bool(planned),
            "live": current is not None,
            "state": current["state"] if current else "open",
            "body": current["body"] if current else "",
            "updatedAt": current["updatedAt"] if current else None,
        }
        if current:
            record["blockedBy"] = current["blockedBy"]
        else:
            record["blockedBy"] = [{"id": b, "state": "open"} for b in planned.get("blockedBy", [])]
        record["openBlockers"] = [b["id"] for b in record["blockedBy"] if b["state"] == "open"]

        card = cards.get(key)
        record["card"] = card
        stale = False
        if card and not card.get("unreadable"):
            card_time = parse_time(card.get("issueUpdatedAt"))
            issue_time = parse_time(record["updatedAt"])
            stale = bool(card_time and issue_time and card_time < issue_time)
        record["cardStale"] = stale

        entry = state.get(key) if isinstance(state.get(key), dict) else {}
        record["glance"] = entry.get("glance")
        record["glanceAt"] = entry.get("glanceAt")
        record["status"] = entry.get("status")
        record["statusAt"] = entry.get("statusAt")
        record["comments"] = [c for c in entry.get("comments") or [] if isinstance(c, dict)]
        record["proposed"] = entry.get("proposed") if isinstance(entry.get("proposed"), str) and entry.get("proposed") else None
        record["prs"] = pr_links(entry)
        record["ask"] = ask_of(entry)
        record["askOpen"] = ask_is_open(entry)
        records[key] = record

    graph = {key: [] for key in records}
    for record in records.values():
        if record["state"] != "open":
            continue
        for blocker in record["openBlockers"]:
            if blocker in graph:
                graph[blocker].append(record["id"])
    memo = {}
    for key, record in records.items():
        record["unblocks"] = sorted(graph[key])
        record["unblocksTotal"] = len(count_descendants(graph, key, memo, set()))

    return {
        "meta": META,
        "generatedAt": now_iso(),
        "refreshedAt": live.get("refreshedAt") if isinstance(live, dict) else None,
        "cardCount": len(cards),
        "issues": list(records.values()),
    }


def mutate_state(mutator):
    with state_lock:
        state = read_json(STATE_FILE, {})
        if not isinstance(state, dict):
            state = {}
        events = mutator(state)
        write_json_atomic(STATE_FILE, state)
        append_events(events)


def state_entry(state, key):
    entry = state.get(key)
    if not isinstance(entry, dict):
        entry = {"glance": None, "glanceAt": None, "status": None, "comments": []}
        state[key] = entry
    entry.setdefault("glance", None)
    entry.setdefault("glanceAt", None)
    entry.setdefault("status", None)
    entry.setdefault("comments", [])
    return entry


class BadRequest(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    server_version = "board/1"

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.log_date_time_string()} {self.address_string()} {fmt % args}\n")

    def log_request(self, code="-", size="-"):
        if self.command == "GET" and isinstance(code, int) and code < 400:
            return
        super().log_request(code, size)

    def send_json(self, value, status=HTTPStatus.OK):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path):
        try:
            body = path.read_bytes()
        except (FileNotFoundError, IsADirectoryError):
            self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", STATIC_TYPES.get(path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise BadRequest("body too large")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            value = json.loads(raw or b"{}")
        except json.JSONDecodeError as error:
            raise BadRequest(f"invalid JSON: {error}")
        if not isinstance(value, dict):
            raise BadRequest("expected a JSON object")
        return value

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/data":
            self.send_json(build_data())
        elif path in ("/", "/index.html"):
            self.send_file(STATIC / "index.html")
        elif path in ("/map", "/map.html"):
            self.send_file(STATIC / "map.html")
        elif path == "/data/plan.json":
            self.send_file(PLAN_FILE)
        elif path == "/data/map-notes.json":
            self.send_file(MAP_NOTES_FILE)
        elif path.startswith("/static/"):
            target = (STATIC / path[len("/static/"):]).resolve()
            if STATIC not in target.parents:
                self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
                return
            self.send_file(target)
        else:
            self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            body = self.read_body()
            if path == "/api/glance":
                self.handle_glance(body)
            elif path == "/api/comment":
                self.handle_comment(body)
            elif path == "/api/refresh":
                self.handle_refresh()
            else:
                self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        except BadRequest as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def handle_glance(self, body):
        value = body.get("value")
        if value not in GLANCE_VALUES:
            raise BadRequest("value must be ok, fix, question or null")
        ids = body.get("ids") if isinstance(body.get("ids"), list) else [body.get("id")]
        ids = [key for key in ids if isinstance(key, str) and key]
        if not ids:
            raise BadRequest("id is required")
        at = now_iso()

        def apply(state):
            events = []
            for key in ids:
                entry = state_entry(state, key)
                entry["glance"] = value
                entry["glanceAt"] = at if value else None
                events.append({"at": at, "id": key, "type": "glance", "value": value})
            return events

        mutate_state(apply)
        self.send_json({"ok": True, "at": at, "ids": ids, "value": value})

    def handle_comment(self, body):
        key = body.get("id")
        text = body.get("text")
        if not isinstance(key, str) or not key:
            raise BadRequest("id is required")
        if not isinstance(text, str) or not text.strip():
            raise BadRequest("text is required")
        text = text.strip()
        at = now_iso()

        def apply(state):
            entry = state_entry(state, key)
            kind = "reply" if ask_is_open(entry) else "comment"
            entry["comments"].append({"by": "you", "at": at, "text": text})
            return [{"at": at, "id": key, "type": kind, "value": text}]

        mutate_state(apply)
        self.send_json({"ok": True, "at": at})

    def handle_refresh(self):
        try:
            refresh_issues()
        except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, TypeError) as error:
            self.send_json({"error": f"refresh failed: {error}"}, HTTPStatus.BAD_GATEWAY)
            return
        self.send_json(build_data())


def initial_refresh():
    try:
        refresh_issues()
        sys.stderr.write(f"{now_iso()} initial refresh wrote {ISSUES_FILE}\n")
    except Exception as error:
        sys.stderr.write(f"{now_iso()} initial refresh failed: {error}\n")


def parse_epic(value):
    repo, sep, number = str(value).partition("#")
    owner, slash, name = repo.partition("/")
    if not (sep and slash and owner and name and number.isdigit()):
        raise SystemExit(f"meta.json: epic {value!r} must look like owner/repo#123")
    return owner, name, int(number)


def load_meta(root):
    raw = read_json(root / "meta.json", None)
    if not isinstance(raw, dict):
        raise SystemExit(f"{root / 'meta.json'} is missing or not a JSON object")
    slug = raw.get("slug") or root.name
    repos = raw.get("repos") if isinstance(raw.get("repos"), dict) else {}
    epics = raw.get("epics") if isinstance(raw.get("epics"), list) else []
    return {
        "name": raw.get("name") or slug,
        "slug": slug,
        "port": int(raw.get("port") or DEFAULT_PORT),
        "epics": [str(epic) for epic in epics],
        "repos": {str(repo): str(prefix) for repo, prefix in repos.items()},
    }


def configure(board_dir):
    global ROOT, DATA, CARDS, PLAN_FILE, ISSUES_FILE, STATE_FILE, EVENTS_FILE, MAP_NOTES_FILE, META, EPICS
    ROOT = Path(board_dir).resolve()
    DATA = ROOT / "data"
    CARDS = DATA / "cards"
    PLAN_FILE = DATA / "plan.json"
    ISSUES_FILE = DATA / "issues.json"
    STATE_FILE = DATA / "state.json"
    EVENTS_FILE = DATA / "events.jsonl"
    MAP_NOTES_FILE = DATA / "map-notes.json"
    META = load_meta(ROOT)
    EPICS = [parse_epic(epic) for epic in META["epics"]]


def main():
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} <board-dir>")
    configure(sys.argv[1])
    CARDS.mkdir(parents=True, exist_ok=True)
    if not STATE_FILE.exists():
        write_json_atomic(STATE_FILE, {})
    EVENTS_FILE.touch(exist_ok=True)
    if not ISSUES_FILE.exists():
        threading.Thread(target=initial_refresh, daemon=True).start()
    server = ThreadingHTTPServer((HOST, META["port"]), Handler)
    server.daemon_threads = True
    sys.stderr.write(f"{now_iso()} {META['name']} board serving http://{HOST}:{META['port']}/ from {ROOT}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
