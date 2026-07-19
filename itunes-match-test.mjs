/* itunes-match-test.mjs — the song-preview / song-link lookup.
   Runs the SHIPPED www/js/itunes-match.js against (a) fixtures that pin the known
   failure modes and (b) the live iTunes Search API for every song in the catalog.
   Live half is skipped automatically with --offline or when the network is down. */
import fs from 'fs';

(0, eval)(fs.readFileSync(new URL('./www/js/itunes-match.js', import.meta.url), 'utf8'));
(0, eval)(fs.readFileSync(new URL('./www/js/engine.js', import.meta.url), 'utf8'));
(0, eval)(fs.readFileSync(new URL('./www/js/data.dances.js', import.meta.url), 'utf8'));
const { pick, scoreTrack } = globalThis.SS_iTunesMatch;

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? ' PASS ' : ' FAIL ') + n + (d ? '  [' + d + ']' : '')); };

const T = (o) => Object.assign({ kind: 'song', previewUrl: 'p', trackViewUrl: 'v' }, o);

console.log('\niTUNES MATCHING — fixtures\n');

// The exact bug seen live: iTunes returns the tribute act FIRST for this query.
const gb = [
  T({ artistName: 'Garth Brooks Tribute', trackName: 'Friends in Low Places' }),
  T({ artistName: 'Garth Brooks', trackName: 'Friends in Low Places' })
];
ok('tribute act loses to the real artist',
  pick(gb, 'Friends in Low Places', 'Garth Brooks').view === 'v' &&
  scoreTrack(gb[1], 'Friends in Low Places', 'Garth Brooks') > scoreTrack(gb[0], 'Friends in Low Places', 'Garth Brooks'),
  'tribute=' + scoreTrack(gb[0], 'Friends in Low Places', 'Garth Brooks') + ' real=' + scoreTrack(gb[1], 'Friends in Low Places', 'Garth Brooks'));

ok('a karaoke cut loses to the real recording', (() => {
  const r = [T({ artistName: 'V.I.C.', trackName: 'Wobble', collectionName: 'Karaoke Hits', trackViewUrl: 'karaoke' }),
             T({ artistName: 'V.I.C.', trackName: 'Wobble', collectionName: 'Beast', trackViewUrl: 'real' })];
  return pick(r, 'Wobble', 'V.I.C.').view === 'real';
})());

ok('instrumental loses to the vocal cut', (() => {
  const r = [T({ artistName: 'V.I.C.', trackName: 'Wobble (Instrumental Version)', trackViewUrl: 'inst' }),
             T({ artistName: 'V.I.C.', trackName: 'Wobble', trackViewUrl: 'real' })];
  return pick(r, 'Wobble', 'V.I.C.').view === 'real';
})());

ok('a track WITH a preview beats an otherwise-equal one without', (() => {
  const r = [T({ artistName: 'Cupid', trackName: 'Cupid Shuffle', previewUrl: null, trackViewUrl: 'nopreview' }),
             T({ artistName: 'Cupid', trackName: 'Cupid Shuffle', trackViewUrl: 'haspreview' })];
  return pick(r, 'Cupid Shuffle', 'Cupid').view === 'haspreview';
})());

ok('punctuation differences still match (V.I.C vs V.I.C.)',
  scoreTrack(T({ artistName: 'V.I.C', trackName: 'Wobble' }), 'Wobble', 'V.I.C.') > 0);

ok('a wrong song is rejected outright, not just ranked low',
  pick([T({ artistName: 'Rednex', trackName: 'Old Pop In An Oak' })], 'Cotton Eye Joe', 'Rednex') === null);

ok('empty / no results -> null', pick([], 'x', 'y') === null && pick(null, 'x', 'y') === null);

ok('falls back to collectionViewUrl when there is no trackViewUrl',
  pick([T({ artistName: 'Cupid', trackName: 'Cupid Shuffle', trackViewUrl: null, collectionViewUrl: 'album' })],
    'Cupid Shuffle', 'Cupid').view === 'album');

// ---- live API ------------------------------------------------------------
const offline = process.argv.includes('--offline');
const songs = [];
globalThis.SS_DANCES.forEach(d => (d.songs || []).forEach(s => songs.push(s)));

if (offline) {
  console.log('\n  live API checks skipped (--offline)\n');
} else {
  console.log('\niTUNES MATCHING — live API, every catalog song\n');
  for (const s of songs) {
    const url = 'https://itunes.apple.com/search?media=music&entity=song&country=US&limit=25&term=' +
      encodeURIComponent(s.title + ' ' + s.artist);
    let hit = null, err = null;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      hit = pick((await r.json()).results, s.title, s.artist);
    } catch (e) { err = e.message; }
    if (err) { console.log('  SKIP  ' + s.title + ' — network: ' + err); continue; }
    ok(s.title + ' — resolves a preview + an exact song link',
      !!(hit && hit.preview && hit.view),
      hit ? 'preview=' + !!hit.preview + ' view=' + (hit.view || '').slice(0, 58) : 'no match');
  }
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
