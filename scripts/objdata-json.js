#!/usr/bin/env node
/**
 * The git-safe source of the map's object data. The World Editor keeps the data in binary files
 * (war3map.w3u units, war3map.w3t items, war3map.w3b destructables, war3map.w3d doodads, and their
 * war3mapSkin.* twins) that do not diff or merge; this keeps the same data as JSON under mapdata/,
 * one file a kind, keyed by object id with the fields it sets (its differences from the base object,
 * by their war3-objectdata names). The binaries are generated from the JSON, not committed.
 *
 *   node scripts/objdata-json.js export   maps/map.w3x -> mapdata/*.json   (capture a World Editor save)
 *   node scripts/objdata-json.js import   mapdata/*.json -> maps/map.w3x   (rebuild what the editor opens)
 *
 * Import never overwrites editor changes that were not exported yet (it compares the binaries with what
 * they were at the last export or import, kept in maps/map.w3x/.objdata-stamp.json) unless --force.
 *
 * The round trip is faithful: binaries -> JSON -> binaries -> JSON gives the same JSON, and building the
 * binaries from the JSON gives the same bytes every time (verify()). The World Editor's own files and
 * war3-objectdata's export to the same JSON (checked 2026-10-19 with a real World Editor save).
 * Abilities, buffs and upgrades (w3a/w3h/w3q) are NOT handled here (war3-objectdata does not author
 * them); they stay binary, edited in place by scripts/object-data.js, until their own writer exists.
 * The string table (war3map.wts) stays binary too: a field that is a string holds its TRIGSTR_n
 * reference here, and the text it points at lives in war3map.wts.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadObjectData } = require('war3-transformer/dist/objectdata');

const ROOT = path.resolve(__dirname, '..');
const MAP = path.join(ROOT, 'maps/map.w3x');
const JSON_DIR = path.join(ROOT, 'mapdata');
// What the binaries were the last time they and the JSON agreed (after an export or an import), so an
// import never overwrites editor changes that were not exported yet. Not committed: it describes this
// working copy only.
const STAMP = path.join(MAP, '.objdata-stamp.json');

// kind -> [the war3-objectdata save() keys it produces]: a data file and its skin twin
const KINDS = {
    units: ['w3u', 'w3uSkin'],
    items: ['w3t', 'w3tSkin'],
    destructables: ['w3b', 'w3bSkin'],
    doodads: ['w3d', 'w3dSkin'],
};
// the on-disk name each save() key writes to
const FILE_OF = {
    w3u: 'war3map.w3u', w3uSkin: 'war3mapSkin.w3u',
    w3t: 'war3map.w3t', w3tSkin: 'war3mapSkin.w3t',
    w3b: 'war3map.w3b', w3bSkin: 'war3mapSkin.w3b',
    w3d: 'war3map.w3d', w3dSkin: 'war3mapSkin.w3d',
};

/** The fields a custom object sets: those whose value differs from its base object, as a stable map. */
function delta(container, id) {
    const obj = container.map[id];
    const base = container.game[obj.oldId] || {};
    const out = { _base: obj.oldId };
    for (const key of Object.keys(obj).sort()) {
        if (key === 'oldId' || key === 'newId') continue;
        if (JSON.stringify(obj[key]) !== JSON.stringify(base[key])) out[key] = obj[key];
    }
    return out;
}

/**
 * Reads the four kinds of object data from a map folder into { kind: { id: delta } }, ids sorted: the
 * World Editor and war3-objectdata write the objects in different orders (a stock object's edit and a
 * custom object, among the destructables), and the game looks objects up by id, so the order carries
 * nothing and sorting keeps a save from either one from reordering the JSON.
 */
function read(mapDir) {
    const data = loadObjectData(mapDir);
    const out = {};
    for (const kind of Object.keys(KINDS)) {
        out[kind] = {};
        for (const id of Object.keys(data[kind].map).sort()) out[kind][id] = delta(data[kind], id);
    }
    return out;
}

/** Builds a fresh object-data set from { kind: { id: delta } } (base game data plus the saved fields). */
function build(json) {
    const data = loadObjectData(); // no folder: empty custom tables, base game data loaded
    for (const kind of Object.keys(KINDS)) {
        for (const id of Object.keys(json[kind] || {})) {
            const d = json[kind][id];
            const obj = data[kind].copy(d._base, id);
            for (const key of Object.keys(d)) if (key !== '_base') obj[key] = d[key];
        }
    }
    return data;
}

/** The hash of each generated binary as it is on disk now (null for one that is absent). */
function binaryHashes(mapDir) {
    const hashes = {};
    for (const name of Object.values(FILE_OF)) {
        const file = path.join(mapDir, name);
        hashes[name] = fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
    }
    return hashes;
}

function writeStamp(mapDir) {
    fs.writeFileSync(path.join(mapDir, path.basename(STAMP)), JSON.stringify(binaryHashes(mapDir), null, 2) + '\n');
}

/**
 * Whether the binaries hold editor changes the JSON does not have yet: they differ from what they were
 * the last time they and the JSON agreed. Without a stamp, binaries that exist count as unexported.
 */
function hasUnexportedEdits(mapDir = MAP) {
    const now = binaryHashes(mapDir);
    const stampFile = path.join(mapDir, path.basename(STAMP));
    if (!fs.existsSync(stampFile)) return Object.values(now).some(hash => hash !== null);
    return JSON.stringify(now) !== JSON.stringify(JSON.parse(fs.readFileSync(stampFile, 'utf8')));
}

function exportJson(mapDir = MAP, jsonDir = JSON_DIR) {
    fs.mkdirSync(jsonDir, { recursive: true });
    const json = read(mapDir);
    for (const kind of Object.keys(KINDS)) {
        fs.writeFileSync(path.join(jsonDir, `${kind}.json`), JSON.stringify(json[kind], null, 2) + '\n');
    }
    writeStamp(mapDir);
    return json;
}

/** Rebuilds the binaries from the JSON. Refuses (returns false) when that would lose editor changes. */
function importJson(jsonDir = JSON_DIR, mapDir = MAP, { force = false } = {}) {
    const missing = Object.keys(KINDS).filter(kind => !fs.existsSync(path.join(jsonDir, `${kind}.json`)));
    if (missing.length) {
        // Building from nothing would empty the map of its units: never do that silently
        throw new Error(`no ${missing.map(kind => `mapdata/${kind}.json`).join(', ')}: not rebuilding the object data`);
    }
    if (!force && hasUnexportedEdits(mapDir)) return false;
    const json = {};
    for (const kind of Object.keys(KINDS)) {
        json[kind] = JSON.parse(fs.readFileSync(path.join(jsonDir, `${kind}.json`), 'utf8'));
    }
    const files = build(json).save();
    for (const keys of Object.values(KINDS)) {
        for (const key of keys) {
            const target = path.join(mapDir, FILE_OF[key]);
            if (files[key]) fs.writeFileSync(target, files[key].save());
            else if (fs.existsSync(target)) fs.rmSync(target); // a kind that sets nothing has no file
        }
    }
    writeStamp(mapDir);
    return true;
}

/** Writes the binaries an object-data set saves to, into a folder. */
function writeBinaries(data, dir) {
    const files = data.save();
    for (const keys of Object.values(KINDS)) {
        for (const key of keys) if (files[key]) fs.writeFileSync(path.join(dir, FILE_OF[key]), files[key].save());
    }
}

/**
 * The fidelity gate, through real files: the map's binaries -> JSON -> binaries -> JSON gives the same
 * JSON (nothing is lost or invented on the way), and building the binaries from the JSON gives the same
 * bytes every time (so a rebuild never shows up as a change).
 */
function verify(mapDir = MAP) {
    const json = read(mapDir);
    const os = require('os');
    const tmp = [0, 1].map(() => fs.mkdtempSync(path.join(os.tmpdir(), 'objdata-')));
    try {
        tmp.forEach(dir => writeBinaries(build(JSON.parse(JSON.stringify(json))), dir));
        const stable = JSON.stringify(read(tmp[0])) === JSON.stringify(json);
        const bytes = Object.values(FILE_OF).every(name => {
            const [a, b] = tmp.map(dir => path.join(dir, name));
            return fs.existsSync(a) === fs.existsSync(b) && (!fs.existsSync(a) || fs.readFileSync(a).equals(fs.readFileSync(b)));
        });
        return { stable, bytes };
    } finally {
        tmp.forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
    }
}

module.exports = { exportJson, importJson, hasUnexportedEdits, read, build, verify, KINDS, JSON_DIR, MAP };

if (require.main === module) {
    const cmd = process.argv[2];
    if (cmd === 'export') { exportJson(); console.log('Wrote mapdata/*.json'); }
    else if (cmd === 'import') {
        if (importJson(JSON_DIR, MAP, { force: process.argv.includes('--force') })) {
            console.log('Rebuilt object-data files in maps/map.w3x');
        } else {
            console.error('objdata: NOT rebuilding maps/map.w3x — it has World Editor changes that are not in mapdata/ yet.\n' +
                '  Keep them: run "npm run objdata:export" and commit, then "npm run objdata:import".\n' +
                '  Throw them away: "node scripts/objdata-json.js import --force".');
            process.exit(1);
        }
    } else if (cmd === 'verify') {
        const r = verify();
        console.log(`binaries -> JSON -> binaries -> JSON is the same: ${r.stable}\nbuilding from the JSON is deterministic: ${r.bytes}`);
        process.exit(r.stable && r.bytes ? 0 : 1);
    } else {
        console.error('usage: objdata-json.js export | import | verify');
        process.exit(2);
    }
}
