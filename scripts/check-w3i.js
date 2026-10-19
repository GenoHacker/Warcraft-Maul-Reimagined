#!/usr/bin/env node
/**
 * Guards the map-info file (maps/map.w3x/war3map.w3i). The World Editor saves it in format 39, but
 * the Battle.net host bot's reader (flo-w3map) only parses format 31 and fails "not enough data" on
 * 39, so an editor save silently makes the map unhostable (this is what broke Beta8; Beta9 fixed it
 * by restoring the format-31 file). The game reads either format, so a deliberate map-settings change
 * is lost here on purpose: the host bot's format is the one that must survive. See the memory
 * `we-save-breaks-hostbot-w3i`.
 *
 *   node scripts/check-w3i.js          report the format, exit 1 if it is not 31
 *   node scripts/check-w3i.js --fix    if it is not 31, restore the committed format-31 file (for hooks)
 *
 * A genuine map-settings change needs a format-31 w3i; there is no down-converter from 39 yet, so make
 * such a change deliberately and re-baseline the committed file by hand.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REL = 'maps/map.w3x/war3map.w3i';
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, REL);

function formatVersion(file) {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.readInt32LE(0);
}

/** Restores the committed (HEAD) war3map.w3i into the working tree and the index. */
function restoreFromHead() {
    execFileSync('git', ['checkout', 'HEAD', '--', REL], { cwd: ROOT });
    execFileSync('git', ['add', '--', REL], { cwd: ROOT });
}

function main() {
    const fix = process.argv.includes('--fix');
    if (!fs.existsSync(FILE)) { console.error(`check-w3i: ${REL} is missing`); process.exit(1); }
    const version = formatVersion(FILE);
    if (version === 31) { console.log('check-w3i: war3map.w3i is format 31 (host-readable).'); return; }
    if (!fix) {
        console.error(`check-w3i: war3map.w3i is format ${version}, not 31 — the host bot cannot read it.\n` +
            `  A World Editor save does this. Run "npm run fix-w3i" to restore the host-readable file,\n` +
            `  or edit object data with scripts/object-data.js / mapdata instead of the editor.`);
        process.exit(1);
    }
    restoreFromHead();
    const now = formatVersion(FILE);
    if (now !== 31) { console.error(`check-w3i: restored war3map.w3i is still format ${now}; aborting.`); process.exit(1); }
    console.warn(`check-w3i: war3map.w3i was format ${version} (a World Editor save) — restored the ` +
        `committed format-31 file so the map stays hostable. Any intended map-settings change was NOT kept.`);
}

if (require.main === module) main();
module.exports = { formatVersion, restoreFromHead, REL, FILE };
