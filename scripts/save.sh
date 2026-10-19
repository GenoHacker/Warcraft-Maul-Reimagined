#!/bin/sh
# Commits what you changed in the World Editor, in one step:
#   npm run save -- "What I changed"
# The unit, item and destructable files are not tracked by git (mapdata/*.json is their source), so a
# plain commit would not see an editor change to them. This puts them in the JSON first, keeps the map
# hostable (check-w3i.js), and commits every change in the repository with your message.
set -e
cd "$(git rev-parse --show-toplevel)"
if [ -z "$1" ]; then
  echo 'usage: npm run save -- "What I changed"' >&2
  exit 2
fi
node scripts/check-w3i.js --fix
node scripts/objdata-json.js export
git add -A
git commit -m "$1"
