// =====================================================================
// ORAPA MINE — Console du maître du jeu (v3)
// =====================================================================
// Le rayon est simulé en géométrie continue : il avance en ligne droite et
// rebondit sur la première arête de pièce rencontrée.
//  - Arête droite (horizontale/verticale)  -> renvoie en sens inverse.
//  - Arête oblique (45°)                   -> dévie à angle droit.
//  - Corps noir       -> arrête le rayon dès contact (aucune sortie).
//  - Diamant          -> dévie normalement mais ne colore jamais le rayon.
// Les pièces ne peuvent se toucher que par un coin (jamais par un côté).
// =====================================================================

const COLS = 10, ROWS = 8;
const TOP_LABELS    = Array.from({length:COLS}, (_,i)=> String(i+1));               // 1..10
const BOTTOM_LABELS = Array.from({length:COLS}, (_,i)=> String.fromCharCode(73+i)); // I..R
const LEFT_LABELS   = Array.from({length:ROWS}, (_,i)=> String.fromCharCode(65+i)); // A..H
const RIGHT_LABELS  = Array.from({length:ROWS}, (_,i)=> String(11+i));              // 11..18

// Formes de base, sommets en coordonnées LOCALES relatives au centre (unité = 1 case).
function rightTrianglePts(size){ const h=size/2; return [[-h,-h],[h,-h],[h,h]]; }
function isocelesPts(base, height){ const hb=base/2, hh=height/2; return [[-hb,-hh],[hb,-hh],[0,hh]]; }
const SHAPES = {
  onyx:    { pts: [[-1,-0.5],[1,-0.5],[1,0.5],[-1,0.5]] },           // rectangle 2x1
  red:     { pts: [[-1.5,0.5],[-0.5,-0.5],[1.5,-0.5],[0.5,0.5]] },   // trapèze/parallélogramme
  yellow:  { pts: rightTrianglePts(2) },                             // triangle rectangle, cathètes=2
  blue:    { pts: isocelesPts(4,2) },                                // base 4, hauteur 2
  white:   { pts: isocelesPts(4,2) },                                // base 4, hauteur 2
  rhombus: { pts: [[0,-1],[1,0],[0,1],[-1,0]] },                     // losange 2x2
  gray:    { pts: isocelesPts(2,1) },                                // base 2, hauteur 1
  sapphire:{ pts: [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]] }    // carré plein 1x1
};

const CONFIG = {
  PIECES: {
    red:     { label:'Trapèze rouge',  hex:'#d1293d', colorKey:'red' },
    yellow:  { label:'Triangle jaune', hex:'#e0a72e', colorKey:'yellow' },
    blue:    { label:'Triangle bleu',  hex:'#2f6fd1', colorKey:'blue' },
    white:   { label:'Triangle blanc', hex:'#f5f1e8', colorKey:'white' },
    rhombus: { label:'Losange blanc',  hex:'#f5f1e8', colorKey:'white' },
    gray:    { label:'Diamant',        hex:'#cfd8dc', colorKey:null, isDiamond:true },
    onyx:    { label:'Corps noir',     hex:'#0d0b08', colorKey:null, isOnyx:true },
    sapphire:{ label:'Saphir bleu ciel', hex:'#a8d8f0', colorKey:null, colorKeys:['blue','white'], minHits:3 }
  },
  MIX: {
    'red':                    { name:'Rouge',        hex:'#d1293d' },
    'blue':                   { name:'Bleu',         hex:'#2f6fd1' },
    'yellow':                 { name:'Jaune',        hex:'#e0a72e' },
    'white':                  { name:'Blanc',        hex:'#f5f1e8' },
    'red+yellow':             { name:'Orange',       hex:'#e0763c' },
    'blue+red':               { name:'Violet',       hex:'#9b4fd1' },
    'blue+yellow':            { name:'Vert',         hex:'#5cb82f' },
    'red+white+yellow':       { name:'Orange clair', hex:'#eec397' },
    'blue+red+white':         { name:'Violet clair', hex:'#cdaee6' },
    'blue+white+yellow':      { name:'Vert clair',   hex:'#aee089' },
    'red+white':              { name:'Rose',         hex:'#f2a7bd' },
    'white+yellow':           { name:'Jaune clair',  hex:'#f5f0a3' },
    'blue+white':             { name:'Bleu ciel',    hex:'#a8d8f0' },
    'blue+red+yellow':        { name:'Noir',         hex:'#171310' },
    'blue+red+white+yellow':  { name:'Gris',         hex:'#8f8f8f' }
  },
  NONE:     { name:'Transparent', hex:'#8a93a3' },
  ABSORBED: { name:'Absorbé',     hex:'#0d0b08' }
};

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let state = {
  mode:'gm', // 'gm' | 'solo'
  started:false,
  includeGray:true,
  includeOnyx:true,
  includeSapphire:true,
  pieces:[],
  secretPieces:[],
  soloAttempts:0,
  soloOver:false,
  soloResult:null,
  soloShowGuess:true,
  soloShowSecret:true,
  moveCost:0,
  firstActionTime:null,
  rayCount:0,
  coordCount:0,
  gridId:null,
  gridRanked:true,
  finalTimeMs:null,
  isDaily:false,
  dailyDate:null,
  history:[],
  labelColor:{ top:{}, bottom:{}, left:{}, right:{} },
  labelBounce:{ top:{}, bottom:{}, left:{}, right:{} },
  labelPair:{ top:{}, bottom:{}, left:{}, right:{} },
  labelPartner:{ top:{}, bottom:{}, left:{}, right:{} },
  cellUsed:{},
  traces:[],
  emptyMarks:[],
  occupiedMarks:[],
  coordDots:[]
};
let pieceIdSeq = 1;

// ---------------------------------------------------------------------
// CLASSEMENTS SOLO — persistés séparément (indépendants d'une partie en cours)
// ---------------------------------------------------------------------
const COST_RAY = 1, COST_COORD = 3;
const RANKINGS_KEY = 'orapaMineRankingsV1';
const RANKING_COMBOS = [
  [false,false,false],[true,false,false],[false,true,false],[false,false,true],
  [true,true,false],[true,false,true],[false,true,true],[true,true,true]
];
function configKey(g,o,s){
  const parts = [];
  if(g) parts.push('Diamant');
  if(o) parts.push('Corps noir');
  if(s) parts.push('Saphir bleu ciel');
  return parts.length ? parts.join(' + ') : 'Aucune extension';
}
function loadRankings(){
  try{ const raw = localStorage.getItem(RANKINGS_KEY); return raw ? JSON.parse(raw) : {}; }
  catch(e){ return {}; }
}
function saveRankings(r){ try{ localStorage.setItem(RANKINGS_KEY, JSON.stringify(r)); }catch(e){} }
function formatDuration(ms){
  const s = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(s/60), sec = s%60;
  return m>0 ? `${m} min ${sec}s` : `${sec}s`;
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function registerSoloAction(kind){
  if(state.mode!=='solo' || state.soloOver) return;
  if(state.firstActionTime === null) state.firstActionTime = Date.now();
  if(kind==='ray'){ state.moveCost = (state.moveCost||0) + COST_RAY; state.rayCount = (state.rayCount||0) + 1; }
  else { state.moveCost = (state.moveCost||0) + COST_COORD; state.coordCount = (state.coordCount||0) + 1; }
}
function formatScoreLine(e){
  return `${e.cost} pts (${e.rayCount||0}🔦 + ${e.coordCount||0}📍) · ${formatDuration(e.timeMs)}`;
}
function formatShareText(e){
  const d = new Date(e.date).toLocaleDateString('fr-FR');
  if(e.isDaily){
    const failPart = e.success===false ? ' — Échec' : '';
    return `Orapa Mine · Défi du jour · ${d}\n${e.name||'Anonyme'} - ${e.cost} pts (${e.rayCount||0}🔦/${e.coordCount||0}📍)${failPart}\nhttps://argone57.github.io/Orapa-Mine/`;
  }
  const decoded = e.gridId ? decodeGridId(e.gridId) : null;
  const gems = decoded
    ? gemFlagsEmojiLine(decoded.includeGray, decoded.includeOnyx, decoded.includeSapphire)
    : gemFlagsEmojiLine(state.includeGray, state.includeOnyx, state.includeSapphire);
  const idPart = `ID: ${e.gridId||'?'}`;
  return `Orapa Mine · ${gems} · ${d}\n${e.name||'Anonyme'} - ${e.cost} pts (${e.rayCount||0}🔦/${e.coordCount||0}📍) - ${idPart}\nhttps://argone57.github.io/Orapa-Mine/`;
}
function recordScore(name, elapsedMsOverride){
  const key = configKey(state.includeGray, state.includeOnyx, state.includeSapphire);
  const rankings = loadRankings();
  if(!rankings[key]) rankings[key] = [];
  const elapsedMs = elapsedMsOverride!=null ? elapsedMsOverride : (state.firstActionTime ? (Date.now() - state.firstActionTime) : 0);
  const entry = {
    name: (name||'').trim().slice(0,24) || 'Anonyme',
    cost: state.moveCost||0, timeMs: elapsedMs,
    rayCount: state.rayCount||0, coordCount: state.coordCount||0,
    gridId: state.gridId||null,
    date: Date.now()
  };
  rankings[key].push(entry);
  rankings[key].sort((a,b)=> a.cost - b.cost || a.timeMs - b.timeMs);
  rankings[key] = rankings[key].slice(0,10);
  saveRankings(rankings);
  const rank = rankings[key].indexOf(entry) + 1;
  return { key, entry, rank, madeList: rank>0 };
}

// ---------------------------------------------------------------------
// DÉFI DU JOUR — tentative unique (par navigateur) + classement journalier.
// Le classement est stocké localement (voir le README pour la limite : sans
// backend externe, il n'est pas synchronisé entre navigateurs différents).
// ---------------------------------------------------------------------
const DAILY_ATTEMPT_KEY = 'orapaMineDailyAttemptV1';
const DAILY_RANKINGS_KEY = 'orapaMineDailyRankingsV1';
function loadDailyAttempt(){
  try{ const raw = localStorage.getItem(DAILY_ATTEMPT_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function saveDailyAttempt(a){ try{ localStorage.setItem(DAILY_ATTEMPT_KEY, JSON.stringify(a)); }catch(e){} }
function loadDailyBoards(){
  try{ const raw = localStorage.getItem(DAILY_RANKINGS_KEY); return raw ? JSON.parse(raw) : {}; }catch(e){ return {}; }
}
function saveDailyBoards(b){ try{ localStorage.setItem(DAILY_RANKINGS_KEY, JSON.stringify(b)); }catch(e){} }
// Ne garde que le défi d'aujourd'hui et celui d'hier (verrouillé, visible jusqu'à ce soir 23h59).
function pruneDailyBoards(boards){
  const todayKey = parisDateKey();
  const yesterdayKey = parisDateKey(new Date(Date.now()-24*3600*1000));
  Object.keys(boards).forEach(k=>{ if(k!==todayKey && k!==yesterdayKey) delete boards[k]; });
  return boards;
}
function recordDailyScore(name, dateKey, success, elapsedMsOverride){
  const boards = pruneDailyBoards(loadDailyBoards());
  if(!boards[dateKey]) boards[dateKey] = [];
  const elapsedMs = elapsedMsOverride!=null ? elapsedMsOverride : (state.firstActionTime ? (Date.now() - state.firstActionTime) : 0);
  const entry = {
    name: (name||'').trim().slice(0,24) || 'Anonyme',
    cost: state.moveCost||0, timeMs: elapsedMs,
    rayCount: state.rayCount||0, coordCount: state.coordCount||0,
    success: !!success,
    isDaily: true, dailyDate: dateKey,
    date: Date.now()
  };
  boards[dateKey].push(entry);
  boards[dateKey].sort((a,b)=> (b.success-a.success) || (a.cost-b.cost) || (a.timeMs-b.timeMs));
  saveDailyBoards(boards);
  const rank = boards[dateKey].indexOf(entry) + 1;
  return { entry, rank, board: boards[dateKey] };
}

// ---------------------------------------------------------------------
// CLASSEMENT GLOBAL DU DÉFI DU JOUR — Supabase
// ---------------------------------------------------------------------
const SUPABASE_URL = 'https://itiegzwnjlllhtwhfnxs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dbom16g7Bts5GvJTq6n3nw_O0nIVvw5';
const GLOBAL_SCORE_IDS_KEY = 'orapaMineGlobalScoreIdsV1';
let globalRankingLoading = false;
let globalRankingCache = {};

function loadGlobalScoreIds(){
  try{ return JSON.parse(localStorage.getItem(GLOBAL_SCORE_IDS_KEY) || '{}'); }
  catch(e){ return {}; }
}
function rememberGlobalScoreId(dateKey, id){
  if(id==null) return;
  const ids = loadGlobalScoreIds();
  ids[dateKey] = id;
  try{ localStorage.setItem(GLOBAL_SCORE_IDS_KEY, JSON.stringify(ids)); }catch(e){}
}
function supabaseHeaders(extra={}){
  return { apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${SUPABASE_ANON_KEY}`, ...extra };
}
async function submitGlobalDailyScore(entry){
  if(!entry || !entry.dailyDate) return null;
  const payload = {
    daily_date: entry.dailyDate,
    player_name: (entry.name||'Anonyme').slice(0,24),
    success: !!entry.success,
    cost: Number(entry.cost)||0,
    ray_count: Number(entry.rayCount)||0,
    coord_count: Number(entry.coordCount)||0,
    time_ms: Math.max(0, Math.round(Number(entry.timeMs)||0))
  };
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_scores`, {
      method:'POST',
      headers:supabaseHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify(payload)
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if(rows[0] && rows[0].id!=null) rememberGlobalScoreId(entry.dailyDate, rows[0].id);
    delete globalRankingCache[entry.dailyDate];
    showToast('🌍 Score ajouté au classement global');
    return rows[0] || null;
  }catch(err){
    console.error('Envoi du score global impossible :', err);
    showToast('⚠️ Score local enregistré, mais envoi global impossible');
    return null;
  }
}
async function fetchGlobalDailyScores(dateKey, force=false){
  if(!force && globalRankingCache[dateKey]) return globalRankingCache[dateKey];
  const query = new URLSearchParams({
    select:'id,daily_date,player_name,success,cost,ray_count,coord_count,time_ms,created_at',
    daily_date:`eq.${dateKey}`,
    order:'success.desc,cost.asc,time_ms.asc,created_at.asc',
    limit:'100'
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_scores?${query}`, {headers:supabaseHeaders()});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  globalRankingCache[dateKey] = rows;
  return rows;
}

function piecesEditable(){
  if(state.mode==='solo') return !state.soloOver;
  return !state.started;
}
function raysEnabled(){
  if(state.mode==='solo') return !state.soloOver;
  return state.started;
}

function allTypes(){
  const t = ['red','yellow','blue','white','rhombus'];
  if(state.includeGray) t.push('gray');
  if(state.includeOnyx) t.push('onyx');
  if(state.includeSapphire) t.push('sapphire');
  return t;
}
function freshPieceSet(){ return allTypes().map(t=> newPiece(t)); }
function newPiece(type){ return { id:'p'+(pieceIdSeq++), type, center:null, rotation:0, flipped:false }; }

function saveState(){ try{ localStorage.setItem('orapaMineStateV3', JSON.stringify(state)); }catch(e){} }
function loadState(){
  try{
    const raw = localStorage.getItem('orapaMineStateV3');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.pieces)) return false;
    state = s;
    state.mode = state.mode || 'gm';
    state.secretPieces = state.secretPieces || [];
    state.soloAttempts = state.soloAttempts || 0;
    state.soloOver = state.soloOver || false;
    state.soloResult = state.soloResult || null;
    state.labelBounce = state.labelBounce || {top:{},bottom:{},left:{},right:{}};
    state.labelPair = state.labelPair || {top:{},bottom:{},left:{},right:{}};
    state.labelPartner = state.labelPartner || {top:{},bottom:{},left:{},right:{}};
    state.cellUsed = state.cellUsed || {};
    state.occupiedMarks = state.occupiedMarks || [];
    state.coordDots = state.coordDots || [];
    if(state.moveCost === undefined) state.moveCost = 0;
    if(state.firstActionTime === undefined) state.firstActionTime = null;
    if(state.rayCount === undefined) state.rayCount = 0;
    if(state.coordCount === undefined) state.coordCount = 0;
    if(state.gridId === undefined) state.gridId = null;
    if(state.finalTimeMs === undefined) state.finalTimeMs = null;
    if(state.isDaily === undefined) state.isDaily = false;
    if(state.dailyDate === undefined) state.dailyDate = null;
    if(state.gridRanked === undefined) state.gridRanked = true;
    if(state.soloShowGuess === undefined) state.soloShowGuess = true;
    if(state.soloShowSecret === undefined) state.soloShowSecret = true;
    if(state.includeSapphire === undefined) state.includeSapphire = true;
    pieceIdSeq = 1 + state.pieces.concat(state.secretPieces).reduce((m,p)=>Math.max(m, parseInt((p.id||'p0').slice(1))||0), 0);
    // Resynchronise state.pieces avec les cases à cocher (répare les sauvegardes antérieures
    // à l'ajout d'une extension : le drapeau existe mais la pièce n'a jamais été créée).
    // Ne touche jamais aux pièces déjà placées (center non nul) des autres types.
    if(state.mode==='gm'){
      [['gray',state.includeGray],['onyx',state.includeOnyx],['sapphire',state.includeSapphire]].forEach(([type,include])=>{
        const exists = state.pieces.some(p=>p.type===type);
        if(include && !exists) state.pieces.push(newPiece(type));
        else if(!include && exists) state.pieces = state.pieces.filter(p=>p.type!==type);
      });
    }
    return true;
  }catch(e){ return false; }
}
function resetAll(){
  const g = state.includeGray, o = state.includeOnyx, s2 = state.includeSapphire;
  state = { mode:'gm', started:false, includeGray:g, includeOnyx:o, includeSapphire:s2, pieces:[], secretPieces:[],
            soloAttempts:0, soloOver:false, soloResult:null, soloShowGuess:true, soloShowSecret:true, history:[],
            gridId:null, gridRanked:true, moveCost:0, firstActionTime:null, finalTimeMs:null, rayCount:0, coordCount:0,
            isDaily:false, dailyDate:null,
            labelColor:{top:{},bottom:{},left:{},right:{}}, labelBounce:{top:{},bottom:{},left:{},right:{}},
            labelPair:{top:{},bottom:{},left:{},right:{}},
            labelPartner:{top:{},bottom:{},left:{},right:{}},
            cellUsed:{}, traces:[], emptyMarks:[], occupiedMarks:[], coordDots:[] };
  lastScoreResult = null;
  state.pieces = freshPieceSet();
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------
// PLACEMENT ALÉATOIRE — respecte le contact coin-à-coin et l'accessibilité
// sans rebond, en tenant compte des extensions activées.
// ---------------------------------------------------------------------
const GRID_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L ambigus, valeurs 0-31
const TYPE_ORDER = ['red','yellow','blue','white','rhombus','gray','onyx','sapphire'];

// L'identifiant encode DIRECTEMENT le contenu de la grille (position/rotation/miroir
// de chaque gemme), pas une graine aléatoire : deux grilles identiques donnent toujours
// le même identifiant, sur n'importe quel appareil ou navigateur, et ça fonctionne aussi
// bien pour une grille générée aléatoirement que pour une grille placée à la main.
function encodeGridId(pieces, includeGray, includeOnyx, includeSapphire){
  const header = (includeGray?1:0) + (includeOnyx?2:0) + (includeSapphire?4:0);
  const chars = [GRID_ID_CHARS[header]];
  for(const type of TYPE_ORDER){
    if(type==='gray' && !includeGray) continue;
    if(type==='onyx' && !includeOnyx) continue;
    if(type==='sapphire' && !includeSapphire) continue;
    const piece = pieces.find(p=>p.type===type && p.center);
    if(!piece) return null; // grille incomplète, pas d'identifiant possible
    const x2 = Math.max(0, Math.min(31, Math.round(piece.center.x*2)));
    const y2 = Math.max(0, Math.min(31, Math.round(piece.center.y*2)));
    const rotIdx = Math.max(0, ROTATIONS.indexOf(piece.rotation));
    const combined = rotIdx*2 + (piece.flipped?1:0);
    chars.push(GRID_ID_CHARS[x2], GRID_ID_CHARS[y2], GRID_ID_CHARS[combined]);
  }
  return chars.join('').match(/.{1,4}/g).join('-');
}
function decodeGridId(input){
  const clean = (input||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(clean.length < 1) return null;
  const header = GRID_ID_CHARS.indexOf(clean[0]);
  if(header<0 || header>7) return null;
  const includeGray = !!(header&1), includeOnyx = !!(header&2), includeSapphire = !!(header&4);
  const types = TYPE_ORDER.filter(t=> (t!=='gray'||includeGray) && (t!=='onyx'||includeOnyx) && (t!=='sapphire'||includeSapphire));
  if(clean.length !== 1 + types.length*3) return null;
  const pieces = [];
  let idx = 1;
  for(const type of types){
    const cx = GRID_ID_CHARS.indexOf(clean[idx]), cy = GRID_ID_CHARS.indexOf(clean[idx+1]), cc = GRID_ID_CHARS.indexOf(clean[idx+2]);
    if(cx<0||cy<0||cc<0) return null;
    pieces.push({ type, center:{x:cx/2,y:cy/2}, rotation:ROTATIONS[Math.floor(cc/2)], flipped: !!(cc%2) });
    idx += 3;
  }
  const formatted = clean.match(/.{1,4}/g).join('-');
  return { includeGray, includeOnyx, includeSapphire, pieces, id: formatted };
}
function gemFlagsEmojiLine(g,o,s){
  return `💎 ${g?'✅':'❌'} / ⬛️ ${o?'✅':'❌'} / 🟦 ${s?'✅':'❌'}`;
}

const ROTATIONS = [0,90,180,270];

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seedFromString(str){
  let h = 0;
  for(let i=0;i<str.length;i++) h = Math.imul(31,h) + str.charCodeAt(i) | 0;
  return h>>>0;
}
// Fisher-Yates : contrairement à sort(()=>rng()-0.5), le résultat est garanti identique
// quel que soit le moteur JS (le tri natif n'est pas spécifié pour un comparateur "aléatoire").
function seededShuffle(arr, rngFn){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rngFn()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function tryRandomLayout(rngFn){
  rngFn = rngFn || Math.random;
  const types = seededShuffle(allTypes(), rngFn);
  const placed = [];
  for(const type of types){
    let ok = false;
    for(let tries=0; tries<250 && !ok; tries++){
      const rotation = ROTATIONS[Math.floor(rngFn()*4)];
      const flipped = rngFn() < 0.5;
      const probe = { id:'r_'+type, type, center:{x:COLS/2,y:ROWS/2}, rotation, flipped };
      const {hw,hh} = boundingHalfExtents(probe);
      if(hw*2>COLS || hh*2>ROWS) break; // ne rentre pas, inutile d'insister sur cette rotation
      const rawX = hw + rngFn()*(COLS-2*hw);
      const rawY = hh + rngFn()*(ROWS-2*hh);
      let {x:cx,y:cy} = snapPieceCenter(rawX, rawY, probe);
      cx = Math.min(COLS-hw, Math.max(hw,cx));
      cy = Math.min(ROWS-hh, Math.max(hh,cy));
      const candidate = { id:'r_'+type, type, center:{x:cx,y:cy}, rotation, flipped };
      if(placementValid(candidate, null, placed)){
        placed.push(candidate);
        ok = true;
      }
    }
    if(!ok) return null;
  }
  if(unreachablePieces(placed).length > 0) return null;
  return placed.map(p=> ({ id:'p'+(pieceIdSeq++), type:p.type, center:p.center, rotation:p.rotation, flipped:p.flipped }));
}
function generateRandomLayout(maxAttempts){
  maxAttempts = maxAttempts || 60;
  for(let attempt=0; attempt<maxAttempts; attempt++){
    const layout = tryRandomLayout();
    if(layout) return layout;
  }
  return null;
}
// ---------------------------------------------------------------------
// DÉFI DU JOUR — grille déterministe (même graine = même grille partout),
// avec 0 à 3 gemmes optionnelles tirées au sort et UNE exception de placement
// (contact par un côté OU dépassement partiel) appliquée à une gemme au hasard.
// ---------------------------------------------------------------------
function parisDateKey(d){
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit' });
  return fmt.format(d || new Date()); // "AAAA-MM-JJ"
}
function dailyTypesForFlags(gray,onyx,sapphire){
  const t = ['red','yellow','blue','white','rhombus'];
  if(gray) t.push('gray');
  if(onyx) t.push('onyx');
  if(sapphire) t.push('sapphire');
  return t;
}
// Cherche une position qui colle EXCEPTIONNELLEMENT la pièce contre un voisin par un côté.
function findForcedSideTouch(type, placed, rngFn){
  for(const rotation of seededShuffle(ROTATIONS, rngFn)){
    for(const flipped of [false,true]){
      const probe = { id:'ex', type, center:{x:0,y:0}, rotation, flipped };
      const {hw,hh} = boundingHalfExtents(probe);
      const neighbors = seededShuffle(placed, rngFn);
      for(const nb of neighbors){
        const {hw:nhw, hh:nhh} = boundingHalfExtents(nb);
        const candidates = [
          {x:nb.center.x+nhw+hw, y:nb.center.y}, {x:nb.center.x-nhw-hw, y:nb.center.y},
          {x:nb.center.x, y:nb.center.y+nhh+hh}, {x:nb.center.x, y:nb.center.y-nhh-hh}
        ];
        for(const c of candidates){
          let {x:cx,y:cy} = snapPieceCenter(c.x, c.y, probe);
          cx = Math.min(COLS-hw, Math.max(hw,cx));
          cy = Math.min(ROWS-hh, Math.max(hh,cy));
          const candidate = { id:'ex', type, center:{x:cx,y:cy}, rotation, flipped };
          let overlap=false, sideTouch=false;
          for(const other of placed){
            const kind = edgeContactKind(pieceVertices(candidate), pieceVertices(other));
            if(kind==='overlap'){ overlap=true; break; }
            if(kind==='sideTouch') sideTouch=true;
          }
          if(!overlap && sideTouch) return candidate;
        }
      }
    }
  }
  return null;
}
// Cherche une position qui dépasse EXCEPTIONNELLEMENT du plateau (en gardant >=1 case occupée).
function findForcedPartialOut(type, placed, rngFn){
  for(let tries=0; tries<400; tries++){
    const rotation = ROTATIONS[Math.floor(rngFn()*4)];
    const flipped = rngFn()<0.5;
    const probe = { id:'ex', type, center:{x:0,y:0}, rotation, flipped };
    const {hw,hh} = boundingHalfExtents(probe);
    const rawX = -hw + rngFn()*(COLS+2*hw);
    const rawY = -hh + rngFn()*(ROWS+2*hh);
    const {x:cx,y:cy} = snapPieceCenter(rawX, rawY, probe);
    const candidate = { id:'ex', type, center:{x:cx,y:cy}, rotation, flipped };
    const outOfBounds = (cx-hw < -1e-6 || cx+hw > COLS+1e-6 || cy-hh < -1e-6 || cy+hh > ROWS+1e-6);
    if(!outOfBounds) continue;
    let overlap = false;
    for(const other of placed){
      if(edgeContactKind(pieceVertices(candidate), pieceVertices(other))==='overlap'){ overlap=true; break; }
    }
    if(overlap) continue;
    let hasCell = false;
    for(let r=0;r<ROWS && !hasCell;r++){
      for(let c=0;c<COLS;c++){
        const cellPoly=[{x:c,y:r},{x:c+1,y:r},{x:c+1,y:r+1},{x:c,y:r+1}];
        const inter = clipPolygon(ensureCCW(pieceVertices(candidate)), cellPoly);
        if(inter.length>0 && polyArea(inter) > 0.3){ hasCell = true; break; }
      }
    }
    if(hasCell) return candidate;
  }
  return null;
}
function tryDailyLayout(rngFn){
  const flags = { gray: rngFn()<0.5, onyx: rngFn()<0.5, sapphire: rngFn()<0.5 };
  const types = seededShuffle(dailyTypesForFlags(flags.gray, flags.onyx, flags.sapphire), rngFn);
  const exceptionRule = rngFn()<0.5 ? 'sideTouch' : 'partialOut';
  const exceptionType = types[Math.floor(rngFn()*types.length)];
  const placed = [];
  for(const type of types){
    if(type===exceptionType){
      const forced = exceptionRule==='sideTouch'
        ? findForcedSideTouch(type, placed, rngFn)
        : findForcedPartialOut(type, placed, rngFn);
      if(!forced) return null;
      placed.push(forced);
      continue;
    }
    let ok = false;
    for(let tries=0; tries<250 && !ok; tries++){
      const rotation = ROTATIONS[Math.floor(rngFn()*4)];
      const flipped = rngFn() < 0.5;
      const probe = { id:'r_'+type, type, center:{x:COLS/2,y:ROWS/2}, rotation, flipped };
      const {hw,hh} = boundingHalfExtents(probe);
      if(hw*2>COLS || hh*2>ROWS) break;
      const rawX = hw + rngFn()*(COLS-2*hw);
      const rawY = hh + rngFn()*(ROWS-2*hh);
      let {x:cx,y:cy} = snapPieceCenter(rawX, rawY, probe);
      cx = Math.min(COLS-hw, Math.max(hw,cx));
      cy = Math.min(ROWS-hh, Math.max(hh,cy));
      const candidate = { id:'r_'+type, type, center:{x:cx,y:cy}, rotation, flipped };
      if(placementValid(candidate, null, placed)){
        placed.push(candidate);
        ok = true;
      }
    }
    if(!ok) return null;
  }
  if(unreachablePieces(placed).length > 0) return null;
  return {
    pieces: placed.map(p=> ({ id:'p'+(pieceIdSeq++), type:p.type, center:p.center, rotation:p.rotation, flipped:p.flipped })),
    flags, exceptionRule, exceptionType
  };
}
function generateDailyLayout(dateKey){
  const rngFn = mulberry32(seedFromString('DAILY-'+dateKey));
  for(let attempt=0; attempt<200; attempt++){
    const result = tryDailyLayout(rngFn);
    if(result) return result;
  }
  return null;
}

function randomizePlacement(){
  const layout = generateRandomLayout();
  if(layout){
    state.history = [];
    state.labelColor = {top:{},bottom:{},left:{},right:{}};
    state.labelBounce = {top:{},bottom:{},left:{},right:{}};
    state.cellUsed = {};
    state.traces = [];
    state.emptyMarks = [];
    state.coordDots = [];
    state.pieces = layout;
    saveState();
    renderAll();
    return true;
  }
  setTimeout(()=> alert("Je n'ai pas trouvé de disposition valide, retente en cliquant à nouveau sur Aléatoire."), 60);
  return false;
}

// ---------------------------------------------------------------------
// MODE SOLO — une grille secrète est générée, le joueur doit la retrouver.
// ---------------------------------------------------------------------
function startSoloGame(explicitId){
  let gridId, secret, ranked;
  if(explicitId){
    const decoded = decodeGridId(explicitId);
    if(!decoded){
      setTimeout(()=> alert("Identifiant invalide. Vérifie que tu l'as copié en entier."), 60);
      return;
    }
    state.includeGray = decoded.includeGray;
    state.includeOnyx = decoded.includeOnyx;
    state.includeSapphire = decoded.includeSapphire;
    secret = decoded.pieces.map(p=> ({ id:'p'+(pieceIdSeq++), type:p.type, center:p.center, rotation:p.rotation, flipped:p.flipped }));
    if(unreachablePieces(secret).length>0){
      setTimeout(()=> alert("Cet identifiant ne correspond à aucune grille valide."), 60);
      return;
    }
    gridId = decoded.id;
    ranked = false;
  } else {
    secret = generateRandomLayout();
    if(!secret){
      setTimeout(()=> alert("Je n'ai pas réussi à générer une grille, réessaie."), 60);
      return;
    }
    gridId = encodeGridId(secret, state.includeGray, state.includeOnyx, state.includeSapphire);
    ranked = true;
  }
  setHintMode(false);
  state.mode = 'solo';
  state.started = false;
  state.secretPieces = secret;
  state.pieces = freshPieceSet();
  state.gridId = gridId;
  state.gridRanked = ranked;
  state.soloAttempts = 0;
  state.soloOver = false;
  state.soloResult = null;
  state.soloShowGuess = true;
  state.soloShowSecret = true;
  state.moveCost = 0;
  state.firstActionTime = null;
  state.finalTimeMs = null;
  state.rayCount = 0;
  state.coordCount = 0;
  lastScoreResult = null;
  state.isDaily = false;
  state.dailyDate = null;
  state.history = [];
  state.labelColor = {top:{},bottom:{},left:{},right:{}};
  state.labelBounce = {top:{},bottom:{},left:{},right:{}};
  state.labelPair = {top:{},bottom:{},left:{},right:{}};
  state.labelPartner = {top:{},bottom:{},left:{},right:{}};
  state.cellUsed = {};
  state.traces = [];
  state.emptyMarks = [];
  state.coordDots = [];
  saveState();
  renderAll();
}

function dailyStatusToday(){
  const dateKey = parisDateKey();
  const attempt = loadDailyAttempt();
  return { dateKey, alreadyPlayed: !!(attempt && attempt.date===dateKey), attempt: (attempt && attempt.date===dateKey) ? attempt : null };
}
function startDailyChallenge(){
  const { dateKey, alreadyPlayed, attempt } = dailyStatusToday();
  if(alreadyPlayed){
    alert(`Tu as déjà joué le défi du jour (${attempt.result==='win'?'réussi 🏆':'raté 💥'}). Reviens demain pour un nouveau défi !`);
    return;
  }
  const daily = generateDailyLayout(dateKey);
  if(!daily){
    setTimeout(()=> alert("Je n'ai pas réussi à générer le défi du jour, réessaie plus tard."), 60);
    return;
  }
  setHintMode(false);
  state.includeGray = daily.flags.gray;
  state.includeOnyx = daily.flags.onyx;
  state.includeSapphire = daily.flags.sapphire;
  state.mode = 'solo';
  state.started = false;
  state.secretPieces = daily.pieces;
  state.pieces = freshPieceSet();
  state.gridId = null;
  state.gridRanked = false;
  state.isDaily = true;
  state.dailyDate = dateKey;
  state.soloAttempts = 0;
  state.soloOver = false;
  state.soloResult = null;
  state.soloShowGuess = true;
  state.soloShowSecret = true;
  state.moveCost = 0;
  state.firstActionTime = null;
  state.finalTimeMs = null;
  state.rayCount = 0;
  state.coordCount = 0;
  lastScoreResult = null;
  state.history = [];
  state.labelColor = {top:{},bottom:{},left:{},right:{}};
  state.labelBounce = {top:{},bottom:{},left:{},right:{}};
  state.labelPair = {top:{},bottom:{},left:{},right:{}};
  state.labelPartner = {top:{},bottom:{},left:{},right:{}};
  state.cellUsed = {};
  state.traces = [];
  state.emptyMarks = [];
  state.coordDots = [];
  saveState();
  renderAll();
}
function polygonsMatch(pA, pB, tol){
  tol = tol || 1e-3;
  const vA = pieceVertices(pA), vB = pieceVertices(pB);
  if(vA.length !== vB.length) return false;
  const used = new Array(vB.length).fill(false);
  for(const va of vA){
    let found = false;
    for(let i=0;i<vB.length;i++){
      if(used[i]) continue;
      if(Math.abs(va.x-vB[i].x)<tol && Math.abs(va.y-vB[i].y)<tol){ used[i]=true; found=true; break; }
    }
    if(!found) return false;
  }
  return true;
}
function evaluateGuess(){
  for(const type of allTypes()){
    const s = state.secretPieces.find(p=>p.type===type);
    const g = state.pieces.find(p=>p.type===type && p.center);
    if(!s || !g) return false;
    if(!polygonsMatch(s,g)) return false;
  }
  return true;
}
let lastScoreResult = null;
function currentEntryForDisplay(){
  return {
    name: (lastScoreResult && lastScoreResult.entry.name) || 'Anonyme',
    cost: state.moveCost||0,
    timeMs: state.finalTimeMs||0,
    rayCount: state.rayCount||0,
    coordCount: state.coordCount||0,
    gridId: state.gridId,
    isDaily: state.isDaily,
    dailyDate: state.dailyDate,
    success: state.soloResult==='win',
    date: (lastScoreResult && lastScoreResult.entry.date) || Date.now()
  };
}
function openVictoryModal(){
  const entry = currentEntryForDisplay();
  $('#victoryScoreLine').textContent = formatScoreLine(entry);
  $('#victoryRankLine').textContent = lastScoreResult && lastScoreResult.madeList
    ? `Classé #${lastScoreResult.rank} dans « ${lastScoreResult.key} »`
    : (state.isDaily ? '' : (state.gridRanked ? '' : 'Grille chargée par identifiant — non comptabilisée au classement'));
  $('#victoryGridId').textContent = state.isDaily ? `Défi du jour (${state.dailyDate})` : (state.gridId || '');
  $('#victoryModal').classList.add('open');
}
function proposeSolution(){
  if(state.mode!=='solo' || state.soloOver) return;
  const correct = evaluateGuess();
  if(correct){
    state.soloOver = true;
    state.soloResult = 'win';
    const elapsedMs = state.firstActionTime ? (Date.now() - state.firstActionTime) : 0;
    state.finalTimeMs = elapsedMs;
    if(state.isDaily){
      const name = (prompt('🏆 Bravo, tu as retrouvé la disposition exacte !\nEntre ton nom pour le classement du jour :', '') || '').trim();
      const daily = recordDailyScore(name, state.dailyDate, true, elapsedMs);
      submitGlobalDailyScore(daily.entry);
      lastScoreResult = { key:'Défi du jour', entry:{...daily.entry, gridId:null, isDaily:true, dailyDate:state.dailyDate}, rank:daily.rank, madeList:true };
      saveDailyAttempt({ date: state.dailyDate, result:'win' });
    } else if(state.gridRanked){
      const name = (prompt('🏆 Bravo, tu as retrouvé la disposition exacte !\nEntre ton nom pour le classement :', '') || '').trim();
      lastScoreResult = recordScore(name, elapsedMs);
    } else {
      lastScoreResult = null;
    }
    saveState();
    renderAll();
    setTimeout(()=> openVictoryModal(), 60);
    return;
  }
  state.soloAttempts++;
  if(state.isDaily || state.soloAttempts >= 2){
    state.soloOver = true;
    state.soloResult = 'lose';
    const elapsedMs = state.firstActionTime ? (Date.now() - state.firstActionTime) : 0;
    state.finalTimeMs = elapsedMs;
    if(state.isDaily){
      const name = (prompt("💥 Solution incorrecte — défi du jour terminé.\nEntre ton nom pour le classement du jour :", '') || '').trim();
      const daily = recordDailyScore(name, state.dailyDate, false, elapsedMs);
      submitGlobalDailyScore(daily.entry);
      saveDailyAttempt({ date: state.dailyDate, result:'lose' });
    }
    saveState();
    renderAll();
    setTimeout(()=> alert(state.isDaily ? "💥 Solution incorrecte — la grille secrète est révélée ci-dessous (tes gemmes apparaissent en contour)." : "💥 C'est encore faux — la grille secrète est révélée ci-dessous (tes gemmes apparaissent en contour)."), 60);
  } else {
    saveState();
    setTimeout(()=> alert("C'est faux ! Il te reste un essai avant l'échec."), 60);
  }
}

// ---------------------------------------------------------------------
// GEOMETRY — transform & rendering helpers
// ---------------------------------------------------------------------
function transformVertex(v, flipped, rotation, center){
  let x=v[0], y=v[1];
  if(flipped) x=-x;
  let rx,ry;
  switch(rotation){
    case 90:  rx=-y; ry=x; break;
    case 180: rx=-x; ry=-y; break;
    case 270: rx=y;  ry=-x; break;
    default:  rx=x;  ry=y;
  }
  return { x: center.x+rx, y: center.y+ry };
}
function pieceVertices(piece){
  const shape = SHAPES[piece.type];
  return shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, piece.center));
}
function pieceEdges(piece){
  const v = pieceVertices(piece);
  const edges = [];
  for(let i=0;i<v.length;i++) edges.push([v[i], v[(i+1)%v.length]]);
  return edges;
}
// Pour une gemme qui dépasse du plateau, seule sa partie visible participe au rayon.
// Le contour créé par la limite du plateau devient donc une paroi droite : un rayon
// qui entre exactement à cet endroit repart par sa propre entrée (N→N, O→O, etc.).
function beamEdges(piece){
  const boardPoly = ensureCCW([{x:0,y:0},{x:COLS,y:0},{x:COLS,y:ROWS},{x:0,y:ROWS}]);
  const clipped = clipPolygon(ensureCCW(pieceVertices(piece)), boardPoly);
  if(clipped.length < 2) return [];
  const edges = [];
  for(let i=0;i<clipped.length;i++) edges.push([clipped[i], clipped[(i+1)%clipped.length]]);
  return edges;
}
function boundingHalfExtents(piece){
  const shape = SHAPES[piece.type];
  const pts = shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  return { hw:(Math.max(...xs)-Math.min(...xs))/2, hh:(Math.max(...ys)-Math.min(...ys))/2 };
}
function snapCoord(raw, halfExtent){
  const frac = ((halfExtent % 1) + 1) % 1;
  return Math.round(raw - frac) + frac;
}
// Aligne les SOMMETS de la gemme sur les intersections de la grille.
// C'est plus fiable que l'alignement basé uniquement sur sa largeur/hauteur,
// notamment pour les triangles et les pièces partiellement hors plateau.
function pieceSnapFractions(piece){
  const local = SHAPES[piece.type].pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
  return {
    fracX: ((-local[0].x % 1) + 1) % 1,
    fracY: ((-local[0].y % 1) + 1) % 1
  };
}
function snapOnLattice(raw, frac){
  return Math.round(raw - frac) + frac;
}
function clampOnLattice(value, min, max, frac){
  const latticeMin = Math.ceil(min - frac - 1e-9) + frac;
  const latticeMax = Math.floor(max - frac + 1e-9) + frac;
  return Math.min(latticeMax, Math.max(latticeMin, snapOnLattice(value, frac)));
}
function snapPieceCenter(rawX, rawY, piece){
  const {fracX,fracY} = pieceSnapFractions(piece);
  return {
    x: snapOnLattice(rawX, fracX),
    y: snapOnLattice(rawY, fracY)
  };
}
function snapPieceCenterWithinBounds(rawX, rawY, piece){
  const {hw,hh} = boundingHalfExtents(piece);
  const {fracX,fracY} = pieceSnapFractions(piece);
  const minX = state.isDaily ? -hw+0.5 : hw;
  const maxX = state.isDaily ? COLS+hw-0.5 : COLS-hw;
  const minY = state.isDaily ? -hh+0.5 : hh;
  const maxY = state.isDaily ? ROWS+hh-0.5 : ROWS-hh;
  return {
    x: clampOnLattice(rawX, minX, maxX, fracX),
    y: clampOnLattice(rawY, minY, maxY, fracY)
  };
}
function resnapAfterTransform(piece){
  if(!piece.center) return;
  piece.center = snapPieceCenterWithinBounds(piece.center.x, piece.center.y, piece);
}
function pointInPolygon(pt, poly){
  let inside = false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
    const cross = ((yi>pt.y)!==(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi);
    if(cross) inside = !inside;
  }
  return inside;
}
function pieceAtCell(row,col,piecesList){
  piecesList = piecesList || state.pieces;
  const cellPoly = [{x:col,y:row},{x:col+1,y:row},{x:col+1,y:row+1},{x:col,y:row+1}];
  return piecesList.find(p=>{
    if(!p.center) return false;
    const inter = clipPolygon(ensureCCW(pieceVertices(p)), cellPoly);
    return inter.length>0 && polyArea(inter) > 1e-6;
  });
}

// ---------------------------------------------------------------------
// GEOMETRY — collision : les pièces ne peuvent se toucher que par un coin
// ---------------------------------------------------------------------
function ensureCCW(poly){
  let area=0;
  for(let i=0;i<poly.length;i++){ const p=poly[i], q=poly[(i+1)%poly.length]; area += p.x*q.y - q.x*p.y; }
  return area < 0 ? poly.slice().reverse() : poly;
}
function cross2(A,B,P){ return (B.x-A.x)*(P.y-A.y)-(B.y-A.y)*(P.x-A.x); }
function segIntersect(A,B,P,Q){
  const a1=B.y-A.y,b1=A.x-B.x,c1=a1*A.x+b1*A.y;
  const a2=Q.y-P.y,b2=P.x-Q.x,c2=a2*P.x+b2*P.y;
  const det=a1*b2-a2*b1;
  if(Math.abs(det)<1e-12) return P;
  return { x:(b2*c1-b1*c2)/det, y:(a1*c2-a2*c1)/det };
}
function clipPolygon(subject, clip){
  let output = subject;
  for(let i=0;i<clip.length;i++){
    const A=clip[i], B=clip[(i+1)%clip.length];
    const input = output; output=[];
    if(input.length===0) break;
    for(let j=0;j<input.length;j++){
      const P=input[j], Q=input[(j+1)%input.length];
      const sideP = cross2(A,B,P), sideQ = cross2(A,B,Q);
      if(sideP >= -1e-9) output.push(P);
      if((sideP>1e-9 && sideQ<-1e-9) || (sideP<-1e-9 && sideQ>1e-9)) output.push(segIntersect(A,B,P,Q));
    }
  }
  return output;
}
function polyArea(poly){
  let a=0; for(let i=0;i<poly.length;i++){ const p=poly[i],q=poly[(i+1)%poly.length]; a+=p.x*q.y-q.x*p.y; } return Math.abs(a)/2;
}
function maxExtent(poly){
  let m=0;
  for(let i=0;i<poly.length;i++) for(let j=i+1;j<poly.length;j++) m=Math.max(m, Math.hypot(poly[i].x-poly[j].x, poly[i].y-poly[j].y));
  return m;
}
function touchesBySide(polyA, polyB){
  const A = ensureCCW(polyA), B = ensureCCW(polyB);
  const inter = clipPolygon(A, B);
  if(inter.length===0) return false;
  if(polyArea(inter) > 1e-4) return true;   // chevauchement réel
  if(maxExtent(inter) > 1e-3) return true;  // contact le long d'une arête
  return false;                              // simple contact ponctuel (coin) -> autorisé
}
function edgeContactKind(polyA, polyB){
  const A = ensureCCW(polyA), B = ensureCCW(polyB);
  const inter = clipPolygon(A, B);
  if(inter.length===0) return 'none';
  if(polyArea(inter) > 1e-4) return 'overlap';
  if(maxExtent(inter) > 1e-3) return 'sideTouch';
  return 'corner';
}
function placementValid(candidate, excludeId, piecesList){
  piecesList = piecesList || state.pieces;
  const {hw,hh} = boundingHalfExtents(candidate);
  if(candidate.center.x-hw < -1e-6 || candidate.center.x+hw > COLS+1e-6) return false;
  if(candidate.center.y-hh < -1e-6 || candidate.center.y+hh > ROWS+1e-6) return false;
  const polyA = pieceVertices(candidate);
  for(const other of piecesList){
    if(!other.center || other.id===excludeId) continue;
    if(touchesBySide(polyA, pieceVertices(other))) return false;
  }
  return true;
}

// Chaque gemme posée doit pouvoir être touchée par au moins un rayon SANS rebond
// (un tir direct depuis un bord qui l'atteint avant toute autre pièce).
function firstHitPieceId(side, index, piecesList){
  piecesList = piecesList || state.pieces;
  let pos, dir;
  if(side==='top'){ pos={x:index+0.5,y:0}; dir={dx:0,dy:1}; }
  else if(side==='bottom'){ pos={x:index+0.5,y:ROWS}; dir={dx:0,dy:-1}; }
  else if(side==='left'){ pos={x:0,y:index+0.5}; dir={dx:1,dy:0}; }
  else { pos={x:COLS,y:index+0.5}; dir={dx:-1,dy:0}; }
  let best = { ...intersectBoundary(pos,dir), kind:'boundary' };
  for(const piece of piecesList){
    if(!piece.center) continue;
    for(const [A,B] of beamEdges(piece)){
      const hit = intersectRaySegment(pos,dir,A,B);
      if(hit && hit.t < best.t - EPS) best = { t:hit.t, kind:'edge', pieceId:piece.id };
    }
  }
  return best.kind==='edge' ? best.pieceId : null;
}
function unreachablePieces(piecesList){
  piecesList = piecesList || state.pieces;
  const hitCounts = {};
  function bump(id){ if(id) hitCounts[id] = (hitCounts[id]||0) + 1; }
  for(let i=0;i<COLS;i++){
    bump(firstHitPieceId('top',i,piecesList));
    bump(firstHitPieceId('bottom',i,piecesList));
  }
  for(let i=0;i<ROWS;i++){
    bump(firstHitPieceId('left',i,piecesList));
    bump(firstHitPieceId('right',i,piecesList));
  }
  return piecesList.filter(p=>{
    if(!p.center) return false;
    const need = (CONFIG.PIECES[p.type].minHits) || 1;
    return (hitCounts[p.id]||0) < need;
  });
}

// Calcule l'ensemble des pièces en conflit (contact par un côté / chevauchement / hors
// grille / injoignable) SANS jamais empêcher le placement — sert uniquement à les colorer
// et à bloquer le bouton Démarrer tant qu'il en reste.
function computeInvalidPieceIds(piecesList){
  piecesList = piecesList || state.pieces;
  const placed = piecesList.filter(p=>p.center);
  const invalid = new Set();
  for(let i=0;i<placed.length;i++){
    const {hw,hh} = boundingHalfExtents(placed[i]);
    if(placed[i].center.x-hw < -1e-6 || placed[i].center.x+hw > COLS+1e-6 ||
       placed[i].center.y-hh < -1e-6 || placed[i].center.y+hh > ROWS+1e-6){
      invalid.add(placed[i].id);
    }
    for(let j=i+1;j<placed.length;j++){
      if(touchesBySide(pieceVertices(placed[i]), pieceVertices(placed[j]))){
        invalid.add(placed[i].id);
        invalid.add(placed[j].id);
      }
    }
  }
  unreachablePieces(piecesList).forEach(p=> invalid.add(p.id));
  return invalid;
}

// ---------------------------------------------------------------------
// GEOMETRY — tracé du rayon
// ---------------------------------------------------------------------
const EPS = 1e-6;
function intersectRaySegment(pos, dir, A, B){
  if(dir.dx !== 0){
    if(Math.abs(A.y-B.y) < EPS) return null;
    const s = (pos.y - A.y) / (B.y - A.y);
    if(s < -EPS || s > 1+EPS) return null;
    const x = A.x + s*(B.x-A.x);
    const t = (x - pos.x) / dir.dx;
    if(t < -EPS) return null;
    return { t, point:{x, y:pos.y} };
  } else {
    if(Math.abs(A.x-B.x) < EPS) return null;
    const s = (pos.x - A.x) / (B.x - A.x);
    if(s < -EPS || s > 1+EPS) return null;
    const y = A.y + s*(B.y-A.y);
    const t = (y - pos.y) / dir.dy;
    if(t < -EPS) return null;
    return { t, point:{x:pos.x, y} };
  }
}
function edgeKind(A,B){
  if(Math.abs(A.x-B.x) < EPS || Math.abs(A.y-B.y) < EPS) return 'wall';
  const slope = (B.y-A.y)/(B.x-A.x);
  return slope > 0 ? 'back' : 'fwd';
}
function reflect(dir, kind){
  const {dx,dy} = dir;
  if(kind==='back'){
    if(dx=== 1) return {dx:0,dy:1};
    if(dx===-1) return {dx:0,dy:-1};
    if(dy===-1) return {dx:-1,dy:0};
    if(dy=== 1) return {dx:1,dy:0};
  } else {
    if(dx=== 1) return {dx:0,dy:-1};
    if(dx===-1) return {dx:0,dy:1};
    if(dy===-1) return {dx:1,dy:0};
    if(dy=== 1) return {dx:-1,dy:0};
  }
  return dir;
}
function intersectBoundary(pos,dir){
  if(dir.dx!==0){ const x = dir.dx>0?COLS:0; return { t:(x-pos.x)/dir.dx, point:{x,y:pos.y} }; }
  const y = dir.dy>0?ROWS:0; return { t:(y-pos.y)/dir.dy, point:{x:pos.x,y} };
}
function colorKeyOf(set){ return [...set].sort().join('+'); }
function resolveColor(set){
  if(set.size===0) return CONFIG.NONE;
  return CONFIG.MIX[colorKeyOf(set)] || CONFIG.NONE;
}

function simulateBeam(side,index,piecesList){
  let pos, dir;
  if(side==='top'){ pos={x:index+0.5,y:0}; dir={dx:0,dy:1}; }
  else if(side==='bottom'){ pos={x:index+0.5,y:ROWS}; dir={dx:0,dy:-1}; }
  else if(side==='left'){ pos={x:0,y:index+0.5}; dir={dx:1,dy:0}; }
  else { pos={x:COLS,y:index+0.5}; dir={dx:-1,dy:0}; }

  const placed = (piecesList || state.pieces).filter(p=>p.center);
  const colorsHit = new Set();
  const points = [pos];
  let guard=0, absorbed=false, exitSide=null, exitIndex=null;
  let skipPieceId=null, skipEdgeIdx=null;

  while(true){
    guard++;
    if(guard>400){ absorbed='loop'; break; }
    let best = { ...intersectBoundary(pos,dir), kind:'boundary' };
    for(const piece of placed){
      const edges = beamEdges(piece);
      for(let ei=0; ei<edges.length; ei++){
        if(piece.id===skipPieceId && ei===skipEdgeIdx) continue;
        const [A,B] = edges[ei];
        const hit = intersectRaySegment(pos,dir,A,B);
        if(hit && hit.t < best.t - EPS) best = { t:hit.t, point:hit.point, kind:'edge', piece, edgeType:edgeKind(A,B), edgeIdx:ei };
      }
    }
    if(best.kind==='boundary'){
      points.push(best.point);
      const p = best.point;
      if(Math.abs(p.x)<EPS){ exitSide='left'; exitIndex=Math.floor(p.y); }
      else if(Math.abs(p.x-COLS)<EPS){ exitSide='right'; exitIndex=Math.floor(p.y); }
      else if(Math.abs(p.y)<EPS){ exitSide='top'; exitIndex=Math.floor(p.x); }
      else { exitSide='bottom'; exitIndex=Math.floor(p.x); }
      break;
    }
    const def = CONFIG.PIECES[best.piece.type];
    points.push(best.point);
    if(def.isOnyx){ absorbed=true; break; }
    if(def.colorKey) colorsHit.add(def.colorKey);
    if(def.colorKeys) def.colorKeys.forEach(k=> colorsHit.add(k));
    dir = best.edgeType==='wall' ? {dx:-dir.dx,dy:-dir.dy} : reflect(dir, best.edgeType);
    pos = best.point;
    skipPieceId = best.piece.id; skipEdgeIdx = best.edgeIdx;
  }
  const color = absorbed==='loop' ? {name:'Boucle infinie détectée',hex:'#c1503f'} : (absorbed ? CONFIG.ABSORBED : resolveColor(colorsHit));
  return { entrySide:side, entryIndex:index, exitSide, exitIndex, absorbed, color, points };
}
function labelText(side,index){
  if(side==='top') return TOP_LABELS[index];
  if(side==='bottom') return BOTTOM_LABELS[index];
  if(side==='left') return LEFT_LABELS[index];
  return RIGHT_LABELS[index];
}

// ---------------------------------------------------------------------
// COLOR CONTRAST HELPER
// ---------------------------------------------------------------------
function hexToRgb(hex){ hex=hex.replace('#',''); return [parseInt(hex.substr(0,2),16),parseInt(hex.substr(2,2),16),parseInt(hex.substr(4,2),16)]; }
function contrastText(hex){
  const [r,g,b] = hexToRgb(hex);
  const lum = (0.299*r+0.587*g+0.114*b)/255;
  return lum > 0.58 ? '#14100c' : '#f5f1e8';
}
function beamColorName(hex){
  if(!hex) return '';
  const normalized = String(hex).toLowerCase();
  const colors = [...Object.values(CONFIG.MIX), CONFIG.NONE, CONFIG.ABSORBED];
  const match = colors.find(color => color.hex.toLowerCase() === normalized);
  return match ? match.name : '';
}

// ---------------------------------------------------------------------
// RENDERING
// ---------------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const boardEl = $('#board');
const pieceSvg = $('#pieceSvg');
const traceSvg = $('#traceSvg');
const paletteEl = $('#palette');
const SVGNS = 'http://www.w3.org/2000/svg';

function computeCellSize(){
  const available = Math.min(window.innerWidth - 24, 680);
  let cs = Math.floor((available - 12) / (COLS + 2));
  cs = Math.max(24, Math.min(cs, 46));
  document.documentElement.style.setProperty('--cs', cs+'px');
  return cs;
}

function renderLabels(){
  const top=$('#labelsTop'), bottom=$('#labelsBottom'), left=$('#labelsLeft'), right=$('#labelsRight');
  [top,bottom,left,right].forEach(el=>el.innerHTML='');
  for(let i=0;i<COLS;i++){ top.appendChild(makeLabel('top',i)); bottom.appendChild(makeLabel('bottom',i)); }
  for(let i=0;i<ROWS;i++){ left.appendChild(makeLabel('left',i)); right.appendChild(makeLabel('right',i)); }
}
function makeLabel(side,index){
  const div=document.createElement('div');
  const used = state.labelColor[side][index] !== undefined;
  div.className='label'+(raysEnabled() ? ' clickable':'');
  div.textContent = labelText(side,index);
  div.dataset.side = side;
  div.dataset.index = index;
  if(used){
    const hex = state.labelColor[side][index];
    div.classList.add('used');
    div.style.background = hex;
    div.style.color = contrastText(hex);
    if(state.labelBounce[side][index]){
      const arrow = document.createElement('span');
      arrow.className='bounce-arrow';
      arrow.textContent='↔';
      div.appendChild(arrow);
    }
  }
  if(raysEnabled()){
    if(used){
      div.addEventListener('click', ()=>{
        const colorName = beamColorName(state.labelColor[side][index]);
        const pairText = state.labelPair[side][index] || '?';
        showLabelBubble(div, colorName ? `${pairText}\n${colorName}` : pairText);
        pulseLabelPair(side, index);
      });
    } else {
      div.addEventListener('click', ()=> onLabelClick(side,index));
    }
  }
  return div;
}
function pulseOneLabel(side,index){
  const el = document.querySelector(`.label[data-side="${side}"][data-index="${index}"]`);
  if(!el) return;
  el.classList.remove('pulse'); void el.offsetWidth;
  el.classList.add('pulse');
  setTimeout(()=> el.classList.remove('pulse'), 1000);
}
function pulseLabelPair(side,index){
  pulseOneLabel(side,index);
  const partner = state.labelPartner[side] && state.labelPartner[side][index];
  if(partner && !(partner.side===side && partner.index===index)) pulseOneLabel(partner.side, partner.index);
}
function showLabelBubble(el, text){
  let bubble = document.getElementById('labelBubble');
  if(!bubble){
    bubble = document.createElement('div');
    bubble.id = 'labelBubble';
    bubble.className = 'label-bubble';
    document.body.appendChild(bubble);
  }
  bubble.textContent = text;
  bubble.style.whiteSpace = 'pre';
  bubble.classList.add('show');
  const rect = el.getBoundingClientRect();
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const margin = 8;
  let left = rect.left + rect.width/2;
  left = Math.max(bw/2+margin, Math.min(window.innerWidth-bw/2-margin, left));
  const above = rect.top - bh - 10 >= 0;
  bubble.classList.toggle('below', !above);
  bubble.style.left = left+'px';
  bubble.style.top = (above ? rect.top : rect.bottom) + 'px';
  clearTimeout(showLabelBubble._t);
  showLabelBubble._t = setTimeout(()=> bubble.classList.remove('show'), 1600);
}

function renderBgGrid(){
  const cs = computeCellSize();
  const bg = $('#bgGrid'); bg.innerHTML='';
  boardEl.style.width = (cs*COLS)+'px';
  boardEl.style.height = (cs*ROWS)+'px';
  const frag = document.createDocumentFragment();
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = document.createElement('div');
      cell.className='cellhit';
      cell.style.left=(c*cs)+'px'; cell.style.top=(r*cs)+'px';
      cell.style.width=cs+'px'; cell.style.height=cs+'px';
      cell.style.border='1px solid rgba(0,0,0,.18)';
      cell.dataset.row=r; cell.dataset.col=c;
      const used = state.cellUsed[r+','+c];
      if(raysEnabled() && !used) cell.addEventListener('click', ()=> onCellClick(r,c,cell));
      frag.appendChild(cell);
    }
  }
  bg.appendChild(frag);
}

function polyPointsAttr(verts){ return verts.map(v=> v.x+','+v.y).join(' '); }

function svgPolyForPiece(piece, opts){
  opts = opts || {};
  const def = CONFIG.PIECES[piece.type];
  const verts = pieceVertices(piece);
  const poly = document.createElementNS(SVGNS,'polygon');
  poly.setAttribute('points', polyPointsAttr(verts));
  if(opts.outline){
    poly.setAttribute('fill','none');
    poly.setAttribute('stroke', def.isOnyx ? '#cfd8dc' : def.hex);
    poly.setAttribute('stroke-width', 0.1);
    poly.setAttribute('stroke-dasharray','0.14,0.09');
  } else if(opts.invalid){
    poly.setAttribute('fill', 'rgba(180,60,50,0.75)');
    poly.setAttribute('stroke', '#ff8a5c');
    poly.setAttribute('stroke-width', 0.06);
  } else {
    poly.setAttribute('fill', def.isDiamond ? 'rgba(207,216,220,0.55)' : def.hex);
    poly.setAttribute('stroke', def.isOnyx ? '#cfd8dc' : 'rgba(0,0,0,.4)');
    poly.setAttribute('stroke-width', def.isOnyx ? 0.03 : 0.045);
  }
  poly.setAttribute('vector-effect','non-scaling-stroke');
  poly.setAttribute('class','piece-poly'+(!opts.outline && piecesEditable() ? ' interactive':'')+(opts.invalid?' piece-invalid':''));
  poly.dataset.id = piece.id;
  return poly;
}
function svgOutlinePiece(piece){
  const def = CONFIG.PIECES[piece.type];
  const pts = polyPointsAttr(pieceVertices(piece));
  const g = document.createElementNS(SVGNS,'g');
  const tint = def.isOnyx ? '#e8e2d6' : def.hex;
  const fill = document.createElementNS(SVGNS,'polygon');
  fill.setAttribute('points', pts);
  fill.setAttribute('fill', tint);
  fill.setAttribute('fill-opacity','0.4');
  fill.setAttribute('stroke','none');
  const back = document.createElementNS(SVGNS,'polygon');
  back.setAttribute('points', pts);
  back.setAttribute('fill','none');
  back.setAttribute('stroke','rgba(8,6,4,0.95)');
  back.setAttribute('stroke-width', 0.32);
  back.setAttribute('stroke-linejoin','round');
  back.setAttribute('vector-effect','non-scaling-stroke');
  const front = document.createElementNS(SVGNS,'polygon');
  front.setAttribute('points', pts);
  front.setAttribute('fill','none');
  front.setAttribute('stroke', tint);
  front.setAttribute('stroke-width', 0.16);
  front.setAttribute('stroke-linejoin','round');
  front.setAttribute('vector-effect','non-scaling-stroke');
  g.appendChild(fill);
  g.appendChild(back);
  g.appendChild(front);
  g.dataset.id = piece.id;
  return g;
}
function renderPieces(){
  pieceSvg.innerHTML='';
  if(state.mode==='solo' && state.soloOver){
    // Comparaison finale : la grille secrète en plein, les gemmes du joueur en contour épais bien visible.
    if(state.soloShowSecret){
      state.secretPieces.forEach(piece=>{
        pieceSvg.appendChild(svgPolyForPiece(piece));
      });
    }
    if(state.soloShowGuess){
      state.pieces.filter(p=>p.center).forEach(piece=>{
        pieceSvg.appendChild(svgOutlinePiece(piece));
      });
    }
    return;
  }
  const invalidIds = (state.mode==='gm' && !state.started) ? computeInvalidPieceIds(state.pieces) : new Set();
  state.pieces.filter(p=>p.center).forEach(piece=>{
    const el = svgPolyForPiece(piece, { invalid: invalidIds.has(piece.id) });
    pieceSvg.appendChild(el);
    if(piecesEditable()) attachPieceInteraction(el, piece);
  });
}

function renderPalette(){
  paletteEl.innerHTML='';
  const inPalette = state.pieces.filter(p=>!p.center);
  paletteEl.classList.toggle('empty', inPalette.length===0);
  const showPalette = piecesEditable();
  const showCheckboxes = state.mode==='gm' && !state.started;
  if(state.mode==='gm'){
    // Les cases à cocher reflètent toujours la présence réelle des pièces (et non un
    // simple drapeau qui pourrait se désynchroniser, par ex. après un retour du mode solo).
    const hasGray = state.pieces.some(p=>p.type==='gray');
    const hasOnyx = state.pieces.some(p=>p.type==='onyx');
    const hasSapphire = state.pieces.some(p=>p.type==='sapphire');
    state.includeGray = hasGray;
    state.includeOnyx = hasOnyx;
    state.includeSapphire = hasSapphire;
    $('#optGray').checked = hasGray;
    $('#optOnyx').checked = hasOnyx;
    $('#optSapphire').checked = hasSapphire;
  }
  $('#paletteTitle').style.display = showPalette?'':'none';
  paletteEl.style.display = showPalette?'flex':'none';
  $('#setupOptions').style.display = showCheckboxes?'flex':'none';
  $('#setupHint').style.display = showPalette?'block':'none';
  $('#setupHint').textContent = state.mode==='solo'
    ? "Place tes gemmes comme tu penses que la grille secrète est composée · tape pour pivoter · reste appuyé pour retourner en miroir · clique un bord ou une case pour indice"
    : "Glisse une gemme sur la grille · tape dessus pour la faire pivoter de 90° · reste appuyé pour la retourner en miroir";
  if(!showPalette) return;
  const cs = computeCellSize();
  inPalette.forEach(piece=>{
    const shape = SHAPES[piece.type];
    // Encombrement maximal possible (à rotation 0, une rotation de 90° ne fait qu'échanger
    // largeur/hauteur donc le plus grand côté reste identique) -> taille de conteneur FIXE,
    // pour que la tuile ne change jamais de taille/position dans la palette en tournant.
    const basePts = shape.pts.map(v=> transformVertex(v,false,0,{x:0,y:0}));
    const bxs=basePts.map(p=>p.x), bys=basePts.map(p=>p.y);
    const baseW = Math.max(...bxs)-Math.min(...bxs), baseH = Math.max(...bys)-Math.min(...bys);
    const pad = 0.15;
    const boxSize = Math.max(baseW,baseH) + 2*pad;

    const pts = shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2, cy=(Math.min(...ys)+Math.max(...ys))/2;
    const svg = document.createElementNS(SVGNS,'svg');
    svg.setAttribute('viewBox', `${cx-boxSize/2} ${cy-boxSize/2} ${boxSize} ${boxSize}`);
    svg.style.width = (boxSize*cs)+'px';
    svg.style.height = (boxSize*cs)+'px';
    svg.classList.add('palette-tile');
    const def = CONFIG.PIECES[piece.type];
    const poly = document.createElementNS(SVGNS,'polygon');
    poly.setAttribute('points', polyPointsAttr(pts));
    poly.setAttribute('fill', def.isDiamond ? 'rgba(207,216,220,0.55)' : def.hex);
    poly.setAttribute('stroke', def.isOnyx ? '#cfd8dc' : 'rgba(0,0,0,.4)');
    poly.setAttribute('stroke-width', 0.05);
    poly.setAttribute('vector-effect','non-scaling-stroke');
    svg.appendChild(poly);
    svg.dataset.id = piece.id;
    paletteEl.appendChild(svg);
    attachPieceInteraction(svg, piece);
  });
}

function renderTraces(){
  let html = state.traces.map(t=>{
    const d = t.points.map((p,i)=> (i===0?'M':'L')+p.x+','+p.y).join(' ');
    return `<path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.55" stroke-linejoin="round" stroke-linecap="round" opacity="0.32" vector-effect="non-scaling-stroke"/>
            <path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.3" stroke-linejoin="round" stroke-linecap="round" opacity="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  html += state.emptyMarks.map(m=>{
    const s=0.14;
    return `<g stroke="rgba(20,16,12,0.55)" stroke-width="0.045" vector-effect="non-scaling-stroke">
      <line x1="${m.x-s}" y1="${m.y-s}" x2="${m.x+s}" y2="${m.y+s}"/>
      <line x1="${m.x-s}" y1="${m.y+s}" x2="${m.x+s}" y2="${m.y-s}"/>
    </g>`;
  }).join('');
  html += state.coordDots.map(m=>{
    return `<circle cx="${m.x}" cy="${m.y}" r="0.17" fill="${m.hex}" stroke="rgba(0,0,0,.45)" stroke-width="0.03"/>`;
  }).join('');
  traceSvg.innerHTML = html;
}

function renderHistory(){
  const el=$('#history');
  if(state.history.length===0){
    el.innerHTML='<div class="history-empty">Démarre la partie puis clique sur une lettre, un chiffre ou une case pour interroger la mine.</div>';
    return;
  }
  el.innerHTML = state.history.slice().reverse().map(h=>`
    <div class="history-item">
      <span class="history-swatch" style="background:${h.hex}"></span>
      <span class="history-text">${h.text}</span>
      <span class="history-time">${h.time}</span>
    </div>`).join('');
}
function renderModePill(){
  const pill=$('#modePill');
  let text, cls;
  if(state.mode==='solo'){
    if(state.soloOver){
      if(state.isDaily){
        text = state.soloResult==='win' ? '📅 Défi du jour — Victoire !' : '📅 Défi du jour — Défaite';
      } else {
        text = state.soloResult==='win' ? '🏆 Victoire !' : '💥 Défaite';
      }
      cls = state.soloResult==='win' ? 'win' : 'lose';
    } else {
      text = state.isDaily ? '📅 Défi du jour — devine la grille' : 'Mode solo — devine la grille';
      cls = 'live';
    }
  } else {
    text = state.started ? 'Partie en cours' : 'Placement des gemmes';
    cls = state.started ? 'live' : '';
  }
  pill.className = 'mode-pill' + (cls ? (' '+cls) : '');
  pill.querySelector('span:last-child').textContent = text;
}
function renderControls(){
  const gmPreStart = state.mode==='gm' && !state.started;
  $('#btnRandom').style.display = gmPreStart ? '' : 'none';
  $('#btnSolo').style.display = gmPreStart ? '' : 'none';
  $('#btnStart').style.display = state.mode==='gm' ? '' : 'none';
  let startBlockReason = '';
  if(state.mode==='gm' && !state.started){
    const unplaced = state.pieces.some(p=>!p.center);
    const conflictCount = computeInvalidPieceIds(state.pieces).size;
    if(unplaced) startBlockReason = 'Place toutes les gemmes avant de démarrer.';
    else if(conflictCount>0) startBlockReason = `${conflictCount} gemme${conflictCount>1?'s':''} en conflit (en rouge) à corriger avant de démarrer.`;
  }
  $('#btnStart').disabled = state.started || !!startBlockReason;
  $('#startBlockMsg').textContent = startBlockReason;
  $('#startBlockMsg').style.display = startBlockReason ? 'block' : 'none';
  $('#btnPropose').style.display = (state.mode==='solo' && !state.soloOver) ? '' : 'none';
  $('#btnHint').style.display = (state.mode==='solo' && !state.soloOver) ? '' : 'none';
  updateHintModeUI();
  $('#btnBackToGM').style.display = state.mode==='solo' ? '' : 'none';
  const soloReveal = state.mode==='solo' && state.soloOver;
  $('#btnToggleGuess').style.display = soloReveal ? '' : 'none';
  $('#btnToggleSecret').style.display = soloReveal ? '' : 'none';
  $('#btnToggleGuess').textContent = (state.soloShowGuess?'👁 ':'🚫 ') + 'Mes gemmes';
  $('#btnToggleSecret').textContent = (state.soloShowSecret?'👁 ':'🚫 ') + 'Gemmes à trouver';
  const showGridId = (soloReveal && state.gridId) || (state.mode==='gm' && state.started && state.gridId);
  $('#gridIdRow').style.display = showGridId ? 'flex' : 'none';
  if(showGridId){
    $('#gridIdText').textContent = state.gridId;
    $('#btnCopyGridId').textContent = state.mode==='gm' ? '📋 Copier le défi' : '📋 Copier';
  }
  $('#btnReplayVictory').style.display = (state.mode==='solo' && state.soloOver && state.soloResult==='win') ? '' : 'none';
  $('#btnReset').style.display = state.isDaily ? 'none' : '';
}
function renderAll(){
  renderModePill();
  renderControls();
  renderLabels();
  renderBgGrid();
  renderPalette();
  renderPieces();
  renderTraces();
  renderHistory();
  buildMixBoard();
}

function shapeIconSVG(type, size){
  size = size||22;
  const shape = SHAPES[type];
  const pts = shape.pts.map(v=> transformVertex(v,false,0,{x:0,y:0}));
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=0.2;
  const def = CONFIG.PIECES[type];
  const fill = def.isDiamond ? 'rgba(207,216,220,0.7)' : def.hex;
  return `<svg class="mix-icon" width="${size}" height="${size}" viewBox="${minX-pad} ${minY-pad} ${(maxX-minX)+2*pad} ${(maxY-minY)+2*pad}">
    <polygon points="${polyPointsAttr(pts)}" fill="${fill}" stroke="rgba(0,0,0,.4)" stroke-width="0.05"/>
  </svg>`;
}
function buildMixBoard(){
  const el = $('#mixBoard');
  function row(types, resultKey){
    const icons = types.map(t=> shapeIconSVG(t)).join('<span style="color:var(--text-faint);font-size:.8rem;">+</span>');
    const res = CONFIG.MIX[resultKey];
    return `<div class="mix-row">${icons}<span style="color:var(--text-faint);">=</span>
      <span class="mix-swatch" style="background:${res.hex}"></span><span class="mix-name">${res.name}</span></div>`;
  }
  el.innerHTML = `
    <div class="mix-quad">
      <div class="mix-block">
        ${row(['red','yellow'],'red+yellow')}
        ${row(['red','blue'],'blue+red')}
        ${row(['yellow','blue'],'blue+yellow')}
      </div>
      <div class="mix-block">
        ${row(['red','yellow','white'],'red+white+yellow')}
        ${row(['red','blue','white'],'blue+red+white')}
        ${row(['yellow','blue','white'],'blue+white+yellow')}
      </div>
    </div>
    <hr class="mix-sep">
    <div class="mix-quad">
      <div class="mix-block">
        ${row(['red','white'],'red+white')}
        ${row(['yellow','white'],'white+yellow')}
        ${row(['blue','white'],'blue+white')}
      </div>
      <div class="mix-block">
        ${row(['red','yellow','blue'],'blue+red+yellow')}
        ${row(['red','yellow','blue','white'],'blue+red+white+yellow')}
      </div>
    </div>
    ${state.includeSapphire ? `
    <hr class="mix-sep">
    <div style="color:var(--gold);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Saphir bleu ciel — compte comme bleu + blanc à chaque contact</div>
    <div class="mix-quad">
      <div class="mix-block">
        ${row(['sapphire'],'blue+white')}
        ${row(['sapphire','white'],'blue+white')}
        ${row(['sapphire','blue'],'blue+white')}
      </div>
      <div class="mix-block">
        ${row(['sapphire','red'],'blue+red+white')}
        ${row(['sapphire','yellow'],'blue+white+yellow')}
        ${row(['sapphire','red','yellow'],'blue+red+white+yellow')}
      </div>
    </div>` : ''}`;
}

// ---------------------------------------------------------------------
// INTERACTIONS — tap = pivoter, appui long = miroir, glisser = déplacer
// ---------------------------------------------------------------------
function attachPieceInteraction(el, piece){
  el.addEventListener('pointerdown', ev=> onPieceDown(ev, piece, el));
}
let toastTimer = null;
function showToast(msg){
  let toast = document.getElementById('toastMsg');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toast.classList.remove('show'), 1600);
}
function onPieceDown(ev, piece, el){
  if(!piecesEditable()) return;
  ev.preventDefault();
  const startX=ev.clientX, startY=ev.clientY;
  let moved=false, longPressed=false, dragging=false;
  let ghost=null;
  const boardRect = ()=> boardEl.getBoundingClientRect();
  const cs = ()=> boardRect().width / COLS;

  const longPressTimer = setTimeout(()=>{
    if(!moved){
      longPressed = true;
      piece.flipped = !piece.flipped;
      resnapAfterTransform(piece);
      saveState();
      el.classList.add('flip-pulse');
      setTimeout(()=>el.classList.remove('flip-pulse'),350);
      if(navigator.vibrate) navigator.vibrate(15);
      renderPalette(); renderPieces();
    }
  }, 480);

  function startDrag(){
    dragging = true;
    el.classList.add('dragging');
    ghost = document.createElement('div');
    ghost.style.position='fixed'; ghost.style.zIndex=999; ghost.style.pointerEvents='none';
    const shape = SHAPES[piece.type];
    const pts = shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY, pad=0.15;
    const csVal = cs();
    ghost.style.width = ((w+2*pad)*csVal)+'px';
    ghost.style.height = ((h+2*pad)*csVal)+'px';
    const def = CONFIG.PIECES[piece.type];
    ghost.innerHTML = `<svg viewBox="${minX-pad} ${minY-pad} ${w+2*pad} ${h+2*pad}" width="100%" height="100%">
      <polygon points="${polyPointsAttr(pts)}" fill="${def.isDiamond?'rgba(207,216,220,0.55)':def.hex}" stroke="rgba(0,0,0,.4)" stroke-width="0.06"/>
    </svg>`;
    document.body.appendChild(ghost);
    positionGhost(ev.clientX, ev.clientY);
  }
  function positionGhost(x,y){
    const gw = parseFloat(ghost.style.width), gh = parseFloat(ghost.style.height);
    ghost.style.left = (x - gw/2)+'px';
    ghost.style.top = (y - gh/2)+'px';
  }
  function onMove(e){
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(!moved && Math.hypot(dx,dy) > 9){ moved=true; clearTimeout(longPressTimer); startDrag(); }
    if(dragging) positionGhost(e.clientX, e.clientY);
  }
  function onUp(e){
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    clearTimeout(longPressTimer);
    if(dragging){
      const rect = boardRect();
      const cellsz = rect.width / COLS;
      const rawX = (e.clientX - rect.left) / cellsz;
      const rawY = (e.clientY - rect.top) / cellsz;
      const {hw,hh} = boundingHalfExtents(piece);
      const {x:cx,y:cy} = snapPieceCenterWithinBounds(rawX, rawY, piece);
      const marginX = state.isDaily ? hw*cellsz : 0;
      const marginY = state.isDaily ? hh*cellsz : 0;
      const withinBoard = e.clientX>=rect.left-marginX && e.clientX<=rect.right+marginX && e.clientY>=rect.top-marginY && e.clientY<=rect.bottom+marginY;
      piece.center = withinBoard ? {x:cx,y:cy} : null;
      ghost.remove();
      el.classList.remove('dragging');
      saveState();
      renderPalette();
      renderPieces();
    } else if(!longPressed){
      piece.rotation = (piece.rotation + 90) % 360;
      resnapAfterTransform(piece);
      saveState();
      renderPalette();
      renderPieces();
    }
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------------------------------------------------------------------
// GAME ACTIONS
// ---------------------------------------------------------------------
function timeNow(){ const d=new Date(); return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

function onLabelClick(side,index){
  if(state.labelColor[side][index] !== undefined) return;
  registerSoloAction('ray');
  const piecesForRay = state.mode==='solo' ? state.secretPieces : state.pieces;
  const result = simulateBeam(side,index,piecesForRay);
  state.labelColor[side][index] = result.color.hex;
  const entryLabelTxt = labelText(side,index);
  let text;
  if(result.absorbed){
    text = `<b>${entryLabelTxt}</b> — Absorbé`;
    state.labelPair[side][index] = 'Absorbé (aucune sortie)';
    state.labelPartner[side][index] = null;
  } else {
    const bounced = result.exitSide===side && result.exitIndex===index;
    const exitLabel = labelText(result.exitSide, result.exitIndex);
    if(state.labelColor[result.exitSide][result.exitIndex] === undefined){
      state.labelColor[result.exitSide][result.exitIndex] = result.color.hex;
    }
    if(bounced){
      state.labelBounce[side][index] = true;
      state.labelPair[side][index] = 'Ressort ici même (↔)';
      state.labelPartner[side][index] = { side, index };
    } else {
      state.labelPair[side][index] = `Sort en ${exitLabel}`;
      state.labelPair[result.exitSide][result.exitIndex] = `Sort en ${entryLabelTxt}`;
      state.labelPartner[side][index] = { side: result.exitSide, index: result.exitIndex };
      state.labelPartner[result.exitSide][result.exitIndex] = { side, index };
    }
    text = bounced
      ? `<b>${entryLabelTxt}</b> ↔ — ${result.color.name}`
      : `<b>${entryLabelTxt}</b> — <b>${exitLabel}</b> — ${result.color.name}`;
  }
  state.history.push({ text, hex: result.color.hex, time: timeNow() });
  if(state.mode!=='solo'){
    state.traces.push({ points: result.points, hex: result.color.hex });
  }
  saveState();
  renderLabels(); renderHistory(); renderTraces();
}

function gemDisplayName(piece){
  const def = CONFIG.PIECES[piece.type];
  if(def.colorKey) return CONFIG.MIX[def.colorKey].name;
  return def.label;
}
let hintModeActive = false;
function setHintMode(active){
  hintModeActive = active;
  updateHintModeUI();
}
function updateHintModeUI(){
  const btn = document.getElementById('btnHint');
  if(!btn) return;
  btn.classList.toggle('active', hintModeActive);
  btn.textContent = hintModeActive ? '🔍 Mode indice actif — touche une case' : '🔍 Demander un indice';
}

function onCellClick(r,c,cellEl){
  const key = r+','+c;
  if(state.cellUsed[key]) return;
  if(state.mode==='solo' && !hintModeActive) return;
  const coord = LEFT_LABELS[r] + (c+1);
  if(state.mode==='solo'){
    if(!confirm(`Révéler le contenu de la case ${coord} ?`)) return;
    registerSoloAction('coord');
  }
  state.cellUsed[key] = true;
  const piecesForQuery = state.mode==='solo' ? state.secretPieces : state.pieces;
  const piece = pieceAtCell(r,c,piecesForQuery);
  let text, hex;
  if(piece){
    const def = CONFIG.PIECES[piece.type];
    text = `<b>${coord}</b> — ${gemDisplayName(piece)}`;
    hex = def.hex;
    if(state.mode==='solo') state.coordDots.push({x:c+0.5, y:r+0.5, hex:def.hex});
  } else {
    text = `<b>${coord}</b> — Vide`;
    hex = '#6b6355';
    state.emptyMarks.push({x:c+0.5, y:r+0.5});
  }
  state.history.push({ text, hex, time: timeNow() });
  if(state.mode==='solo') setHintMode(false);
  saveState();
  renderHistory();
  renderTraces();
  cellEl.classList.remove('queried'); void cellEl.offsetWidth; cellEl.classList.add('queried');
}

// ---------------------------------------------------------------------
// TOP LEVEL EVENTS
// ---------------------------------------------------------------------
$('#btnRandom').addEventListener('click', ()=>{ if(state.mode!=='gm' || state.started) return; randomizePlacement(); });
$('#btnSolo').addEventListener('click', ()=>{ if(state.mode!=='gm' || state.started) return; openSoloChoiceModal(); });
$('#btnStart').addEventListener('click', ()=>{
  if(state.mode!=='gm' || state.started) return;
  if(state.pieces.some(p=>!p.center)){
    alert('Place toutes les gemmes sur la grille avant de démarrer la partie.');
    return;
  }
  if(computeInvalidPieceIds(state.pieces).size>0){
    alert('Certaines gemmes sont en conflit (affichées en rouge sur la grille) : contact par un côté, chevauchement, ou gemme injoignable. Corrige-les avant de démarrer.');
    return;
  }
  state.started = true;
  state.gridId = encodeGridId(state.pieces, state.includeGray, state.includeOnyx, state.includeSapphire);
  saveState();
  renderAll();
});
$('#btnHint').addEventListener('click', ()=> setHintMode(!hintModeActive));
$('#btnPropose').addEventListener('click', ()=> proposeSolution());
$('#btnToggleGuess').addEventListener('click', ()=>{ state.soloShowGuess = !state.soloShowGuess; saveState(); renderControls(); renderPieces(); });
$('#btnToggleSecret').addEventListener('click', ()=>{ state.soloShowSecret = !state.soloShowSecret; saveState(); renderControls(); renderPieces(); });
$('#btnReplayVictory').addEventListener('click', ()=> openVictoryModal());
$('#btnCopyGridId').addEventListener('click', ()=>{
  if(!state.gridId || !navigator.clipboard) return;
  if(state.mode==='gm'){
    const gems = gemFlagsEmojiLine(state.includeGray, state.includeOnyx, state.includeSapphire);
    const text = `Je te défie à Orapa Mine !\n${gems}\nID: ${state.gridId}`;
    navigator.clipboard.writeText(text).then(()=> showToast('Défi copié !'));
  } else {
    navigator.clipboard.writeText(state.gridId).then(()=> showToast('Identifiant copié : '+state.gridId));
  }
});
$('#btnBackToGM').addEventListener('click', ()=>{
  const message = state.soloOver
    ? 'Voulez-vous quitter le mode solo et revenir à la console maître du jeu ?'
    : 'Quitter le mode solo et revenir à la console maître du jeu ? La partie solo en cours sera perdue.';
  if(!confirm(message)) return;
  resetAll();
});
$('#btnReset').addEventListener('click', ()=>{
  if(state.mode==='solo'){
    openSoloSetupModal();
    return;
  }
  if(!confirm("Recommencer efface le placement des gemmes et tout l'historique. Continuer ?")) return;
  resetAll();
});

function openSoloChoiceModal(){
  const { alreadyPlayed, attempt } = dailyStatusToday();
  const line = $('#dailyStatusLine');
  if(alreadyPlayed){
    line.textContent = `Défi du jour déjà joué aujourd'hui (${attempt.result==='win'?'réussi 🏆':'raté 💥'}) — reviens demain.`;
    line.style.display = 'block';
  } else {
    line.style.display = 'none';
  }
  $('#soloChoiceModal').classList.add('open');
}
function closeSoloChoiceModal(){ $('#soloChoiceModal').classList.remove('open'); }
$('#soloChoiceCancel').addEventListener('click', closeSoloChoiceModal);
$('#soloChoiceModal').addEventListener('click', e=>{ if(e.target.id==='soloChoiceModal') closeSoloChoiceModal(); });
$('#soloChoiceDaily').addEventListener('click', ()=>{
  const { alreadyPlayed } = dailyStatusToday();
  if(alreadyPlayed){
    startDailyChallenge();
    return;
  }
  closeSoloChoiceModal();
  $('#dailyRulesModal').classList.add('open');
});
$('#dailyRulesCancel').addEventListener('click', ()=>{
  $('#dailyRulesModal').classList.remove('open');
  openSoloChoiceModal();
});
$('#dailyRulesStart').addEventListener('click', ()=>{
  $('#dailyRulesModal').classList.remove('open');
  startDailyChallenge();
});
$('#dailyRulesModal').addEventListener('click', e=>{
  if(e.target.id==='dailyRulesModal'){
    $('#dailyRulesModal').classList.remove('open');
    openSoloChoiceModal();
  }
});
$('#soloChoiceRandom').addEventListener('click', ()=>{ closeSoloChoiceModal(); openSoloSetupModal(); });
$('#soloChoiceById').addEventListener('click', ()=> promptLoadGridById());
function promptLoadGridById(){
  const id = prompt('Entre l\'identifiant de la grille :', '');
  if(!id) return; // annulé : on reste sur l'écran de choix Aléatoire/Par identifiant
  const decoded = decodeGridId(id);
  if(!decoded){
    alert("Identifiant invalide. Vérifie que tu l'as copié en entier.");
    return; // reste aussi sur l'écran de choix
  }
  if(!confirm('⚠️ Une partie lancée à partir d\'un identifiant ne sera pas ajoutée au classement. Continuer ?')) return;
  closeSoloChoiceModal();
  startSoloGame(id);
}

function openSoloSetupModal(){
  $('#soloOptGray').checked = state.includeGray;
  $('#soloOptOnyx').checked = state.includeOnyx;
  $('#soloOptSapphire').checked = state.includeSapphire;
  $('#soloSetupModal').classList.add('open');
}
function closeSoloSetupModal(){ $('#soloSetupModal').classList.remove('open'); }
$('#soloSetupCancel').addEventListener('click', ()=>{ closeSoloSetupModal(); openSoloChoiceModal(); });
$('#soloSetupModal').addEventListener('click', e=>{ if(e.target.id==='soloSetupModal'){ closeSoloSetupModal(); openSoloChoiceModal(); } });
$('#soloSetupConfirm').addEventListener('click', ()=>{
  state.includeGray = $('#soloOptGray').checked;
  state.includeOnyx = $('#soloOptOnyx').checked;
  state.includeSapphire = $('#soloOptSapphire').checked;
  closeSoloSetupModal();
  startSoloGame();
});
$('#optGray').addEventListener('change', e=> syncOptionalPiece('gray', e.target.checked, 'includeGray'));
$('#optOnyx').addEventListener('change', e=> syncOptionalPiece('onyx', e.target.checked, 'includeOnyx'));
$('#optSapphire').addEventListener('change', e=> syncOptionalPiece('sapphire', e.target.checked, 'includeSapphire'));
function syncOptionalPiece(type, include, flagName){
  state[flagName] = include;
  const existing = state.pieces.filter(p=>p.type===type);
  if(include && existing.length===0) state.pieces.push(newPiece(type));
  else if(!include) state.pieces = state.pieces.filter(p=>p.type!==type);
  saveState(); renderPalette(); renderPieces();
}
$('#helpFab').addEventListener('click', ()=>{
  buildMixBoard();
  $('#helpModal').classList.add('open');
});
$('#closeHelp').addEventListener('click', ()=> $('#helpModal').classList.remove('open'));
$('#closeVictory').addEventListener('click', ()=> $('#victoryModal').classList.remove('open'));
$('#victoryModal').addEventListener('click', e=>{ if(e.target.id==='victoryModal') $('#victoryModal').classList.remove('open'); });
$('#btnVictoryCopyId').addEventListener('click', ()=>{
  if(state.isDaily){
    const text = `Défi du jour (${state.dailyDate})`;
    if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=> showToast('Copié : '+text));
    return;
  }
  if(!state.gridId) return;
  if(navigator.clipboard) navigator.clipboard.writeText(state.gridId).then(()=> showToast('Identifiant copié : '+state.gridId));
});
$('#btnVictoryCopySummary').addEventListener('click', ()=>{
  const text = formatShareText(currentEntryForDisplay());
  if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=> showToast('Résumé copié !'));
});
$('#helpModal').addEventListener('click', e=>{ if(e.target.id==='helpModal') $('#helpModal').classList.remove('open'); });

let rankingView = 'solo';
function buildRankingConfigOptions(){
  const select = $('#rankingConfigSelect');
  if(rankingView==='daily' || rankingView==='global'){
    const todayKey = parisDateKey();
    const yesterdayKey = parisDateKey(new Date(Date.now()-24*3600*1000));
    const prefix = rankingView==='global' ? 'GLOBAL:' : 'DAILY:';
    let options = `<option value="${prefix}${todayKey}">Défi du jour (${todayKey})</option>`;
    if(rankingView==='global' || pruneDailyBoards(loadDailyBoards())[yesterdayKey]){
      options += `<option value="${prefix}${yesterdayKey}">Défi d'hier (${yesterdayKey})</option>`;
    }
    select.innerHTML = options;
  } else {
    select.innerHTML = RANKING_COMBOS.map(([g,o,s])=>{
      const key = configKey(g,o,s);
      return `<option value="${key}">${key}</option>`;
    }).join('');
  }
}
function setRankingView(view){
  rankingView = view;
  $('#rankingTabSolo').classList.toggle('active', view==='solo');
  $('#rankingTabDaily').classList.toggle('active', view==='daily');
  $('#rankingTabGlobal').classList.toggle('active', view==='global');
  $('#rankingSoloIntro').style.display = view==='solo' ? '' : 'none';
  $('#rankingDailyIntro').style.display = view==='daily' ? '' : 'none';
  $('#rankingGlobalIntro').style.display = view==='global' ? '' : 'none';
  $('#btnRefreshGlobal').style.display = view==='global' ? '' : 'none';
  buildRankingConfigOptions();
  if(view==='solo') $('#rankingConfigSelect').value = configKey(state.includeGray, state.includeOnyx, state.includeSapphire);
  renderRankingList();
}
let expandedScores = new Set();
function rankingMedal(i){ return ['🥇','🥈','🥉'][i] || `#${i+1}`; }
function globalEntryToLocal(e){
  return {
    id:e.id, name:e.player_name, success:e.success, cost:e.cost,
    rayCount:e.ray_count, coordCount:e.coord_count, timeMs:e.time_ms,
    date:new Date(e.created_at).getTime(), dailyDate:e.daily_date, isDaily:true
  };
}
async function renderGlobalRanking(dateKey, force=false){
  const el = $('#rankingList');
  const token = `${dateKey}:${Date.now()}`;
  el.dataset.renderToken = token;
  globalRankingLoading = true;
  el.innerHTML = '<div class="history-empty">🌍 Chargement du classement global…</div>';
  try{
    const rows = await fetchGlobalDailyScores(dateKey, force);
    if(el.dataset.renderToken!==token || rankingView!=='global') return;
    const myId = loadGlobalScoreIds()[dateKey];
    const layout = generateDailyLayout(dateKey);
    const gems = layout ? gemFlagsEmojiLine(layout.flags.gray, layout.flags.onyx, layout.flags.sapphire) : '';
    if(rows.length===0){
      el.innerHTML = '<div class="history-empty">Aucun score global enregistré pour ce défi.</div>';
      return;
    }
    const wins = rows.filter(r=>r.success).length;
    el.innerHTML = `<div class="global-ranking-summary"><b>${rows.length}</b> participant${rows.length>1?'s':''} · <b>${wins}</b> réussite${wins>1?'s':''}<span>${gems}</span></div>` + rows.map((raw,i)=>{
      const e=globalEntryToLocal(raw);
      const expanded=expandedScores.has(`g${e.id}`);
      const mine=String(e.id)===String(myId);
      const failTag=e.success ? '' : '<span class="ranking-fail">Échec</span>';
      const detail=expanded ? `<div class="ranking-row-detail">${e.rayCount} rayon${e.rayCount===1?'':'s'} 🔦 + ${e.coordCount} coordonnée${e.coordCount===1?'':'s'} 📍 · ${formatDuration(e.timeMs)}</div><div class="controls" style="justify-content:flex-start;gap:8px;margin:8px 0 2px 34px;"><button class="ranking-copy-summary" data-global-idx="${i}">📋 Copier le résumé</button></div>` : '';
      return `<div class="ranking-row global-row${expanded?' expanded':''}${mine?' ranking-mine':''}" data-global-id="${e.id}"><div class="ranking-row-top"><span class="ranking-rank${i===0?' top1':''}">${rankingMedal(i)}</span><span class="ranking-name">${escapeHtml(e.name||'Anonyme')} ${mine?'<span class="ranking-you">Vous</span>':''}</span>${failTag}<span class="ranking-points">${e.cost} pts</span><span class="ranking-time">${formatDuration(e.timeMs)}</span></div>${detail}</div>`;
    }).join('');
    el.querySelectorAll('.global-row').forEach(row=>row.addEventListener('click',ev=>{
      if(ev.target.closest('.ranking-copy-summary')) return;
      const k=`g${row.dataset.globalId}`;
      if(expandedScores.has(k)) expandedScores.delete(k); else expandedScores.add(k);
      renderGlobalRanking(dateKey);
    }));
    el.querySelectorAll('[data-global-idx]').forEach(btn=>btn.addEventListener('click',ev=>{
      ev.stopPropagation();
      const entry=globalEntryToLocal(rows[Number(btn.dataset.globalIdx)]);
      navigator.clipboard?.writeText(formatShareText(entry)).then(()=>showToast('Résumé copié !'));
    }));
  }catch(err){
    console.error('Chargement du classement global impossible :',err);
    if(el.dataset.renderToken===token) el.innerHTML='<div class="history-empty">⚠️ Impossible de joindre le classement global.<br><small>Vérifie la connexion puis utilise « Actualiser ».</small></div>';
  }finally{ globalRankingLoading=false; }
}
function renderRankingList(){
  const key = $('#rankingConfigSelect').value || '';
  if(key.startsWith('GLOBAL:')){
    $('#btnResetRanking').style.display='none';
    renderGlobalRanking(key.slice(7));
    return;
  }
  const isDailyKey = key.startsWith('DAILY:');
  const dailyDateKey = isDailyKey ? key.slice(6) : null;
  const list = isDailyKey ? (pruneDailyBoards(loadDailyBoards())[dailyDateKey] || []) : (loadRankings()[key] || []);
  const dailyLayout = isDailyKey ? generateDailyLayout(dailyDateKey) : null;
  const dailyGems = dailyLayout ? gemFlagsEmojiLine(dailyLayout.flags.gray, dailyLayout.flags.onyx, dailyLayout.flags.sapphire) : '';
  const el = $('#rankingList');
  $('#btnResetRanking').style.display = isDailyKey ? 'none' : '';
  if(list.length===0){
    el.innerHTML = `<div class="history-empty">Aucun score enregistré ${isDailyKey?'pour ce défi':'pour cette configuration'}.</div>`;
    return;
  }
  el.innerHTML = list.map((e,i)=>{
    const d = new Date(e.date).toLocaleDateString('fr-FR');
    const expanded = expandedScores.has(e.date);
    const failTag = (isDailyKey && e.success===false) ? ' <span style="color:#e59c8c;">— Échec</span>' : '';
    const detailHtml = expanded ? `<div class="ranking-row-detail">${e.rayCount||0} rayon${e.rayCount===1?'':'s'} 🔦 + ${e.coordCount||0} coordonnée${e.coordCount===1?'':'s'} 📍 · ${formatDuration(e.timeMs)}</div>${e.gridId ? `<div class="ranking-row-id">Grille : <b>${escapeHtml(e.gridId)}</b></div>` : ''}<div class="controls" style="justify-content:flex-start;gap:8px;margin:8px 0 2px 34px;">${isDailyKey ? '' : `<button class="ranking-copy-id" data-idx="${i}">📋 Copier ID</button>`}<button class="ranking-copy-summary" data-idx="${i}">📋 Copier le résumé</button></div>` : '';
    return `<div class="ranking-row${expanded?' expanded':''}" data-date="${e.date}"><div class="ranking-row-top"><span class="ranking-rank${i===0?' top1':''}">${rankingMedal(i)}</span><span class="ranking-name">${escapeHtml(e.name||'Anonyme')}${failTag}</span>${isDailyKey ? `<span class="ranking-gems">${dailyGems}</span>` : ''}<span class="ranking-points">${e.cost} pts</span><span class="ranking-date">${d}</span></div>${detailHtml}</div>`;
  }).join('');
  el.querySelectorAll('.ranking-row').forEach(row=>row.addEventListener('click',ev=>{
    if(ev.target.closest('.ranking-copy-id') || ev.target.closest('.ranking-copy-summary')) return;
    const date=Number(row.dataset.date); if(expandedScores.has(date)) expandedScores.delete(date); else expandedScores.add(date); renderRankingList();
  }));
  el.querySelectorAll('.ranking-copy-id').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();const entry=list[Number(btn.dataset.idx)];navigator.clipboard?.writeText(entry.gridId||'').then(()=>showToast('Identifiant copié : '+entry.gridId));}));
  el.querySelectorAll('.ranking-copy-summary').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();const entry=list[Number(btn.dataset.idx)];navigator.clipboard?.writeText(formatShareText(entry)).then(()=>showToast('Résumé copié !'));}));
}
$('#rankingTabSolo').addEventListener('click', ()=> setRankingView('solo'));
$('#rankingTabDaily').addEventListener('click', ()=> setRankingView('daily'));
$('#rankingTabGlobal').addEventListener('click', ()=> setRankingView('global'));
$('#btnRefreshGlobal').addEventListener('click', ()=>{
  const key=$('#rankingConfigSelect').value;
  if(key.startsWith('GLOBAL:')) renderGlobalRanking(key.slice(7),true);
});
$('#rankingsFab').addEventListener('click', ()=>{
  setRankingView(state.isDaily ? 'daily' : 'solo');
  $('#rankingsModal').classList.add('open');
});
$('#closeRankings').addEventListener('click', ()=> $('#rankingsModal').classList.remove('open'));
$('#rankingsModal').addEventListener('click', e=>{ if(e.target.id==='rankingsModal') $('#rankingsModal').classList.remove('open'); });
$('#rankingConfigSelect').addEventListener('change', renderRankingList);
$('#btnResetRanking').addEventListener('click', ()=>{
  const key = $('#rankingConfigSelect').value;
  if(key.startsWith('DAILY:') || key.startsWith('GLOBAL:')) return;
  if(!confirm(`Réinitialiser le classement « ${key} » ? Cette action est irréversible.`)) return;
  const rankings = loadRankings(); rankings[key]=[]; saveRankings(rankings); renderRankingList();
});
window.addEventListener('resize', ()=>{ renderBgGrid(); renderPieces(); renderTraces(); });

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
function init(){
  buildMixBoard();
  const restored = loadState();
  if(!restored){ state.pieces = freshPieceSet(); }
  $('#optGray').checked = state.includeGray;
  $('#optOnyx').checked = state.includeOnyx;
  $('#optSapphire').checked = state.includeSapphire;
  computeCellSize();
  renderAll();
}
init();
