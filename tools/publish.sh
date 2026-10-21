#!/usr/bin/env bash
#
# KOZA LITERARY LIAISON — publish to GitHub Pages
# ===============================================
#
#   ./tools/publish.sh https://github.com/USERNAME/REPO.git
#
# That is the entire publish. The script works out the live address from the
# repository URL you give it, writes that address into every page, validates
# the build, and pushes. You do not edit a config file by hand.
#
#   https://github.com/ann/koza          ->  https://ann.github.io/koza
#   https://github.com/ann/ann.github.io ->  https://ann.github.io
#
# Safe by design:
#   · Refuses to run if validation fails, or if a credential file is present
#   · Detects a new repository vs one that already has history
#   · On an existing repository it works on a clone and overlays only the
#     site files — your README, other files and commit history all survive
#   · Commits only when something changed, so re-running is safe
#   · Never asks for, prints or stores a password or token
#
set -euo pipefail

REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  cat <<'EOF'
Usage: ./tools/publish.sh https://github.com/USERNAME/REPO.git

Create the repository on github.com first (public, no README), then paste
its URL above. Everything else is automatic.
EOF
  exit 1
fi

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 1/6  Working out the live address"
echo "──────────────────────────────────────────────"

# Accept https://host/user/repo(.git) and git@host:user/repo(.git)
CLEAN="$REPO_URL"
CLEAN="${CLEAN%.git}"
CLEAN="${CLEAN#https://}"
CLEAN="${CLEAN#http://}"
CLEAN="${CLEAN#git@}"
CLEAN="${CLEAN/:/\/}"

HOST="$(echo "$CLEAN" | cut -d/ -f1)"
OWNER="$(echo "$CLEAN" | cut -d/ -f2)"
REPO="$(echo "$CLEAN" | cut -d/ -f3)"

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  echo "  could not read an owner and repository name from: $REPO_URL"
  echo "  expected something like https://github.com/yourname/your-repo.git"
  exit 1
fi

if [ "$HOST" != "github.com" ]; then
  echo "  host is $HOST, not github.com — keeping the configured address."
  LIVE_URL=""
else
  if [ "$REPO" = "$OWNER.github.io" ]; then
    LIVE_URL="https://$OWNER.github.io"
    echo "  repository is your user site — served at the domain root"
  else
    LIVE_URL="https://$OWNER.github.io/$REPO"
    echo "  repository is a project site — served from a subfolder"
  fi
  echo "  owner : $OWNER"
  echo "  repo  : $REPO"
  echo "  live  : $LIVE_URL"
fi

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 2/6  Pointing the site at that address"
echo "──────────────────────────────────────────────"
if [ -n "$LIVE_URL" ]; then
  python3 tools/set-site-url.py "$LIVE_URL"
else
  echo "  skipped"
fi

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 3/6  Validating the build"
echo "──────────────────────────────────────────────"
python3 tools/validate.py || {
  echo
  echo "  Validation failed. Nothing has been pushed."
  exit 1
}

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 4/6  Checking for secrets"
echo "──────────────────────────────────────────────"
for f in .env .env.local .git-credentials .netrc id_rsa secrets.json credentials.json; do
  if [ -e "$f" ]; then
    echo "  STOP: $f exists in this folder and could contain a credential."
    echo "  Move it outside the project, then run this again."
    exit 1
  fi
done
echo "  no credential files present"

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 5/6  Staging"
echo "──────────────────────────────────────────────"
git init -q 2>/dev/null || true
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

BRANCH="$(git ls-remote --symref origin HEAD 2>/dev/null \
          | awk '/^ref: / { sub("refs/heads/", "", $2); print $2; exit }' || true)"
if [ -z "$BRANCH" ]; then
  BRANCH="main"; REMOTE_EMPTY=1
  echo "  repository is empty — branch: main"
else
  REMOTE_EMPTY=0
  echo "  repository default branch: $BRANCH"
fi

if [ "$REMOTE_EMPTY" = "1" ]; then
  WORK="$PROJECT_DIR"
  cd "$WORK"
  git checkout -q -B "$BRANCH" 2>/dev/null || git symbolic-ref HEAD "refs/heads/$BRANCH"
  git add -A
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  git clone -q --branch "$BRANCH" "$REPO_URL" "$WORK" 2>/dev/null \
    || git clone -q "$REPO_URL" "$WORK"
  echo "  cloned $(git -C "$WORK" rev-list --count HEAD) existing commit(s) to a temp folder"
  tar -C "$PROJECT_DIR" --exclude=.git --exclude=node_modules --exclude=.DS_Store \
      -cf - . | tar -C "$WORK" -xf -
  cd "$WORK"
  git add -A
  echo "  overlaid the site — existing files are kept, nothing deleted"
fi
echo "  $(git diff --cached --name-only | wc -l | tr -d ' ') file(s) staged"

# ─────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
echo " 6/6  Committing and pushing"
echo "──────────────────────────────────────────────"
if git diff --cached --quiet; then
  echo "  nothing changed since the last publish"
else
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "kozaliteraryliaison@gmail.com"
    git config user.name "KOZA Literary Liaison"
  fi
  git commit -q -m "Publish KOZA Literary Liaison"
  echo "  committed"
  git push -q -u origin "$BRANCH"
  echo "  pushed to $BRANCH"
fi

REMOTE_HEAD="$(git ls-remote --symref origin HEAD 2>/dev/null \
               | awk '/^ref: / { sub("refs/heads/", "", $2); print $2; exit }' || true)"
if [ -n "$REMOTE_HEAD" ] && [ "$REMOTE_HEAD" != "$BRANCH" ]; then
  echo
  echo "  WARNING: the repository's default branch is '$REMOTE_HEAD' but the"
  echo "  site is on '$BRANCH'. Pages serves the default branch. Change it in"
  echo "  Settings → Branches, or run:  git push origin $BRANCH:$REMOTE_HEAD"
fi

cat <<EOF

──────────────────────────────────────────────
 Published.

 One switch left, in the repository:
   Settings → Pages
   Source: Deploy from a branch
   Branch: $BRANCH      Folder: / (root)
   Save

 Address: ${LIVE_URL:-<see site-config.js>}
 It goes live about a minute after you press Save.

 Re-run this exact command after any edit — it is idempotent.
──────────────────────────────────────────────
EOF
