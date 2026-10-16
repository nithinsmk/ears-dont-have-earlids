#!/bin/bash
# Publishes the locked page to GitHub Pages.
#
#   bash ~/ears-site/publish.sh
#
# Safe to run again after editing the paper: it rebuilds, pushes and checks.
set -e
cd "$(dirname "$0")"
REPO=nithinsmk/ears-dont-have-earlids
URL=https://nithinsmk.github.io/ears-dont-have-earlids/

echo "1/4  Building the page from the iA Writer file"
node build.mjs
git add -A
git commit -q -m "Rebuild from the latest paper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" || true

echo "2/4  Checking GitHub sign-in"
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "     Press Enter: your browser opens. Type the code shown below there and approve."
  gh auth login -h github.com -p ssh --skip-ssh-key -w
fi

echo "3/4  Creating the repository and pushing"
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --description "ears don't have earlids (password protected)"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "git@github.com:$REPO.git"
git push -u origin main

echo "4/4  Turning on GitHub Pages"
gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || echo "     (Pages was already on)"
echo "     Waiting for GitHub to serve this build..."
LIVE=$(mktemp)
for i in $(seq 1 40); do
  curl -s "$URL?v=$(date +%s)" -o "$LIVE"
  if cmp -s "$LIVE" index.html; then
    rm -f "$LIVE"
    echo "Live: $URL"
    exit 0
  fi
  sleep 6
done
rm -f "$LIVE"
echo "Pushed, but GitHub hasn't finished yet. It can take a few minutes: $URL"
