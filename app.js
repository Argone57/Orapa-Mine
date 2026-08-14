// Orapa Mine V2 - correctif fenêtre de score et classements globaux - 2026-07-25
const APP_VERSION = '20260814-0010';
let publishedAppVersion = null;
let lastVersionCheckAt = 0;
let versionCheckPromise = null;

async function fetchPublishedAppVersion(force=false){
  const now=Date.now();
  if(!force && publishedAppVersion && now-lastVersionCheckAt<60000) return publishedAppVersion;
  if(versionCheckPromise) return versionCheckPromise;
  versionCheckPromise=(async()=>{
    const response=await fetch(`version.json?_=${now}`,{cache:'no-store'});
    if(!response.ok) throw new Error(`Version inaccessible (${response.status})`);
    const data=await response.json();
    if(!data?.version) throw new Error('Version publiée invalide');
    publishedAppVersion=String(data.version);
    lastVersionCheckAt=Date.now();
    return publishedAppVersion;
  })();
  try{return await versionCheckPromise;}finally{versionCheckPromise=null;}
}
function openAppUpdateModal(kind='outdated'){
  const unavailable=kind==='unavailable';
  $('#appUpdateMessage').textContent=unavailable
    ? 'Impossible de vérifier que le défi du jour utilise la dernière version. Vérifie ta connexion puis réessaie.'
    : 'Une nouvelle version d’Orapa Mine est disponible. La mise à jour est nécessaire pour accéder au défi du jour.';
  $('#appUpdateConfirm').textContent=unavailable?'Réessayer':'Mettre à jour';
  $('#appUpdateConfirm').dataset.action=unavailable?'retry':'update';
  $('#appUpdateModal').classList.add('open');
}
function closeAppUpdateModal(){ $('#appUpdateModal').classList.remove('open'); }
async function ensureCurrentAppVersion(required=false,force=false){
  try{
    const remoteVersion=await fetchPublishedAppVersion(force);
    if(remoteVersion!==APP_VERSION){ openAppUpdateModal('outdated'); return false; }
    return true;
  }catch(error){
    if(required) openAppUpdateModal('unavailable');
    return !required;
  }
}
function reloadLatestAppVersion(){
  const url=new URL(window.location.href);
  url.searchParams.set('update',publishedAppVersion||Date.now());
  window.location.replace(url.toString());
}
// =====================================================================
// ORAPA MINE — Console du maître du jeu (v3)
// =====================================================================
// L’onde est simulée en géométrie continue : elle avance en ligne droite et
// rebondit sur la première arête de pièce rencontrée.
//  - Arête droite (horizontale/verticale)  -> renvoie en sens inverse.
//  - Arête oblique (45°)                   -> dévie à angle droit.
//  - Corps noir       -> arrête l’onde dès contact (aucune sortie).
//  - Diamant          -> dévie normalement mais ne colore jamais l’onde.
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
  gameVariant:'classic',
  missingType:null,
  selectedMissingType:null,
  placementBonus:false,
  dailyDate:null,
  history:[],
  historyHintShown:false,
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
// CLASSEMENTS SOLO
// ---------------------------------------------------------------------
const COST_RAY = 1, COST_COORD = 3;
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
  const d = e.isDaily && e.dailyDate
    ? formatDailyDate(e.dailyDate)
    : new Date(e.date).toLocaleDateString('fr-FR');
  if(e.isDaily){
    return `Orapa Mine · Défi du jour · ${d}\n${e.name||'Anonyme'} - ${e.success===false?'😞':'🏅'} - ${e.cost} pts (${e.rayCount||0}🔦/${e.coordCount||0}📍)\nhttps://argone57.github.io/Orapa-Mine/`;
  }
  const decoded = e.gridId ? decodeGridId(e.gridId) : null;
  if(e.gameVariant==='lost'||decoded?.variant==='lost'){
    const puzzle=e.success!==false&&e.placementBonus?'/🧩':'';
    return `Orapa Mine · Gemme perdue · ${d}\n${e.name||'Anonyme'} - ${e.success===false?'😞':'🏅'} - ${e.cost} pts (${e.rayCount||0}🔦/${e.coordCount||0}📍${puzzle}) - ID: ${e.gridId||'?'}\nhttps://argone57.github.io/Orapa-Mine/`;
  }
  const gems = decoded
    ? gemFlagsEmojiLine(decoded.includeGray, decoded.includeOnyx, decoded.includeSapphire)
    : gemFlagsEmojiLine(state.includeGray, state.includeOnyx, state.includeSapphire);
  const idPart = `ID: ${e.gridId||'?'}`;
  return `Orapa Mine · ${gems} · ${d}\n${e.name||'Anonyme'} - ${e.success===false?'😞':'🏅'} - ${e.cost} pts (${e.rayCount||0}🔦/${e.coordCount||0}📍) - ${idPart}\nhttps://argone57.github.io/Orapa-Mine/`;
}
// ---------------------------------------------------------------------
// DÉFI DU JOUR — tentative unique (par navigateur) + classement journalier.
// Le classement est stocké localement (voir le README pour la limite : sans
// backend externe, il n'est pas synchronisé entre navigateurs différents).
// ---------------------------------------------------------------------
const DAILY_ATTEMPT_KEY = 'orapaMineDailyAttemptV1';
const DAILY_RANKINGS_KEY = 'orapaMineDailyRankingsV1';
const DAILY_FINAL_SNAPSHOTS_KEY = 'orapaMineDailyFinalSnapshotsV1';
let remoteDailyStatusCache = null;
let remoteDailyStatusPromise = null;
function loadDailyAttempt(){
  try{ const raw = localStorage.getItem(DAILY_ATTEMPT_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function saveDailyAttempt(a){ try{ localStorage.setItem(DAILY_ATTEMPT_KEY, JSON.stringify(a)); }catch(e){} }
function dailyAttemptAccountKey(){ return String(currentPlayerAccount?.id || currentPlayerAccount?.display_name || 'local'); }
function dailySnapshotAccountKey(){
  return String(currentPlayerAccount?.id || currentPlayerAccount?.display_name || 'local');
}
function dailySnapshotKey(dateKey){ return `${dailySnapshotAccountKey()}::${dateKey}`; }
function loadDailyFinalSnapshots(){
  try{ const raw=localStorage.getItem(DAILY_FINAL_SNAPSHOTS_KEY); return raw?JSON.parse(raw):{}; }catch(e){ return {}; }
}
function saveDailyFinalSnapshot(){
  if(!state.isDaily || !state.dailyDate || !state.soloOver) return;
  try{
    const snapshots=loadDailyFinalSnapshots();
    snapshots[dailySnapshotKey(state.dailyDate)]={state:JSON.parse(JSON.stringify(state)),lastScoreResult:JSON.parse(JSON.stringify(lastScoreResult))};
    localStorage.setItem(DAILY_FINAL_SNAPSHOTS_KEY,JSON.stringify(snapshots));
  }catch(e){}
}
function loadDailyFinalSnapshot(dateKey){
  const snapshot=loadDailyFinalSnapshots()[dailySnapshotKey(dateKey)];
  return snapshot?.state?.isDaily && snapshot.state.soloOver ? snapshot : null;
}
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

const PLAYER_ACCOUNT_KEY = 'orapaMinePlayerAccountV1';
const PLAYER_TRUST_KEY = 'orapaMinePlayerTrustV1';
const FIREFOX_PERFORMANCE_KEY = 'orapaMineFirefoxPerformanceV1';
const LEGACY_FIREFOX_ANDROID_PERFORMANCE_KEY = 'orapaMineFirefoxAndroidPerformanceV1';
let currentPlayerAccount = loadPlayerAccount();
let scoreIdentityResolver = null;

function isFirefox(){
  const ua=navigator.userAgent||'';
  return /Firefox\//i.test(ua);
}
function firefoxPerformanceEnabled(){
  if(!isFirefox())return false;
  try{return localStorage.getItem(FIREFOX_PERFORMANCE_KEY)==='1'||localStorage.getItem(LEGACY_FIREFOX_ANDROID_PERFORMANCE_KEY)==='1';}catch(e){return false;}
}
function applyFirefoxPerformanceMode(){
  document.body.classList.toggle('firefox-performance',firefoxPerformanceEnabled());
}
function setFirefoxPerformanceMode(enabled){
  try{
    enabled?localStorage.setItem(FIREFOX_PERFORMANCE_KEY,'1'):localStorage.removeItem(FIREFOX_PERFORMANCE_KEY);
    localStorage.removeItem(LEGACY_FIREFOX_ANDROID_PERFORMANCE_KEY);
  }catch(e){}
  applyFirefoxPerformanceMode();
}

function loadPlayerAccount(){
  try{ return JSON.parse(localStorage.getItem(PLAYER_ACCOUNT_KEY)||'null'); }catch(e){ return null; }
}
function savePlayerAccount(account){
  currentPlayerAccount=account||null;
  invalidateGlobalSoloScores();
  try{
    if(account) localStorage.setItem(PLAYER_ACCOUNT_KEY,JSON.stringify(account));
    else localStorage.removeItem(PLAYER_ACCOUNT_KEY);
  }catch(e){}
  updateAccountFab();
}
function isTrustedDevice(){ return localStorage.getItem(PLAYER_TRUST_KEY)==='1'; }
function setTrustedDevice(value){
  try{ value ? localStorage.setItem(PLAYER_TRUST_KEY,'1') : localStorage.removeItem(PLAYER_TRUST_KEY); }catch(e){}
}
function updateAccountFab(){
  const btn=$('#accountFab'); if(!btn) return;
  btn.textContent=currentPlayerAccount ? `👤 ${currentPlayerAccount.display_name}` : '👤 Compte';
  btn.classList.toggle('connected',!!currentPlayerAccount);
}
async function supabaseRpc(fn,params={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{
    method:'POST',headers:supabaseHeaders({'Content-Type':'application/json'}),body:JSON.stringify(params)
  });
  let data=null; try{data=await response.json();}catch(e){}
  if(!response.ok){
    const msg=data?.message||data?.error||`Erreur HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}
let achievementCatalogCache=null,achievementExpanded=new Set(),achievementMode='list',achievementSort='order',achievementFilter='all',achievementReverse=false,achievementQueueBusy=false;
const ACHIEVEMENT_NAMES={welcome:'Bienvenue',good_student:'Bon élève',first_step:'Premier pas',first_win:'Première victoire',founder:'Fondateur',ancestor:'Ancêtre',adventurous:'Aventureux',adventurous_victorious:'Aventureux et victorieux',meticulous:'Méticuleux',diamond:'Diamant',black_body:'Corps noir',sky_sapphire:'Saphir bleu ciel',curious:'Curieux',architect:'Architecte',challenger:'Défieur',mine_regular:'Habitué de la mine',confirmed_miner:'Mineur confirmé',first_try:'Du premier coup',economical:'Économe',mole_eye:'Œil de taupe',back_to_mine:'Retour au fond de la mine',regular:'Régulier',challenge_week:'Une semaine de défis',always_present:'Toujours présent',assiduous:'Assidu',winning_streak:'Série victorieuse',perfect_week:'Semaine parfaite',podium:'Sur le podium',number_one:'Numéro un',next_day_revenge:'La revanche du lendemain',photofinish:'Photofinish',copycat:'Copie conforme',first_visitor:'Premier visiteur',deja_vu:'Une impression de déjà-vu',two_waves_late:'Deux ondes de retard',triforce:'Triforce',where_is_charlie:'Où est Charlie ?',seven_at_home:'Sept à la maison',eight_out_of_eight:'Huit sur huit',perfect_reconstructions:'Reconstitutions parfaites',lost_quickly_found:'Perdue, mais vite retrouvée',fine_sleuth:'Fin limier',organized_search:'Battue organisée',missing_notice:'Avis de disparition',without_touching_evidence:'Sans toucher aux preuves',detective_flair:'Le flair du détective',dissectologist:'Dissectologue',cephaloclastophile:'Céphaloclastophile',indiana_and_short_round:'Indiana Jones et Demi-Lune'};
async function refreshAchievements(eventKey=null){
  if(!currentPlayerAccount?.session_token)return null;
  let triforceResult=null,allModeResult=null;
  try{triforceResult=await supabaseRpc('orapa_triforce_status',{p_session_token:currentPlayerAccount.session_token});}
  catch(error){console.error('Vérification du succès Triforce impossible :',error);}
  try{allModeResult=await supabaseRpc('orapa_refresh_all_mode_achievements',{p_session_token:currentPlayerAccount.session_token});}catch(error){console.error('All-mode achievement check failed:',error);}
  try{
    const result=await supabaseRpc('orapa_refresh_achievements',{p_session_token:currentPlayerAccount.session_token,p_event:eventKey});
    achievementCatalogCache=null;
    const keys=[...new Set([...(Array.isArray(result?.new_keys)?result.new_keys:[]),...(Array.isArray(allModeResult?.new_keys)?allModeResult.new_keys:[]),...(triforceResult?.newly_unlocked?['triforce']:[])])];
    if(keys.includes('welcome')) showWelcomeAchievement();
    const regular=keys.filter(key=>key!=='welcome');
    if(regular.length&&!result?.hide_notifications) queueAchievementNotifications(regular);
    return {...result,new_keys:keys,triforce_unlocked:!!triforceResult?.unlocked,triforce_check_ok:!!triforceResult};
  }catch(error){
    console.error('Actualisation des succès impossible :',error);
    if(triforceResult?.newly_unlocked&&!triforceResult.hide_notifications)queueAchievementNotifications(['triforce']);
    return triforceResult?{triforce_unlocked:!!triforceResult.unlocked,triforce_check_ok:true}:null;
  }
}
async function queueAchievementNotifications(keys){
  if(achievementQueueBusy)return;
  achievementQueueBusy=true;
  for(const key of keys){
    let toast=$('#achievementToast');
    if(!toast){toast=document.createElement('div');toast.id='achievementToast';toast.className='achievement-toast';document.body.appendChild(toast);}
    toast.textContent=`🏆 Succès débloqué · ${ACHIEVEMENT_NAMES[key]||key}`;toast.classList.add('show');
    await new Promise(resolve=>setTimeout(resolve,2000));toast.classList.remove('show');await new Promise(resolve=>setTimeout(resolve,220));
  }
  achievementQueueBusy=false;
}
function showWelcomeAchievement(){
  $('#welcomeAchievementCard').innerHTML='<div class="achievement-row unlocked"><div class="achievement-row-top"><span class="achievement-name">🏆 Bienvenue</span><span class="achievement-points">5 pts</span></div><div class="achievement-detail" style="display:block">Créer un compte joueur.</div></div>';
  $('#welcomeAchievementModal').classList.add('open');
}
async function getAchievementCatalog(force=false){
  if(!force&&achievementCatalogCache)return achievementCatalogCache;
  achievementCatalogCache=await supabaseRpc('orapa_achievement_catalog',{p_session_token:currentPlayerAccount.session_token});
  return achievementCatalogCache||[];
}
function achievementToolbar(rows,myOnly=false){const visible=sortedAchievements(rows,myOnly),allExpanded=visible.length>0&&visible.every(row=>achievementExpanded.has(row.achievement_key));return `<div class="achievement-toolbar"><select id="achievementSort" class="ranking-select"><option value="order">Ordre</option><option value="date">Date d’obtention</option><option value="name">Nom</option><option value="count">Nombre de joueurs</option><option value="points">Points</option></select><select id="achievementFilter" class="ranking-select"><option value="all">Tous</option><option value="unlocked">Obtenus</option><option value="locked">Non obtenus</option></select><button id="achievementReverse" class="ghost achievement-direction" aria-label="Inverser l’ordre">${achievementReverse?'↑':'↓'}</button><button id="achievementExpandAll" class="ghost achievement-expand-all" aria-label="${allExpanded?'Replier':'Déplier'} tous les succès">${allExpanded?'−':'+'}</button></div>`;}
function sortedAchievements(rows,myOnly=false){
  let result=rows.filter(row=>!myOnly||row.unlocked).filter(row=>achievementFilter==='all'||(achievementFilter==='unlocked'?row.unlocked:!row.unlocked));
  const value=row=>achievementSort==='date'?(row.unlocked_at?new Date(row.unlocked_at).getTime():0):achievementSort==='name'?String(row.name).localeCompare('', 'fr'):achievementSort==='count'?Number(row.unlock_count):achievementSort==='points'?Number(row.points):Number(row.display_order);
  result.sort((a,b)=>{if(achievementSort==='name')return String(a.name).localeCompare(String(b.name),'fr');if(achievementSort==='date')return (new Date(a.unlocked_at||0)-new Date(b.unlocked_at||0));return value(a)-value(b);});
  if(achievementSort!=='count'&&achievementSort!=='points'&&achievementSort!=='date')result.sort((a,b)=>(Number(b.unlocked)-Number(a.unlocked))||(achievementSort==='name'?String(a.name).localeCompare(String(b.name),'fr'):Number(a.display_order)-Number(b.display_order)));
  if(achievementReverse)result.reverse();return result;
}
function meticulousProgress(row){const won=new Set((row.progress_data||[]).map(Number));return `<div style="display:grid;gap:3px;margin-top:7px">${Array.from({length:8},(_,mask)=>`<div>${won.has(mask)?'✅':'⬜'} ${gemFlagsEmojiLine(!!(mask&1),!!(mask&2),!!(mask&4))}</div>`).sort((a,b)=>(a.startsWith('✅')?1:0)-(b.startsWith('✅')?1:0)).join('')}</div>`;}
function achievementRowsHtml(rows,myOnly=false){
  const sorted=sortedAchievements(rows,myOnly);if(!sorted.length)return '<div class="history-empty">Aucun succès dans cette sélection.</div>';
  return `<div class="achievement-list">${sorted.map(row=>{const expanded=achievementExpanded.has(row.achievement_key),secret=row.visibility==='hidden',star=Number(row.points||0)===0&&(secret||row.visibility==='masked'),showProgress=row.progress_target&&(row.visibility!=='masked'||row.unlocked),progress=showProgress?`<div class="achievement-progress"><i style="width:${Math.min(100,100*Number(row.progress_value||0)/Number(row.progress_target))}%"></i></div><small>${row.progress_value||0} / ${row.progress_target}</small>${row.achievement_key==='meticulous'?meticulousProgress(row):''}`:'',date=row.unlocked_at?new Date(row.unlocked_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';return `<div class="achievement-row ${row.unlocked?'unlocked':'locked'}${secret?' hidden-achievement':''}${expanded?' expanded':''}" data-achievement-key="${row.achievement_key}"><div class="achievement-row-top"><span class="achievement-title-cell"><span class="achievement-status">${row.unlocked?'✓':'○'}</span><span class="achievement-name">${escapeHtml(row.name)}</span></span><span class="achievement-date">${date}</span><span class="achievement-count">👥 ${row.unlock_count||0}</span><span class="achievement-points">${star?'<span class="achievement-star" aria-label="Succès sans points">★</span>':row.points+' pts'}</span></div><div class="achievement-detail"><div>${escapeHtml(row.description)}</div>${progress}<div class="achievement-actions"><button class="ghost achievement-unlockers" data-achievement-key="${row.achievement_key}">Voir les joueurs</button></div></div></div>`;}).join('')}</div>`;
}
function bindAchievementList(container,rows,myOnly=false,toolbarContainer=null){
  container.querySelectorAll('[data-achievement-key].achievement-row').forEach(row=>row.onclick=event=>{if(event.target.closest('button'))return;const key=row.dataset.achievementKey;achievementExpanded.has(key)?achievementExpanded.delete(key):achievementExpanded.add(key);renderAchievementsInto(container,rows,myOnly,toolbarContainer);});
  container.querySelectorAll('.achievement-unlockers').forEach(button=>button.onclick=event=>{event.stopPropagation();openAchievementUnlockers(button.dataset.achievementKey,rows.find(row=>row.achievement_key===button.dataset.achievementKey)?.name);});
}
function renderAchievementsInto(container,rows,myOnly=false,toolbarContainer=null){const toolbarHost=toolbarContainer||container;if(toolbarContainer){toolbarHost.innerHTML=achievementToolbar(rows,myOnly);container.innerHTML=achievementRowsHtml(rows,myOnly);}else container.innerHTML=achievementToolbar(rows,myOnly)+achievementRowsHtml(rows,myOnly);const sort=toolbarHost.querySelector('#achievementSort'),filter=toolbarHost.querySelector('#achievementFilter'),reverse=toolbarHost.querySelector('#achievementReverse'),expandAll=toolbarHost.querySelector('#achievementExpandAll');sort.value=achievementSort;filter.value=achievementFilter;sort.onchange=e=>{achievementSort=e.target.value;renderAchievementsInto(container,rows,myOnly,toolbarContainer)};filter.onchange=e=>{achievementFilter=e.target.value;renderAchievementsInto(container,rows,myOnly,toolbarContainer)};reverse.onclick=()=>{achievementReverse=!achievementReverse;renderAchievementsInto(container,rows,myOnly,toolbarContainer)};expandAll.onclick=()=>{const visible=sortedAchievements(rows,myOnly),allExpanded=visible.length>0&&visible.every(row=>achievementExpanded.has(row.achievement_key));visible.forEach(row=>allExpanded?achievementExpanded.delete(row.achievement_key):achievementExpanded.add(row.achievement_key));renderAchievementsInto(container,rows,myOnly,toolbarContainer)};bindAchievementList(container,rows,myOnly,toolbarContainer);}
async function openAchievementUnlockers(key,name){
  $('#achievementUnlockersTitle').textContent=`🏆 ${name||'Succès'}`;$('#achievementUnlockersContent').innerHTML='<div class="history-empty">Chargement…</div>';$('#achievementUnlockersModal').classList.add('open');
  try{const rows=await supabaseRpc('orapa_achievement_unlockers',{p_session_token:currentPlayerAccount.session_token,p_achievement_key:key});$('#achievementUnlockersContent').innerHTML=rows?.length?rows.map(row=>`<div class="achievement-ranking-row${row.is_mine?' mine':''}"><span>${row.is_mine?'✓':'•'}</span><strong>${escapeHtml(row.player_name)}</strong><small style="grid-column:3/5">${new Date(row.unlocked_at).toLocaleDateString('fr-FR')}</small></div>`).join(''):'<div class="history-empty">Personne pour le moment.</div>';}catch(e){$('#achievementUnlockersContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;}
}
async function openMyAchievements(){openGridDataShell('🏆 Mes succès','',true);await refreshAchievements();try{const rows=await getAchievementCatalog(true);renderAchievementsInto($('#gridDataContent'),rows,false);}catch(e){$('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;}}
function validPin(pin){ return /^\d{4}$/.test(pin||''); }
function looksLikeEmailAddress(name){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test((name||'').trim()); }
const EMAIL_AS_PSEUDO_WARNING='Attention, il semble que vous ayez saisi une adresse mail à la place d’un pseudo.';
function accountError(id,msg){
  const el=$(id);
  if(!el) return;
  el.textContent=msg||'';
  el.style.display=msg?'block':'none';
}
function accountInput(label,id,type='text',extra=''){
  return `<label>${label}<input id="${id}" type="${type}" ${extra}></label>`;
}
async function validateSavedAccount(){
  if(!currentPlayerAccount?.session_token) return;
  try{
    const data=await supabaseRpc('orapa_get_account',{p_session_token:currentPlayerAccount.session_token});
    savePlayerAccount({...currentPlayerAccount,id:data.id,display_name:data.display_name});
    try{await supabaseRpc('orapa_sync_profile_name',{p_session_token:currentPlayerAccount.session_token});}catch(syncError){console.error('Synchronisation du pseudo impossible :',syncError);}
  }catch(e){ savePlayerAccount(null); setTrustedDevice(false); }
}
async function loadMyAccountStats(){
  if(!currentPlayerAccount) return null;
  return supabaseRpc('orapa_my_stats',{p_session_token:currentPlayerAccount.session_token});
}
function showAccountLogin(){
  const content=$('#accountContent');
  content.innerHTML=`<div class="account-status disconnected">⚪ Non connecté</div>
    <p>Connecte-toi avec ton pseudo unique et ton code à 4 chiffres.</p>
    <div class="account-form">
      ${accountInput('Pseudo','accountLoginName','text','maxlength="24" autocomplete="nickname"')}
      ${accountInput('Code à 4 chiffres','accountLoginPin','password','inputmode="numeric" maxlength="4" autocomplete="off"')}
      <div class="account-error" id="accountLoginError"></div>
    </div>
    <div class="account-main-actions">
      <button class="primary" id="accountLoginBtn">Se connecter</button>
      <button class="ghost" id="accountCreateBtn">Créer un compte</button>
    </div>`;
  $('#accountLoginBtn').onclick=async()=>{
    accountError('#accountLoginError','');
    const name=$('#accountLoginName').value.trim(), pin=$('#accountLoginPin').value;
    if(!name||!validPin(pin)){accountError('#accountLoginError','Saisis un pseudo et un code de 4 chiffres.');return;}
    try{
      const data=await supabaseRpc('orapa_login_profile',{p_name:name,p_pin:pin});
      savePlayerAccount(data); showToast(`Connecté : ${data.display_name}`); await renderAccountHome();
    }catch(e){accountError('#accountLoginError',e.message);}
  };
  $('#accountCreateBtn').onclick=showAccountCreate;
}
function showAccountCreate(){
  $('#accountContent').innerHTML=`<button class="ghost" id="accountBackLogin">← Retour</button>
    <h3 style="margin-top:14px;">Créer un compte</h3>
    <p>Le pseudo sera unique. Aucune adresse mail n’est demandée.</p>
    <div class="account-form">
      ${accountInput('Pseudo','accountCreateName','text','maxlength="24" autocomplete="nickname"')}
      ${accountInput('Code à 4 chiffres','accountCreatePin','password','inputmode="numeric" maxlength="4" autocomplete="off"')}
      ${accountInput('Confirmer le code','accountCreatePinConfirm','password','inputmode="numeric" maxlength="4" autocomplete="off"')}
      <div class="account-error" id="accountCreateError"></div>
    </div>
    <div class="controls" style="justify-content:flex-end;"><button class="primary" id="accountCreateSave">Créer le compte</button></div>`;
  $('#accountBackLogin').onclick=showAccountLogin;
  $('#accountCreateSave').onclick=async()=>{
    accountError('#accountCreateError','');
    const name=$('#accountCreateName').value.trim(), pin=$('#accountCreatePin').value, confirmPin=$('#accountCreatePinConfirm').value;
    if(!name){accountError('#accountCreateError','Saisis un pseudo.');return;}
    if(looksLikeEmailAddress(name)){accountError('#accountCreateError',EMAIL_AS_PSEUDO_WARNING);return;}
    if(!validPin(pin)){accountError('#accountCreateError','Le code doit contenir exactement 4 chiffres.');return;}
    if(pin!==confirmPin){accountError('#accountCreateError','Les deux codes ne correspondent pas.');return;}
    try{
      const data=await supabaseRpc('orapa_create_profile',{p_name:name,p_pin:pin});
      savePlayerAccount(data); showToast(`Compte créé : ${data.display_name}`); await renderAccountHome();
    }catch(e){accountError('#accountCreateError',e.message);}
  };
}
async function renderAccountHome(){
  if(!currentPlayerAccount){ showAccountLogin(); return; }
  const content=$('#accountContent');
  content.innerHTML=`<div class="account-card account-profile-row"><strong>👤 ${escapeHtml(currentPlayerAccount.display_name)}</strong><span class="account-status connected">● Connecté</span></div>
    <h3 class="account-section-title">📅 Défis du jour</h3>
    <div id="accountStats"><div class="history-empty">Chargement des statistiques…</div></div>
    <label class="account-trust"><input type="checkbox" id="accountTrustDevice" ${isTrustedDevice()?'checked':''}><span><b>Enregistrer mes scores sans redemander le code sur cet appareil</b></span></label>
    <div class="achievement-preferences"><label class="account-trust"><input type="checkbox" id="accountHideAchievementNotifications"><span><b>Ne pas afficher les notifications des succès</b></span></label><label class="account-trust"><input type="checkbox" id="accountHideAchievementRankings"><span><b>Ne pas afficher mon pseudo dans les classements des succès</b></span></label></div>
    ${isFirefox()?`<div class="achievement-preferences"><label class="account-trust"><input type="checkbox" id="accountFirefoxPerformance" ${firefoxPerformanceEnabled()?'checked':''}><span><b>Mode performances Firefox</b><small>Réduit certains effets visuels et opérations d’affichage afin d’améliorer la fluidité sur Firefox.</small></span></label></div>`:''}
    <div class="account-actions">
      <button class="ghost" id="accountAchievementsBtn">🏆 Mes succès</button>
      <button class="ghost" id="accountDailyHistoryBtn">📅 Historique des défis</button>
      <button class="ghost" id="accountGridHistoryBtn">🕘 Historique des grilles</button>
      <button class="ghost" id="accountSharedGridsBtn">📤 Mes grilles partagées</button>
      <button class="ghost" id="accountRenameBtn">✏️ Changer le pseudo</button>
      <button class="ghost" id="accountPinBtn">🔢 Modifier le code</button>
      <button class="danger" id="accountLogoutBtn">🚪 Se déconnecter</button>
    </div>`;
  $('#accountTrustDevice').onchange=e=>setTrustedDevice(e.target.checked);
  const firefoxPerformance=$('#accountFirefoxPerformance');
  if(firefoxPerformance)firefoxPerformance.onchange=e=>{setFirefoxPerformanceMode(e.target.checked);showToast(e.target.checked?'Mode performances activé':'Mode performances désactivé');};
  $('#accountAchievementsBtn').onclick=openMyAchievements;
  $('#accountDailyHistoryBtn').onclick=()=>openMyDailyHistory();
  $('#accountGridHistoryBtn').onclick=()=>openMyGridHistory();
  $('#accountSharedGridsBtn').onclick=()=>openMySharedGrids();
  $('#accountRenameBtn').onclick=showRenameAccount;
  $('#accountPinBtn').onclick=showChangePin;
  $('#accountLogoutBtn').onclick=()=>{savePlayerAccount(null);setTrustedDevice(false);showAccountLogin();showToast('Déconnecté');};
  try{
    await refreshAchievements();
    const [st,gridStats,lostStats,achievementRows,achievementPreferences]=await Promise.all([
      loadMyAccountStats(),
      supabaseRpc('orapa_my_grid_stats',{p_session_token:currentPlayerAccount.session_token}).catch(()=>null),
      supabaseRpc('orapa_my_lost_stats',{p_session_token:currentPlayerAccount.session_token}).catch(()=>null),
      getAchievementCatalog(true).catch(()=>[]),
      supabaseRpc('orapa_get_achievement_preferences',{p_session_token:currentPlayerAccount.session_token}).catch(()=>({}))
    ]);
    $('#accountHideAchievementNotifications').checked=!!achievementPreferences.hide_notifications;
    $('#accountHideAchievementRankings').checked=!!achievementPreferences.hide_from_rankings;
    const saveAchievementPreferences=async()=>{try{await supabaseRpc('orapa_set_achievement_preferences',{p_session_token:currentPlayerAccount.session_token,p_hide_notifications:$('#accountHideAchievementNotifications').checked,p_hide_from_rankings:$('#accountHideAchievementRankings').checked});showToast('Préférences enregistrées');}catch(e){showToast('Enregistrement impossible : '+e.message);}};
    $('#accountHideAchievementNotifications').onchange=saveAchievementPreferences;$('#accountHideAchievementRankings').onchange=saveAchievementPreferences;
    const rate=st.participations?Math.round(st.wins/st.participations*100):0;
    $('#accountStats').innerHTML=`<div class="account-stats-grid">
      <div class="account-stat"><b>${st.participations||0}</b>défis</div>
      <div class="account-stat"><b>${st.wins||0}</b>réussites</div>
      <div class="account-stat"><b>${rate}%</b>réussite</div>
      <div class="account-stat"><b>${st.best_score==null?'—':st.best_score+' pts'}</b>meilleur score</div>
      <div class="account-stat"><b>${st.best_time_ms==null?'—':formatDuration(st.best_time_ms)}</b>meilleur temps</div>
    </div>
    ${gridStats?`<h3 class="account-section-title">🧩 Grilles classiques</h3><div class="account-stats-grid">
      <div class="account-stat"><b>${gridStats.played||0}</b>jouées</div>
      <div class="account-stat"><b>${gridStats.played?Math.round((gridStats.wins||0)/gridStats.played*100):0}%</b>réussite</div>
      <div class="account-stat"><b>${gridStats.created||0}</b>créées</div>
      <div class="account-stat"><b>${gridStats.best_score==null?'—':gridStats.best_score+' pts'}</b>meilleur score</div>
      <div class="account-stat"><b>${gridStats.average_score==null?'—':gridStats.average_score+' pts'}</b>score moyen</div>
      <div class="account-stat"><b>${gridStats.average_rank==null?'—':'#'+gridStats.average_rank}</b>rang moyen</div>
    </div>`:''}${lostStats?`<h3 class="account-section-title">💎 Gemme perdue</h3><div class="account-stats-grid"><div class="account-stat"><b>${lostStats.played||0}</b>jouées</div><div class="account-stat"><b>${lostStats.played?Math.round((lostStats.wins||0)*100/lostStats.played):0}%</b>réussite</div><div class="account-stat"><b>${lostStats.shared||0}</b>partagées</div><div class="account-stat"><b>${lostStats.best_score==null?'—':lostStats.best_score+' pts'}</b>meilleur score</div><div class="account-stat"><b>${lostStats.best_time_ms==null?'—':formatDuration(lostStats.best_time_ms)}</b>meilleur temps</div><div class="account-stat"><b>${lostStats.full_placements||0}</b>🧩 complets</div></div>`:''}
    <h3 class="account-section-title">🏆 Succès</h3><div class="account-stats-grid"><div class="account-stat"><b>${achievementRows.filter(row=>row.unlocked).length}</b>débloqués</div><div class="account-stat"><b>${achievementRows.filter(row=>row.unlocked).reduce((sum,row)=>sum+Number(row.points||0),0)}</b>points</div></div>`;
  }catch(e){ $('#accountStats').innerHTML=`<div class="account-error" style="display:block;">${escapeHtml(e.message)}</div>`; }
}
function showRenameAccount(){
  $('#accountContent').innerHTML=`<button class="ghost" id="accountBackHome">← Retour</button><h3 style="margin-top:14px;">Renommer le pseudo</h3>
    <div class="account-form">${accountInput('Nouveau pseudo','accountNewName','text','maxlength="24"')}${accountInput('Code actuel','accountRenamePin','password','inputmode="numeric" maxlength="4"')}<div class="account-error" id="accountRenameError"></div></div>
    <div class="controls" style="justify-content:flex-end;"><button class="primary" id="accountRenameSave">Enregistrer</button></div>`;
  $('#accountNewName').value=currentPlayerAccount.display_name;
  $('#accountBackHome').onclick=renderAccountHome;
  $('#accountRenameSave').onclick=async()=>{
    accountError('#accountRenameError',''); const name=$('#accountNewName').value.trim(),pin=$('#accountRenamePin').value;
    if(!name||!validPin(pin)){accountError('#accountRenameError','Saisis le nouveau pseudo et ton code actuel.');return;}
    if(looksLikeEmailAddress(name)){accountError('#accountRenameError',EMAIL_AS_PSEUDO_WARNING);return;}
    try{
      const d=await supabaseRpc('orapa_rename_profile',{p_session_token:currentPlayerAccount.session_token,p_pin:pin,p_new_name:name});
      savePlayerAccount({...currentPlayerAccount,display_name:d.display_name});
      try{await supabaseRpc('orapa_sync_profile_name',{p_session_token:currentPlayerAccount.session_token});}catch(syncError){console.error('Synchronisation du pseudo impossible :',syncError);}
      globalAllScoresCache=null;globalRankingCache={};showToast('Pseudo modifié');renderAccountHome();
    }catch(e){accountError('#accountRenameError',e.message);}
  };
}
function showChangePin(){
  $('#accountContent').innerHTML=`<button class="ghost" id="accountBackHome">← Retour</button><h3 style="margin-top:14px;">Modifier le code</h3>
    <div class="account-form">${accountInput('Ancien code','accountOldPin','password','inputmode="numeric" maxlength="4"')}${accountInput('Nouveau code','accountNewPin','password','inputmode="numeric" maxlength="4"')}${accountInput('Confirmer le nouveau code','accountConfirmPin','password','inputmode="numeric" maxlength="4"')}<div class="account-error" id="accountPinError"></div></div>
    <div class="controls" style="justify-content:flex-end;"><button class="primary" id="accountPinSave">Enregistrer</button></div>`;
  $('#accountBackHome').onclick=renderAccountHome;
  $('#accountPinSave').onclick=async()=>{
    accountError('#accountPinError',''); const old=$('#accountOldPin').value,nw=$('#accountNewPin').value,confirmPin=$('#accountConfirmPin').value;
    if(!validPin(old)||!validPin(nw)){accountError('#accountPinError','Les codes doivent contenir exactement 4 chiffres.');return;}
    if(nw!==confirmPin){accountError('#accountPinError','Les deux nouveaux codes ne correspondent pas.');return;}
    if(old===nw){accountError('#accountPinError','Choisis un code différent de l’ancien.');return;}
    try{await supabaseRpc('orapa_change_pin',{p_session_token:currentPlayerAccount.session_token,p_old_pin:old,p_new_pin:nw});showToast('Code modifié');renderAccountHome();}catch(e){accountError('#accountPinError',e.message);}
  };
}
async function openAccountModal(){
  $('#accountModal').classList.add('open');
  await renderAccountHome();
}

let gridDataReturnsToAccount=false;
let gridDataReturnsToVictory=false;
function openGridDataShell(title,intro='',returnToAccount=false,returnToVictory=false){
  achievementExpanded.clear();
  expandedScores.clear();
  gridDataReturnsToAccount=returnToAccount;
  gridDataReturnsToVictory=returnToVictory;
  if(!returnToAccount) $('#accountModal').classList.remove('open');
  $('#victoryModal').classList.remove('open');
  $('#gridDataTitle').textContent=title;
  $('#gridDataIntro').innerHTML=intro;
  $('#gridDataContent').innerHTML='<div class="history-empty">Chargement…</div>';
  $('#gridDataBack').textContent='← Retour au compte';
  $('#gridDataBack').style.display='none';
  $('#gridDataModal').classList.add('open');
}
function gridRankingRows(rows){
  if(!rows?.length) return '<div class="history-empty">Aucun score classé pour cette grille.</div>';
  const myAccountName=currentPlayerAccount?.display_name?.trim().toLocaleLowerCase('fr-FR')||'';
  return rows.map(row=>{
    const mine=!!myAccountName&&String(row.player_name||'').trim().toLocaleLowerCase('fr-FR')===myAccountName;
    return `<div class="ranking-row grid-ranking-row one-line-ranking${mine?' ranking-mine':''}"><div class="ranking-row-top">
    <span class="ranking-player-cell"><span class="ranking-rank${Number(row.rank)===1?' top1':''}">${rankingMedal(Number(row.rank)-1)}</span><span class="ranking-name">${escapeHtml(row.player_name||'Anonyme')}${row.played_by_creator?' *':''}</span>${row.success?'':'<span class="ranking-fail">Échec</span>'}</span>
    <span class="ranking-query-cell">${row.ray_count||0} 🔦 + ${row.coord_count||0} 📍${row.placement_bonus?' · 🧩':''}</span>
    <span class="ranking-points">${row.cost} pts</span><span class="ranking-time">${formatDuration(row.time_ms)}</span>
  </div></div>`;
  }).join('');
}
function gridRankingIntro(gridId,copyButtonId,returnToVictory=false){
  const decoded=decodeGridId(gridId);
  const gems=decoded?.variant==='lost'?'💎 Gemme perdue':(decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'');
  return `<div class="grid-ranking-idline"><p>Grille <b>${escapeHtml(gridId)}</b></p><span class="ranking-gems">${gems}</span></div><div class="controls ranked-grid-actions"><button id="${copyButtonId}" class="ghost">📋 Copier l’ID de la grille</button>${returnToVictory?'<button id="gridResultBack" class="ghost">← Retour au résultat</button>':''}</div>`;
}
async function openGridRanking(gridId,returnToAccount=false,returnToVictory=false){
  if(!gridId) return;
  const lost=decodeGridId(gridId)?.variant==='lost';
  if(returnToAccount&&$('#gridDataModal').classList.contains('open')){
    $('#nestedGridRankingIntro').innerHTML=gridRankingIntro(gridId,'copyNestedRankedGridId');
    $('#nestedGridRankingContent').innerHTML='<div class="history-empty">Chargement…</div>';
    $('#nestedGridRankingModal').classList.add('open');
    $('#copyNestedRankedGridId').onclick=()=>navigator.clipboard?.writeText(gridId).then(()=>showToast('Identifiant copié : '+gridId));
    try{
      const rows=await supabaseRpc(lost?'orapa_lost_grid_ranking':'orapa_get_grid_scores',lost?{p_grid_id:gridId,p_session_token:currentPlayerAccount?.session_token||''}:{p_grid_id:gridId});
      if(!$('#nestedGridRankingModal').classList.contains('open'))return;
      const wins=(rows||[]).filter(row=>row.success).length;
      $('#nestedGridRankingContent').innerHTML=`<div class="global-ranking-summary"><b>${rows?.length||0}</b> participant${rows?.length===1?'':'s'} · <b>${wins}</b> réussite${wins===1?'':'s'}</div>${gridRankingRows(rows)}${rows?.some(row=>row.played_by_creator)?'<p class="stats-note">* Cette personne a créé la grille et l’a jouée après la période de protection.</p>':''}`;
    }catch(e){
      $('#nestedGridRankingContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;
    }
    return;
  }
  openGridDataShell('🏆 Classement de la grille',gridRankingIntro(gridId,'copyRankedGridId',returnToVictory),returnToAccount,returnToVictory);
  $('#copyRankedGridId').onclick=()=>navigator.clipboard?.writeText(gridId).then(()=>showToast('Identifiant copié : '+gridId));
  if(returnToVictory) $('#gridResultBack').onclick=()=>closeGridDataModal(true);
  try{
    const rows=await supabaseRpc(lost?'orapa_lost_grid_ranking':'orapa_get_grid_scores',lost?{p_grid_id:gridId,p_session_token:currentPlayerAccount?.session_token||''}:{p_grid_id:gridId});
    const wins=(rows||[]).filter(row=>row.success).length;
    $('#gridDataContent').innerHTML=`<div class="global-ranking-summary"><b>${rows?.length||0}</b> participant${rows?.length===1?'':'s'} · <b>${wins}</b> réussite${wins===1?'':'s'}</div>${gridRankingRows(rows)}${rows?.some(row=>row.played_by_creator)?'<p class="stats-note">* Cette personne a créé la grille et l’a jouée après la période de protection.</p>':''}`;
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}
async function openMyGridHistory(){
  if(!currentPlayerAccount) return;
  const configOptions='<option value="ALL">Toutes les configurations</option>'+RANKING_COMBOS.map(([g,o,s])=>{const key=configKey(g,o,s);return `<option value="${key}">${key}</option>`;}).join('');
  openGridDataShell('🕘 Historique des grilles',`<p>Grilles classées jouées avec ce compte, chargées par 10.</p><div class="achievement-subtabs"><button id="accountHistoryClassic" class="ghost active">Classique</button><button id="accountHistoryLost" class="ghost">Gemme perdue</button></div><select id="accountHistoryConfigSelect" class="ranking-select">${configOptions}</select>`,true);
  const historyState={rows:[],hasMore:true};
  const loadPage=async()=>{
    const page=await supabaseRpc('orapa_my_grid_history',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:historyState.rows.length});
    const pageRows=Array.isArray(page)?page:[];
    historyState.rows.push(...pageRows.slice(0,10));
    historyState.hasMore=pageRows.length>10;
  };
  try{
    await loadPage();
    if(!historyState.rows.length){ $('#gridDataContent').innerHTML='<div class="history-empty">Aucune grille classée jouée.</div>'; return; }
    const renderHistory=()=>{
      const selected=$('#accountHistoryConfigSelect')?.value||'ALL';
      const activeRows=selected==='ALL'?historyState.rows:historyState.rows.filter(row=>{const decoded=decodeGridId(row.grid_id);return decoded&&configKey(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire)===selected;});
      const rowsHtml=activeRows.map((row,i)=>{
        const key=`history:${row.grid_id}`,expanded=expandedScores.has(key),decoded=decodeGridId(row.grid_id);
        const gems=decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'';
        const date=new Date(row.played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});
        return `<div class="ranking-row account-history-row account-ranked-history${expanded?' expanded':''}" data-grid-index="${i}"><div class="ranking-row-top"><span class="account-result-position"><span class="solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><b>#${row.rank}</b></span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.cost} pts</span><span class="ranking-date">${date}</span></div>${expanded?`<div class="ranking-row-detail">ID <b>${escapeHtml(row.grid_id)}</b> · ${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${row.cost} pts · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions"><button class="history-summary ghost" data-grid-index="${i}">📋 Résumé</button><button class="history-copy-id ghost" data-grid-index="${i}">📋 ID</button><button class="grid-history-ranking primary" data-grid-index="${i}">🏆 Grille</button></div>`:''}</div>`;
      }).join('');
      const empty=!activeRows.length?'<div class="history-empty">Aucune grille de cette configuration dans les pages chargées.</div>':'';
      const more=historyState.hasMore?'<button id="historyLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
      $('#gridDataContent').innerHTML=rowsHtml+empty+more;
      $('#gridDataContent').querySelectorAll('.account-history-row').forEach(el=>el.onclick=ev=>{if(ev.target.closest('button'))return;const row=activeRows[Number(el.dataset.gridIndex)],key=`history:${row.grid_id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);renderHistory();});
      $('#gridDataContent').querySelectorAll('.grid-history-ranking').forEach(btn=>btn.onclick=()=>openGridRanking(activeRows[Number(btn.dataset.gridIndex)].grid_id,true));
      $('#gridDataContent').querySelectorAll('.history-copy-id').forEach(btn=>btn.onclick=()=>{const id=activeRows[Number(btn.dataset.gridIndex)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});
      $('#gridDataContent').querySelectorAll('.history-summary').forEach(btn=>btn.onclick=()=>{const row=activeRows[Number(btn.dataset.gridIndex)];navigator.clipboard?.writeText(formatShareText({name:currentPlayerAccount.display_name,cost:row.cost,rayCount:row.ray_count,coordCount:row.coord_count,timeMs:row.time_ms,gridId:row.grid_id,date:new Date(row.played_at).getTime(),success:row.success})).then(()=>showToast('Résumé copié !'));});
      const loadMore=$('#historyLoadMore');
      if(loadMore) loadMore.onclick=async()=>{loadMore.disabled=true;loadMore.textContent='Chargement…';try{await loadPage();renderHistory();}catch(e){showToast(`Chargement impossible : ${e.message}`);loadMore.disabled=false;loadMore.textContent='Afficher les résultats suivants';}};
    };
    $('#accountHistoryConfigSelect').addEventListener('change',renderHistory);
    $('#accountHistoryClassic').addEventListener('click',openMyGridHistory);
    $('#accountHistoryLost').addEventListener('click',openMyLostGridHistory);
    renderHistory();
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}
async function openMyLostGridHistory(){
  if(!currentPlayerAccount)return;
  openGridDataShell('🕘 Historique des grilles',`<p>Parties Gemme perdue jouées avec ce compte, chargées par 10.</p><div class="achievement-subtabs"><button id="accountHistoryClassic" class="ghost">Classique</button><button id="accountHistoryLost" class="ghost active">Gemme perdue</button></div>`,true);
  const stateRows={rows:[],hasMore:true};
  const load=async()=>{const page=await supabaseRpc('orapa_my_lost_grid_history_v2',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:stateRows.rows.length});stateRows.rows.push(...(page||[]).slice(0,10));stateRows.hasMore=(page||[]).length>10;};
  const render=()=>{
    $('#gridDataContent').innerHTML=stateRows.rows.map((row,index)=>{const key=`lost-history:${row.grid_id}`,expanded=expandedScores.has(key),date=new Date(row.played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}),moves=`${row.ray_count} 🔦 + ${row.coord_count} 📍${row.placement_bonus?' + 🧩':''}`;return `<div class="ranking-row account-history-row account-ranked-history${expanded?' expanded':''}" data-lost-index="${index}"><div class="ranking-row-top"><span class="account-result-position"><span class="solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><b>#${row.rank}</b></span><span class="ranking-query-cell">${moves}</span><span class="ranking-points">${row.cost} pts</span><span class="ranking-date">${date}</span></div>${expanded?`<div class="ranking-row-detail">ID <b>${escapeHtml(row.grid_id)}</b> · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions three"><button class="lost-account-copy ghost" data-index="${index}">📋 Résumé</button><button class="lost-account-id ghost" data-index="${index}">📋 ID</button><button class="lost-account-ranking primary" data-index="${index}">🏆 Grille</button></div>`:''}</div>`;}).join('')+(stateRows.hasMore?'<button id="lostAccountLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'');
    $('#gridDataContent').querySelectorAll('.account-history-row').forEach(element=>element.onclick=event=>{if(event.target.closest('button'))return;const row=stateRows.rows[Number(element.dataset.lostIndex)],key=`lost-history:${row.grid_id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);render();});
    $('#gridDataContent').querySelectorAll('.lost-account-ranking').forEach(button=>button.onclick=()=>openGridRanking(stateRows.rows[Number(button.dataset.index)].grid_id,true));
    $('#gridDataContent').querySelectorAll('.lost-account-copy').forEach(button=>button.onclick=()=>{const row=stateRows.rows[Number(button.dataset.index)];navigator.clipboard?.writeText(formatShareText({gameVariant:'lost',gridId:row.grid_id,name:currentPlayerAccount.display_name,success:row.success,placementBonus:row.placement_bonus,cost:row.cost,rayCount:row.ray_count,coordCount:row.coord_count,timeMs:row.time_ms,date:new Date(row.played_at).getTime()})).then(()=>showToast('Résumé copié !'));});
    $('#gridDataContent').querySelectorAll('.lost-account-id').forEach(button=>button.onclick=()=>{const id=stateRows.rows[Number(button.dataset.index)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});
    if($('#lostAccountLoadMore'))$('#lostAccountLoadMore').onclick=async()=>{await load();render();};
  };
  try{await load();$('#accountHistoryClassic').onclick=openMyGridHistory;$('#accountHistoryLost').onclick=openMyLostGridHistory;if(!stateRows.rows.length){$('#gridDataContent').innerHTML='<div class="history-empty">Aucune partie Gemme perdue enregistrée.</div>';return;}render();}catch(error){$('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}
async function openMyDailyHistory(){
  if(!currentPlayerAccount) return;
  openGridDataShell('📅 Historique des défis','<p>Défis du jour joués avec ce compte, chargés par 10.</p>',true);
  const dailyState={rows:[],hasMore:true};
  const loadPage=async()=>{
    const page=await supabaseRpc('orapa_my_daily_history',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:dailyState.rows.length});
    const pageRows=Array.isArray(page)?page:[];
    dailyState.rows.push(...pageRows.slice(0,10));
    dailyState.hasMore=pageRows.length>10;
  };
  try{
    await loadPage();
    if(!dailyState.rows.length){ $('#gridDataContent').innerHTML='<div class="history-empty">Aucun défi du jour joué avec ce compte.</div>'; return; }
    const renderDaily=()=>{
      const rows=dailyState.rows;
      const rowsHtml=rows.map((row,i)=>{
        const key=`daily-history:${row.id}`,expanded=expandedScores.has(key);
        const dateKey=String(row.daily_date).slice(0,10);
        const layout=generateDailyLayout(dateKey);
        const gems=layout?gemFlagsEmojiLine(layout.flags.gray,layout.flags.onyx,layout.flags.sapphire):'';
        return `<div class="ranking-row account-daily-row${expanded?' expanded':''}" data-daily-index="${i}"><div class="ranking-row-top"><span class="account-result-position"><span class="solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><b>#${row.rank}</b></span><span class="ranking-date">${shortFrenchDate(dateKey)}</span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.cost} pts</span></div>${expanded?`<div class="ranking-row-detail">${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions daily-history-actions"><button class="daily-history-summary ghost" data-daily-index="${i}">📋 Résumé</button></div>`:''}</div>`;
      }).join('');
      const more=dailyState.hasMore?'<button id="dailyHistoryLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
      $('#gridDataContent').innerHTML=rowsHtml+more;
      $('#gridDataContent').querySelectorAll('.account-daily-row').forEach(el=>el.onclick=ev=>{if(ev.target.closest('button'))return;const row=rows[Number(el.dataset.dailyIndex)],key=`daily-history:${row.id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);renderDaily();});
      $('#gridDataContent').querySelectorAll('.daily-history-summary').forEach(btn=>btn.onclick=()=>{const row=rows[Number(btn.dataset.dailyIndex)];navigator.clipboard?.writeText(formatShareText({name:currentPlayerAccount.display_name,cost:row.cost,rayCount:row.ray_count,coordCount:row.coord_count,timeMs:row.time_ms,dailyDate:String(row.daily_date).slice(0,10),isDaily:true,date:new Date(row.played_at).getTime(),success:row.success})).then(()=>showToast('Résumé copié !'));});
      const loadMore=$('#dailyHistoryLoadMore');
      if(loadMore) loadMore.onclick=async()=>{loadMore.disabled=true;loadMore.textContent='Chargement…';try{await loadPage();renderDaily();}catch(e){showToast(`Chargement impossible : ${e.message}`);loadMore.disabled=false;loadMore.textContent='Afficher les résultats suivants';}};
    };
    renderDaily();
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}
let blockedCreatorGridId=null;
function readOnlyGridSvg(decoded){
  const polygons=decoded.pieces.map(piece=>{
    const def=CONFIG.PIECES[piece.type];
    const fill=def.isDiamond?'rgba(207,216,220,.62)':def.hex;
    return `<polygon points="${polyPointsAttr(pieceVertices(piece))}" fill="${fill}" stroke="rgba(0,0,0,.42)" stroke-width=".045"/>`;
  }).join('');
  return `<svg viewBox="-.16 -.16 ${COLS+.32} ${ROWS+.32}" role="img" aria-label="Disposition complète de la grille"><defs><pattern id="readonlyGridPattern" width="1" height="1" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#7d8795"/><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#606b79" stroke-width=".035"/></pattern></defs><rect x="0" y="0" width="${COLS}" height="${ROWS}" rx=".08" fill="url(#readonlyGridPattern)"/>${polygons}</svg>`;
}
function openSharedGridPreview(gridId){
  const decoded=decodeGridId(gridId);
  if(!decoded){showToast('Identifiant de grille invalide.');return;}
  const gems=decoded.variant==='lost'?'💎 Gemme perdue':gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire);
  $('#sharedGridPreviewContent').innerHTML=`<div class="readonly-grid-meta"><b>${escapeHtml(decoded.id)}</b><span>${gems}</span></div><div class="readonly-grid-board">${readOnlyGridSvg(decoded)}</div><p class="readonly-grid-note">Aucune action n’est possible dans cet aperçu.</p><div class="controls readonly-grid-actions"><button class="ghost" id="sharedPreviewCopyId">📋 Copier l’ID</button><button class="primary" id="sharedPreviewRanking">🏆 Classement</button></div>`;
  $('#sharedPreviewCopyId').onclick=()=>navigator.clipboard?.writeText(decoded.id).then(()=>showToast('Identifiant copié : '+decoded.id));
  $('#sharedPreviewRanking').onclick=()=>{const fromList=$('#gridDataModal').classList.contains('open');if(!fromList)closeSharedGridPreview();openGridRanking(decoded.id,fromList);};
  $('#sharedGridPreviewModal').classList.add('open');
}
function closeSharedGridPreview(){$('#sharedGridPreviewModal').classList.remove('open');}
function openCreatorGridBlockedModal(gridId){blockedCreatorGridId=gridId;$('#creatorGridBlockedModal').classList.add('open');}
function closeCreatorGridBlockedModal(){$('#creatorGridBlockedModal').classList.remove('open');}
document.querySelector('#closeSharedGridPreview').addEventListener('click',closeSharedGridPreview);
document.querySelector('#sharedGridPreviewModal').addEventListener('click',e=>{if(e.target.id==='sharedGridPreviewModal')closeSharedGridPreview();});
document.querySelector('#closeCreatorGridBlocked').addEventListener('click',closeCreatorGridBlockedModal);
document.querySelector('#dismissCreatorGridBlocked').addEventListener('click',closeCreatorGridBlockedModal);
document.querySelector('#creatorGridBlockedModal').addEventListener('click',e=>{if(e.target.id==='creatorGridBlockedModal')closeCreatorGridBlockedModal();});
document.querySelector('#viewBlockedCreatorGrid').addEventListener('click',()=>{const id=blockedCreatorGridId;closeCreatorGridBlockedModal();closeSoloChoiceModal();if(id)openSharedGridPreview(id);});
function openAlreadyPlayedGridModal(){$('#alreadyPlayedGridModal').classList.add('open');}
function closeAlreadyPlayedGridModal(){$('#alreadyPlayedGridModal').classList.remove('open');}
document.querySelector('#closeAlreadyPlayedGrid').addEventListener('click',closeAlreadyPlayedGridModal);
document.querySelector('#dismissAlreadyPlayedGrid').addEventListener('click',closeAlreadyPlayedGridModal);
document.querySelector('#alreadyPlayedGridModal').addEventListener('click',event=>{if(event.target.id==='alreadyPlayedGridModal')closeAlreadyPlayedGridModal();});
function openIncorrectSolutionModal(){document.querySelector('#incorrectSolutionModal').classList.add('open');}
function closeIncorrectSolutionModal(){document.querySelector('#incorrectSolutionModal').classList.remove('open');}
document.querySelector('#closeIncorrectSolution').addEventListener('click',closeIncorrectSolutionModal);
document.querySelector('#dismissIncorrectSolution').addEventListener('click',closeIncorrectSolutionModal);
document.querySelector('#incorrectSolutionModal').addEventListener('click',event=>{if(event.target.id==='incorrectSolutionModal')closeIncorrectSolutionModal();});

async function openMySharedGrids(){
  if(!currentPlayerAccount) return;
  const configOptions='<option value="ALL">Toutes les configurations</option>'+RANKING_COMBOS.map(([g,o,s])=>{const key=configKey(g,o,s);return `<option value="${key}">${key}</option>`;}).join('');
  openGridDataShell('📤 Mes grilles partagées',`<p>Les grilles dont ce compte est enregistré comme créateur, chargées par 10. Elles sont consultables mais ne peuvent plus être résolues avec ce compte.</p><div class="achievement-subtabs"><button id="accountSharedClassic" class="ghost active">Classique</button><button id="accountSharedLost" class="ghost">Gemme perdue</button></div><div class="shared-grid-toolbar"><select id="accountSharedConfigSelect" class="ranking-select">${configOptions}</select><select id="accountSharedSortSelect" class="ranking-select"><option value="date">Date</option><option value="players">Nombre de joueurs</option><option value="points">Nombre de points</option></select><button id="accountSharedSortReverse" class="ghost shared-sort-reverse" aria-label="Inverser le tri">↓</button></div>`,true);
  $('#accountSharedClassic').onclick=openMySharedGrids;$('#accountSharedLost').onclick=openMySharedLostGrids;
  const sharedState={rows:[],hasMore:true,reverse:false};
  const loadPage=async()=>{
    const page=await supabaseRpc('orapa_my_shared_grids',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:sharedState.rows.length});
    const pageRows=Array.isArray(page)?page:[];
    sharedState.rows.push(...pageRows.slice(0,10));
    sharedState.hasMore=pageRows.length>10;
  };
  try{
    await loadPage();
    if(!sharedState.rows.length){ $('#gridDataContent').innerHTML='<div class="history-empty">Aucune grille partagée avec ce compte.</div>'; return; }
    const renderShared=()=>{
      const selectedConfig=$('#accountSharedConfigSelect')?.value||'ALL';
      const sortMode=$('#accountSharedSortSelect')?.value||'date';
      const rows=sharedState.rows.filter(row=>{
        if(selectedConfig==='ALL')return true;
        const decoded=decodeGridId(row.grid_id);
        return decoded&&configKey(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire)===selectedConfig;
      }).sort((a,b)=>{
        let value=0;
        if(sortMode==='players')value=Number(b.score_count||0)-Number(a.score_count||0);
        else if(sortMode==='points')value=(a.best_score==null?Number.MAX_SAFE_INTEGER:Number(a.best_score))-(b.best_score==null?Number.MAX_SAFE_INTEGER:Number(b.best_score));
        else value=new Date(b.shared_at||0)-new Date(a.shared_at||0);
        if(value===0)value=String(a.grid_id).localeCompare(String(b.grid_id));
        return sharedState.reverse?-value:value;
      });
      const rowsHtml=rows.map((row,i)=>{
        const key=`shared:${row.grid_id}`,expanded=expandedScores.has(key),decoded=decodeGridId(row.grid_id);
        const gems=decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'';
        const sharedDate=row.shared_at?new Date(row.shared_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
        const rate=Number(row.score_count||0)>0?`${Math.round(100*Number(row.success_count||0)/Number(row.score_count))}%`:'—';
        return `<div class="ranking-row account-shared-row${expanded?' expanded':''}" data-grid-index="${i}"><div class="ranking-row-top"><span class="account-shared-date">${sharedDate||'—'}</span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.best_score==null?'—':`${row.best_score} pts`}</span><span class="ranking-count">${row.score_count||0} 👥</span><span class="ranking-rate">${rate}</span></div>${expanded?`<div class="account-grid-meta-line"><span class="account-grid-id">ID : ${escapeHtml(row.grid_id)}</span><span>Consultation uniquement</span></div>${row.best_time_ms==null?'':`<div class="ranking-row-detail">Meilleur temps : ${formatDuration(row.best_time_ms)}</div>`}<div class="controls ranking-compact-actions three"><button class="shared-copy ghost" data-grid-index="${i}">📋 ID</button><button class="shared-ranking ghost" data-grid-index="${i}">🏆 Classement</button><button class="shared-preview primary" data-grid-index="${i}">👁️ Voir</button></div>`:''}</div>`;
      }).join('');
      const empty=!rows.length?'<div class="history-empty">Aucune grille de cette configuration dans les pages chargées.</div>':'';
      const more=sharedState.hasMore?'<button id="sharedLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
      $('#gridDataContent').innerHTML=rowsHtml+empty+more;
      $('#gridDataContent').querySelectorAll('.account-shared-row').forEach(el=>el.onclick=ev=>{if(ev.target.closest('button'))return;const row=rows[Number(el.dataset.gridIndex)],key=`shared:${row.grid_id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);renderShared();});
      $('#gridDataContent').querySelectorAll('.shared-copy').forEach(btn=>btn.onclick=()=>{const id=rows[Number(btn.dataset.gridIndex)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});
      $('#gridDataContent').querySelectorAll('.shared-ranking').forEach(btn=>btn.onclick=()=>openGridRanking(rows[Number(btn.dataset.gridIndex)].grid_id,true));
      $('#gridDataContent').querySelectorAll('.shared-preview').forEach(btn=>btn.onclick=()=>openSharedGridPreview(rows[Number(btn.dataset.gridIndex)].grid_id));
      const loadMore=$('#sharedLoadMore');
      if(loadMore) loadMore.onclick=async()=>{loadMore.disabled=true;loadMore.textContent='Chargement…';try{await loadPage();renderShared();}catch(e){showToast(`Chargement impossible : ${e.message}`);loadMore.disabled=false;loadMore.textContent='Afficher les résultats suivants';}};
    };
    $('#accountSharedConfigSelect').addEventListener('change',renderShared);
    $('#accountSharedSortSelect').addEventListener('change',renderShared);
    $('#accountSharedSortReverse').addEventListener('click',()=>{sharedState.reverse=!sharedState.reverse;$('#accountSharedSortReverse').textContent=sharedState.reverse?'↑':'↓';renderShared();});
    $('#accountSharedClassic').onclick=openMySharedGrids;$('#accountSharedLost').onclick=openMySharedLostGrids;
    renderShared();
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}
async function openMySharedLostGrids(){
  if(!currentPlayerAccount)return;
  openGridDataShell('📤 Mes grilles partagées','<p>Les grilles dont ce compte est enregistré comme créateur, chargées par 10. Elles sont consultables mais ne peuvent plus être résolues avec ce compte.</p><div class="achievement-subtabs"><button id="accountSharedClassic" class="ghost">Classique</button><button id="accountSharedLost" class="ghost active">Gemme perdue</button></div><div class="shared-grid-toolbar lost-shared-toolbar"><select id="accountSharedLostSortSelect" class="ranking-select"><option value="date">Date</option><option value="players">Nombre de joueurs</option><option value="points">Nombre de points</option></select><button id="accountSharedLostSortReverse" class="ghost shared-sort-reverse" aria-label="Inverser le tri">↓</button></div>',true);
  $('#accountSharedClassic').onclick=openMySharedGrids;$('#accountSharedLost').onclick=openMySharedLostGrids;
  const sharedState={rows:[],hasMore:true,reverse:false};
  const loadPage=async()=>{
    const page=await supabaseRpc('orapa_my_shared_lost_grids',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:sharedState.rows.length});
    const pageRows=Array.isArray(page)?page:[];
    sharedState.rows.push(...pageRows.slice(0,10));
    sharedState.hasMore=pageRows.length>10;
  };
  try{
    await loadPage();
    if(!sharedState.rows.length){$('#gridDataContent').innerHTML='<div class="history-empty">Aucune grille Gemme perdue partagée.</div>';return;}
    const renderShared=()=>{
      const sortMode=$('#accountSharedLostSortSelect')?.value||'date';
      const rows=[...sharedState.rows].sort((a,b)=>{
        let value=0;
        if(sortMode==='players')value=Number(b.score_count||0)-Number(a.score_count||0);
        else if(sortMode==='points')value=(a.best_score==null?Number.MAX_SAFE_INTEGER:Number(a.best_score))-(b.best_score==null?Number.MAX_SAFE_INTEGER:Number(b.best_score));
        else value=new Date(b.shared_at||0)-new Date(a.shared_at||0);
        if(value===0)value=String(a.grid_id).localeCompare(String(b.grid_id));
        return sharedState.reverse?-value:value;
      });
      const rowsHtml=rows.map((row,index)=>{
        const key=`shared-lost:${row.grid_id}`,expanded=expandedScores.has(key),decoded=decodeGridId(row.grid_id);
        const missingGem=decoded?.missingType?shapeIconSVG(decoded.missingType,18):'';
        const total=Number(row.score_count||0),rate=total?`${Math.round(Number(row.success_count||0)*100/total)}%`:'—';
        const date=row.shared_at?new Date(row.shared_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
        return `<div class="ranking-row account-shared-row${expanded?' expanded':''}" data-grid-index="${index}"><div class="ranking-row-top"><span class="account-shared-date">${date}</span><span class="ranking-gems lost-shared-gem-label"><span>Gemme perdue</span>${missingGem}</span><span class="ranking-points">${row.best_score==null?'—':row.best_score+' pts'}</span><span class="ranking-count">${total} 👥</span><span class="ranking-rate">${rate}</span></div>${expanded?`<div class="account-grid-meta-line"><span class="account-grid-id">ID : ${escapeHtml(row.grid_id)}</span><span>Consultation uniquement</span></div>${row.best_time_ms==null?'':`<div class="ranking-row-detail">Meilleur temps : ${formatDuration(row.best_time_ms)}</div>`}<div class="controls ranking-compact-actions three"><button class="shared-lost-copy ghost" data-index="${index}">📋 ID</button><button class="shared-lost-ranking ghost" data-index="${index}">🏆 Classement</button><button class="shared-lost-preview primary" data-index="${index}">👁️ Voir</button></div>`:''}</div>`;
      }).join('');
      const more=sharedState.hasMore?'<button id="sharedLostLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
      $('#gridDataContent').innerHTML=rowsHtml+more;
      $('#gridDataContent').querySelectorAll('.account-shared-row').forEach(element=>element.onclick=event=>{if(event.target.closest('button'))return;const row=rows[Number(element.dataset.gridIndex)],key=`shared-lost:${row.grid_id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);renderShared();});
      $('#gridDataContent').querySelectorAll('.shared-lost-copy').forEach(button=>button.onclick=()=>navigator.clipboard?.writeText(rows[Number(button.dataset.index)].grid_id).then(()=>showToast('Identifiant copié !')));
      $('#gridDataContent').querySelectorAll('.shared-lost-ranking').forEach(button=>button.onclick=()=>openGridRanking(rows[Number(button.dataset.index)].grid_id,true));
      $('#gridDataContent').querySelectorAll('.shared-lost-preview').forEach(button=>button.onclick=()=>openSharedGridPreview(rows[Number(button.dataset.index)].grid_id));
      const loadMore=$('#sharedLostLoadMore');
      if(loadMore)loadMore.onclick=async()=>{loadMore.disabled=true;loadMore.textContent='Chargement…';try{await loadPage();renderShared();}catch(error){showToast(`Chargement impossible : ${error.message}`);loadMore.disabled=false;loadMore.textContent='Afficher les résultats suivants';}};
    };
    $('#accountSharedLostSortSelect').addEventListener('change',renderShared);
    $('#accountSharedLostSortReverse').addEventListener('click',()=>{sharedState.reverse=!sharedState.reverse;$('#accountSharedLostSortReverse').textContent=sharedState.reverse?'↑':'↓';renderShared();});
    renderShared();
  }catch(error){$('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}

function closeScoreIdentity(result=null){
  $('#scoreIdentityModal').classList.remove('open');
  const r=scoreIdentityResolver; scoreIdentityResolver=null; if(r) r(result);
}
function renderScoreAccountPrompt(resolve){
  const content=$('#scoreIdentityContent');
  accountError('#scoreIdentityError','');
  if(!currentPlayerAccount){
    content.innerHTML=`<div class="score-account-summary guest">
        <strong>👤 Invité</strong>
        <span>Connecte-toi ou crée un compte pour enregistrer ce score dans le classement global.</span>
      </div>
      <div class="account-error" id="scoreIdentityError"></div>
      <div class="score-identity-actions">
        <button class="primary" id="scoreLoginBtn">Se connecter</button>
        <button class="ghost" id="scoreCreateBtn">Créer un compte</button>
      </div>`;
    $('#scoreLoginBtn').onclick=()=>renderScoreInlineLogin(resolve,false);
    $('#scoreCreateBtn').onclick=()=>renderScoreInlineLogin(resolve,true);
    return;
  }
  const trusted=isTrustedDevice();
  content.innerHTML=`<div class="score-account-summary">
      <span>Le score sera enregistré sous :</span>
      <strong>👤 ${escapeHtml(currentPlayerAccount.display_name)}</strong>
    </div>
    ${trusted?'':`<div class="account-form">${accountInput('Code à 4 chiffres','scoreConnectedPin','password','inputmode="numeric" maxlength="4" autocomplete="off"')}</div><p class="score-account-note">Tu peux éviter cette demande pour les prochains scores en activant l’option correspondante dans <b>Compte</b>.</p>`}
    <div class="account-error" id="scoreIdentityError"></div>
    <div class="score-identity-actions">
      <button class="primary" id="scoreSaveConnectedBtn">Enregistrer</button>
      <button class="ghost" id="scoreSwitchAccountBtn">Changer de compte</button>
    </div>`;
  $('#scoreSaveConnectedBtn').onclick=async()=>{
    accountError('#scoreIdentityError','');
    try{
      let account=currentPlayerAccount;
      if(!trusted){
        const pin=$('#scoreConnectedPin').value;
        if(!validPin(pin)){accountError('#scoreIdentityError','Saisis ton code à 4 chiffres.');return;}
        account=await supabaseRpc('orapa_login_profile',{p_name:currentPlayerAccount.display_name,p_pin:pin});
        savePlayerAccount(account);
      }
      closeScoreIdentity({saveGlobal:true,name:account.display_name,pin:'',sessionToken:account.session_token});
    }catch(e){accountError('#scoreIdentityError',e.message);}
  };
  $('#scoreSwitchAccountBtn').onclick=()=>renderScoreInlineLogin(resolve,false,true);
}
function renderScoreInlineLogin(resolve,create=false,switching=false){
  const content=$('#scoreIdentityContent');
  content.innerHTML=`<button class="ghost" id="scoreBackAccount">← Retour</button>
    <h3 style="margin-top:14px;">${create?'Créer un compte':'Se connecter'}</h3>
    <div class="account-form">
      ${accountInput('Pseudo','scoreInlineName','text','maxlength="24" autocomplete="nickname"')}
      ${accountInput('Code à 4 chiffres','scoreInlinePin','password','inputmode="numeric" maxlength="4" autocomplete="off"')}
      ${create?accountInput('Confirmer le code','scoreInlinePinConfirm','password','inputmode="numeric" maxlength="4" autocomplete="off"'):''}
      <div class="account-error" id="scoreIdentityError"></div>
    </div>
    <div class="controls" style="justify-content:flex-end;"><button class="primary" id="scoreInlineSubmit">${create?'Créer et enregistrer':'Se connecter et enregistrer'}</button></div>`;
  $('#scoreBackAccount').onclick=()=>renderScoreAccountPrompt(resolve);
  $('#scoreInlineSubmit').onclick=async()=>{
    accountError('#scoreIdentityError','');
    const name=$('#scoreInlineName').value.trim(),pin=$('#scoreInlinePin').value;
    if(!name){accountError('#scoreIdentityError','Saisis un pseudo.');return;}
    if(create&&looksLikeEmailAddress(name)){accountError('#scoreIdentityError',EMAIL_AS_PSEUDO_WARNING);return;}
    if(!validPin(pin)){accountError('#scoreIdentityError','Le code doit contenir exactement 4 chiffres.');return;}
    if(create && pin!==$('#scoreInlinePinConfirm').value){accountError('#scoreIdentityError','Les deux codes ne correspondent pas.');return;}
    try{
      const account=create
        ? await supabaseRpc('orapa_create_profile',{p_name:name,p_pin:pin})
        : await supabaseRpc('orapa_login_profile',{p_name:name,p_pin:pin});
      savePlayerAccount(account);
      closeScoreIdentity({saveGlobal:true,name:account.display_name,pin:'',sessionToken:account.session_token});
    }catch(e){accountError('#scoreIdentityError',e.message);}
  };
}
async function requestScoreIdentity(title='Enregistrer le score'){
  return new Promise(resolve=>{
    scoreIdentityResolver=resolve;
    const heading=$('#scoreIdentityModal h2');
    if(heading) heading.textContent=`🏆 ${title}`;
    $('#scoreIdentityModal').classList.add('open');
    renderScoreAccountPrompt(resolve);
  });
}
async function requestDailyIdentity(){ return requestScoreIdentity('Enregistrer le défi du jour'); }
async function requestGridIdentity(){ return requestScoreIdentity('Enregistrer ce score'); }
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
async function submitGlobalDailyScore(entry, identity){
  if(!entry || !entry.dailyDate || !identity) return null;
  try{
    const dailyFlags=generateDailyLayout(entry.dailyDate)?.flags||{};
    const row=await supabaseRpc('orapa_submit_daily_score',{
      p_name:identity.name,
      p_pin:identity.pin||'',
      p_session_token:identity.sessionToken||'',
      p_daily_date:entry.dailyDate,
      p_success:!!entry.success,
      p_cost:Number(entry.cost)||0,
      p_ray_count:Number(entry.rayCount)||0,
      p_coord_count:Number(entry.coordCount)||0,
      p_time_ms:Math.max(0,Math.round(Number(entry.timeMs)||0)),
      p_option_mask:(dailyFlags.gray?1:0)+(dailyFlags.onyx?2:0)+(dailyFlags.sapphire?4:0)
    });
    await releaseDailyChallengeLock(identity,entry.dailyDate);
    if(row?.accepted===false&&row?.reason==='already_played'){
      showToast('Ce défi du jour est déjà enregistré avec ce compte.');
      return row;
    }
    if(row?.id!=null) rememberGlobalScoreId(entry.dailyDate,row.id);
    delete globalRankingCache[entry.dailyDate]; globalAllScoresCache=null;
    showToast('🌍 Score ajouté au classement global');
    if(row?.accepted) refreshAchievements();
    return row;
  }catch(err){
    console.error('Envoi du score global impossible :',err);
    showToast(`⚠️ Envoi global impossible : ${err.message}`);
    return null;
  }
}
async function shareGridGlobally(gridId){
  if(!gridId) return null;
  const result=await supabaseRpc('orapa_share_grid',{
    p_grid_id:gridId,
    p_session_token:currentPlayerAccount?.session_token||''
  });
  if(currentPlayerAccount?.session_token) refreshAchievements();
  return result;
}
async function submitGlobalGridScore(entry, identity){
  if(!entry?.gridId || !identity?.sessionToken) return null;
  try{
    const row=await supabaseRpc('orapa_submit_grid_score',{
      p_grid_id:entry.gridId,
      p_session_token:identity.sessionToken,
      p_success:entry.success!==false,
      p_cost:Number(entry.cost)||0,
      p_ray_count:Number(entry.rayCount)||0,
      p_coord_count:Number(entry.coordCount)||0,
      p_time_ms:Math.max(0,Math.round(Number(entry.timeMs)||0))
    });
    if(row?.accepted){invalidateGlobalSoloScores();refreshAchievements(entry.firstTry?'first_try':null);}
    if(row?.reason==='already_played'){refreshAchievements('deja_vu');}
    else if(row?.reason==='creator_protected') showToast('⭐ Cette grille est la vôtre et ne peut pas être résolue avec ce compte.');
    else showToast(row?.rank ? `🌍 Première tentative enregistrée · rang #${row.rank}` : '🌍 Première tentative enregistrée');
    return row;
  }catch(err){
    console.error('Envoi du score de grille impossible :',err);
    showToast(`⚠️ Envoi global impossible : ${err.message}`);
    return null;
  }
}
async function submitLostGridScore(entry,identity){
  if(!entry?.gridId||!identity?.sessionToken)return null;
  try{
    const unlockedBefore=new Set((await getAchievementCatalog(true)).filter(item=>item.unlocked).map(item=>item.achievement_key));
    const row=await supabaseRpc('orapa_submit_lost_grid_score',{p_grid_id:entry.gridId,p_session_token:identity.sessionToken,p_success:entry.success!==false,p_placement_bonus:!!entry.placementBonus,p_placed_count:state.pieces.filter(piece=>piece.center).length,p_cost:Number(entry.cost)||0,p_ray_count:Number(entry.rayCount)||0,p_coord_count:Number(entry.coordCount)||0,p_time_ms:Math.max(0,Math.round(Number(entry.timeMs)||0))});
    if(row?.accepted){
      achievementCatalogCache=null;
      const result=await refreshAchievements(entry.placementBonus?'lost_full_placement':'lost_completed');
      const unlockedAfter=(await getAchievementCatalog(true)).filter(item=>item.unlocked).map(item=>item.achievement_key);
      const newlyUnlocked=unlockedAfter.filter(key=>!unlockedBefore.has(key));
      if(newlyUnlocked.includes('welcome'))showWelcomeAchievement();
      const alreadyNotified=new Set(Array.isArray(result?.new_keys)?result.new_keys:[]);
      const notices=newlyUnlocked.filter(key=>key!=='welcome'&&!alreadyNotified.has(key));
      if(notices.length&&!result?.hide_notifications)queueAchievementNotifications(notices);
    }
    return row;
  }catch(error){console.error('Envoi Gemme perdue impossible',error);showToast(`⚠️ Envoi global impossible : ${error.message}`);return null;}
}
async function shareLostGridGlobally(gridId){
  return supabaseRpc('orapa_share_lost_grid',{p_grid_id:gridId,p_session_token:currentPlayerAccount?.session_token||''});
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
let globalAllScoresCache = null;
async function fetchAllGlobalScores(force=false){
  if(!force && globalAllScoresCache) return globalAllScoresCache;
  const all=[];
  const pageSize=1000;
  for(let start=0;;start+=pageSize){
    const query=new URLSearchParams({
      select:'id,daily_date,player_name,success,cost,ray_count,coord_count,time_ms,created_at',
      order:'daily_date.desc,created_at.asc'
    });
    const response=await fetch(`${SUPABASE_URL}/rest/v1/daily_scores?${query}`,{
      headers:supabaseHeaders({Range:`${start}-${start+pageSize-1}`})
    });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows=await response.json();
    all.push(...rows);
    if(rows.length<pageSize) break;
  }
  globalAllScoresCache=all;
  return all;
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
  if(state.gameVariant==='lost') return TYPE_ORDER.slice();
  const t = ['red','yellow','blue','white','rhombus'];
  if(state.includeGray) t.push('gray');
  if(state.includeOnyx) t.push('onyx');
  if(state.includeSapphire) t.push('sapphire');
  return t;
}
function freshPieceSet(){ return allTypes().map(t=> newPiece(t)); }
function newPiece(type){ return { id:'p'+(pieceIdSeq++), type, center:null, rotation:0, flipped:false }; }

function saveState(){
  try{
    localStorage.setItem('orapaMineStateV3',JSON.stringify({...state,savedScoreResult:lastScoreResult}));
  }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem('orapaMineStateV3');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.pieces)) return false;
    lastScoreResult = s.savedScoreResult || null;
    delete s.savedScoreResult;
    state = s;
    state.mode = state.mode || 'gm';
    state.gameVariant = state.gameVariant || 'classic';
    state.missingType = state.missingType || null;
    state.selectedMissingType = state.selectedMissingType || null;
    state.placementBonus = !!state.placementBonus;
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
    if(state.historyHintShown === undefined) state.historyHintShown = false;
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
  if(state.isDaily && state.soloOver) saveDailyFinalSnapshot();
  const g = state.includeGray, o = state.includeOnyx, s2 = state.includeSapphire;
  state = { mode:'gm', gameVariant:'classic',missingType:null,selectedMissingType:null,placementBonus:false,started:false, includeGray:g, includeOnyx:o, includeSapphire:s2, pieces:[], secretPieces:[],
            soloAttempts:0, soloOver:false, soloResult:null, soloShowGuess:true, soloShowSecret:true, history:[], historyHintShown:false,
            gridId:null, gridRanked:true, moveCost:0, firstActionTime:null, finalTimeMs:null, rayCount:0, coordCount:0,
            isDaily:false, dailyDate:null,
            labelColor:{top:{},bottom:{},left:{},right:{}}, labelBounce:{top:{},bottom:{},left:{},right:{}},
            labelPair:{top:{},bottom:{},left:{},right:{}},
            labelPartner:{top:{},bottom:{},left:{},right:{}},
            cellUsed:{}, traces:[], emptyMarks:[], occupiedMarks:[], coordDots:[] };
  resetHistoryDisclosure();
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
const LOST_GRID_ID_MARKER = 'Z';

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
function encodeLostGridId(pieces, missingType){
  const missingIndex=TYPE_ORDER.indexOf(missingType);
  if(missingIndex<0)return null;
  const chars=[LOST_GRID_ID_MARKER,GRID_ID_CHARS[missingIndex]];
  for(const type of TYPE_ORDER){
    if(type===missingType)continue;
    const piece=pieces.find(p=>p.type===type&&p.center);
    if(!piece)return null;
    const x2=Math.max(0,Math.min(31,Math.round(piece.center.x*2)));
    const y2=Math.max(0,Math.min(31,Math.round(piece.center.y*2)));
    const rotIdx=Math.max(0,ROTATIONS.indexOf(piece.rotation));
    chars.push(GRID_ID_CHARS[x2],GRID_ID_CHARS[y2],GRID_ID_CHARS[rotIdx*2+(piece.flipped?1:0)]);
  }
  return chars.join('').match(/.{1,4}/g).join('-');
}
function decodeGridId(input){
  const clean = (input||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(clean.length < 1) return null;
  if(clean[0]===LOST_GRID_ID_MARKER){
    if(clean.length!==2+7*3)return null;
    const missingIndex=GRID_ID_CHARS.indexOf(clean[1]);
    const missingType=TYPE_ORDER[missingIndex];
    if(!missingType)return null;
    const pieces=[];let idx=2;
    for(const type of TYPE_ORDER.filter(type=>type!==missingType)){
      const cx=GRID_ID_CHARS.indexOf(clean[idx]),cy=GRID_ID_CHARS.indexOf(clean[idx+1]),cc=GRID_ID_CHARS.indexOf(clean[idx+2]);
      if(cx<0||cy<0||cc<0||cc>7)return null;
      pieces.push({type,center:{x:cx/2,y:cy/2},rotation:ROTATIONS[Math.floor(cc/2)],flipped:!!(cc%2)});idx+=3;
    }
    return {variant:'lost',missingType,includeGray:true,includeOnyx:true,includeSapphire:true,pieces,id:clean.match(/.{1,4}/g).join('-')};
  }
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
  return { variant:'classic',includeGray, includeOnyx, includeSapphire, pieces, id: formatted };
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

function tryRandomLayout(rngFn,requestedTypes){
  rngFn = rngFn || Math.random;
  const types = seededShuffle(requestedTypes||allTypes(), rngFn);
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
function generateRandomLayout(maxAttempts,requestedTypes){
  maxAttempts = maxAttempts || 60;
  for(let attempt=0; attempt<maxAttempts; attempt++){
    const layout = tryRandomLayout(null,requestedTypes);
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
function placeDailyRegularPiece(type, placed, rngFn){
  for(let tries=0; tries<250; tries++){
    const rotation = ROTATIONS[Math.floor(rngFn()*4)];
    const flipped = rngFn()<0.5;
    const probe = { id:'r_'+type, type, center:{x:COLS/2,y:ROWS/2}, rotation, flipped };
    const {hw,hh} = boundingHalfExtents(probe);
    if(hw*2>COLS || hh*2>ROWS) return null;
    const rawX = hw+rngFn()*(COLS-2*hw);
    const rawY = hh+rngFn()*(ROWS-2*hh);
    let {x:cx,y:cy} = snapPieceCenter(rawX,rawY,probe);
    cx=Math.min(COLS-hw,Math.max(hw,cx));
    cy=Math.min(ROWS-hh,Math.max(hh,cy));
    const candidate={id:'r_'+type,type,center:{x:cx,y:cy},rotation,flipped};
    if(placementValid(candidate,null,placed)) return candidate;
  }
  return null;
}
function pieceIsPartiallyOutside(piece){
  const {hw,hh}=boundingHalfExtents(piece);
  return piece.center.x-hw < -1e-6 || piece.center.x+hw > COLS+1e-6 ||
         piece.center.y-hh < -1e-6 || piece.center.y+hh > ROWS+1e-6;
}
function sideTouchPairs(pieces){
  const pairs=[];
  for(let i=0;i<pieces.length;i++) for(let j=i+1;j<pieces.length;j++){
    if(edgeContactKind(pieceVertices(pieces[i]),pieceVertices(pieces[j]))==='sideTouch') pairs.push([pieces[i].type,pieces[j].type]);
  }
  return pairs;
}
// Depuis le 30/07/2026, les deux exceptions sont tirées explicitement :
// dépassement seul, contact seul, ou les deux. Dans ce dernier cas, le contact
// peut concerner la gemme qui dépasse ou deux autres gemmes.
function createDailyLayoutV2Plan(rngFn){
  const flags={gray:rngFn()<0.5,onyx:rngFn()<0.5,sapphire:rngFn()<0.5};
  const types=seededShuffle(dailyTypesForFlags(flags.gray,flags.onyx,flags.sapphire),rngFn);
  const modes=['partialOut','sideTouch','both'];
  const exceptionRule=modes[Math.floor(rngFn()*modes.length)];
  const needsPartial=exceptionRule!=='sideTouch';
  const needsTouch=exceptionRule!=='partialOut';
  const partialType=needsPartial ? types[Math.floor(rngFn()*types.length)] : null;
  let touchTypes=[];
  if(needsTouch){
    const touchPool=seededShuffle(types,rngFn);
    touchTypes=[touchPool[0],touchPool[1]];
  }
  return {flags,types,exceptionRule,needsPartial,needsTouch,partialType,touchTypes};
}
function rerollDailyLayoutV2Roles(plan,rngFn){
  const {flags,types,exceptionRule,needsPartial,needsTouch}=plan;
  const keepPartialInPair=exceptionRule==='both'&&plan.touchTypes.includes(plan.partialType);
  const partialType=needsPartial ? types[Math.floor(rngFn()*types.length)] : null;
  let touchTypes=[];
  if(needsTouch){
    if(exceptionRule==='both'){
      if(keepPartialInPair){
        const partners=seededShuffle(types.filter(type=>type!==partialType),rngFn);
        touchTypes=seededShuffle([partialType,partners[0]],rngFn);
      }else{
        touchTypes=seededShuffle(types.filter(type=>type!==partialType),rngFn).slice(0,2);
      }
    }else{
      touchTypes=seededShuffle(types,rngFn).slice(0,2);
    }
  }
  return {flags,types,exceptionRule,needsPartial,needsTouch,partialType,touchTypes};
}
function tryDailyLayoutV2(rngFn,useUniqueTemporaryIds=false,fixedPlan=null){
  const plan=fixedPlan||createDailyLayoutV2Plan(rngFn);
  const {flags,types,exceptionRule,needsPartial,needsTouch,partialType,touchTypes}=plan;
  const placed=[];
  if(needsPartial){
    const partial=findForcedPartialOut(partialType,placed,rngFn);
    if(!partial) return null;
    if(useUniqueTemporaryIds) partial.id='daily_partial_'+partialType;
    placed.push(partial);
  }
  if(needsTouch){
    const partialInPair=touchTypes.includes(partialType);
    if(partialInPair){
      const otherType=touchTypes.find(type=>type!==partialType);
      const touching=findForcedSideTouch(otherType,placed,rngFn);
      if(!touching) return null;
      if(useUniqueTemporaryIds) touching.id='daily_touch_'+otherType;
      placed.push(touching);
    }else{
      const anchor=placeDailyRegularPiece(touchTypes[0],placed,rngFn);
      if(!anchor) return null;
      placed.push(anchor);
      const touching=findForcedSideTouch(touchTypes[1],placed,rngFn);
      if(!touching) return null;
      if(useUniqueTemporaryIds) touching.id='daily_touch_'+touchTypes[1];
      placed.push(touching);
    }
  }
  for(const type of types){
    if(placed.some(piece=>piece.type===type)) continue;
    const candidate=placeDailyRegularPiece(type,placed,rngFn);
    if(!candidate) return null;
    placed.push(candidate);
  }
  const partialCount=placed.filter(pieceIsPartiallyOutside).length;
  const touches=sideTouchPairs(placed);
  if(needsPartial ? partialCount!==1 : partialCount!==0) return null;
  if(useUniqueTemporaryIds&&needsTouch){
    const expected=touchTypes.slice().sort().join('|');
    if(touches.length!==1||touches[0].slice().sort().join('|')!==expected) return null;
  }else if(needsTouch ? touches.length<1 : touches.length!==0) return null;
  if(unreachablePieces(placed).length>0) return null;
  return {
    pieces:placed.map(p=>({id:'p'+(pieceIdSeq++),type:p.type,center:p.center,rotation:p.rotation,flipped:p.flipped})),
    flags,exceptionRule,exceptionType:partialType,touchTypes
  };
}
function generateDailyLayout(dateKey){
  const useV2=dateKey>='2026-07-30';
  const useUniqueTemporaryIds=dateKey>='2026-08-06';
  const rngFn = mulberry32(seedFromString((useV2?'DAILY-V2-':'DAILY-')+dateKey));
  let fixedPlan=useUniqueTemporaryIds?createDailyLayoutV2Plan(rngFn):null;
  const maxAttempts=120;
  for(let attempt=0; attempt<maxAttempts; attempt++){
    if(useUniqueTemporaryIds&&attempt>0&&attempt%8===0){
      fixedPlan=rerollDailyLayoutV2Roles(fixedPlan,rngFn);
    }
    const result = useV2 ? tryDailyLayoutV2(rngFn,useUniqueTemporaryIds,fixedPlan) : tryDailyLayout(rngFn);
    if(result) return result;
  }
  return null;
}

function randomizePlacement(){
  const requestedTypes=state.gameVariant==='lost'?(state.pieces.length===8?TYPE_ORDER.filter(type=>type!==TYPE_ORDER[Math.floor(Math.random()*TYPE_ORDER.length)]):state.pieces.map(piece=>piece.type)):null;
  const layout = generateRandomLayout(60,requestedTypes);
  if(layout){
    state.history = [];
    resetHistoryDisclosure();
    state.labelColor = {top:{},bottom:{},left:{},right:{}};
    state.labelBounce = {top:{},bottom:{},left:{},right:{}};
    state.cellUsed = {};
    state.traces = [];
    state.emptyMarks = [];
    state.coordDots = [];
    state.pieces = state.gameVariant==='lost'?[...layout,newPiece(TYPE_ORDER.find(type=>!layout.some(piece=>piece.type===type)))]:layout;
    if(state.gameVariant==='lost')state.missingType=state.pieces.find(piece=>!piece.center)?.type||null;
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
async function startSoloGame(explicitId,creatorRetry=0){
  const previousOptions={includeGray:state.includeGray,includeOnyx:state.includeOnyx,includeSapphire:state.includeSapphire};
  let gridId, secret, ranked;
  if(explicitId){
    const decoded = decodeGridId(explicitId);
    if(!decoded){
      showToast("Identifiant invalide. Vérifie qu’il a été copié en entier.");
      return;
    }
    state.includeGray = decoded.includeGray;
    state.includeOnyx = decoded.includeOnyx;
    state.includeSapphire = decoded.includeSapphire;
    secret = decoded.pieces.map(p=> ({ id:'p'+(pieceIdSeq++), type:p.type, center:p.center, rotation:p.rotation, flipped:p.flipped }));
    if(computeInvalidPieceIds(secret).size>0){
      showToast("Cet identifiant ne correspond à aucune grille valide.");
      return;
    }
    gridId = decoded.id;
    ranked = true;
  } else {
    secret = generateRandomLayout();
    if(!secret){
      setTimeout(()=> alert("Je n'ai pas réussi à générer une grille, réessaie."), 60);
      return;
    }
    gridId = encodeGridId(secret, state.includeGray, state.includeOnyx, state.includeSapphire);
    ranked = true;
  }
  let gridStatus=null;
  try{
    gridStatus=await supabaseRpc('orapa_get_grid_status',{p_grid_id:gridId,p_session_token:currentPlayerAccount.session_token});
  }catch(e){
    console.warn('Statut de grille indisponible',e);
    showToast('Impossible de vérifier cette grille. Vérifie ta connexion puis réessaie.');
    return;
  }
  if(gridStatus?.is_creator){
    if(!explicitId&&creatorRetry<20)return startSoloGame(null,creatorRetry+1);
    if(explicitId)Object.assign(state,previousOptions);
    openCreatorGridBlockedModal(gridId);
    return;
  }
  const unrankedReason=gridStatus?.creator_protected?'creator_protected':(gridStatus?.already_played?'already_played':null);
  setHintMode(false);
  state.mode = 'solo';
  state.gameVariant='classic';state.missingType=null;state.selectedMissingType=null;state.placementBonus=false;
  state.started = false;
  state.secretPieces = secret;
  state.pieces = freshPieceSet();
  state.gridId = gridId;
  state.gridRanked = ranked && !unrankedReason;
  state.gridUnrankedReason = unrankedReason;
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
  resetHistoryDisclosure();
  state.labelColor = {top:{},bottom:{},left:{},right:{}};
  state.labelBounce = {top:{},bottom:{},left:{},right:{}};
  state.labelPair = {top:{},bottom:{},left:{},right:{}};
  state.labelPartner = {top:{},bottom:{},left:{},right:{}};
  state.cellUsed = {};
  state.traces = [];
  state.emptyMarks = [];
  state.coordDots = [];
  saveState();
  document.body.classList.remove('solo-menu-open');
  showGame();
  renderAll();
  if(unrankedReason==='creator_protected') setTimeout(()=>alert('Vous avez créé cette grille récemment. Vous pouvez jouer normalement, mais votre score ne sera pas ajouté au classement pour le moment.'),60);
  else if(unrankedReason==='already_played') setTimeout(openAlreadyPlayedGridModal,60);
}

async function startLostGame(explicitId=null,creatorRetry=0){
  let decoded=null,secret=null,gridId=null,missingType=null;
  if(explicitId){
    decoded=decodeGridId(explicitId);
    if(!decoded||decoded.variant!=='lost'){showToast('Cet identifiant ne correspond pas à une grille Gemme perdue.');return;}
    secret=decoded.pieces.map(p=>({id:'p'+(pieceIdSeq++),type:p.type,center:{...p.center},rotation:p.rotation,flipped:p.flipped}));
    missingType=decoded.missingType;gridId=decoded.id;
  }else{
    missingType=TYPE_ORDER[Math.floor(Math.random()*TYPE_ORDER.length)];
    secret=generateRandomLayout(100,TYPE_ORDER.filter(type=>type!==missingType));
    if(!secret){showToast('Impossible de générer cette grille. Réessaie.');return;}
    gridId=encodeLostGridId(secret,missingType);
  }
  if(computeInvalidPieceIds(secret).size>0){showToast('Cet identifiant ne correspond à aucune grille valide.');return;}
  let gridStatus={};
  try{gridStatus=await supabaseRpc('orapa_get_lost_grid_status',{p_grid_id:gridId,p_session_token:currentPlayerAccount?.session_token||''});}
  catch(error){console.warn('Statut Gemme perdue indisponible',error);if(explicitId){showToast('Impossible de vérifier cette grille.');return;}}
  if(gridStatus?.is_creator){
    if(!explicitId&&creatorRetry<24)return startLostGame(null,creatorRetry+1);
    openCreatorGridBlockedModal(gridId);return;
  }
  setHintMode(false);
  state.mode='solo';state.gameVariant='lost';state.started=false;state.includeGray=true;state.includeOnyx=true;state.includeSapphire=true;
  state.secretPieces=secret;state.pieces=TYPE_ORDER.map(type=>newPiece(type));state.missingType=missingType;state.selectedMissingType=null;state.placementBonus=false;
  state.gridId=gridId;state.gridRanked=!gridStatus?.already_played;state.gridUnrankedReason=gridStatus?.already_played?'already_played':null;
  state.soloAttempts=0;state.soloOver=false;state.soloResult=null;state.soloShowGuess=true;state.soloShowSecret=true;state.moveCost=0;state.firstActionTime=null;state.finalTimeMs=null;state.rayCount=0;state.coordCount=0;lastScoreResult=null;state.isDaily=false;state.dailyDate=null;state.history=[];resetHistoryDisclosure();state.labelColor={top:{},bottom:{},left:{},right:{}};state.labelBounce={top:{},bottom:{},left:{},right:{}};state.labelPair={top:{},bottom:{},left:{},right:{}};state.labelPartner={top:{},bottom:{},left:{},right:{}};state.cellUsed={};state.traces=[];state.emptyMarks=[];state.occupiedMarks=[];state.coordDots=[];
  saveState();closeSoloChoiceModal();showGame();renderAll();
  if(gridStatus?.already_played)setTimeout(openAlreadyPlayedGridModal,60);
}

function dailyStatusToday(){
  const dateKey = parisDateKey();
  const attempt = loadDailyAttempt();
  const accountKey=dailyAttemptAccountKey();
  const localAttempt=attempt && attempt.date===dateKey
    && (attempt.accountId===accountKey || (!attempt.accountId && accountKey==='local')) ? attempt : null;
  const remoteAttempt=remoteDailyStatusCache?.dateKey===dateKey && remoteDailyStatusCache.accountKey===accountKey
    ? remoteDailyStatusCache.attempt : null;
  const currentAttempt=localAttempt||remoteAttempt;
  return {dateKey,alreadyPlayed:!!currentAttempt,attempt:currentAttempt};
}
async function refreshDailyStatusFromSupabase(force=false){
  if(!currentPlayerAccount?.session_token) return dailyStatusToday();
  const dateKey=parisDateKey(),accountKey=dailyAttemptAccountKey();
  if(!force && remoteDailyStatusCache?.dateKey===dateKey && remoteDailyStatusCache.accountKey===accountKey && Date.now()-remoteDailyStatusCache.checkedAt<30000){
    return dailyStatusToday();
  }
  if(remoteDailyStatusPromise) return remoteDailyStatusPromise;
  remoteDailyStatusPromise=(async()=>{
    const response=await supabaseRpc('orapa_my_daily_history',{p_session_token:currentPlayerAccount.session_token,p_limit:1,p_offset:0});
    const row=(Array.isArray(response)?response:[]).find(item=>String(item.daily_date).slice(0,10)===dateKey);
    remoteDailyStatusCache={
      dateKey,accountKey,checkedAt:Date.now(),
      attempt:row?{date:dateKey,result:row.success?'win':'lose',accountId:accountKey,source:'supabase'}:null
    };
    return dailyStatusToday();
  })();
  try{return await remoteDailyStatusPromise;}finally{remoteDailyStatusPromise=null;}
}
function formatDailyDate(dateKey){
  const match=String(dateKey||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(dateKey||'');
}
function reviewDailyFinalGrid(dateKey){
  const snapshot=loadDailyFinalSnapshot(dateKey);
  if(!snapshot){ showToast('La grille finale n’est plus disponible sur ce navigateur.'); return; }
  state=JSON.parse(JSON.stringify(snapshot.state));
  lastScoreResult=snapshot.lastScoreResult?JSON.parse(JSON.stringify(snapshot.lastScoreResult)):null;
  pieceIdSeq=1+state.pieces.concat(state.secretPieces||[]).reduce((max,piece)=>Math.max(max,parseInt((piece.id||'p0').slice(1))||0),0);
  saveState();
  closeSoloChoiceModal();
  showGame();
  renderAll();
}
function fallbackBrowserEnvironment(){
  const ua=navigator.userAgent||'';
  let browserName='Navigateur',browserVersion='inconnue',osName='Système',osVersion='inconnue',match;
  if((match=ua.match(/Edg(?:A|iOS)?\/([\d.]+)/))){browserName='Edge';browserVersion=match[1];}
  else if((match=ua.match(/OPR\/([\d.]+)/))){browserName='Opera';browserVersion=match[1];}
  else if((match=ua.match(/(?:Chrome|CriOS)\/([\d.]+)/))){browserName='Chrome';browserVersion=match[1];}
  else if((match=ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/))){browserName='Firefox';browserVersion=match[1];}
  else if((match=ua.match(/Version\/([\d.]+).*Safari/))){browserName='Safari';browserVersion=match[1];}
  if((match=ua.match(/Android\s+([\d.]+)/))){osName='Android';osVersion=match[1];}
  else if((match=ua.match(/(?:iPhone|CPU) OS ([\d_]+)/))){osName='iOS';osVersion=match[1].replace(/_/g,'.');}
  else if((match=ua.match(/Windows NT ([\d.]+)/))){osName='Windows';osVersion=match[1];}
  else if((match=ua.match(/Mac OS X ([\d_]+)/))){osName='macOS';osVersion=match[1].replace(/_/g,'.');}
  return {browserName,browserVersion,osName,osVersion};
}
async function browserEnvironmentFingerprint(){
  const fallback=fallbackBrowserEnvironment();
  if(!navigator.userAgentData?.getHighEntropyValues) return JSON.stringify(fallback);
  try{
    const data=await navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion']);
    const brands=data.fullVersionList||data.brands||[];
    const preferred=brands.find(item=>!/chromium|not.?a.?brand/i.test(item.brand))||brands.find(item=>!/not.?a.?brand/i.test(item.brand));
    return JSON.stringify({
      browserName:preferred?.brand||fallback.browserName,
      browserVersion:preferred?.version||fallback.browserVersion,
      osName:data.platform||fallback.osName,
      osVersion:data.platformVersion||fallback.osVersion
    });
  }catch(e){ return JSON.stringify(fallback); }
}
async function acquireDailyChallengeLock(dateKey){
  if(!currentPlayerAccount?.session_token) return {accepted:false,reason:'account_required'};
  const fingerprint=await browserEnvironmentFingerprint();
  return supabaseRpc('orapa_acquire_daily_lock',{
    p_session_token:currentPlayerAccount.session_token,
    p_daily_date:dateKey,
    p_browser_fingerprint:fingerprint
  });
}
async function releaseDailyChallengeLock(identity,dateKey){
  if(!identity?.sessionToken||!dateKey) return;
  try{await supabaseRpc('orapa_release_daily_lock',{p_session_token:identity.sessionToken,p_daily_date:dateKey});}
  catch(error){console.warn('Libération du verrou du défi impossible :',error);}
}
async function startDailyChallenge(){
  const { dateKey, alreadyPlayed, attempt } = dailyStatusToday();
  if(alreadyPlayed){
    reviewDailyFinalGrid(dateKey);
    return;
  }
  if(!await verifyTriforcePrerequisite(true)) return;
  if(!await ensureCurrentAppVersion(true,true)) return;
  try{
    const lock=await acquireDailyChallengeLock(dateKey);
    if(lock?.accepted===false){
      if(lock.reason==='already_played') reviewDailyFinalGrid(dateKey);
      else if(lock.reason==='triforce_required') openTriforcePrerequisiteModal(false);
      else alert('Défi déjà commencé ailleurs\n\nCe défi du jour a déjà été lancé depuis un autre navigateur. Veuillez reprendre la partie sur le navigateur depuis lequel elle a été commencée.');
      return;
    }
  }catch(error){
    alert('Impossible de vérifier la disponibilité du défi du jour. Vérifie ta connexion puis réessaie.');
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
  state.gameVariant='classic';state.missingType=null;state.selectedMissingType=null;state.placementBonus=false;
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
  resetHistoryDisclosure();
  state.labelColor = {top:{},bottom:{},left:{},right:{}};
  state.labelBounce = {top:{},bottom:{},left:{},right:{}};
  state.labelPair = {top:{},bottom:{},left:{},right:{}};
  state.labelPartner = {top:{},bottom:{},left:{},right:{}};
  state.cellUsed = {};
  state.traces = [];
  state.emptyMarks = [];
  state.coordDots = [];
  saveState();
  document.body.classList.remove('solo-menu-open');
  showGame();
  renderAll();
}
function polygonVertexSetsMatch(vA,vB,tol=1e-3){
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
function polygonsMatch(pA,pB,tol=1e-3){
  return polygonVertexSetsMatch(pieceVertices(pA),pieceVertices(pB),tol);
}
function normalizedClippedPieceVertices(piece,tol=1e-7){
  const board=ensureCCW([{x:0,y:0},{x:COLS,y:0},{x:COLS,y:ROWS},{x:0,y:ROWS}]);
  let vertices=clipPolygon(ensureCCW(pieceVertices(piece)),board);
  vertices=vertices.filter((point,index)=>{
    const previous=vertices[(index+vertices.length-1)%vertices.length];
    return Math.hypot(point.x-previous.x,point.y-previous.y)>tol;
  });
  let changed=true;
  while(changed&&vertices.length>2){
    changed=false;
    vertices=vertices.filter((point,index)=>{
      const previous=vertices[(index+vertices.length-1)%vertices.length];
      const next=vertices[(index+1)%vertices.length];
      const collinear=Math.abs(cross2(previous,point,next))<=tol;
      if(collinear)changed=true;
      return !collinear;
    });
  }
  return vertices;
}
function visiblePolygonsMatch(pA,pB,tol=1e-3){
  return polygonVertexSetsMatch(normalizedClippedPieceVertices(pA),normalizedClippedPieceVertices(pB),tol);
}
function evaluateGuess(){
  for(const type of allTypes()){
    const s = state.secretPieces.find(p=>p.type===type);
    const g = state.pieces.find(p=>p.type===type && p.center);
    if(!s || !g) return false;
    if(state.isDaily ? !visiblePolygonsMatch(s,g) : !polygonsMatch(s,g)) return false;
  }
  return true;
}
let lastScoreResult = null;
function currentEntryForDisplay(){
  return {
    name: (lastScoreResult && lastScoreResult.entry.name) || currentPlayerAccount?.display_name || 'Anonyme',
    cost: state.moveCost||0,
    timeMs: state.finalTimeMs||0,
    rayCount: state.rayCount||0,
    coordCount: state.coordCount||0,
    gridId: state.gridId,
    isDaily: state.isDaily,
    gameVariant:state.gameVariant||'classic',
    placementBonus:!!state.placementBonus,
    dailyDate: state.dailyDate,
    success: state.soloResult==='win',
    firstTry: state.soloResult==='win'&&state.soloAttempts===0,
    date: (lastScoreResult && lastScoreResult.entry.date) || Date.now()
  };
}
function openVictoryModal(){
  const entry = currentEntryForDisplay();
  const won = state.soloResult==='win';
  $('#resultModalTitle').textContent = won ? '🏆 Victoire !' : '💥 Défaite';
  $('#victoryMessage').textContent = won
    ? (state.gameVariant==='lost'?(state.placementBonus?'Tu as identifié la gemme perdue et reconstitué toute la grille !':'Tu as identifié la gemme perdue !'):'Tu as retrouvé la disposition exacte !')
    : (state.isDaily
      ? 'Solution incorrecte : la grille secrète est révélée ci-dessous.'
      : 'La seconde proposition est incorrecte : la grille secrète est révélée ci-dessous.');
  $('#victoryScoreLine').textContent = formatScoreLine(entry);
  $('#victoryRankLine').textContent = lastScoreResult?.alreadyPlayed
    ? 'Ce défi avait déjà été terminé avec ce compte sur un autre appareil. Cette tentative n’a pas été enregistrée.'
    : (lastScoreResult && lastScoreResult.madeList
      ? `Classé #${lastScoreResult.rank} dans « ${lastScoreResult.key} »`
      : (state.isDaily ? '' : (state.gridUnrankedReason==='creator_protected'
      ? '⭐ Cette grille est la vôtre et ne peut pas être résolue avec ce compte.'
      : '')));
  $('#victoryGridId').textContent = state.isDaily ? `Défi du jour (${formatDailyDate(state.dailyDate)})` : `${state.gameVariant==='lost'?'Gemme perdue · ':''}${state.gridId||''}`;
  $('#btnVictoryGridRanking').style.display=(!state.isDaily&&state.gridId)?'':'none';
  $('#btnVictoryCopySummary').style.display=state.gridUnrankedReason==='already_played'?'none':'';
  $('#victoryModal').classList.add('open');
}
async function proposeSolution(){
  if(state.mode!=='solo' || state.soloOver) return;
  if(tutorialActive){tutorialPropose();return;}
  if(state.gameVariant==='lost'){openLostSolutionModal();return;}
  const correct=evaluateGuess();
  if(correct){
    state.soloOver=true; state.soloResult='win';
    const elapsedMs=state.firstActionTime?(Date.now()-state.firstActionTime):0; state.finalTimeMs=elapsedMs;
    if(state.isDaily){
      const identity=await requestDailyIdentity();
      if(!identity){ state.soloOver=false; state.soloResult=null; return; }
      const candidate={...currentEntryForDisplay(),name:identity.name||'Invité',success:true,gridId:null,isDaily:true,dailyDate:state.dailyDate};
      const globalResult=identity.saveGlobal!==false?await submitGlobalDailyScore(candidate,identity):null;
      state.dailyAlreadyRecorded=globalResult?.accepted===false&&globalResult?.reason==='already_played';
      if(state.dailyAlreadyRecorded){
        lastScoreResult={key:'Défi du jour',entry:candidate,rank:null,madeList:false,alreadyPlayed:true};
      }else{
        const daily=recordDailyScore(identity.name||'Invité',state.dailyDate,true,elapsedMs);
        lastScoreResult={key:'Défi du jour',entry:{...daily.entry,gridId:null,isDaily:true,dailyDate:state.dailyDate},rank:globalResult?.rank||daily.rank,madeList:true};
      }
      saveDailyAttempt({date:state.dailyDate,result:'win',accountId:dailyAttemptAccountKey()});
    }else if(state.gridRanked){
      const identity=await requestGridIdentity();
      if(!identity){ state.soloOver=false; state.soloResult=null; return; }
      lastScoreResult={key:'classement global de la grille',entry:{...currentEntryForDisplay(),name:identity.name||'Invité'},rank:null,madeList:false};
      if(identity.saveGlobal!==false){
        const globalResult=await submitGlobalGridScore(lastScoreResult.entry,identity);
        if(globalResult?.rank){ lastScoreResult.rank=globalResult.rank; lastScoreResult.madeList=true; }
        if(globalResult?.reason){ state.gridUnrankedReason=globalResult.reason; state.gridRanked=false; }
      }
    }else lastScoreResult=null;
    if(state.isDaily) saveDailyFinalSnapshot();
    saveState();renderAll();setTimeout(()=>openVictoryModal(),60);return;
  }
  state.soloAttempts++;
  if(state.isDaily||state.soloAttempts>=2){
    state.soloOver=true;state.soloResult='lose';
    const elapsedMs=state.firstActionTime?(Date.now()-state.firstActionTime):0;state.finalTimeMs=elapsedMs;
    if(state.isDaily){
      const identity=await requestDailyIdentity();
      if(!identity){ state.soloOver=false;state.soloResult=null;state.soloAttempts--;return; }
      const candidate={...currentEntryForDisplay(),name:identity.name||'Invité',success:false,gridId:null,isDaily:true,dailyDate:state.dailyDate};
      const globalResult=identity.saveGlobal!==false?await submitGlobalDailyScore(candidate,identity):null;
      state.dailyAlreadyRecorded=globalResult?.accepted===false&&globalResult?.reason==='already_played';
      if(!state.dailyAlreadyRecorded) recordDailyScore(identity.name||'Invité',state.dailyDate,false,elapsedMs);
      saveDailyAttempt({date:state.dailyDate,result:'lose',accountId:dailyAttemptAccountKey()});
    }else if(state.gridRanked){
      const identity=await requestGridIdentity();
      if(!identity){ state.soloOver=false;state.soloResult=null;state.soloAttempts--;return; }
      if(identity.saveGlobal!==false){
        const entry={...currentEntryForDisplay(),name:identity.name||'Invité',success:false};
        const globalResult=await submitGlobalGridScore(entry,identity);
        if(globalResult?.reason){ state.gridUnrankedReason=globalResult.reason; state.gridRanked=false; }
      }
    }
    if(state.isDaily) saveDailyFinalSnapshot();
    saveState();renderAll();setTimeout(()=>openVictoryModal(),60);
  }else{saveState();setTimeout(openIncorrectSolutionModal,60);}
}
function lostPlacementIsExact(){
  const placed=state.pieces.filter(piece=>piece.center);
  if(placed.length!==7||placed.some(piece=>piece.type===state.missingType))return false;
  return state.secretPieces.every(secret=>{const guess=placed.find(piece=>piece.type===secret.type);return guess&&polygonsMatch(secret,guess);});
}
async function finalizeLostSolution(){
  if(state.gameVariant!=='lost'||state.soloOver||!state.selectedMissingType)return;
  $('#lostSolutionModal').classList.remove('open');
  const won=state.selectedMissingType===state.missingType;
  const originalCost=state.moveCost||0;
  state.soloOver=true;state.soloResult=won?'win':'lose';state.placementBonus=won&&lostPlacementIsExact();state.soloAttempts=1;state.finalTimeMs=state.firstActionTime?Date.now()-state.firstActionTime:0;
  if(state.placementBonus)state.moveCost=Math.max(0,originalCost-5);
  if(state.gridRanked){
    const identity=await requestGridIdentity();
    if(!identity){state.soloOver=false;state.soloResult=null;state.placementBonus=false;state.soloAttempts=0;state.moveCost=originalCost;return;}
    const entry={...currentEntryForDisplay(),name:identity.name||'Invité',success:won};
    lastScoreResult={key:'classement Gemme perdue',entry,rank:null,madeList:false};
    if(identity.saveGlobal!==false){const result=await submitLostGridScore(entry,identity);if(result?.rank){lastScoreResult.rank=result.rank;lastScoreResult.madeList=true;}if(result?.reason){state.gridUnrankedReason=result.reason;state.gridRanked=false;}}
  }
  saveState();renderAll();setTimeout(openVictoryModal,60);
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
// Pour une gemme qui dépasse du plateau, seule sa partie visible participe à l’onde.
// Le contour créé par la limite du plateau devient donc une paroi droite : une onde
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

// Chaque gemme posée doit pouvoir être touchée par au moins une onde SANS rebond
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
// GEOMETRY — tracé de l’onde
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
  const points = [pos], hitPieceIds=[];
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
    hitPieceIds.push(best.piece.id);
    points.push(best.point);
    if(def.isOnyx){ absorbed=true; break; }
    if(def.colorKey) colorsHit.add(def.colorKey);
    if(def.colorKeys) def.colorKeys.forEach(k=> colorsHit.add(k));
    dir = best.edgeType==='wall' ? {dx:-dir.dx,dy:-dir.dy} : reflect(dir, best.edgeType);
    pos = best.point;
    skipPieceId = best.piece.id; skipEdgeIdx = best.edgeIdx;
  }
  const color = absorbed==='loop' ? {name:'Boucle infinie détectée',hex:'#c1503f'} : (absorbed ? CONFIG.ABSORBED : resolveColor(colorsHit));
  return { entrySide:side, entryIndex:index, exitSide, exitIndex, absorbed, color, points, hitPieceIds };
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
  const labelValue=document.createElement('span');
  labelValue.className='label-value';
  labelValue.textContent=labelText(side,index);
  div.appendChild(labelValue);
  div.dataset.side = side;
  div.dataset.index = index;
  if(used){
    const hex = state.labelColor[side][index];
    const colorName=beamColorName(hex);
    div.classList.add('used');
    if(colorName==='Transparent'){
      div.classList.add('beam-transparent');
    }else if(colorName==='Absorbé'){
      div.classList.add('beam-absorbed');
    }else if(colorName==='Noir'){
      // Le noir est une couleur obtenue par combinaison : il conserve
      // l'ancien affichage plein, contrairement à une onde absorbée.
      div.classList.add('beam-black');
    }else{
      div.style.background = hex;
      div.style.color = contrastText(hex);
    }
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
        // Compatibilité avec les parties déjà enregistrées avant la correction :
        // les anciennes valeurs « Entré par X » sont affichées comme « Sort en X ».
        const rawPairText = state.labelPair[side][index] || '?';
        const pairText = rawPairText.replace(/^Entr(?:é|e) par\s+/i, 'Sort en ');
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
  const showCheckboxes = state.mode==='gm' && !state.started && state.gameVariant!=='lost';
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
  const moveCount=$('#historyMoveCount');
  if(moveCount){
    const rays=state.mode==='solo'?Number(state.rayCount||0):state.history.filter(h=>h.kind==='ray'||(!h.kind&&!/<b>[A-H](?:10|[1-9])<\/b>/i.test(h.text||''))).length;
    const coords=state.mode==='solo'?Number(state.coordCount||0):state.history.length-rays;
    moveCount.textContent=`${rays}🔦 / ${coords}📍`;
  }
  if(firefoxPerformanceEnabled()&&$('#historyDisclosure')?.classList.contains('collapsed'))return;
  if(state.history.length===0){
    el.innerHTML='<div class="history-empty">Démarre la partie puis clique sur une lettre, un chiffre ou une case pour interroger la mine.</div>';
    return;
  }
  el.innerHTML = state.history.slice().reverse().map(h=>{
    const colorName=beamColorName(h.hex);
    const specialClass=colorName==='Transparent'?' beam-transparent':colorName==='Absorbé'?' beam-absorbed':'';
    const swatchStyle=specialClass?'':` style="background:${h.hex}"`;
    return `
    <div class="history-item">
      <span class="history-swatch${specialClass}"${swatchStyle}></span>
      <span class="history-text">${h.text}</span>
      <span class="history-time">${h.time}</span>
    </div>`;
  }).join('');
}
function resetHistoryDisclosure(){
  state.historyHintShown=false;
  const disclosure=$('#historyDisclosure'),toggle=$('#historyToggle'),indicator=$('#historyToggleIndicator');
  if(!disclosure||!toggle||!indicator)return;
  disclosure.classList.add('collapsed');
  toggle.setAttribute('aria-expanded','false');
  indicator.textContent='+';
}
function toggleHistoryDisclosure(){
  const disclosure=$('#historyDisclosure'),toggle=$('#historyToggle'),indicator=$('#historyToggleIndicator');
  if(!disclosure||!toggle||!indicator)return;
  const opening=disclosure.classList.contains('collapsed');
  disclosure.classList.toggle('collapsed',!opening);
  toggle.setAttribute('aria-expanded',String(opening));
  indicator.textContent=opening?'−':'+';
  if(opening)renderHistory();
  if(opening&&!state.historyHintShown){
    state.historyHintShown=true;
    saveState();
    showToast('Vous pouvez revoir la couleur et le point de sortie d’une onde en touchant à nouveau une lettre ou un chiffre déjà utilisé.',5000);
  }
}
function renderModePill(){
  const pill=$('#modePill');
  let text, cls;
  if(state.mode==='solo'){
    if(tutorialActive){text='Tutoriel guidé';cls='live';}
    else if(state.soloOver){
      if(state.isDaily){
        text = state.soloResult==='win' ? `📅 Défi du jour — ${formatDailyDate(state.dailyDate)} — Victoire !` : `📅 Défi du jour — ${formatDailyDate(state.dailyDate)} — Défaite`;
      } else {
        text = state.gameVariant==='lost' ? `💎 Gemme perdue — ${state.soloResult==='win'?'Victoire !':'Défaite'}` : (state.soloResult==='win' ? '🏆 Victoire !' : '💥 Défaite');
      }
      cls = state.soloResult==='win' ? 'win' : 'lose';
    } else {
      text = state.isDaily ? `📅 Défi du jour — ${formatDailyDate(state.dailyDate)}` : (state.gameVariant==='lost'?'💎 Gemme perdue':'Mode solo — devine la grille');
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
  $('#masterSubtitle').style.display=state.isDaily?'none':'';
  $('#setupOptions').style.display=state.gameVariant==='lost'?'none':'';
  $('#setupHint').textContent=state.gameVariant==='lost'?'Place sept gemmes sur la grille : celle qui restera dans la réserve deviendra la gemme perdue.':'Glisse une gemme sur la grille · tape dessus pour la faire pivoter de 90° · reste appuyé pour la retourner en miroir';
  const gmPreStart = state.mode==='gm' && !state.started;
  $('#btnRandom').style.display = gmPreStart ? '' : 'none';
  $('#btnStart').style.display = state.mode==='gm' ? '' : 'none';
  $('#btnEndGame').style.display = (state.mode==='gm' && state.started) ? '' : 'none';
  $('#btnShareGrid').style.display = gmPreStart ? '' : 'none';
  let startBlockReason = '';
  if(state.mode==='gm' && !state.started){
    const unplacedCount = state.pieces.filter(p=>!p.center).length;
    const conflictCount = computeInvalidPieceIds(state.pieces).size;
    if(state.gameVariant==='lost'&&unplacedCount!==1) startBlockReason = 'Place exactement sept gemmes avant de démarrer ou de partager.';
    else if(state.gameVariant!=='lost'&&unplacedCount>0) startBlockReason = 'Place toutes les gemmes avant de démarrer.';
    else if(conflictCount>0) startBlockReason = `${conflictCount} gemme${conflictCount>1?'s':''} en conflit (en rouge) à corriger avant de démarrer.`;
  }
  $('#btnStart').disabled = state.started || !!startBlockReason;
  $('#btnShareGrid').disabled = !gmPreStart || !!startBlockReason;
  $('#startBlockMsg').textContent = startBlockReason;
  $('#startBlockMsg').style.display = startBlockReason ? 'block' : 'none';
  $('#btnPropose').style.display = (state.mode==='solo' && !state.soloOver) ? '' : 'none';
  $('#btnHint').style.display = (state.mode==='solo' && !state.soloOver) ? '' : 'none';
  updateHintModeUI();
  $('#btnBackToGM').style.display = 'none';
  const soloReveal = state.mode==='solo' && state.soloOver;
  $('#btnToggleGuess').style.display = soloReveal ? '' : 'none';
  $('#btnToggleSecret').style.display = soloReveal ? '' : 'none';
  $('#btnToggleGuess').textContent = (state.soloShowGuess?'👁 ':'🚫 ') + 'Mes gemmes';
  $('#btnToggleSecret').textContent = (state.soloShowSecret?'👁 ':'🚫 ') + 'Gemmes à trouver';
  const showGridId = soloReveal && state.gridId;
  $('#gridIdRow').style.display = showGridId ? 'flex' : 'none';
  if(showGridId){
    $('#gridIdText').textContent = state.gridId;
    $('#btnCopyGridId').textContent = '📋 Copier';
  }
  $('#btnReplayVictory').style.display = (state.mode==='solo' && state.soloOver) ? '' : 'none';
  $('#btnReset').style.display = state.isDaily ? 'none' : '';
  $('#btnPropose').textContent=state.gameVariant==='lost'?'💎 Choisir la gemme perdue':'✅ Proposer une solution';
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
  const stroke = def.isOnyx ? '#cfd8dc' : 'rgba(0,0,0,.4)';
  return `<svg class="mix-icon" width="${size}" height="${size}" viewBox="${minX-pad} ${minY-pad} ${(maxX-minX)+2*pad} ${(maxY-minY)+2*pad}">
    <polygon points="${polyPointsAttr(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="0.05"/>
  </svg>`;
}
function lostGemChoiceMarkup(type,selected){
  const shape=SHAPES[type],def=CONFIG.PIECES[type],points=shape.pts.map(([x,y])=>`${50+x*20},${50+y*20}`).join(' ');
  return `<button type="button" class="lost-gem-choice${selected===type?' selected':''}" data-lost-type="${type}" aria-label="${escapeHtml(def.label)}"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${points}" fill="${def.isDiamond?'rgba(207,216,220,.55)':def.hex}" stroke="${def.isOnyx?'#cfd8dc':'rgba(255,255,255,.35)'}" stroke-width="1.5"/></svg></button>`;
}
function renderLostGemChoices(hostId,selected,onSelect){
  const host=$(hostId);host.classList.toggle('has-selection',!!selected);host.innerHTML=TYPE_ORDER.map(type=>lostGemChoiceMarkup(type,selected)).join('');
  host.querySelectorAll('[data-lost-type]').forEach(button=>button.onclick=()=>onSelect(button.dataset.lostType));
}
function openLostSolutionModal(){
  const selectLostType=type=>{state.selectedMissingType=type;renderLostGemChoices('#lostGemChoices',type,selectLostType);$('#confirmLostSolution').disabled=false;};
  state.selectedMissingType=null;renderLostGemChoices('#lostGemChoices',null,selectLostType);
  $('#confirmLostSolution').disabled=true;$('#lostSolutionModal').classList.add('open');
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
    <div class="mix-section-title">${shapeIconSVG('sapphire')}<span>Saphir bleu ciel — compte comme bleu + blanc à chaque contact</span></div>
    <p class="mix-reminder mix-warning"><span>⚠️</span><span>Le Saphir bleu ciel doit pouvoir être atteint directement par au moins 3 ondes différentes, sans rebond.</span></p>
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
    </div>` : ''}
    ${state.includeGray ? `
    <hr class="mix-sep">
    <div class="mix-section-title">${shapeIconSVG('gray')}<span>Diamant</span></div>
    <p class="mix-option-text">Le diamant ne modifie pas la couleur de l’onde.<br>Si l’onde vient heurter le diamant en plus des autres gemmes, sa couleur reste déterminée uniquement par les autres gemmes.</p>` : ''}
    ${state.includeOnyx ? `
    <hr class="mix-sep">
    <div class="mix-section-title">${shapeIconSVG('onyx')}<span>Corps noir</span></div>
    <p class="mix-option-text">Le corps noir absorbe l’onde sans la renvoyer.</p>
    <img class="mix-onyx-example" src="onyx-absorption-example.png" alt="Exemple d’une onde absorbée par le corps noir">` : ''}`;
}

// ---------------------------------------------------------------------
// INTERACTIONS — tap = pivoter, appui long = miroir, glisser = déplacer
// ---------------------------------------------------------------------
function attachPieceInteraction(el, piece){
  // Safari iOS n'applique pas toujours touch-action:none aux formes SVG.
  // Bloque son scroll natif uniquement si le geste commence sur une gemme.
  const keepPieceGesture=event=>event.preventDefault();
  el.addEventListener('touchstart',keepPieceGesture,{passive:false});
  el.addEventListener('touchmove',keepPieceGesture,{passive:false});
  el.addEventListener('pointerdown', ev=> onPieceDown(ev, piece, el));
}
let toastTimer = null;
function showToast(msg,duration=1600){
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
  toastTimer = setTimeout(()=> toast.classList.remove('show'), duration);
}
function onPieceDown(ev, piece, el){
  if(!piecesEditable()) return;
  if(tutorialActive&&!((tutorialStage===7&&piece.id===tutorialWrongPieceId)||([11,12].includes(tutorialStage)&&piece.id===tutorialPlacementPieceId))){showToast('Utilise uniquement l’élément mis en évidence.');return;}
  ev.preventDefault();
  try{ el.setPointerCapture(ev.pointerId); }catch(e){}
  const startX=ev.clientX, startY=ev.clientY;
  let moved=false, longPressed=false, dragging=false;
  let ghost=null;
  let ghostFrame=0, ghostX=startX, ghostY=startY, ghostHalfW=0, ghostHalfH=0;
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
      renderPalette(); renderPieces(); renderControls();
      tutorialAfterPieceAction(piece);
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
    ghost.style.left='0';
    ghost.style.top='0';
    ghost.style.willChange='transform';
    ghostHalfW=((w+2*pad)*csVal)/2;
    ghostHalfH=((h+2*pad)*csVal)/2;
    const def = CONFIG.PIECES[piece.type];
    ghost.innerHTML = `<svg viewBox="${minX-pad} ${minY-pad} ${w+2*pad} ${h+2*pad}" width="100%" height="100%">
      <polygon points="${polyPointsAttr(pts)}" fill="${def.isDiamond?'rgba(207,216,220,0.55)':def.hex}" stroke="rgba(0,0,0,.4)" stroke-width="0.06"/>
    </svg>`;
    document.body.appendChild(ghost);
    positionGhost(ev.clientX, ev.clientY);
  }
  function positionGhost(x,y){
    ghostX=x; ghostY=y;
    if(ghostFrame) return;
    ghostFrame=requestAnimationFrame(()=>{
      ghostFrame=0;
      if(!ghost?.isConnected) return;
      ghost.style.transform=`translate3d(${ghostX-ghostHalfW}px,${ghostY-ghostHalfH}px,0)`;
    });
  }
  function cleanupGesture(){
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('blur', onCancel);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if(ghostFrame){cancelAnimationFrame(ghostFrame);ghostFrame=0;}
  }
  function onVisibilityChange(){
    if(document.hidden) onCancel();
  }
  function onMove(e){
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(!moved && Math.hypot(dx,dy) > 9){ moved=true; clearTimeout(longPressTimer); startDrag(); }
    if(dragging) positionGhost(e.clientX, e.clientY);
  }
  function onUp(e){
    cleanupGesture();
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
      renderControls();
      tutorialAfterPiecePlacement(piece);
    } else if(!longPressed){
      piece.rotation = (piece.rotation + 90) % 360;
      resnapAfterTransform(piece);
      saveState();
      renderPalette();
      renderPieces();
      renderControls();
      tutorialAfterPieceAction(piece);
    }
  }
  function onCancel(){
    cleanupGesture();
    clearTimeout(longPressTimer);
    if(ghost?.isConnected) ghost.remove();
    el.classList.remove('dragging');
    renderPalette();
    renderPieces();
    renderControls();
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('blur', onCancel);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

// ---------------------------------------------------------------------
// GAME ACTIONS
// ---------------------------------------------------------------------
function timeNow(){ const d=new Date(); return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

function onLabelClick(side,index){
  if(tutorialActive&&(tutorialStage!==1||!tutorialTargetLabel||side!==tutorialTargetLabel.side||index!==tutorialTargetLabel.index)){showToast('Touche l’entrée mise en évidence.');return;}
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
  state.history.push({ text, hex: result.color.hex, time: timeNow(), kind:'ray' });
  if(state.mode!=='solo'){
    state.traces.push({ points: result.points, hex: result.color.hex });
  }
  saveState();
  renderLabels(); renderHistory(); renderTraces();
  if(tutorialActive) tutorialAfterRay(result);
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
  if(tutorialActive&&(![5,15,17].includes(tutorialStage)||!tutorialTargetCell||r!==tutorialTargetCell.r||c!==tutorialTargetCell.c)){showToast('Touche la case mise en \u00e9vidence.');return;}
  const key = r+','+c;
  if(state.cellUsed[key]) return;
  if(state.mode==='solo' && !hintModeActive) return;
  const coord = LEFT_LABELS[r] + (c+1);
  if(state.mode==='solo'){
    if(!tutorialActive&&!confirm(`Révéler le contenu de la case ${coord} ?`)) return;
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
  state.history.push({ text, hex, time: timeNow(), kind:'coord' });
  if(state.mode==='solo') setHintMode(false);
  saveState();
  renderHistory();
  renderTraces();
  cellEl.classList.remove('queried'); void cellEl.offsetWidth; cellEl.classList.add('queried');
  if(tutorialActive) tutorialAfterCell();
}

// ---------------------------------------------------------------------
// TOP LEVEL EVENTS
// ---------------------------------------------------------------------
function showHome(){
  document.body.classList.add('home-view');
  window.scrollTo({top:0,behavior:'smooth'});
}
function showGame(){
  document.body.classList.remove('home-view');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{ computeCellSize(); renderAll(); },0);
}
async function enterSolo(){
  if(!currentPlayerAccount){
    $('#soloAccountPromptModal').classList.add('open');
    return;
  }
  if(state.mode==='solo' && !state.soloOver){
    if(!await activeSoloGridIsAllowed())return;
    showGame();return;
  }
  openSoloChoiceModal();
}
$('#homeSolo').addEventListener('click', enterSolo);
async function activeSoloGridIsAllowed(){
  if(state.mode!=='solo'||state.isDaily||!state.gridId||!currentPlayerAccount?.session_token)return true;
  try{
    const status=await supabaseRpc(state.gameVariant==='lost'?'orapa_get_lost_grid_status':'orapa_get_grid_status',{p_grid_id:state.gridId,p_session_token:currentPlayerAccount.session_token});
    if(status?.is_creator){showHome();openCreatorGridBlockedModal(state.gridId);return false;}
    return true;
  }catch(error){showToast('Vérification de la grille impossible.');return false;}
}
const TUTORIAL_PROGRESS_KEY='orapaTutorialProgressV1';
let tutorialActive=false,tutorialStage=0,tutorialTargetLabel=null,tutorialTargetCell=null,tutorialWrongPieceId=null,tutorialLastResult=null,tutorialRayExamples=[],tutorialRayIndex=0,tutorialPlacementIndex=0,tutorialPlacementPieceId=null,tutorialPlacementEnds=[],tutorialStepNumber=0,tutorialStepKey='';
function tutorialLoadProgress(){try{const data=JSON.parse(localStorage.getItem(TUTORIAL_PROGRESS_KEY)||'null');return data?.version===1&&data.state?data:null;}catch(e){return null;}}
function tutorialSaveProgress(){
  if(!tutorialActive)return;
  try{localStorage.setItem(TUTORIAL_PROGRESS_KEY,JSON.stringify({version:1,state,tutorialStage,tutorialTargetLabel,tutorialTargetCell,tutorialWrongPieceId,tutorialLastResult,tutorialRayIndex,tutorialPlacementIndex,tutorialPlacementPieceId,tutorialStepNumber,tutorialStepKey}));}catch(e){}
}
function tutorialClearProgress(){try{localStorage.removeItem(TUTORIAL_PROGRESS_KEY);}catch(e){}}
function tutorialClearTargets(){document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));document.querySelectorAll('.tutorial-placement-target').forEach(el=>el.remove());}
function tutorialCoach(title,text,actionLabel=''){
  tutorialClearTargets();
  const coach=$('#tutorialCoach');
  coach.classList.remove('minimized');
  coach.classList.toggle('tutorial-coach-top',![8,11,12].includes(tutorialStage));
  $('#tutorialCoachTitle').innerHTML=title;
  $('#tutorialCoachText').innerHTML=text;
  const stepKey=`${tutorialStage}:${tutorialRayIndex}:${tutorialPlacementIndex}`;
  if(stepKey!==tutorialStepKey){tutorialStepKey=stepKey;tutorialStepNumber++;}
  $('#tutorialCoachStep').textContent=`\u00c9tape ${tutorialStepNumber}`;
  $('#tutorialCoachAction').innerHTML=actionLabel;
  $('#tutorialCoachAction').style.display=actionLabel?'':'none';
  $('#tutorialCoachStep').style.display=([9,10].includes(tutorialStage)||tutorialStage>=13)?'none':'';
  tutorialSaveProgress();
  setTimeout(tutorialHighlightTarget,40);
}
function tutorialHighlightTarget(){
  tutorialClearTargets();
  let target=null;
  if(tutorialStage===1&&tutorialTargetLabel){
    target=document.querySelector(`#labels${tutorialTargetLabel.side[0].toUpperCase()+tutorialTargetLabel.side.slice(1)} .label:nth-child(${tutorialTargetLabel.index+1})`);
  }else if([5,15,17].includes(tutorialStage)&&tutorialTargetCell){
    target=document.querySelector(`.cellhit[data-row="${tutorialTargetCell.r}"][data-col="${tutorialTargetCell.c}"]`);
  }else if(tutorialStage===7&&tutorialWrongPieceId){
    target=document.querySelector(`#pieceSvg .piece-poly[data-id="${tutorialWrongPieceId}"]`);
  }else if((tutorialStage===11||tutorialStage===12)&&tutorialPlacementPieceId){
    target=document.querySelector(`#palette [data-id="${tutorialPlacementPieceId}"]`);
    tutorialDrawPlacementTarget();
  }else if(tutorialStage===8) target=$('#btnPropose');
  if(target){
    target.classList.add('tutorial-target');
    if(tutorialStage===11||tutorialStage===12)$('#paletteTitle').scrollIntoView({behavior:'smooth',block:'start'});
    else if(tutorialStage===8)window.scrollTo({top:0,behavior:'smooth'});
    else target.scrollIntoView({behavior:'smooth',block:'center'});
  }
}
function tutorialFindOccupiedCell(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(pieceAtCell(r,c,state.secretPieces)) return {r,c};
  return {r:3,c:4};
}
function tutorialFindEmptyCell(){
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!pieceAtCell(r,c,state.secretPieces))return {r,c};
  return {r:0,c:0};
}
function tutorialFixedLesson(){
  const pieces=[
    {id:'tutorial-red',type:'red',center:{x:7.5,y:2.5},rotation:180,flipped:true},
    {id:'tutorial-yellow',type:'yellow',center:{x:2,y:3},rotation:90,flipped:false},
    {id:'tutorial-white',type:'white',center:{x:7,y:7},rotation:0,flipped:false},
    {id:'tutorial-blue',type:'blue',center:{x:3,y:5},rotation:180,flipped:false},
    {id:'tutorial-rhombus',type:'rhombus',center:{x:5,y:2},rotation:270,flipped:false}
  ];
  const inputs=[
    ['right',0],['right',1],['right',2],['right',5],
    ['top',6],
    ['right',4],['bottom',1],['bottom',4],
    ['top',1],
    ['right',6],['bottom',5]
  ];
  const examples=inputs.map(([side,index])=>{
    const result=simulateBeam(side,index,pieces);
    return {side,index,result,same:!result.absorbed&&result.exitSide===side&&result.exitIndex===index,colored:result.color.name!=='Transparent'};
  });
  return {pieces,examples,ends:[4,7,7,8,10]};
}
function tutorialPlacementType(){return ['red','blue','rhombus','yellow','white'][tutorialPlacementIndex]||'red';}
function tutorialTargetTransform(piece,secret){
  const probe={...piece,center:{...secret.center}};
  const flips=piece.type==='red'?[secret.flipped]:[false];
  for(const flipped of flips)for(const rotation of [0,90,180,270]){
    probe.flipped=flipped;probe.rotation=rotation;
    if(polygonsMatch(probe,secret))return {flipped,rotation};
  }
  return {flipped:secret.flipped,rotation:secret.rotation};
}
function tutorialPreparePlacement(stage){
  const type=tutorialPlacementType();
  const piece=state.pieces.find(p=>p.type===type);
  if(!piece)return;
  piece.center=null;piece.rotation=0;piece.flipped=false;
  tutorialPlacementPieceId=piece.id;tutorialStage=stage;
  renderPalette();renderPieces();renderTraces();tutorialShowStage();
}
function tutorialDrawPlacementTarget(){
  if(!(tutorialStage===11||tutorialStage===12))return;
  const secret=state.secretPieces.find(p=>p.type===tutorialPlacementType());
  if(!secret)return;
  const poly=document.createElementNS(SVGNS,'polygon');
  poly.setAttribute('points',polyPointsAttr(pieceVertices(secret)));
  poly.setAttribute('class','tutorial-placement-target');
  poly.setAttribute('fill','rgba(255,220,90,.2)');
  poly.setAttribute('stroke','#ffe27a');
  poly.setAttribute('stroke-width','.06');
  poly.setAttribute('stroke-dasharray','.14 .1');
  poly.setAttribute('pointer-events','none');
  pieceSvg.appendChild(poly);
}
function tutorialAfterPiecePlacement(piece){
  if(!tutorialActive||![11,12].includes(tutorialStage)||piece.id!==tutorialPlacementPieceId)return;
  const secret=state.secretPieces.find(p=>p.type===piece.type);
  if(!secret||!piece.center)return;
  const close=Math.hypot(piece.center.x-secret.center.x,piece.center.y-secret.center.y)<1.1;
  if(!close){piece.center=null;showToast('Place la gemme dans la zone mise en \u00e9vidence.');renderPalette();renderPieces();tutorialShowStage();return;}
  piece.center={...secret.center};
  renderPalette();renderPieces();renderTraces();
  if(polygonsMatch(piece,secret))tutorialCompletePlacement();
  else{tutorialStage=12;tutorialShowStage();}
}
function tutorialCompletePlacement(){
  tutorialPlacementIndex++;tutorialPlacementPieceId=null;
  renderPalette();renderPieces();renderTraces();
  if(tutorialPlacementIndex>=5){tutorialStage=8;tutorialShowStage();return;}
  if(tutorialPlacementEnds[tutorialPlacementIndex]===tutorialRayIndex){tutorialPreparePlacement(11);return;}
  tutorialRayIndex++;
  const ray=tutorialRayExamples[tutorialRayIndex];
  tutorialTargetLabel={side:ray.side,index:ray.index};tutorialStage=1;tutorialShowStage();
}
function tutorialObservationText(result){
  const exit=labelText(result.exitSide,result.exitIndex),color=result.color.name;
  if((result.hitPieceIds||[]).length===0)return `L&rsquo;onde ressort en <b>${exit}</b>, toujours transparente : elle a travers&eacute; la mine en ligne droite sans rencontrer de gemme.`;
  const colorTypes=[...new Set((result.hitPieceIds||[]).map(id=>state.secretPieces.find(p=>p.id===id)?.type).filter(Boolean))];
  const colored=[...new Set(colorTypes.flatMap(type=>{const def=CONFIG.PIECES[type];return def.colorKeys||[def.colorKey].filter(Boolean);} ))];
  const returned=result.entrySide===result.exitSide&&result.entryIndex===result.exitIndex;
  if(colored.length===1){const adjective={red:'rouge',yellow:'jaune',blue:'bleue',white:'blanche'}[colored[0]];const movement=returned?`L&rsquo;onde est revenue &agrave; son point de d&eacute;part <b>${exit}</b> : une gemme l&rsquo;a renvoy&eacute;e`:`L&rsquo;onde ressort en <b>${exit}</b> : une gemme l&rsquo;a d&eacute;vi&eacute;e`;return `${movement} et elle est devenue <b>${color.toLowerCase()}</b>. Elle n&rsquo;a rencontr&eacute; que la gemme ${adjective}.`;}
  const names=colored.map(key=>({key,name:{red:'rouge',yellow:'jaune',blue:'bleue',white:'blanche'}[key]}));
  const descriptions=names.map(({key,name})=>key==='white'?`au moins une gemme ${name}`:`la gemme ${name}`);
  const encountered=descriptions.length===2
    ? `${descriptions[0]} et ${descriptions[1]}`
    : descriptions.slice(0,-1).join(', ')+` et ${descriptions.at(-1)}`;
  const formula=names.map(({name})=>name.charAt(0).toUpperCase()+name.slice(1)).join(' + ')+` = ${color}`;
  return `L&rsquo;onde ressort en <b>${exit}</b> avec la couleur <b>${color}</b>.<br><b>${formula}</b> : elle a rencontr&eacute; ${encountered}.`;
}
function tutorialWaveGroup(){
  const placement=tutorialPlacementEnds.findIndex(end=>tutorialRayIndex<=end);
  if(placement<0)return null;
  const start=placement===0?4:tutorialPlacementEnds[placement-1]+1;
  return {placement,start,count:tutorialPlacementEnds[placement]-start+1,offset:tutorialRayIndex-start};
}
function tutorialShowStage(){
  if(!tutorialActive)return;
  if(tutorialStage===0)tutorialCoach('Bienvenue dans le tutoriel','Nous avons re&ccedil;u la mission de localiser les gemmes de la mine d&rsquo;Orapa. En envoyant des ondes supersoniques &agrave; travers le sol et en interpr&eacute;tant correctement les signaux qui nous reviennent, nous devons &ecirc;tre capables de d&eacute;terminer la position et l&rsquo;&eacute;tat des gemmes recherch&eacute;es&hellip;','D&eacute;couvrir les actions');
  else if(tutorialStage===24)tutorialCoach('Deux actions pour enqu&ecirc;ter','Tu peux obtenir des informations de deux fa&ccedil;ons :<br><br><b>Envoyer une onde</b> co&ucirc;te 1 point et r&eacute;v&egrave;le sa sortie ainsi que sa couleur.<br><br><b>Demander une coordonn&eacute;e</b> co&ucirc;te 3 points et indique directement si une case est vide ou occup&eacute;e.<br><br>Commen&ccedil;ons par l&rsquo;action principale : envoyer des ondes.','Commencer l&rsquo;enqu&ecirc;te');
  else if(tutorialStage===1){const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index),group=tutorialWaveGroup();let intro='';if(tutorialRayIndex===0)intro='Commen&ccedil;ons par observer le trajet le plus simple.';else if(tutorialRayIndex===1)intro='Teste maintenant l&rsquo;entr&eacute;e suivante pour comparer les deux trajets.';else if(tutorialRayIndex===2)intro='Poursuis avec l&rsquo;entr&eacute;e suivante.';else if(tutorialRayIndex===3)intro='Cette onde va montrer comment plusieurs couleurs peuvent se combiner.';else if(group?.placement===0&&group.offset===0)intro='L&rsquo;onde rouge d&eacute;j&agrave; observ&eacute;e permet de localiser le trap&egrave;ze. V&eacute;rifions son orientation depuis cette entr&eacute;e.';else if(group?.placement===1&&group.offset===0)intro='L&rsquo;onde verte a notamment rencontr&eacute; la gemme bleue. Cherchons maintenant une trajectoire uniquement bleue.';else if(group?.placement===3&&group.offset===0)intro='Reprenons maintenant la recherche de la gemme jaune rencontr&eacute;e par l&rsquo;onde verte.';else if(group?.placement===4&&group.offset===0)intro='Il reste maintenant &agrave; placer le triangle blanc.';else intro=['Envoie cette onde pour obtenir une nouvelle information.','Observe maintenant la gemme depuis un autre bord.','Cette derni&egrave;re direction va confirmer son placement et son orientation.'][group?.offset||0];tutorialCoach('Envoie une onde',`${intro}<br><br>Touche l&rsquo;entr&eacute;e <b>${name}</b>, mise en &eacute;vidence.`);}
  else if(tutorialStage===2){const group=tutorialWaveGroup();let follow='';if(tutorialRayIndex===1)follow='En comparant ces deux trajectoires, tu peux commencer &agrave; d&eacute;limiter la zone occup&eacute;e.';else if(tutorialRayIndex===2)follow='Cette nouvelle couleur indique qu&rsquo;une autre gemme intervient sur ce trajet.';else if(group?.placement===0&&group.offset===0)follow='Avec l&rsquo;onde rouge obtenue depuis 13, ce second trajet permet maintenant de d&eacute;duire l&rsquo;emplacement et l&rsquo;orientation du trap&egrave;ze.';else if(group?.placement===1&&group.offset===2)follow='L&rsquo;onde envoy&eacute;e depuis M est renvoy&eacute;e par le bord droit du triangle. Si celui-ci se trouvait une ligne plus haut et un cran plus &agrave; gauche, cette onde ne le toucherait pas.<br><br>Avec les r&eacute;sultats obtenus depuis 15, J et M, ainsi que l&rsquo;onde verte observ&eacute;e plus t&ocirc;t, son placement peut maintenant &ecirc;tre d&eacute;termin&eacute;.';else if(group?.placement===3&&group.offset===0)follow='Cette onde indique l&rsquo;orientation du triangle jaune. En la recoupant avec le trajet vert clair qui revient en 16, son emplacement devient lui aussi d&eacute;terminable.';else if(group?.offset===0)follow='Ce r&eacute;sultat apporte une premi&egrave;re information sur cette gemme.';else if(group?.offset===1)follow=group.count===2?'En recoupant ces deux directions avec les trajets d&eacute;j&agrave; observ&eacute;s, son placement devient d&eacute;terminable.':'Cette seconde direction pr&eacute;cise les positions encore possibles.';else if(group?.offset===2)follow='Cette troisi&egrave;me direction confirme le placement et l&rsquo;orientation retenus.';tutorialCoach('Observe le r\u00e9sultat',`${tutorialObservationText(tutorialLastResult)}${follow?'<br><br>'+follow:''}`,'Continuer');}
  else if(tutorialStage===3)tutorialCoach('Comprendre les m&eacute;langes','L&rsquo;aide pr&eacute;sente les diff&eacute;rentes combinaisons de couleurs obtenues lorsqu&rsquo;une onde rencontre plusieurs gemmes.','Afficher l\u2019aide des couleurs');
  else if(tutorialStage===8)tutorialCoach('Propose cette solution','Toutes les gemmes sont plac&eacute;es. Dans une partie solo, tu peux proposer une solution <b>deux fois au maximum</b> : une seule erreur est donc permise.<br><br>Touche maintenant <b>Proposer une solution</b>.');
  else if(tutorialStage===19)tutorialCoach('Bravo, tu as trouv&eacute; !','La disposition est correcte : tu viens de terminer le tutoriel.<br><br>Voici maintenant quelques informations suppl&eacute;mentaires sur les autres grilles et les fonctions du site.','Continuer');
  else if(tutorialStage===9)tutorialCoach('Les gemmes optionnelles','Cette grille utilise uniquement les cinq gemmes de base. D&rsquo;autres parties peuvent ajouter une ou plusieurs de ces gemmes :<br><br>&#128142; <b>Diamant</b> : d&eacute;vie l&rsquo;onde sans ajouter de couleur.<br>&#11035; <b>Corps noir</b> : absorbe l&rsquo;onde, qui ne ressort pas.<br>&#128998; <b>Saphir bleu ciel</b> : ajoute simultan&eacute;ment le bleu et le blanc au r&eacute;sultat.','D&eacute;couvrir les autres fonctions');
  else if(tutorialStage===11){const name=CONFIG.PIECES[tutorialPlacementType()].label;const start=tutorialPlacementIndex===0?4:tutorialPlacementEnds[tutorialPlacementIndex-1]+1;const count=tutorialPlacementEnds[tutorialPlacementIndex]-start+1;let explanation='';if(tutorialPlacementIndex===0)explanation='Les deux ondes rouges obtenues depuis les entr&eacute;es 13 et 7 permettent de placer et d&rsquo;orienter le trap&egrave;ze.';else if(tutorialPlacementIndex===1)explanation='Ces trois ondes bleues, recoup&eacute;es avec l&rsquo;onde verte qui a aussi rencontr&eacute; cette gemme, permettent de placer le triangle bleu sans ambigu&iuml;t&eacute;.';else if(tutorialPlacementIndex===2)explanation='La coordonn&eacute;e r&eacute;v&eacute;l&eacute;e confirme la pr&eacute;sence d&rsquo;une gemme blanche &agrave; cet endroit. L&rsquo;onde blanche envoy&eacute;e depuis 12, l&rsquo;onde bleue envoy&eacute;e depuis 4 et la ligne transparente A&ndash;11 permettent d&rsquo;identifier le losange et de d&eacute;terminer son emplacement.';else if(tutorialPlacementIndex===3)explanation='L&rsquo;onde jaune envoy&eacute;e depuis 2 indique l&rsquo;orientation du triangle. En suivant le trajet de l&rsquo;onde vert clair, qui revient &agrave; son point de d&eacute;part en 16, il ne reste qu&rsquo;une fa&ccedil;on de le placer.';else if(tutorialPlacementIndex===4)explanation='Il ne reste plus que le triangle blanc. Les trajectoires 17&ndash;Q et N&ndash;G suffisent &agrave; d&eacute;terminer sa position et son orientation.';else explanation=`Les ${count===3?'trois':'deux'} derni&egrave;res ondes, recoup&eacute;es avec les r&eacute;sultats pr&eacute;c&eacute;dents, permettent de retenir ce placement et cette orientation.`;tutorialCoach(`Place la gemme ${tutorialPlacementIndex+1} sur 5`,`${explanation}<br><br>Fais glisser <b>${name}</b> jusqu&rsquo;&agrave; cet emplacement.`);}
  else if(tutorialStage===12){const piece=state.pieces.find(p=>p.id===tutorialPlacementPieceId),secret=state.secretPieces.find(p=>p.type===piece?.type),target=piece&&secret?tutorialTargetTransform(piece,secret):null;const needsFlip=piece?.type==='red'&&target&&piece.flipped!==target.flipped;const turns=piece&&target?((target.rotation-piece.rotation+360)%360)/90:0;let action=needsFlip?'<b>Reste appuy&eacute; sur le trap&egrave;ze</b> pour le retourner en miroir.':'';if(turns)action+=(action?'<br>':'')+`<b>Touche la gemme ${turns===1?'une fois':turns+' fois'}</b> pour la faire pivoter.`;tutorialCoach('Oriente la gemme',`La position est correcte. Il reste &agrave; adapter son orientation aux trajectoires.<br><br>${action}`);}
  else if(tutorialStage===13)tutorialCoach('Les r&egrave;gles de placement','Une gemme doit rester enti&egrave;rement dans la mine. Ses sommets se placent sur les intersections de la grille.<br><br>Deux gemmes ne peuvent ni se chevaucher ni partager un c&ocirc;t&eacute;. Elles peuvent toutefois se toucher par une pointe.<br><br>Toutes les gemmes doivent aussi pouvoir &ecirc;tre atteintes directement par au moins une onde.','D&eacute;couvrir la seconde action');
  else if(tutorialStage===14)tutorialCoach('Demander une coordonn&eacute;e','Voici la seconde action pr&eacute;sent&eacute;e au d&eacute;but du tutoriel. Une <b>coordonn&eacute;e</b> co&ucirc;te 3 points et r&eacute;v&egrave;le directement si une case est vide ou occup&eacute;e. Elle est utile pour trancher entre deux placements encore possibles.','Tester une case vide');
  else if(tutorialStage===15){const coord=LEFT_LABELS[tutorialTargetCell.r]+(tutorialTargetCell.c+1);tutorialCoach('Active le mode indice',`Le tutoriel a activ&eacute; <b>Demander un indice</b>. Touche la case <b>${coord}</b>, mise en &eacute;vidence.`);}
  else if(tutorialStage===16)tutorialCoach('Premier r&eacute;sultat : case vide','La croix indique que la case est vide : aucune gemme ne peut occuper ou traverser cet emplacement.','Tester une case occup&eacute;e');
  else if(tutorialStage===17){const coord=LEFT_LABELS[tutorialTargetCell.r]+(tutorialTargetCell.c+1);tutorialCoach('Un second exemple',`Touche maintenant la case <b>${coord}</b>. Cette fois, elle contient une gemme.`);}
  else if(tutorialStage===18)tutorialCoach('Second r&eacute;sultat : gemme trouv&eacute;e','Un point color&eacute; marque la case et l&rsquo;historique indique la gemme rencontr&eacute;e. Tu connais maintenant les deux r&eacute;sultats possibles d&rsquo;une coordonn&eacute;e.','Poursuivre l&rsquo;enqu&ecirc;te');
  else if(tutorialStage===20)tutorialCoach('Jouer en solo','<div class="tutorial-summary-grid"><div><b>&#127922; Al&eacute;atoire</b><span>R&eacute;sous une grille g&eacute;n&eacute;r&eacute;e al&eacute;atoirement.</span></div><div><b>&#127757; D&eacute;fi du jour</b><span>Une nouvelle grille chaque jour, identique pour tout le monde, avec des r&egrave;gles sp&eacute;ciales et une seule tentative &#128520;</span></div><div><b>&#128273; Par identifiant</b><span>Rejoins une grille pr&eacute;cise partag&eacute;e par un joueur.</span></div></div>','Suivant');
  else if(tutorialStage===21)tutorialCoach('Cr&eacute;er une grille','Cr&eacute;e tes propres grilles pour les utiliser avec le jeu physique ou les partager avec d&rsquo;autres joueurs.','Suivant');
  else if(tutorialStage===22)tutorialCoach('Le compte joueur','Le compte est n&eacute;cessaire pour jouer en solo, mais il suffit d&rsquo;un <b>pseudo</b> et d&rsquo;un <b>code &agrave; 4 chiffres</b> : aucune adresse e-mail n&rsquo;est demand&eacute;e. Il permet de retrouver ton profil depuis n&rsquo;importe quel navigateur.<br><br>Tu y retrouves ton historique de grilles, tes d&eacute;fis du jour, tes grilles partag&eacute;es et tes informations de joueur. Il permet aussi d&rsquo;identifier tes r&eacute;sultats dans les classements.','Terminer');
  else tutorialCoach('Tutoriel termin\u00e9 !','Tu connais maintenant les principes du jeu et les principales fonctions du site. Tu peux revenir au tutoriel &agrave; tout moment depuis l&rsquo;accueil.','Retour \u00e0 l\u2019accueil');
}
function beginInteractiveTutorial(){
  if(state.mode==='solo'&&!state.soloOver&&state.gridUnrankedReason!=='tutorial'&&!confirm('Quitter la partie solo en cours pour lancer le tutoriel ?')) return;
  state.includeGray=false;state.includeOnyx=false;state.includeSapphire=false;
  const lesson=tutorialFixedLesson();
  if(!lesson.pieces||lesson.examples.length<11){showToast('Le tutoriel est momentan\u00e9ment indisponible.');return;}
  tutorialRayExamples=lesson.examples;tutorialPlacementEnds=lesson.ends;tutorialRayIndex=0;tutorialPlacementIndex=0;tutorialPlacementPieceId=null;
  tutorialActive=true;tutorialStage=0;tutorialStepNumber=0;tutorialStepKey='';tutorialTargetLabel={side:tutorialRayExamples[0].side,index:tutorialRayExamples[0].index};tutorialTargetCell=null;tutorialWrongPieceId=null;tutorialLastResult=null;
  document.body.classList.add('tutorial-active');
  state.mode='solo';state.gameVariant='classic';state.missingType=null;state.selectedMissingType=null;state.placementBonus=false;state.started=false;state.secretPieces=lesson.pieces.map(p=>({...p,center:{...p.center}}));state.pieces=freshPieceSet();
  state.gridId=null;state.gridRanked=false;state.gridUnrankedReason='tutorial';state.soloAttempts=0;state.soloOver=false;state.soloResult=null;state.soloShowGuess=true;state.soloShowSecret=true;state.moveCost=0;state.firstActionTime=null;state.finalTimeMs=null;state.rayCount=0;state.coordCount=0;state.isDaily=false;state.dailyDate=null;state.history=[];resetHistoryDisclosure();state.labelColor={top:{},bottom:{},left:{},right:{}};state.labelBounce={top:{},bottom:{},left:{},right:{}};state.labelPair={top:{},bottom:{},left:{},right:{}};state.labelPartner={top:{},bottom:{},left:{},right:{}};state.cellUsed={};state.traces=[];state.emptyMarks=[];state.coordDots=[];
  showGame();setTimeout(tutorialShowStage,80);
}
function startInteractiveTutorial(){
  if(tutorialLoadProgress()){$('#tutorialResumeModal').classList.add('open');return;}
  beginInteractiveTutorial();
}
function resumeInteractiveTutorial(){
  const saved=tutorialLoadProgress();if(!saved)return beginInteractiveTutorial();
  state=saved.state;tutorialStage=saved.tutorialStage;tutorialTargetLabel=saved.tutorialTargetLabel;tutorialTargetCell=saved.tutorialTargetCell;tutorialWrongPieceId=saved.tutorialWrongPieceId;tutorialLastResult=saved.tutorialLastResult;tutorialRayIndex=saved.tutorialRayIndex||0;tutorialPlacementIndex=saved.tutorialPlacementIndex||0;tutorialPlacementPieceId=saved.tutorialPlacementPieceId||null;tutorialStepNumber=saved.tutorialStepNumber||0;tutorialStepKey=saved.tutorialStepKey||'';
  pieceIdSeq=1+state.pieces.concat(state.secretPieces).reduce((max,piece)=>Math.max(max,parseInt((piece.id||'p0').slice(1))||0),0);
  const lesson=tutorialFixedLesson();tutorialRayExamples=lesson.examples;tutorialPlacementEnds=lesson.ends;tutorialActive=true;document.body.classList.add('tutorial-active');
  $('#tutorialResumeModal').classList.remove('open');showGame();setTimeout(tutorialShowStage,100);
}
function exitInteractiveTutorial(completed=false){tutorialActive=false;document.body.classList.remove('tutorial-active');tutorialClearTargets();if(completed)tutorialClearProgress();resetAll();showHome();}
function tutorialAfterRay(result){tutorialLastResult=result;tutorialStage=2;tutorialShowStage();}
function tutorialAfterCell(){
  if(tutorialStage===15)tutorialStage=16;
  else if(tutorialStage===17)tutorialStage=18;
  else tutorialStage=6;
  tutorialShowStage();
}
function tutorialAfterPieceAction(piece){
  if(!tutorialActive||![11,12].includes(tutorialStage)||piece.id!==tutorialPlacementPieceId)return;
  if(tutorialStage===11){tutorialShowStage();return;}
  const secret=state.secretPieces.find(p=>p.type===piece.type);
  if(secret&&polygonsMatch(piece,secret))tutorialCompletePlacement();
  else tutorialShowStage();
}
function tutorialPropose(){
  if(tutorialStage!==8){showToast('Suis d\u2019abord l\u2019\u00e9tape mise en \u00e9vidence.');tutorialShowStage();return;}
  if(!evaluateGuess()){tutorialCoach('Pas encore','La gemme mise en &eacute;vidence n&rsquo;est pas dans la bonne orientation. Touche-la encore avant de proposer.');return;}
  tutorialStage=19;tutorialClearTargets();tutorialShowStage();
}
$('#homeLearn').addEventListener('click',startInteractiveTutorial);
$('#tutorialCoachClose').addEventListener('click',()=>$('#tutorialExitModal').classList.add('open'));
$('#tutorialCoachMinimize').addEventListener('click',event=>{event.stopPropagation();$('#tutorialCoach').classList.add('minimized');});
$('#tutorialCoach').addEventListener('click',event=>{if($('#tutorialCoach').classList.contains('minimized')&&!event.target.closest('.tutorial-coach-close'))$('#tutorialCoach').classList.remove('minimized');});
const closeTutorialExit=()=>$('#tutorialExitModal').classList.remove('open');
$('#tutorialExitContinue').addEventListener('click',closeTutorialExit);$('#tutorialExitContinueX').addEventListener('click',closeTutorialExit);
$('#tutorialExitModal').addEventListener('click',event=>{if(event.target.id==='tutorialExitModal')closeTutorialExit();});
$('#tutorialExitConfirm').addEventListener('click',()=>{closeTutorialExit();exitInteractiveTutorial(false);});
const cancelTutorialResume=()=>$('#tutorialResumeModal').classList.remove('open');
$('#tutorialResumeCancel').addEventListener('click',cancelTutorialResume);$('#tutorialResumeCancelX').addEventListener('click',cancelTutorialResume);
$('#tutorialResumeModal').addEventListener('click',event=>{if(event.target.id==='tutorialResumeModal')cancelTutorialResume();});
$('#tutorialResumeContinue').addEventListener('click',resumeInteractiveTutorial);
$('#tutorialResumeRestart').addEventListener('click',()=>{tutorialClearProgress();cancelTutorialResume();beginInteractiveTutorial();});
$('#tutorialCoachAction').addEventListener('click',()=>{
  if(tutorialStage===0){tutorialStage=24;tutorialShowStage();}
  else if(tutorialStage===24){tutorialStage=1;renderLabels();tutorialShowStage();}
  else if(tutorialStage===2){
    if(tutorialRayIndex===3){tutorialStage=3;tutorialShowStage();}
    else if(tutorialPlacementEnds[tutorialPlacementIndex]===tutorialRayIndex)tutorialPreparePlacement(11);
    else if(tutorialRayIndex<tutorialRayExamples.length-1){tutorialRayIndex++;const ray=tutorialRayExamples[tutorialRayIndex];tutorialTargetLabel={side:ray.side,index:ray.index};tutorialStage=1;tutorialShowStage();}
  }
  else if(tutorialStage===3){buildMixBoard();$('#helpModal').classList.add('open');tutorialStage=13;tutorialShowStage();}
  else if(tutorialStage===13){tutorialStage=14;tutorialShowStage();}
  else if(tutorialStage===14){tutorialTargetCell=tutorialFindEmptyCell();setHintMode(true);tutorialStage=15;renderBgGrid();tutorialShowStage();}
  else if(tutorialStage===16){tutorialTargetCell=tutorialFindOccupiedCell();setHintMode(true);tutorialStage=17;renderBgGrid();tutorialShowStage();}
  else if(tutorialStage===18){tutorialRayIndex++;const ray=tutorialRayExamples[tutorialRayIndex];tutorialTargetLabel={side:ray.side,index:ray.index};tutorialStage=1;tutorialShowStage();}
  else if(tutorialStage===19){tutorialStage=9;tutorialShowStage();}
  else if(tutorialStage===9){tutorialStage=20;tutorialShowStage();}
  else if(tutorialStage===20){tutorialStage=21;tutorialShowStage();}
  else if(tutorialStage===21){tutorialStage=22;tutorialShowStage();}
  else if(tutorialStage===22){tutorialStage=23;refreshAchievements('tutorial_complete');tutorialShowStage();}
  else if(tutorialStage===23) exitInteractiveTutorial(true);
});
$('#closeSoloAccountPrompt').addEventListener('click',()=>$('#soloAccountPromptModal').classList.remove('open'));
$('#soloAccountPromptModal').addEventListener('click',e=>{if(e.target.id==='soloAccountPromptModal')$('#soloAccountPromptModal').classList.remove('open');});
$('#soloPromptLogin').addEventListener('click',async()=>{$('#soloAccountPromptModal').classList.remove('open');await openAccountModal();});
$('#soloPromptRegister').addEventListener('click',async()=>{$('#soloAccountPromptModal').classList.remove('open');await openAccountModal();showAccountCreate();});
$('#homeCreate').addEventListener('click', ()=>{
  if(state.mode==='solo'){
    if(!state.soloOver && !confirm("Quitter la partie solo en cours ? Elle sera effacée.")) return;
    resetAll();
  }
  $('#createModeModal').classList.add('open');
});
function closeCreateModeModal(){$('#createModeModal').classList.remove('open');}
$('#closeCreateMode').addEventListener('click',closeCreateModeModal);
$('#createModeModal').addEventListener('click',event=>{if(event.target.id==='createModeModal')closeCreateModeModal();});
$('#createClassicMode').addEventListener('click',()=>{closeCreateModeModal();resetAll();state.gameVariant='classic';showGame();renderAll();});
$('#createLostMode').addEventListener('click',()=>{
  (async()=>{
  if(!await verifyTriforcePrerequisite(true))return;
  closeCreateModeModal();resetAll();state.mode='gm';state.gameVariant='lost';state.includeGray=true;state.includeOnyx=true;state.includeSapphire=true;state.missingType=null;state.pieces=TYPE_ORDER.map(type=>newPiece(type));showGame();renderAll();
  })();
});
$('#btnHome').addEventListener('click',()=>{
  if(state.mode==='solo'&&!state.soloOver){
    if(!confirm('Revenir à l’accueil ? La partie solo reste disponible tant que tu ne démarres pas une autre partie.')) return;
  }
  if(state.mode==='solo'&&state.soloOver) resetAll();
  showHome();
});
$('#btnRandom').addEventListener('click', ()=>{ if(state.mode!=='gm' || state.started) return; randomizePlacement(); });
$('#btnStart').addEventListener('click', ()=>{
  if(state.mode!=='gm' || state.started) return;
  const unplaced=state.pieces.filter(piece=>!piece.center);
  if((state.gameVariant==='lost'&&unplaced.length!==1)||(state.gameVariant!=='lost'&&unplaced.length)){
    alert(state.gameVariant==='lost'?'Place exactement sept gemmes sur la grille avant de démarrer la partie.':'Place toutes les gemmes sur la grille avant de démarrer la partie.');
    return;
  }
  if(computeInvalidPieceIds(state.pieces).size>0){
    alert('Certaines gemmes sont en conflit (affichées en rouge sur la grille) : contact par un côté, chevauchement, ou gemme injoignable. Corrige-les avant de démarrer.');
    return;
  }
  if(state.gameVariant==='lost')state.missingType=unplaced[0].type;
  state.started = true;
  state.gridId = state.gameVariant==='lost'?encodeLostGridId(state.pieces,state.missingType):encodeGridId(state.pieces, state.includeGray, state.includeOnyx, state.includeSapphire);
  saveState();
  renderAll();
});
$('#btnEndGame').addEventListener('click',()=>{
  if(state.mode!=='gm'||!state.started) return;
  if(!confirm('Terminer cette partie et revenir à l’accueil ?')) return;
  resetAll();
  showHome();
});
$('#btnShareGrid').addEventListener('click',async()=>{
  if(state.mode!=='gm'||state.started||$('#btnShareGrid').disabled) return;
  if(!currentPlayerAccount){
    alert('Connectez-vous pour enregistrer cette grille comme la vôtre et la partager. Aucune adresse mail n’est nécessaire.');
    await openAccountModal();
    return;
  }
  if(state.gameVariant==='lost')state.missingType=state.pieces.find(piece=>!piece.center)?.type||null;
  const gridId=state.gameVariant==='lost'?encodeLostGridId(state.pieces,state.missingType):encodeGridId(state.pieces,state.includeGray,state.includeOnyx,state.includeSapphire);
  if(!gridId) return;
  const gems=gemFlagsEmojiLine(state.includeGray,state.includeOnyx,state.includeSapphire);
  const text=state.gameVariant==='lost'?`Je te défie à Orapa Mine · Gemme perdue !\nID: ${gridId}\nhttps://argone57.github.io/Orapa-Mine/`:`Je te défie à Orapa Mine !\n${gems}\nID: ${gridId}\nhttps://argone57.github.io/Orapa-Mine/`;
  try{
    await (state.gameVariant==='lost'?shareLostGridGlobally(gridId):shareGridGlobally(gridId));
    await navigator.clipboard?.writeText(text);
    showToast('Grille partagée et défi copié !');
  }catch(err){ showToast(`⚠️ Partage impossible : ${err.message}`); }
});
$('#btnHint').addEventListener('click', ()=> setHintMode(!hintModeActive));
$('#btnPropose').addEventListener('click', ()=> proposeSolution());
$('#btnToggleGuess').addEventListener('click', ()=>{ state.soloShowGuess = !state.soloShowGuess; saveState(); renderControls(); renderPieces(); });
$('#btnToggleSecret').addEventListener('click', ()=>{ state.soloShowSecret = !state.soloShowSecret; saveState(); renderControls(); renderPieces(); });
$('#btnReplayVictory').addEventListener('click', ()=> openVictoryModal());
$('#btnCopyGridId').addEventListener('click', async()=>{
  if(!state.gridId || !navigator.clipboard) return;
  if(state.mode==='gm'){
    const gems = gemFlagsEmojiLine(state.includeGray, state.includeOnyx, state.includeSapphire);
    const text = state.gameVariant==='lost'?`Je te défie à Orapa Mine · Gemme perdue !\nID: ${state.gridId}\nhttps://argone57.github.io/Orapa-Mine/`:`Je te défie à Orapa Mine !\n${gems}\nID: ${state.gridId}\nhttps://argone57.github.io/Orapa-Mine/`;
    try{
      await (state.gameVariant==='lost'?shareLostGridGlobally(state.gridId):shareGridGlobally(state.gridId));
      await navigator.clipboard.writeText(text);
      showToast('Grille partagée et défi copié !');
    }catch(err){
      console.error('Partage Supabase impossible :',err);
      await navigator.clipboard.writeText(text);
      showToast('Défi copié · enregistrement en ligne impossible');
    }
  } else {
    navigator.clipboard.writeText(state.gridId).then(()=> showToast('Identifiant copié : '+state.gridId));
  }
});
$('#btnBackToGM').addEventListener('click', ()=>{
  showHome();
});
$('#btnReset').addEventListener('click', ()=>{
  if(state.mode==='solo'){
    if(state.gameVariant==='lost'){
      startLostGame();
      return;
    }
    openSoloSetupModal();
    return;
  }
  if(!confirm("Recommencer efface le placement des gemmes et tout l'historique. Continuer ?")) return;
  resetAll();
});

let dailyTriforceState={checked:false,unlocked:false,error:false};
function renderDailyStatusLine(status){
  const line=$('#dailyStatusLine');
  const button=$('#soloChoiceDaily');
  const detail=button.querySelector('small');
  button.classList.remove('review-available','prerequisite-locked','prerequisite-checking');
  if(status?.alreadyPlayed){
    button.classList.add('review-available');
    detail.textContent='Revoir la grille';
    line.textContent=`Défi du jour déjà joué aujourd'hui (${status.attempt.result==='win'?'réussi 🏆':'raté 💥'}) — reviens demain.`;
    line.style.display='block';
  }else{
    line.style.display='none';
    if(!dailyTriforceState.checked){
      button.classList.add('prerequisite-checking');
      detail.textContent='Vérification du prérequis…';
    }else if(!dailyTriforceState.unlocked){
      button.classList.add('prerequisite-locked');
      detail.textContent=dailyTriforceState.error?'Vérification impossible':'🔒 Succès Triforce requis';
    }
  }
}
function openTriforcePrerequisiteModal(checkError=false){
  $('#triforcePrerequisiteTitle').textContent=checkError?'⚠️ Vérification impossible':'🔒 Défi du jour verrouillé';
  $('#triforcePrerequisiteText').innerHTML=checkError
    ? 'Impossible de vérifier le succès <b>Triforce</b>. Vérifie ta connexion puis réessaie.'
    : 'Pour accéder aux défis du jour, débloque d’abord le succès <b>Triforce</b> en remportant une grille aléatoire comprenant les trois gemmes optionnelles : Diamant, Corps noir et Saphir bleu ciel.';
  $('#triforcePrerequisiteAchievement').style.display=checkError?'none':'';
  $('#triforcePrerequisiteRetry').style.display=checkError?'':'none';
  $('#triforcePrerequisiteModal').classList.add('open');
}
function closeTriforcePrerequisiteModal(){$('#triforcePrerequisiteModal').classList.remove('open');}
async function verifyTriforcePrerequisite(showModal=false){
  if(!currentPlayerAccount?.session_token){
    dailyTriforceState={checked:true,unlocked:false,error:true};
    if(showModal)openTriforcePrerequisiteModal(true);
    return false;
  }
  try{
    const result=await refreshAchievements();
    if(!result?.triforce_check_ok)throw new Error('Vérification indisponible');
    dailyTriforceState={checked:true,unlocked:!!result.triforce_unlocked,error:false};
  }catch(error){dailyTriforceState={checked:true,unlocked:false,error:true};}
  renderDailyStatusLine(dailyStatusToday());
  if(showModal&&!dailyTriforceState.unlocked)openTriforcePrerequisiteModal(dailyTriforceState.error);
  return dailyTriforceState.unlocked;
}
async function openSoloChoiceModal(){
  document.body.classList.add('solo-menu-open');
  const line = $('#dailyStatusLine');
  dailyTriforceState={checked:false,unlocked:false,error:false};
  renderDailyStatusLine(dailyStatusToday());
  $('#soloChoiceModal').classList.add('open');
  if(!dailyStatusToday().alreadyPlayed && currentPlayerAccount){
    line.textContent='Vérification du défi du jour…';
    line.style.display='block';
    try{
      const status=await refreshDailyStatusFromSupabase(true);
      if($('#soloChoiceModal').classList.contains('open')) renderDailyStatusLine(status);
    }catch(error){
      if($('#soloChoiceModal').classList.contains('open')) renderDailyStatusLine(dailyStatusToday());
    }
  }
  if(!dailyStatusToday().alreadyPlayed&&$('#soloChoiceModal').classList.contains('open'))await verifyTriforcePrerequisite(false);
}
function closeSoloChoiceModal(){ $('#soloChoiceModal').classList.remove('open'); document.body.classList.remove('solo-menu-open'); }
$('#soloChoiceCancel').addEventListener('click', closeSoloChoiceModal);
$('#soloChoiceModal').addEventListener('click', e=>{ if(e.target.id==='soloChoiceModal') closeSoloChoiceModal(); });
$('#soloChoiceDaily').addEventListener('click', async()=>{
  try{await refreshDailyStatusFromSupabase();}catch(error){}
  const status=dailyStatusToday();
  if(status.alreadyPlayed){
    reviewDailyFinalGrid(status.dateKey);
    return;
  }
  if(!await verifyTriforcePrerequisite(true))return;
  if(!await ensureCurrentAppVersion(true,true)) return;
  closeSoloChoiceModal();
  document.body.classList.add('solo-menu-open');
  $('#dailyRulesModal').classList.add('open');
});
$('#closeTriforcePrerequisite').addEventListener('click',closeTriforcePrerequisiteModal);
$('#triforcePrerequisiteClose').addEventListener('click',closeTriforcePrerequisiteModal);
$('#triforcePrerequisiteModal').addEventListener('click',e=>{if(e.target.id==='triforcePrerequisiteModal')closeTriforcePrerequisiteModal();});
$('#triforcePrerequisiteRetry').addEventListener('click',async()=>{
  closeTriforcePrerequisiteModal();
  if(await verifyTriforcePrerequisite(true))showToast('Succès Triforce vérifié.');
});
$('#triforcePrerequisiteAchievement').addEventListener('click',async()=>{
  closeTriforcePrerequisiteModal();
  closeSoloChoiceModal();
  await openMyAchievements();
});
$('#dailyRulesCancel').addEventListener('click', ()=>{
  $('#dailyRulesModal').classList.remove('open');
  document.body.classList.remove('solo-menu-open');
  openSoloChoiceModal();
});
$('#dailyRulesStart').addEventListener('click', ()=>{
  $('#dailyRulesModal').classList.remove('open');
  document.body.classList.remove('solo-menu-open');
  startDailyChallenge();
});
$('#dailyRulesModal').addEventListener('click', e=>{
  if(e.target.id==='dailyRulesModal'){
    $('#dailyRulesModal').classList.remove('open');
    document.body.classList.remove('solo-menu-open');
    openSoloChoiceModal();
  }
});
$('#appUpdateLater').addEventListener('click',closeAppUpdateModal);
$('#appUpdateConfirm').addEventListener('click',async e=>{
  if(e.currentTarget.dataset.action==='update'){ reloadLatestAppVersion(); return; }
  closeAppUpdateModal();
  if(await ensureCurrentAppVersion(true,true)) showToast('La version du site est à jour.');
});
$('#appUpdateModal').addEventListener('click',e=>{if(e.target.id==='appUpdateModal')closeAppUpdateModal();});
$('#soloChoiceRandom').addEventListener('click', ()=>{ closeSoloChoiceModal(); openSoloSetupModal(); });
$('#soloChoiceLost').addEventListener('click',async()=>{
  if(!await verifyTriforcePrerequisite(true)){
    if($('#triforcePrerequisiteModal').classList.contains('open')){
      $('#triforcePrerequisiteTitle').textContent=dailyTriforceState.error?'⚠️ Vérification impossible':'🔒 Gemme perdue verrouillée';
      if(!dailyTriforceState.error)$('#triforcePrerequisiteText').innerHTML='Pour accéder au mode <b>Gemme perdue</b>, débloque d’abord le succès <b>Triforce</b> en remportant une grille aléatoire comprenant les trois gemmes optionnelles.';
    }
    return;
  }
  closeSoloChoiceModal();$('#lostIntroModal').classList.add('open');
});
function closeLostIntro(){$('#lostIntroModal').classList.remove('open');}
$('#closeLostIntro').addEventListener('click',closeLostIntro);$('#cancelLostIntro').addEventListener('click',closeLostIntro);
$('#lostIntroModal').addEventListener('click',event=>{if(event.target.id==='lostIntroModal')closeLostIntro();});
$('#startLostGame').addEventListener('click',()=>{closeLostIntro();startLostGame();});
function closeLostSolution(){$('#lostSolutionModal').classList.remove('open');}
$('#closeLostSolution').addEventListener('click',closeLostSolution);$('#cancelLostSolution').addEventListener('click',closeLostSolution);
$('#lostSolutionModal').addEventListener('click',event=>{if(event.target.id==='lostSolutionModal')closeLostSolution();});
$('#confirmLostSolution').addEventListener('click',finalizeLostSolution);
$('#soloChoiceById').addEventListener('click', ()=> promptLoadGridById());
function promptLoadGridById(){
  $('#gridIdEntryInput').value='';
  accountError('#gridIdEntryError','');
  $('#gridIdEntryModal').classList.add('open');
  setTimeout(()=>$('#gridIdEntryInput').focus(),0);
}
function closeGridIdEntry(){
  $('#gridIdEntryModal').classList.remove('open');
  accountError('#gridIdEntryError','');
}
async function confirmGridIdEntry(){
  const id=$('#gridIdEntryInput').value.trim().toUpperCase();
  const decoded=decodeGridId(id);
  if(!decoded){accountError('#gridIdEntryError','Identifiant invalide. Vérifie qu’il a été copié en entier.');return;}
  const button=$('#confirmGridIdEntry');
  button.disabled=true;
  button.textContent='Vérification…';
  closeGridIdEntry();
  closeSoloChoiceModal();
  try{await (decoded.variant==='lost'?startLostGame(decoded.id):startSoloGame(decoded.id));}finally{button.disabled=false;button.textContent='Lancer la grille';}
}
$('#closeGridIdEntry').addEventListener('click',closeGridIdEntry);
$('#cancelGridIdEntry').addEventListener('click',closeGridIdEntry);
$('#confirmGridIdEntry').addEventListener('click',confirmGridIdEntry);
$('#gridIdEntryInput').addEventListener('keydown',event=>{if(event.key==='Enter')confirmGridIdEntry();});
$('#gridIdEntryModal').addEventListener('click',event=>{if(event.target.id==='gridIdEntryModal')closeGridIdEntry();});

function openSoloSetupModal(){
  document.body.classList.add('solo-menu-open');
  $('#soloOptGray').checked = state.includeGray;
  $('#soloOptOnyx').checked = state.includeOnyx;
  $('#soloOptSapphire').checked = state.includeSapphire;
  $('#soloSetupModal').classList.add('open');
}
function closeSoloSetupModal(){ $('#soloSetupModal').classList.remove('open'); document.body.classList.remove('solo-menu-open'); }
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
  saveState(); renderPalette(); renderPieces(); renderControls(); buildMixBoard();
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
    const text = `Défi du jour (${formatDailyDate(state.dailyDate)})`;
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
$('#btnVictoryGridRanking').addEventListener('click',()=>openGridRanking(state.gridId,false,true));
function closeGridDataModal(returnToOrigin=true){
  $('#gridDataModal').classList.remove('open');
  achievementExpanded.clear();
  expandedScores.clear();
  if(returnToOrigin){
    if(gridDataReturnsToVictory) openVictoryModal();
    else if(gridDataReturnsToAccount) $('#accountModal').classList.add('open');
  }
  gridDataReturnsToAccount=false;
  gridDataReturnsToVictory=false;
}
$('#closeGridData').addEventListener('click',()=>closeGridDataModal(false));
$('#gridDataBack').addEventListener('click',()=>closeGridDataModal(true));
$('#gridDataModal').addEventListener('click',e=>{if(e.target.id==='gridDataModal')closeGridDataModal(false);});
$('#closeNestedGridRanking').addEventListener('click',()=>$('#nestedGridRankingModal').classList.remove('open'));
$('#nestedGridRankingModal').addEventListener('click',e=>{if(e.target.id==='nestedGridRankingModal')$('#nestedGridRankingModal').classList.remove('open');});
$('#helpModal').addEventListener('click', e=>{ if(e.target.id==='helpModal') $('#helpModal').classList.remove('open'); });

let rankingView = 'solo';
function shiftDateKey(dateKey, days){
  const [year,month,day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month-1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}
function shortFrenchDate(dateKey){
  const [year,month,day]=dateKey.split('-');
  return `${day}/${month}/${String(year).slice(-2)}`;
}
function globalDateLabel(dateKey, index){
  if(index===0) return `Aujourd’hui · ${shortFrenchDate(dateKey)}`;
  if(index===1) return `Hier · ${shortFrenchDate(dateKey)}`;
  const [year,month,day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year,month-1,day));
  const weekday = new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(date);
  return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)} · ${shortFrenchDate(dateKey)}`;
}
function selectGlobalRankingDate(dateKey){
  if(!dateKey || dateKey>parisDateKey()) return;
  const select=$('#rankingConfigSelect'),value=`GLOBAL:${dateKey}`;
  let option=[...select.options].find(item=>item.value===value);
  if(!option){
    option=document.createElement('option');
    option.value=value;
    const today=parisDateKey();
    option.textContent=globalDateLabel(dateKey,dateKey===today?0:dateKey===shiftDateKey(today,-1)?1:2);
    select.appendChild(option);
  }
  select.value=value;
  $('#rankingDatePicker').value=dateKey;
  $('#rankingDateNext').disabled=dateKey>=parisDateKey();
  renderRankingList();
}
function buildRankingConfigOptions(){
  const select = $('#rankingConfigSelect');
  if(rankingView==='global'){
    const todayKey = parisDateKey();
    select.innerHTML = Array.from({length:7},(_,index)=>{
      const dateKey = shiftDateKey(todayKey,-index);
      return `<option value="GLOBAL:${dateKey}">${globalDateLabel(dateKey,index)}</option>`;
    }).join('');
  } else {
    if(historyDisplayMode==='lost'){select.innerHTML='<option value="LOST_HISTORY:ALL">Gemme perdue</option>';return;}
    select.innerHTML = '<option value="GLOBAL_SOLO:ALL">Toutes les configurations</option>'+RANKING_COMBOS.map(([g,o,s])=>{
      const key=configKey(g,o,s);
      return `<option value="GLOBAL_SOLO:${key}">${key}</option>`;
    }).join('');
  }
}
function setRankingView(view){
  rankingView = view;
  $('#rankingTabSolo').classList.toggle('active', view==='solo');
  $('#rankingTabDaily').classList.toggle('active', view==='grids');
  $('#rankingTabGlobal').classList.toggle('active', view==='global');
  $('#rankingTabAchievements').classList.toggle('active', view==='achievements');
  $('#rankingSoloIntro').style.display = view==='solo' ? '' : 'none';
  $('#rankingDailyIntro').style.display = view==='grids' ? '' : 'none';
  $('#rankingGlobalIntro').style.display = view==='global' ? '' : 'none';
  $('#rankingAchievementsIntro').style.display = view==='achievements' ? '' : 'none';
  $('#rankingDateControls').style.display=(view==='grids'||view==='achievements')?'none':'grid';
  $('#rankingConfigSelect').style.display=(view==='solo'&&historyDisplayMode==='lost')?'none':'';
  $('#rankingList').style.maxHeight=view==='grids'?'480px':'320px';
  $('#btnRefreshGlobal').style.display = (view==='global'||view==='grids') ? '' : 'none';
  $('#btnRefreshGlobal').textContent=view==='grids'?'↻ Actualiser les grilles':'↻ Actualiser';
  $('#btnStatsGlobal').style.display = (view==='global'||view==='solo') ? '' : 'none';
  $('#btnStatsGlobal').textContent=view==='solo'?(historyDisplayMode==='lost'?'📊 Statistiques Gemme perdue':'📊 Statistiques classiques'):'📊 Statistiques';
  const picker=$('#rankingDatePicker');
  $('#rankingDatePickerWrap').style.display=view==='global'?'flex':'none';
  $('#rankingDatePrevious').style.display=view==='global'?'flex':'none';
  $('#rankingDateNext').style.display=view==='global'?'flex':'none';
  picker.max=parisDateKey();
  if(view!=='grids'&&view!=='achievements') buildRankingConfigOptions();
  if(view==='solo') $('#rankingConfigSelect').value = 'GLOBAL_SOLO:ALL';
  if(view==='solo'&&historyDisplayMode==='lost')$('#rankingConfigSelect').value='LOST_HISTORY:ALL';
  if(view==='global'){
    picker.value=($('#rankingConfigSelect').value||'').replace('GLOBAL:','')||parisDateKey();
    $('#rankingDateNext').disabled=picker.value>=parisDateKey();
  }
  renderRankingList();
}
let expandedScores = new Set();
let gridDisplayMode='classic',historyDisplayMode='classic';
let gridCatalogState={popular:null,searched:null,searchError:'',accountId:null};
async function fetchGridCatalog(sort,limit,offset=0){
  if(gridDisplayMode==='lost'){
    const rows=await supabaseRpc('orapa_lost_grid_catalog',{p_sort:sort,p_limit:limit,p_offset:offset,p_session_token:currentPlayerAccount?.session_token||''});
    return Array.isArray(rows)?rows:[];
  }
  const rows=currentPlayerAccount?.session_token
    ? await supabaseRpc('orapa_get_grid_catalog_for_account',{p_sort:sort,p_limit:limit,p_offset:offset,p_session_token:currentPlayerAccount.session_token})
    : await supabaseRpc('orapa_get_grid_catalog',{p_sort:sort,p_limit:limit,p_offset:offset});
  return Array.isArray(rows)?rows:[];
}
function gridCatalogCard(row,section,index){
  const id=String(row.grid_id||''),decoded=decodeGridId(id);
  const gems=decoded?.variant==='lost'?'💎 Gemme perdue':(decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'');
  const count=Number(row.participation_count)||0,wins=Number(row.success_count)||0,rate=count?Math.round(wins/count*100):0;
  const key=`gridcatalog:${section}:${id}`,expanded=expandedScores.has(key);
  const lastDate=row.last_played_at?new Date(row.last_played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
  const label=section==='popular'?rankingMedal(index):'';
  const statusKind=row.shared_by_me?'shared':row.solved_by_me===true?'win':row.solved_by_me===false?'fail':'';
  const playedResult=statusKind==='shared'?'<span class="grid-catalog-status-icon share" aria-label="Grille partagée par ce compte">📤</span>':statusKind==='win'?'<span class="grid-catalog-status-icon win" aria-label="Grille réussie">✓</span>':statusKind==='fail'?'<span class="grid-catalog-status-icon fail" aria-label="Grille échouée">✕</span>':'';
  const detail=expanded?`<div class="grid-catalog-detail"><div class="grid-catalog-id">ID : ${escapeHtml(id)}</div><div>${wins} réussite${wins===1?'':'s'} · ${count-wins} échec${count-wins===1?'':'s'} · meilleur score : <b>${row.best_score==null?'—':row.best_score+' pts'}</b> · meilleur temps : <b>${row.best_time_ms==null?'—':formatDuration(Number(row.best_time_ms))}</b> · dernière partie : ${lastDate}</div></div><div class="controls grid-catalog-actions"><button class="grid-catalog-copy ghost" data-grid-id="${escapeHtml(id)}">📋 Copier l’ID</button><button class="grid-catalog-ranking primary" data-grid-id="${escapeHtml(id)}">🏆 Classement</button></div>`:'';
  return `<div class="ranking-row grid-catalog-row${expanded?' expanded':''}" data-grid-catalog-key="${escapeHtml(key)}"><div class="ranking-row-top"><span class="grid-catalog-label">${label}</span><span class="grid-catalog-gems ranking-gems">${gems}</span><span class="grid-catalog-solved ${statusKind}">${playedResult}</span><span class="grid-catalog-count">${count} 👥</span><span class="grid-catalog-rate">${count?rate+' %':'—'}</span></div>${detail}</div>`;
}
function bindGridCatalogActions(){
  const el=$('#rankingList');
  el.querySelectorAll('[data-grid-catalog-key]').forEach(row=>row.onclick=event=>{
    if(event.target.closest('button'))return;
    const key=row.dataset.gridCatalogKey;
    expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);
    renderGridCatalog();
  });
  el.querySelectorAll('.grid-catalog-copy').forEach(button=>button.onclick=event=>{event.stopPropagation();navigator.clipboard?.writeText(button.dataset.gridId).then(()=>showToast('Identifiant copié : '+button.dataset.gridId));});
  el.querySelectorAll('.grid-catalog-ranking').forEach(button=>button.onclick=event=>{event.stopPropagation();openGridRanking(button.dataset.gridId);});
}
async function renderGridCatalog(force=false){
  const el=$('#rankingList'),savedScrollTop=el.scrollTop;
  const accountId=currentPlayerAccount?.id||null;
  if(gridCatalogState.accountId!==accountId){gridCatalogState={popular:null,searched:null,searchError:'',accountId};force=true;}
  if(force)gridCatalogState.popular=null;
  try{
    if(!gridCatalogState.popular){
      el.innerHTML='<div class="history-empty">Chargement des grilles les plus jouées…</div>';
      gridCatalogState.popular=await fetchGridCatalog('popular',10);
      if(rankingView!=='grids')return;
    }
    const searched=gridCatalogState.searchError?`<div class="grid-search-error">${escapeHtml(gridCatalogState.searchError)}</div>`:gridCatalogState.searched?`<section class="grid-catalog-section"><h3 class="grid-catalog-title">Résultat de la recherche</h3>${gridCatalogCard(gridCatalogState.searched,'search',0)}</section>`:'';
    const popular=gridCatalogState.popular.length?gridCatalogState.popular.map((row,index)=>gridCatalogCard(row,'popular',index)).join(''):'<div class="history-empty grid-catalog-empty">Aucune grille jouée.</div>';
    el.innerHTML=`${searched}<section class="grid-catalog-section"><h3 class="grid-catalog-title">Les 10 grilles les plus jouées</h3>${popular}</section>`;
    bindGridCatalogActions();
    el.scrollTop=savedScrollTop;
  }catch(error){el.innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}
async function searchGridCatalog(input){
  const decoded=decodeGridId(input);
  if(!decoded){gridCatalogState.searched=null;gridCatalogState.searchError='Identifiant de grille incorrect.';renderGridCatalog();return;}
  gridCatalogState.searchError='';
  $('#rankingList').innerHTML='<div class="history-empty">Recherche de la grille…</div>';
  if((gridDisplayMode==='lost')!==(decoded.variant==='lost')){gridCatalogState.searched=null;gridCatalogState.searchError=gridDisplayMode==='lost'?'Cet identifiant correspond à une grille classique.':'Cet identifiant correspond à une grille Gemme perdue.';renderGridCatalog();return;}
  try{
    if(gridDisplayMode==='lost'){
      const rows=await supabaseRpc('orapa_lost_grid_overview',{p_grid_id:decoded.id,p_session_token:currentPlayerAccount?.session_token||''});
      gridCatalogState.searched=Array.isArray(rows)&&rows[0]?rows[0]:{grid_id:decoded.id,participation_count:0,success_count:0};renderGridCatalog();return;
    }
    const rows=currentPlayerAccount?.session_token
      ? await supabaseRpc('orapa_get_grid_overview_for_account',{p_grid_id:decoded.id,p_session_token:currentPlayerAccount.session_token})
      : await supabaseRpc('orapa_get_grid_overview',{p_grid_id:decoded.id});
    gridCatalogState.searched=Array.isArray(rows)&&rows[0]?rows[0]:{grid_id:decoded.id,participation_count:0,success_count:0,best_score:null,best_time_ms:null,last_played_at:null};
    renderGridCatalog();
  }catch(error){gridCatalogState.searched=null;gridCatalogState.searchError='Recherche impossible : '+error.message;renderGridCatalog();}
}
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
    const myAccountName = currentPlayerAccount?.display_name?.trim().toLocaleLowerCase('fr-FR') || '';
    const layout = generateDailyLayout(dateKey);
    const gems = layout ? gemFlagsEmojiLine(layout.flags.gray, layout.flags.onyx, layout.flags.sapphire) : '';
    if(rows.length===0){
      el.innerHTML = '<div class="history-empty">Aucun score global enregistré pour ce défi.</div>';
      return;
    }
    const wins = rows.filter(r=>r.success).length;
    el.innerHTML = `<div class="global-ranking-summary daily-ranking-summary"><span class="summary-stat" title="Participants"><b>${rows.length}</b> 👥</span><span class="summary-separator">·</span><span class="summary-stat"><b>${wins}</b> réussite${wins>1?'s':''}</span><span class="summary-gems">${gems}</span></div>` + rows.map((raw,i)=>{
      const e=globalEntryToLocal(raw);
      const mine=String(e.id)===String(myId) || (!!myAccountName && String(e.name||'').trim().toLocaleLowerCase('fr-FR')===myAccountName);
      const failTag=e.success ? '' : '<span class="ranking-fail">Échec</span>';
      return `<div class="ranking-row global-row one-line-ranking${mine?' ranking-mine':''}" data-global-idx="${i}"><div class="ranking-row-top"><span class="ranking-player-cell"><span class="ranking-rank${i===0?' top1':''}">${rankingMedal(i)}</span><span class="ranking-name">${escapeHtml(e.name||'Anonyme')}</span>${failTag}</span><span class="ranking-query-cell">${e.rayCount} 🔦 + ${e.coordCount} 📍</span><span class="ranking-points">${e.cost} pts</span><span class="ranking-time">${formatDuration(e.timeMs)}</span></div></div>`;
    }).join('');
    el.querySelectorAll('.global-row').forEach(row=>row.addEventListener('click',()=>{
      const entry=globalEntryToLocal(rows[Number(row.dataset.globalIdx)]);
      navigator.clipboard?.writeText(formatShareText(entry)).then(()=>showToast('Résumé copié !'));
    }));
  }catch(err){
    console.error('Chargement du classement global impossible :',err);
    if(el.dataset.renderToken===token) el.innerHTML='<div class="history-empty">⚠️ Impossible de joindre le classement global.<br><small>Vérifie la connexion puis utilise « Actualiser ».</small></div>';
  }finally{ globalRankingLoading=false; }
}
function average(values){
  return values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0;
}
function formatDecimal(value){
  return value.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
}
function formatStatsDate(dateKey){
  const [year,month,day]=dateKey.split('-');
  return `${day}/${month}/${year}`;
}
let globalStatsMode = 'daily';
let globalStatsRows = [];

function statsPlayerKey(name){ return (name||'Anonyme').trim().toLocaleLowerCase('fr-FR'); }
function statsDateOptions(selectedDate){
  const dates=Array.from({length:7},(_,index)=>shiftDateKey(parisDateKey(),-index));
  return dates.map((dateKey,index)=>`<option value="${dateKey}"${dateKey===selectedDate?' selected':''}>${globalDateLabel(dateKey,index)}</option>`).join('');
}
function statsSummaryCards(rows){
  const successes=rows.filter(row=>row.success);
  const failures=rows.filter(row=>!row.success);
  const rate=rows.length ? Math.round(successes.length/rows.length*100) : 0;
  return `<div class="stats-grid">
    <div class="stats-card"><b>${rows.length}</b><span>participation${rows.length>1?'s':''}</span></div>
    <div class="stats-card"><b>${successes.length}</b><span>réussite${successes.length>1?'s':''}</span></div>
    <div class="stats-card"><b>${failures.length}</b><span>échec${failures.length>1?'s':''}</span></div>
    <div class="stats-card"><b>${rows.length?rate+' %':'—'}</b><span>de réussite</span></div>
  </div>`;
}
function statsDetails(rows){
  const successes=rows.filter(row=>row.success);
  const bestScore=successes.length ? Math.min(...successes.map(row=>Number(row.cost)||0)) : null;
  const bestTime=successes.length ? Math.min(...successes.map(row=>Number(row.time_ms)||0)) : null;
  const averageScore=rows.length ? average(rows.map(row=>Number(row.cost)||0)) : null;
  const averageTime=rows.length ? average(rows.map(row=>Number(row.time_ms)||0)) : null;
  return `<div class="mode-stats-details">
    <div class="mode-stat-detail"><span>Meilleur score réussi</span><b>${bestScore==null?'—':bestScore+' pts'}</b></div>
    <div class="mode-stat-detail"><span>Temps record réussi</span><b>${bestTime==null?'—':formatDuration(bestTime)}</b></div>
    <div class="mode-stat-detail"><span>Score moyen</span><b>${averageScore==null?'—':formatDecimal(averageScore)+' pts'}</b></div>
    <div class="mode-stat-detail"><span>Temps moyen</span><b>${averageTime==null?'—':formatDuration(averageTime)}</b></div>
  </div>`;
}
function aggregatePlayers(rows){
  const map=new Map();
  rows.forEach(row=>{
    const key=statsPlayerKey(row.player_name);
    if(!map.has(key)) map.set(key,{key,name:(row.player_name||'Anonyme').trim()||'Anonyme',rows:[]});
    map.get(key).rows.push(row);
  });
  return [...map.values()].sort((a,b)=>b.rows.length-a.rows.length || b.rows.filter(r=>r.success).length-a.rows.filter(r=>r.success).length || a.name.localeCompare(b.name,'fr'));
}
function statsPlayerButtons(rows, daily=false){
  const players=aggregatePlayers(rows);
  if(!players.length) return '';
  return `<div class="stats-section-title"><h3>${daily?'Joueurs du défi':'Statistiques par pseudo'}</h3><small>Clique sur un pseudo</small></div><div class="stats-player-list">${players.map(player=>{
    const wins=player.rows.filter(r=>r.success).length;
    const rate=Math.round(wins/player.rows.length*100);
    return `<button class="stats-player" data-player-key="${escapeHtml(player.key)}"><span>${escapeHtml(player.name)}</span><b>${player.rows.length} partie${player.rows.length>1?'s':''}</b><em>${rate} % de réussite</em></button>`;
  }).join('')}</div>`;
}
function bindStatsPlayerButtons(){
  $('#globalStatsContent').querySelectorAll('[data-player-key]').forEach(button=>button.addEventListener('click',()=>renderPlayerStats(button.dataset.playerKey)));
}
function renderPlayerStats(playerKey){
  const content=$('#playerStatsContent');
  const playerRows=globalStatsRows.filter(row=>statsPlayerKey(row.player_name)===playerKey);
  if(!playerRows.length) return;
  const name=(playerRows[0].player_name||'Anonyme').trim()||'Anonyme';
  const dates=playerRows.map(row=>row.daily_date||row.played_date).filter(Boolean).sort();
  const distinctItems=new Set(playerRows.map(row=>row.daily_date||row.grid_id).filter(Boolean)).size;
  const isDaily=playerRows.some(row=>row.daily_date);
  content.innerHTML=`<div class="mode-stats-heading"><h3>${escapeHtml(name)}</h3><p class="stats-subtitle">${isDaily?'Défis du jour':'Parties'} associés à ce pseudo.</p></div>${statsSummaryCards(playerRows)}<div class="mode-stats-details"><div class="mode-stat-detail"><span>${isDaily?'Défis':'Grilles'} différents</span><b>${distinctItems}</b></div><div class="mode-stat-detail"><span>Première participation</span><b>${dates.length?formatStatsDate(dates[0]):'—'}</b></div><div class="mode-stat-detail"><span>Dernière participation</span><b>${dates.length?formatStatsDate(dates[dates.length-1]):'—'}</b></div></div>${statsDetails(playerRows)}`;
  $('#playerStatsModal').classList.add('open');
}
async function renderGlobalStatsView(force=false){
  const modal=$('#globalStatsModal');
  const content=$('#globalStatsContent');
  const dateSelect=$('#globalStatsDateSelect');
  $('#statsModeDaily').classList.toggle('active',globalStatsMode==='daily');
  $('#statsModeAll').classList.toggle('active',globalStatsMode==='all');
  dateSelect.style.display=globalStatsMode==='daily'?'':'none';
  content.innerHTML='<div class="history-empty">📊 Calcul des statistiques…</div>';
  try{
    if(globalStatsMode==='daily'){
      const dateKey=dateSelect.value || parisDateKey();
      const rows=await fetchGlobalDailyScores(dateKey,force);
      if(!modal.classList.contains('open')) return;
      globalStatsRows=rows;
      content.innerHTML=`<div class="stats-daily-heading"><h3>Défi du ${formatStatsDate(dateKey)}</h3><div class="stats-daily-nav"><button id="globalStatsDatePrevious" class="ranking-date-step" type="button" aria-label="Jour précédent">&lt;</button><button id="globalStatsDateNext" class="ranking-date-step" type="button" aria-label="Jour suivant"${dateKey>=parisDateKey()?' disabled':''}>&gt;</button><label class="ranking-date-picker-wrap stats-date-picker-wrap" aria-label="Choisir une autre date"><span aria-hidden="true">&#128197;</span><input id="globalStatsDatePicker" class="ranking-date-picker" type="date" value="${dateKey}" max="${parisDateKey()}"></label></div></div>${rows.length ? statsSummaryCards(rows)+statsDetails(rows)+statsPlayerButtons(rows,true) : '<div class="history-empty">Aucune participation pour cette date.</div>'}`;
      const changeStatsDate=nextDate=>{if(nextDate>parisDateKey())return;if(![...dateSelect.options].some(option=>option.value===nextDate))dateSelect.add(new Option(formatStatsDate(nextDate),nextDate));dateSelect.value=nextDate;renderGlobalStatsView();};
      $('#globalStatsDatePrevious').onclick=()=>changeStatsDate(shiftDateKey(dateKey,-1));
      $('#globalStatsDateNext').onclick=()=>changeStatsDate(shiftDateKey(dateKey,1));
      $('#globalStatsDatePicker')?.addEventListener('change',event=>{
        const picked=event.target.value;
        if(!picked)return;
        if(![...dateSelect.options].some(option=>option.value===picked))dateSelect.add(new Option(formatStatsDate(picked),picked));
        dateSelect.value=picked;
        renderGlobalStatsView();
      });
    }else{
      const rows=await fetchAllGlobalScores(force);
      if(!modal.classList.contains('open')) return;
      globalStatsRows=rows;
      const uniquePlayers=aggregatePlayers(rows).length;
      const uniqueDays=new Set(rows.map(row=>row.daily_date)).size;
      const participantsByDay=new Map();
      rows.forEach(row=>participantsByDay.set(row.daily_date,(participantsByDay.get(row.daily_date)||0)+1));
      const maxDailyParticipants=participantsByDay.size?Math.max(...participantsByDay.values()):0;
      const extra=`<div class="mode-stats-details"><div class="mode-stat-detail"><span>Pseudos différents</span><b>${uniquePlayers}</b></div><div class="mode-stat-detail"><span>Défis enregistrés</span><b>${uniqueDays}</b></div><div class="mode-stat-detail"><span>Record de participation à un défi</span><b>${maxDailyParticipants} joueur${maxDailyParticipants>1?'s':''}</b></div></div>`;
      content.innerHTML=`<h3>Depuis le début</h3><p class="stats-subtitle">Toutes les participations enregistrées.</p>${rows.length ? statsSummaryCards(rows)+extra+statsDetails(rows)+statsPlayerButtons(rows,false) : '<div class="history-empty">Aucune participation enregistrée.</div>'}`;
    }
    bindStatsPlayerButtons();
  }catch(err){
    console.error('Chargement des statistiques globales impossible :',err);
    content.innerHTML='<div class="history-empty">⚠️ Impossible de charger les statistiques.<br><small>Vérifie la connexion puis réessaie.</small></div>';
  }
}
async function openGlobalStats(){
  const selected=$('#rankingConfigSelect').value||'';
  const selectedDate=selected.startsWith('GLOBAL:') ? selected.slice(7) : parisDateKey();
  globalStatsMode='all';
  $('#globalStatsToolbar').style.display='flex';
  $('#globalStatsDateSelect').innerHTML=statsDateOptions(selectedDate);
  $('#globalStatsDateSelect').value=selectedDate;
  $('#globalStatsModal').classList.add('open');
  await renderGlobalStatsView();
}
async function openLostGlobalStats(){
  $('#globalStatsModal').classList.add('open');$('#globalStatsToolbar').style.display='none';$('#globalStatsContent').innerHTML='<div class="history-empty">Calcul des statistiques Gemme perdue…</div>';
  try{const [stats,rows]=await Promise.all([supabaseRpc('orapa_lost_global_stats'),supabaseRpc('orapa_lost_stats_rows')]);globalStatsRows=Array.isArray(rows)?rows:[];$('#globalStatsContent').innerHTML=renderGridModeGlobalStats('💎 Gemme perdue',stats,true)+statsPlayerButtons(globalStatsRows,false);bindStatsPlayerButtons();}catch(error){$('#globalStatsContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}
function renderGridModeGlobalStats(title,stats,lost=false){
  const detail=(label,value)=>`<div class="mode-stat-detail"><span>${label}</span><b>${value}</b></div>`;
  return `<div class="mode-stats-heading"><h3>${title}</h3><p class="stats-subtitle">Toutes les parties enregistrées dans ce mode.</p></div><div class="stats-grid mode-stats-summary"><div class="stats-card"><b>${stats.played||0}</b><span>participations</span></div><div class="stats-card"><b>${stats.wins||0}</b><span>réussites</span></div><div class="stats-card"><b>${stats.losses||0}</b><span>échecs</span></div><div class="stats-card"><b>${stats.success_rate||0} %</b><span>de réussite</span></div></div><div class="mode-stats-details">${detail('Pseudos différents',stats.players||0)}${detail('Grilles jouées',stats.grids||0)}${detail('Grilles partagées',stats.shared_grids||0)}${lost?detail('Reconstitutions complètes',stats.full_placements||0):''}${detail('Meilleur score réussi',stats.best_score==null?'—':stats.best_score+' pts')}${detail('Temps record réussi',stats.best_time_ms==null?'—':formatDuration(stats.best_time_ms))}${detail('Score moyen',stats.average_score==null?'—':formatDecimal(Number(stats.average_score))+' pts')}${detail('Temps moyen',stats.average_time_ms==null?'—':formatDuration(Number(stats.average_time_ms)))}</div>`;
}
async function openClassicGridGlobalStats(){
  $('#globalStatsModal').classList.add('open');$('#globalStatsToolbar').style.display='none';$('#globalStatsContent').innerHTML='<div class="history-empty">Calcul des statistiques des grilles classiques…</div>';
  try{const [stats,rows]=await Promise.all([supabaseRpc('orapa_grid_global_stats'),supabaseRpc('orapa_grid_stats_rows')]);globalStatsRows=Array.isArray(rows)?rows:[];$('#globalStatsContent').innerHTML=renderGridModeGlobalStats('🧩 Grilles classiques',stats,false)+statsPlayerButtons(globalStatsRows,false);bindStatsPlayerButtons();}catch(error){$('#globalStatsContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}

const GLOBAL_SOLO_PAGE_SIZE=10;
let globalSoloScoresCache=null;
let globalSoloVisibleCounts={};
function invalidateGlobalSoloScores(){
  globalSoloScoresCache=null;
  globalSoloVisibleCounts={};
}
function filterGlobalSoloRows(filterKey){
  const cachedRows=globalSoloScoresCache?.rows||[];
  if(filterKey==='ALL') return cachedRows.slice();
  return cachedRows.filter(row=>{
    const decoded=decodeGridId(row.grid_id);
    return decoded&&configKey(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire)===filterKey;
  });
}
async function loadNextGlobalSoloPage(){
  if(!globalSoloScoresCache) globalSoloScoresCache={rows:[],hasMore:true};
  if(!globalSoloScoresCache.hasMore) return;
  const page=await supabaseRpc('orapa_get_recent_grid_scores',{
    p_session_token:currentPlayerAccount.session_token,
    p_limit:GLOBAL_SOLO_PAGE_SIZE+1,
    p_offset:globalSoloScoresCache.rows.length
  });
  const pageRows=Array.isArray(page)?page:[];
  globalSoloScoresCache.rows.push(...pageRows.slice(0,GLOBAL_SOLO_PAGE_SIZE));
  globalSoloScoresCache.hasMore=pageRows.length>GLOBAL_SOLO_PAGE_SIZE;
}
async function renderGlobalSoloScores(filterKey='ALL'){
  const el=$('#rankingList');
  const savedScrollTop=el.scrollTop;
  if(!currentPlayerAccount){ el.innerHTML='<div class="history-empty">Connectez-vous pour consulter les résultats solo.</div>'; return; }
  if(!globalSoloScoresCache) el.innerHTML='<div class="history-empty">Chargement des résultats solo…</div>';
  try{
    const visibleTarget=globalSoloVisibleCounts[filterKey]||GLOBAL_SOLO_PAGE_SIZE;
    globalSoloVisibleCounts[filterKey]=visibleTarget;
    if(!globalSoloScoresCache) await loadNextGlobalSoloPage();
    let matchingRows=filterGlobalSoloRows(filterKey);
    while(matchingRows.length<visibleTarget+1&&globalSoloScoresCache.hasMore){
      await loadNextGlobalSoloPage();
      matchingRows=filterGlobalSoloRows(filterKey);
    }
    const rows=matchingRows.slice(0,visibleTarget);
    if(!rows?.length && !globalSoloScoresCache.hasMore){ el.innerHTML='<div class="history-empty">Aucun résultat solo enregistré.</div>'; return; }
    const rowsHtml=rows.map((row,i)=>{
      const decoded=decodeGridId(row.grid_id);
      const gems=decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'';
      const expanded=expandedScores.has(`solo:${row.id}`);
      return `<div class="ranking-row solo-global-row${expanded?' expanded':''}" data-solo-row="${i}"><div class="ranking-row-top"><span class="solo-ranking-player"><span class="ranking-rank solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><span class="ranking-name${row.is_mine?' mine':''}">${escapeHtml(row.player_name||'Anonyme')}${row.played_by_creator?' *':''}</span></span><span class="solo-ranking-config ranking-gems">${gems}</span><span class="solo-ranking-score"><span class="ranking-points">${row.cost} pts</span><span class="ranking-date">${new Date(row.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})}</span></span></div>${expanded?`<div class="ranking-row-detail">ID <b>${escapeHtml(row.grid_id)}</b> · ${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions"><button class="solo-copy-summary ghost" data-solo-index="${i}">📋 Résumé</button><button class="solo-copy-id ghost" data-solo-index="${i}">📋 ID</button><button class="solo-grid-ranking primary" data-solo-index="${i}">🏆 Grille</button></div>`:''}</div>`;
    }).join('');
    const emptyFiltered=!rows.length?'<div class="history-empty">Aucun résultat pour cette configuration.</div>':'';
    const creatorNote=rows.some(row=>row.played_by_creator)?'<p class="stats-note">* Créateur de la grille, résultat enregistré après la période de protection.</p>':'';
    const hasMore=matchingRows.length>visibleTarget||globalSoloScoresCache.hasMore;
    const moreButton=hasMore?'<button id="soloLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
    el.innerHTML=rowsHtml+emptyFiltered+creatorNote+moreButton;
    el.querySelectorAll('.solo-global-row').forEach(rowEl=>rowEl.onclick=ev=>{
      if(ev.target.closest('button')) return;
      const row=rows[Number(rowEl.dataset.soloRow)],key=`solo:${row.id}`;
      if(expandedScores.has(key)) expandedScores.delete(key); else expandedScores.add(key);
      renderGlobalSoloScores(filterKey);
    });
    el.querySelectorAll('.solo-grid-ranking').forEach(btn=>btn.onclick=()=>openGridRanking(rows[Number(btn.dataset.soloIndex)].grid_id));
    el.querySelectorAll('.solo-copy-summary').forEach(btn=>btn.onclick=()=>{const row=rows[Number(btn.dataset.soloIndex)];navigator.clipboard?.writeText(formatShareText({name:row.player_name,cost:row.cost,rayCount:row.ray_count,coordCount:row.coord_count,timeMs:row.time_ms,gridId:row.grid_id,date:new Date(row.created_at).getTime(),success:row.success})).then(()=>showToast('Résumé copié !'));});
    el.querySelectorAll('.solo-copy-id').forEach(btn=>btn.onclick=()=>{const id=rows[Number(btn.dataset.soloIndex)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});
    const loadMore=$('#soloLoadMore');
    if(loadMore) loadMore.onclick=async()=>{
      loadMore.disabled=true;
      loadMore.textContent='Chargement…';
      try{ globalSoloVisibleCounts[filterKey]=visibleTarget+GLOBAL_SOLO_PAGE_SIZE; await renderGlobalSoloScores(filterKey); }
      catch(e){ showToast(`Chargement impossible : ${e.message}`); loadMore.disabled=false; loadMore.textContent='Afficher les résultats suivants'; }
    };
    el.scrollTop=savedScrollTop;
  }catch(e){ el.innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}

async function renderAchievementRanking(){
  const el=$('#rankingList');el.innerHTML='<div class="history-empty">Chargement du classement…</div>';
  try{const rows=await supabaseRpc('orapa_achievement_leaderboard',{p_session_token:currentPlayerAccount.session_token});let previous='',displayRank=0;el.innerHTML=rows?.length?rows.map((row,index)=>{const tieKey=`${row.points}|${row.achievement_count}`;if(tieKey!==previous){displayRank=index+1;previous=tieKey;}return `<div class="achievement-ranking-row${row.is_mine?' mine':''}" data-achievement-account="${row.account_id}"><span>${rankingMedal(displayRank-1)}</span><strong>${escapeHtml(row.player_name)}</strong><b>${row.points} pts</b><small>${row.achievement_count} succès</small></div>`;}).join(''):'<div class="history-empty">Aucun succès débloqué.</div>';el.querySelectorAll('[data-achievement-account]').forEach(row=>row.onclick=()=>openPlayerAchievements(row.dataset.achievementAccount,row.querySelector('strong').textContent));}catch(e){el.innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;}
}
async function openPlayerAchievements(accountId,name){
  achievementExpanded.clear();$('#achievementDetailTitle').textContent=`🏆 Succès de ${name}`;$('#achievementDetailToolbar').innerHTML='';$('#achievementDetailContent').innerHTML='<div class="history-empty">Chargement…</div>';$('#achievementDetailModal').classList.add('open');
  try{
    const [catalog,unlockedRows]=await Promise.all([
      getAchievementCatalog(true),
      supabaseRpc('orapa_player_achievements',{p_session_token:currentPlayerAccount.session_token,p_account_id:accountId})
    ]);
    const unlockedByKey=new Map((unlockedRows||[]).map(row=>[row.achievement_key,row]));
    const normalized=(catalog||[]).map((row,index)=>{const unlocked=unlockedByKey.get(row.achievement_key);return {...row,unlocked:!!unlocked,unlocked_at:unlocked?.unlocked_at||null,display_order:Number(row.display_order||index+1),unlock_count:Number(row.unlock_count||0),has_progress:false,progress_value:null,progress_target:null,progress_data:null};});
    if(!normalized.length){$('#achievementDetailContent').innerHTML='<div class="history-empty">Aucun succès visible.</div>';return;}
    renderAchievementsInto($('#achievementDetailContent'),normalized,false,$('#achievementDetailToolbar'));
  }catch(e){$('#achievementDetailContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;}
}
async function renderAchievementsRankingView(){
  $('#btnRefreshGlobal').style.display='none';$('#btnStatsGlobal').style.display='none';const toolbarHost=$('#rankingAchievementToolbar');toolbarHost.style.display='none';toolbarHost.innerHTML='';
  if(!currentPlayerAccount){$('#rankingList').innerHTML='<div class="history-empty">Connecte-toi pour consulter les succès.</div>';return;}
  $('#achievementListTab').classList.toggle('active',achievementMode==='list');$('#achievementRankingTab').classList.toggle('active',achievementMode==='ranking');
  if(achievementMode==='ranking'){renderAchievementRanking();return;}
  toolbarHost.style.display='block';$('#rankingList').innerHTML='<div class="history-empty">Chargement des succès…</div>';await refreshAchievements('open_achievements');try{const rows=await getAchievementCatalog(true);renderAchievementsInto($('#rankingList'),rows,false,toolbarHost);}catch(e){$('#rankingList').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;}
}
function renderRankingList(){
  if(rankingView==='achievements'){renderAchievementsRankingView();return;}
  if(rankingView==='grids'){
    renderGridCatalog();
    return;
  }
  const key = $('#rankingConfigSelect').value || '';
  if(key.startsWith('LOST_HISTORY:')){renderLostHistoryRanking();return;}
  if(key.startsWith('GLOBAL_SOLO:')){
    renderGlobalSoloScores(key.slice(12));
    return;
  }
  if(key.startsWith('GLOBAL:')){
    renderGlobalRanking(key.slice(7));
    return;
  }
}
async function renderLostHistoryRanking(){
  const el=$('#rankingList');el.innerHTML='<div class="history-empty">Chargement des parties Gemme perdue…</div>';
  try{
    const rows=await supabaseRpc('orapa_lost_global_history',{p_session_token:currentPlayerAccount?.session_token||'',p_limit:50,p_offset:0});
    const render=()=>{el.innerHTML=rows?.length?rows.map((row,index)=>{const key=`global-lost-history:${row.id}`,expanded=expandedScores.has(key),date=new Date(row.played_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}),moves=`${row.ray_count} 🔦 + ${row.coord_count} 📍${row.placement_bonus?' + 🧩':''}`;return `<div class="ranking-row solo-global-row${expanded?' expanded':''}" data-index="${index}"><div class="ranking-row-top"><span class="solo-ranking-player"><span class="ranking-rank solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><span class="ranking-name${row.is_mine?' mine':''}">${escapeHtml(row.player_name||'Anonyme')}</span></span><span class="solo-ranking-config ranking-query-cell">${moves}</span><span class="solo-ranking-score"><span class="ranking-points">${row.cost} pts</span><span class="ranking-date">${date}</span></span></div>${expanded?`<div class="ranking-row-detail">ID <b>${escapeHtml(row.grid_id)}</b> · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions three"><button class="lost-history-summary ghost" data-index="${index}">📋 Résumé</button><button class="lost-history-id ghost" data-index="${index}">📋 ID</button><button class="lost-history-ranking primary" data-index="${index}">🏆 Grille</button></div>`:''}</div>`;}).join(''):'<div class="history-empty">Aucune partie Gemme perdue enregistrée.</div>';
    el.querySelectorAll('.solo-global-row').forEach(element=>element.onclick=event=>{if(event.target.closest('button'))return;const row=rows[Number(element.dataset.index)],key=`global-lost-history:${row.id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);render();});
    el.querySelectorAll('.lost-history-ranking').forEach(button=>button.onclick=()=>openGridRanking(rows[Number(button.dataset.index)].grid_id));
    el.querySelectorAll('.lost-history-summary').forEach(button=>button.onclick=()=>{const row=rows[Number(button.dataset.index)];navigator.clipboard?.writeText(formatShareText({gameVariant:'lost',gridId:row.grid_id,name:row.player_name||'Anonyme',success:row.success,placementBonus:row.placement_bonus,cost:row.cost,rayCount:row.ray_count,coordCount:row.coord_count,timeMs:row.time_ms,date:new Date(row.played_at).getTime()})).then(()=>showToast('Résumé copié !'));});
    el.querySelectorAll('.lost-history-id').forEach(button=>button.onclick=()=>{const id=rows[Number(button.dataset.index)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});};render();
  }catch(error){el.innerHTML=`<div class="account-error" style="display:block">${escapeHtml(error.message)}</div>`;}
}
$('#rankingTabSolo').addEventListener('click', ()=> setRankingView('solo'));
$('#rankingTabDaily').addEventListener('click', ()=> setRankingView('grids'));
$('#rankingTabGlobal').addEventListener('click', ()=> setRankingView('global'));
$('#rankingTabAchievements').addEventListener('click', ()=> setRankingView('achievements'));
$('#achievementListTab').addEventListener('click',()=>{achievementMode='list';renderAchievementsRankingView();});
$('#achievementRankingTab').addEventListener('click',()=>{achievementMode='ranking';renderAchievementsRankingView();});
$('#gridModeClassic').addEventListener('click',()=>{gridDisplayMode='classic';gridCatalogState={popular:null,searched:null,searchError:'',accountId:null};$('#gridModeClassic').classList.add('active');$('#gridModeLost').classList.remove('active');renderGridCatalog(true);});
$('#gridModeLost').addEventListener('click',()=>{gridDisplayMode='lost';gridCatalogState={popular:null,searched:null,searchError:'',accountId:null};$('#gridModeLost').classList.add('active');$('#gridModeClassic').classList.remove('active');renderGridCatalog(true);});
$('#historyModeClassic').addEventListener('click',()=>{historyDisplayMode='classic';$('#historyModeClassic').classList.add('active');$('#historyModeLost').classList.remove('active');buildRankingConfigOptions();setRankingView('solo');});
$('#historyModeLost').addEventListener('click',()=>{historyDisplayMode='lost';$('#historyModeLost').classList.add('active');$('#historyModeClassic').classList.remove('active');buildRankingConfigOptions();setRankingView('solo');});
$('#btnRefreshGlobal').addEventListener('click', ()=>{
  if(rankingView==='grids'){renderGridCatalog(true);return;}
  const key=$('#rankingConfigSelect').value;
  if(key.startsWith('GLOBAL:')) renderGlobalRanking(key.slice(7),true);
});
$('#gridSearchForm').addEventListener('submit',event=>{event.preventDefault();searchGridCatalog($('#gridSearchInput').value);});
$('#btnStatsGlobal').addEventListener('click',()=>rankingView==='solo'?(historyDisplayMode==='lost'?openLostGlobalStats():openClassicGridGlobalStats()):openGlobalStats());
$('#closeGlobalStats').addEventListener('click', ()=>{ $('#playerStatsModal').classList.remove('open'); $('#globalStatsModal').classList.remove('open'); });
$('#globalStatsModal').addEventListener('click', e=>{ if(e.target.id==='globalStatsModal') $('#globalStatsModal').classList.remove('open'); });
$('#closePlayerStats').addEventListener('click',()=>$('#playerStatsModal').classList.remove('open'));
$('#playerStatsModal').addEventListener('click',e=>{if(e.target.id==='playerStatsModal')$('#playerStatsModal').classList.remove('open');});
$('#statsModeDaily').addEventListener('click', ()=>{ globalStatsMode='daily'; renderGlobalStatsView(); });
$('#statsModeAll').addEventListener('click', ()=>{ globalStatsMode='all'; renderGlobalStatsView(); });
$('#globalStatsDateSelect').addEventListener('change', ()=> renderGlobalStatsView());
$('#rankingsFab').addEventListener('click', ()=>{
  achievementExpanded.clear();
  expandedScores.clear();
  setRankingView('global');
  $('#rankingsModal').classList.add('open');
});
function closeRankingsModal(){achievementExpanded.clear();expandedScores.clear();$('#rankingsModal').classList.remove('open');}
function closeAchievementDetailModal(){achievementExpanded.clear();$('#achievementDetailModal').classList.remove('open');$('#achievementDetailToolbar').innerHTML='';}
$('#closeRankings').addEventListener('click',closeRankingsModal);
$('#rankingsModal').addEventListener('click',e=>{if(e.target.id==='rankingsModal')closeRankingsModal();});
$('#closeAchievementDetail').addEventListener('click',closeAchievementDetailModal);
$('#achievementDetailModal').addEventListener('click',e=>{if(e.target.id==='achievementDetailModal')closeAchievementDetailModal();});
$('#closeAchievementUnlockers').addEventListener('click',()=>$('#achievementUnlockersModal').classList.remove('open'));
$('#achievementUnlockersModal').addEventListener('click',e=>{if(e.target.id==='achievementUnlockersModal')$('#achievementUnlockersModal').classList.remove('open');});
$('#welcomeAchievementOk').addEventListener('click',()=>$('#welcomeAchievementModal').classList.remove('open'));
$('#welcomeAchievementAccount').addEventListener('click',()=>{$('#welcomeAchievementModal').classList.remove('open');openAccountModal();});
$('#welcomeAchievementModal').addEventListener('click',e=>{if(e.target.id==='welcomeAchievementModal')$('#welcomeAchievementModal').classList.remove('open');});
$('#rankingConfigSelect').addEventListener('change', ()=>{
  const value=$('#rankingConfigSelect').value;
  if(value.startsWith('GLOBAL:')){
    const dateKey=value.slice(7);
    $('#rankingDatePicker').value=dateKey;
    $('#rankingDateNext').disabled=dateKey>=parisDateKey();
  }
  renderRankingList();
});
$('#rankingDatePicker').addEventListener('change',()=>{
  const dateKey=$('#rankingDatePicker').value;
  selectGlobalRankingDate(dateKey);
});
$('#rankingDatePrevious').addEventListener('click',()=>{
  const current=($('#rankingConfigSelect').value||'').replace('GLOBAL:','')||parisDateKey();
  selectGlobalRankingDate(shiftDateKey(current,-1));
});
$('#rankingDateNext').addEventListener('click',()=>{
  const current=($('#rankingConfigSelect').value||'').replace('GLOBAL:','')||parisDateKey();
  selectGlobalRankingDate(shiftDateKey(current,1));
});
$('#accountFab').addEventListener('click',openAccountModal);
$('#closeAccount').addEventListener('click',()=>$('#accountModal').classList.remove('open'));
$('#accountModal').addEventListener('click',e=>{if(e.target.id==='accountModal')$('#accountModal').classList.remove('open');});
$('#cancelScoreIdentity').addEventListener('click',()=>closeScoreIdentity(null));
$('#scoreIdentityModal').addEventListener('click',e=>{if(e.target.id==='scoreIdentityModal')closeScoreIdentity(null);});

let resizeRenderFrame=0,lastRenderedBoardWidth=0;
window.addEventListener('resize', ()=>{
  if(!firefoxPerformanceEnabled()){renderBgGrid();renderPieces();renderTraces();return;}
  if(resizeRenderFrame)return;
  resizeRenderFrame=requestAnimationFrame(()=>{
    resizeRenderFrame=0;
    const width=Math.round($('#board')?.getBoundingClientRect().width||window.innerWidth);
    if(width===lastRenderedBoardWidth)return;
    lastRenderedBoardWidth=width;
    computeCellSize();renderBgGrid();renderPieces();renderTraces();
  });
});
document.addEventListener('dblclick',event=>event.preventDefault(),{passive:false});
$('#historyToggle').addEventListener('click',toggleHistoryDisclosure);

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
function init(){
  applyFirefoxPerformanceMode();
  updateAccountFab();
  buildMixBoard();
  const restored = loadState();
  if(!restored){ state.pieces = freshPieceSet(); }
  $('#optGray').checked = state.includeGray;
  $('#optOnyx').checked = state.includeOnyx;
  $('#optSapphire').checked = state.includeSapphire;
  computeCellSize();
  renderAll();
  const disclosure=$('#historyDisclosure'),toggle=$('#historyToggle'),indicator=$('#historyToggleIndicator');
  disclosure?.classList.add('collapsed');
  toggle?.setAttribute('aria-expanded','false');
  if(indicator)indicator.textContent='+';
  const hasActiveGame = state.mode==='solo' || state.started || state.history.length>0;
  if(tutorialLoadProgress()||!hasActiveGame)showHome();
  else showGame();
  requestAnimationFrame(()=>document.body.classList.remove('app-loading'));

  // Les contrôles Supabase ne doivent jamais bloquer l'affichage initial.
  // Une éventuelle grille créée par ce compte est fermée après validation.
  void validateSavedAccount().then(async()=>{
    updateAccountFab();
    if(state.mode==='solo'&&!state.soloOver&&!state.isDaily&&state.gridId){
      await activeSoloGridIsAllowed();
    }
  }).catch(error=>console.error('Validation du compte impossible :',error));
}
init();
ensureCurrentAppVersion(false,true);
window.addEventListener('pageshow',()=>ensureCurrentAppVersion(false,true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ensureCurrentAppVersion(false,true);});
