#!/bin/bash
# Moves every game that uses the kit to a released version, tests each one, and commits the ones
# that pass. Pushing is off unless asked, because pushing a game's main deploys it to production.
#
# Usage: scripts/upgrade-games.sh 0.3.4 [--only invasion,barrage] [--why "which fixes ..."] [--push]
#        scripts/upgrade-games.sh --list    shows the games it finds and their kit versions
#
# Before testing a game it stops that game's own dev servers, on any port, because Playwright
# would reuse one and test the kit it was started with. --keep-servers leaves them running, and
# then a game whose test port is busy is skipped.
#
# A game is any folder beside the kit whose package.json depends on github:chfields/8bit-kit.
# Set GAMES_ROOT to look somewhere else. Each game must be on main with a clean tree.
set -u

REPO="chfields/8bit-kit"
TEAM_ID="${VERCEL_TEAM_ID:-team_xKlg6l2CLvD3JKSoneruKtbu}"
KIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GAMES_ROOT="${GAMES_ROOT:-$(dirname "$KIT_DIR")}"
DEPLOY_WAIT_SECONDS=600

usage() {
  echo "Usage: scripts/upgrade-games.sh X.Y.Z [--only name,name] [--why \"text\"] [--push]" >&2
  echo "       [--keep-servers]   leave the games' dev servers running" >&2
  echo "       scripts/upgrade-games.sh --list" >&2
  exit 1
}

version=""
only=""
why=""
push=false
list=false
keep_servers=false
while [ $# -gt 0 ]; do
  case "$1" in
    --only) only="${2:-}"; shift 2 || usage ;;
    --why) why="${2:-}"; shift 2 || usage ;;
    --push) push=true; shift ;;
    --list) list=true; shift ;;
    --keep-servers) keep_servers=true; shift ;;
    -h|--help) usage ;;
    [0-9]*.[0-9]*.[0-9]*) version="$1"; shift ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

# The games beside the kit, one folder per line.
find_games() {
  for package in "$GAMES_ROOT"/*/package.json; do
    local dir; dir=$(dirname "$package")
    [ "$dir" = "$KIT_DIR" ] && continue
    grep -q "\"github:$REPO#" "$package" && echo "$dir"
  done
}

if $list; then
  find_games | while read -r dir; do
    printf "%-16s %s\n" "$(basename "$dir")" "$(grep -o "github:$REPO#[^\"]*" "$dir/package.json")"
  done
  exit 0
fi
[ -n "$version" ] || usage
tag="v$version"

tag_sha=$(git ls-remote "https://github.com/$REPO.git" "refs/tags/$tag" | cut -f1)
if [ -z "$tag_sha" ]; then
  echo "Stopping: $tag isn't on GitHub. Release and push it first." >&2
  exit 1
fi

logs="${TMPDIR:-/tmp}"; logs="${logs%/}/8bit-kit-upgrade-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$logs"
echo "Upgrading to $REPO#$tag ($tag_sha). Logs: $logs"

# One line per game for the table at the end: name|result|unit|browser|commit|deploy
summary=""
add_row() { summary="$summary$1|$2|$3|$4|$5|$6"$'\n'; }

# The tests' passed and total counts, from vitest's or Playwright's output.
vitest_counts() {
  python3 -I -c '
import re, sys
text = re.sub(r"\x1b\[[0-9;]*m", "", open(sys.argv[1]).read())
m = re.search(r"Tests\s+(.*?)\(\s*(\d+)\s*\)", text)
passed = re.search(r"(\d+) passed", m.group(1)) if m else None
print(f"{passed.group(1) if passed else 0}/{m.group(2)}" if m else "?")
' "$1"
}
playwright_counts() {
  python3 -I -c '
import re, sys
text = re.sub(r"\x1b\[[0-9;]*m", "", open(sys.argv[1]).read())
count = lambda word: sum(int(n) for n in re.findall(r"^\s*(\d+) " + word + r"\b", text, re.M))
passed = count("passed")
total = passed + count("failed") + count("flaky")
print(f"{passed}/{total}" if total else "?")
' "$1"
}

# The listening processes started from this folder: the game's own dev servers.
servers_of() {
  local dir="$1" pid
  for pid in $(lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u); do
    [ "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" = "$dir" ] && echo "$pid"
  done
}

stop_servers() {
  local dir="$1" pids pid ports
  pids=$(servers_of "$dir")
  [ -z "$pids" ] && return
  for pid in $pids; do
    ports=$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {sub(/.*:/, "", $9); print $9}' | sort -u | tr '\n' ' ')
    echo "   stopping its dev server (pid $pid, port ${ports% })"
    kill "$pid" 2>/dev/null
  done
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -z "$(servers_of "$dir")" ] && return
    sleep 0.5
  done
  for pid in $(servers_of "$dir"); do kill -9 "$pid" 2>/dev/null; done
}

# Puts a game back as it was at its last commit.
roll_back() {
  git checkout -q -- package.json package-lock.json
  npm ci --no-audit --no-fund >>"$1" 2>&1
}

# Waits for Vercel to build this commit, then checks the live page loads the same script as dist.
check_deploy() {
  local sha="$1" repo_name="$2" log="$3"
  local started; started=$(date +%s)
  local found=""
  while [ $(( $(date +%s) - started )) -lt $DEPLOY_WAIT_SECONDS ]; do
    found=$(vercel api "/v6/deployments?teamId=$TEAM_ID&limit=30" 2>>"$log" | python3 -I -c '
import json, sys
sha, repo = sys.argv[1], sys.argv[2]
for d in json.load(sys.stdin).get("deployments", []):
    meta = d.get("meta") or {}
    if meta.get("githubCommitSha") == sha and meta.get("githubCommitRepo", repo).lower() == repo.lower():
        print(d.get("state") or d.get("readyState"), d.get("name"))
        break
' "$sha" "$repo_name")
    case "$found" in
      READY*|ERROR*|CANCELED*) break ;;
    esac
    sleep 10
  done
  local state="${found%% *}" project="${found#* }"
  if [ "$state" != "READY" ]; then
    echo "deploy ${state:-not found}"
    return 1
  fi
  local local_js live_js
  local_js=$(ls dist/assets/index-*.js 2>/dev/null | head -1 | xargs basename 2>/dev/null)
  live_js=$(curl -s "https://$project.vercel.app/" | grep -o 'assets/index-[^"]*\.js' | head -1 | xargs basename 2>/dev/null)
  if [ -n "$local_js" ] && [ "$local_js" = "$live_js" ]; then
    echo "live, $live_js"
  else
    echo "ready, but live page has ${live_js:-no script}, local ${local_js:-none}"
    return 1
  fi
}

upgrade_game() {
  local dir="$1" name; name=$(basename "$dir")
  local log="$logs/$name.log"
  cd "$dir" || return
  echo
  echo "== $name"

  if grep -q "\"github:$REPO#$tag\"" package.json; then
    echo "   already on $tag"
    add_row "$name" "already on $tag" "" "" "" ""
    return
  fi
  if [ "$(git branch --show-current)" != "main" ]; then
    echo "   skipped: not on main"
    add_row "$name" "skipped: not on main" "" "" "" ""
    return
  fi
  if [ -n "$(git status --porcelain)" ]; then
    echo "   skipped: uncommitted changes"
    add_row "$name" "skipped: uncommitted changes" "" "" "" ""
    return
  fi
  # Playwright reuses a server already on the test port, which may be serving the old kit.
  $keep_servers || stop_servers "$dir"
  local port
  port=$(grep -o 'url: *"https\?://localhost:[0-9]*' playwright.config.ts 2>/dev/null | grep -o '[0-9]*$' | head -1)
  if [ -n "$port" ] && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "   skipped: port $port is in use, so the tests would reuse that server. Stop it first."
    add_row "$name" "skipped: port $port in use" "" "" "" ""
    return
  fi

  echo "   installing $tag"
  if ! npm install --no-audit --no-fund "github:$REPO#$tag" >>"$log" 2>&1; then
    roll_back "$log"
    add_row "$name" "failed: install" "" "" "" ""
    return
  fi
  local installed
  installed=$(node -p "require('./node_modules/8bit-kit/package.json').version" 2>/dev/null)
  if ! grep -q "\"github:$REPO#$tag\"" package.json || [ "$installed" != "$version" ] ||
    ! grep -q "$tag_sha" package-lock.json; then
    echo "   failed: the installed kit isn't $tag ($installed)"
    roll_back "$log"
    add_row "$name" "failed: wrong kit installed" "" "" "" ""
    return
  fi

  echo "   building"
  if ! npm run build >>"$log" 2>&1; then
    roll_back "$log"
    add_row "$name" "failed: build" "" "" "" ""
    return
  fi

  local unit="none"
  if node -e "process.exit(require('./package.json').scripts['test:unit'] ? 0 : 1)"; then
    echo "   unit tests"
    local unit_log="$logs/$name-unit.log"
    if npm run test:unit >"$unit_log" 2>&1; then
      unit=$(vitest_counts "$unit_log")
    else
      unit=$(vitest_counts "$unit_log")
      roll_back "$log"
      add_row "$name" "failed: unit tests" "$unit" "" "" ""
      return
    fi
  fi

  echo "   browser tests"
  # A fresh dependency cache, so the dev server can't serve the kit it had before.
  rm -rf node_modules/.vite
  local e2e_log="$logs/$name-browser.log"
  local browser
  if npm test >"$e2e_log" 2>&1; then
    browser=$(playwright_counts "$e2e_log")
  else
    browser=$(playwright_counts "$e2e_log")
    roll_back "$log"
    add_row "$name" "failed: browser tests" "$unit" "$browser" "" ""
    return
  fi

  local message="Use 8bit-kit $tag"
  [ -n "$why" ] && message="$message, $why"
  git add package.json package-lock.json
  if ! git commit -q -m "$message" >>"$log" 2>&1; then
    roll_back "$log"
    add_row "$name" "failed: commit" "$unit" "$browser" "" ""
    return
  fi
  local sha; sha=$(git rev-parse HEAD)
  echo "   committed ${sha:0:7}"

  local deploy="not pushed"
  if $push; then
    local remote
    remote=$(git remote get-url origin 2>/dev/null)
    if [ -z "$remote" ]; then
      deploy="no GitHub remote"
    elif git push -q origin main >>"$log" 2>&1; then
      echo "   pushed, waiting for the deploy"
      local repo_name; repo_name=$(basename "$remote" .git)
      deploy=$(check_deploy "$sha" "$repo_name" "$log")
    else
      deploy="push failed"
    fi
    echo "   $deploy"
  fi
  add_row "$name" "upgraded" "$unit" "$browser" "${sha:0:7}" "$deploy"
}

found_any=false
for dir in $(find_games); do
  name=$(basename "$dir")
  if [ -n "$only" ]; then
    match=false
    for wanted in $(echo "$only" | tr ',' ' '); do
      case "$(echo "$name" | tr 'A-Z' 'a-z')" in
        *"$(echo "$wanted" | tr 'A-Z' 'a-z')"*) match=true ;;
      esac
    done
    $match || continue
  fi
  found_any=true
  upgrade_game "$dir"
  cd "$KIT_DIR" || exit 1
done

if ! $found_any; then
  echo "No games found in $GAMES_ROOT${only:+ matching $only}." >&2
  exit 1
fi

echo
printf "%s" "$summary" | python3 -I -c '
import sys
rows = [line.split("|") for line in sys.stdin.read().splitlines() if line]
head = ["game", "result", "unit", "browser", "commit", "deploy"]
widths = [max(len(r[i]) for r in rows + [head]) for i in range(len(head))]
for r in [head] + rows:
    print("  ".join(cell.ljust(w) for cell, w in zip(r, widths)).rstrip())
'
echo
echo "Logs: $logs"
# Fails if any game failed, so a caller can tell.
! printf "%s" "$summary" | grep -q "|failed"
