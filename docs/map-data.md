# Editing the map's data, in the World Editor or by script

The map's units, items and destructables live in git as JSON, in `mapdata/` (one file a kind, each
object by its id, with the fields it changes from its base object). The World Editor still edits
them as usual: the binary files it reads (`war3map.w3u`, `war3map.w3t`, `war3map.w3b` and their
`war3mapSkin` twins in `maps/map.w3x/`) are made from the JSON on your machine and are not in git.
JSON diffs and merges like any text, so two people changing towers at once no longer collide.

## Setup, once

    npm install

This turns on the git hooks (`.githooks/`) and builds the binaries from `mapdata/`.

## Changing data in the World Editor

1. Open `maps/map.w3x` in the World Editor, change what you want, save.
2. Commit it with one command:

       npm run save -- "What I changed"

   This copies your changes into `mapdata/`, keeps the map hostable (below) and commits.

A World Editor save also rewrites some files that are still binary: it reshuffles the editor's comments
in `war3map.wts` and the string references in `war3mapSkin.w3a`/`.w3q` that go with them. The game data
does not change; the commit just carries those files along.

A plain `git commit` works too, but because the binaries are not tracked it may say "nothing to
commit" the first time; the hook has then staged `mapdata/`, and running it again commits.

## Getting other people's changes

    git pull

The hooks rebuild the binaries from the new `mapdata/`, so the World Editor opens the latest. If you
have saved editor changes that you have not committed yet, the rebuild refuses rather than overwrite
them: commit them first (`npm run save`), then `npm run objdata:import`. `npm run build` does the
same check, and stops instead of building old data.

## By script

`scripts/object-data.js` edits the same data from the command line and updates `mapdata/` itself.

## Keep the map hostable

A World Editor save writes `war3map.w3i` (the map's settings) in format 39. The game reads it, but
the Battle.net host bot reads only format 31 and cannot host a map with 39. Every commit runs
`scripts/check-w3i.js --fix`, which puts the committed format-31 file back and says so. The catch:
a deliberate change to the map's settings (players, forces, name) made in the editor is undone by
it; such a change has to be made to the format-31 file by hand.

## What is not JSON yet

Abilities, buffs and upgrades (`war3map.w3a`, `.w3h`, `.w3q`), the string table (`war3map.wts`,
which holds the tooltips), terrain and imports are still binary files in git.

## Commands

| | |
|---|---|
| `npm run save -- "msg"` | capture editor changes, check the map info, commit |
| `npm run objdata:export` | binaries → `mapdata/` |
| `npm run objdata:import` | `mapdata/` → binaries (refuses over uncommitted editor changes; `--force` discards them) |
| `npm run objdata:verify` | check the JSON rebuilds the binaries exactly |
| `npm run fix-w3i` | put the host-readable `war3map.w3i` back |
