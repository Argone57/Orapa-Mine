// Orapa Mine V2 - correctif fenêtre de score et classements globaux - 2026-07-25
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
function recordScore(name, elapsedMsOverride, success=true){
  const key = configKey(state.includeGray, state.includeOnyx, state.includeSapphire);
  const rankings = loadRankings();
  if(!rankings[key]) rankings[key] = [];
  const elapsedMs = elapsedMsOverride!=null ? elapsedMsOverride : (state.firstActionTime ? (Date.now() - state.firstActionTime) : 0);
  const entry = {
    name: (name||'').trim().slice(0,24) || 'Anonyme',
    cost: state.moveCost||0, timeMs: elapsedMs,
    rayCount: state.rayCount||0, coordCount: state.coordCount||0,
    gridId: state.gridId||null,
    success:!!success,
    date: Date.now()
  };
  rankings[key].push(entry);
  rankings[key].sort((a,b)=> Number(b.success!==false)-Number(a.success!==false) || a.cost - b.cost || a.timeMs - b.timeMs);
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

const PLAYER_ACCOUNT_KEY = 'orapaMinePlayerAccountV1';
const PLAYER_TRUST_KEY = 'orapaMinePlayerTrustV1';
let currentPlayerAccount = loadPlayerAccount();
let scoreIdentityResolver = null;

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
function validPin(pin){ return /^\d{4}$/.test(pin||''); }
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
    <div class="account-actions">
      <button class="ghost" id="accountDailyHistoryBtn">📅 Historique des défis</button>
      <button class="ghost" id="accountGridHistoryBtn">🕘 Historique des grilles</button>
      <button class="ghost" id="accountSharedGridsBtn">📤 Mes grilles partagées</button>
      <button class="ghost" id="accountRenameBtn">✏️ Renommer</button>
      <button class="ghost" id="accountPinBtn">🔢 Modifier le code</button>
      <button class="danger" id="accountLogoutBtn">🚪 Se déconnecter</button>
    </div>`;
  $('#accountTrustDevice').onchange=e=>setTrustedDevice(e.target.checked);
  $('#accountDailyHistoryBtn').onclick=()=>openMyDailyHistory();
  $('#accountGridHistoryBtn').onclick=()=>openMyGridHistory();
  $('#accountSharedGridsBtn').onclick=()=>openMySharedGrids();
  $('#accountRenameBtn').onclick=showRenameAccount;
  $('#accountPinBtn').onclick=showChangePin;
  $('#accountLogoutBtn').onclick=()=>{savePlayerAccount(null);setTrustedDevice(false);showAccountLogin();showToast('Déconnecté');};
  try{
    const [st,gridStats]=await Promise.all([
      loadMyAccountStats(),
      supabaseRpc('orapa_my_grid_stats',{p_session_token:currentPlayerAccount.session_token}).catch(()=>null)
    ]);
    const rate=st.participations?Math.round(st.wins/st.participations*100):0;
    $('#accountStats').innerHTML=`<div class="account-stats-grid">
      <div class="account-stat"><b>${st.participations||0}</b>défis</div>
      <div class="account-stat"><b>${st.wins||0}</b>réussites</div>
      <div class="account-stat"><b>${rate}%</b>réussite</div>
      <div class="account-stat"><b>${st.best_score==null?'—':st.best_score+' pts'}</b>meilleur score</div>
    </div>${st.best_time_ms==null?'':`<p>Meilleur temps : <b>${formatDuration(st.best_time_ms)}</b></p>`}
    ${gridStats?`<h3 class="account-section-title">🧩 Grilles et parties Solo</h3><div class="account-stats-grid">
      <div class="account-stat"><b>${gridStats.played||0}</b>jouées</div>
      <div class="account-stat"><b>${gridStats.played?Math.round((gridStats.wins||0)/gridStats.played*100):0}%</b>réussite</div>
      <div class="account-stat"><b>${gridStats.created||0}</b>créées</div>
      <div class="account-stat"><b>${gridStats.best_score==null?'—':gridStats.best_score+' pts'}</b>meilleur score</div>
      <div class="account-stat"><b>${gridStats.average_score==null?'—':gridStats.average_score+' pts'}</b>score moyen</div>
      <div class="account-stat"><b>${gridStats.average_rank==null?'—':'#'+gridStats.average_rank}</b>rang moyen</div>
      <div class="account-stat"><b>${gridStats.first_places||0}</b>premières places</div>
    </div>`:''}`;
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
    try{const d=await supabaseRpc('orapa_rename_profile',{p_session_token:currentPlayerAccount.session_token,p_pin:pin,p_new_name:name});savePlayerAccount({...currentPlayerAccount,display_name:d.display_name});globalAllScoresCache=null;globalRankingCache={};showToast('Pseudo modifié');renderAccountHome();}catch(e){accountError('#accountRenameError',e.message);}
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
    return `<div class="ranking-row${mine?' ranking-mine':''}"><div class="ranking-row-top">
    <span class="ranking-rank${Number(row.rank)===1?' top1':''}">${rankingMedal(Number(row.rank)-1)}</span>
    <span class="ranking-name">${escapeHtml(row.player_name||'Anonyme')}${row.played_by_creator?' *':''}</span>${row.success?'':'<span class="ranking-fail">Échec</span>'}
    <span class="ranking-points">${row.cost} pts</span>
    <span class="ranking-time">${formatDuration(row.time_ms)}</span>
  </div><div class="ranking-row-detail">${row.ray_count||0} rayon${row.ray_count===1?'':'s'} 🔦 + ${row.coord_count||0} coordonnée${row.coord_count===1?'':'s'} 📍</div></div>`;
  }).join('');
}
async function openGridRanking(gridId,returnToAccount=false,returnToVictory=false){
  if(!gridId) return;
  if(returnToAccount&&$('#gridDataModal').classList.contains('open')){
    $('#nestedGridRankingIntro').innerHTML=`<p>Grille <b>${escapeHtml(gridId)}</b></p><div class="controls ranked-grid-actions"><button id="copyNestedRankedGridId" class="ghost">📋 Copier l’ID de la grille</button></div>`;
    $('#nestedGridRankingContent').innerHTML='<div class="history-empty">Chargement…</div>';
    $('#nestedGridRankingModal').classList.add('open');
    $('#copyNestedRankedGridId').onclick=()=>navigator.clipboard?.writeText(gridId).then(()=>showToast('Identifiant copié : '+gridId));
    try{
      const rows=await supabaseRpc('orapa_get_grid_scores',{p_grid_id:gridId});
      if(!$('#nestedGridRankingModal').classList.contains('open'))return;
      const wins=(rows||[]).filter(row=>row.success).length;
      $('#nestedGridRankingContent').innerHTML=`<div class="global-ranking-summary"><b>${rows?.length||0}</b> participant${rows?.length===1?'':'s'} · <b>${wins}</b> réussite${wins===1?'':'s'}</div>${gridRankingRows(rows)}${rows?.some(row=>row.played_by_creator)?'<p class="stats-note">* Cette personne a créé la grille et l’a jouée après la période de protection.</p>':''}`;
    }catch(e){
      $('#nestedGridRankingContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`;
    }
    return;
  }
  openGridDataShell('🏆 Classement de la grille',`<p>Grille <b>${escapeHtml(gridId)}</b></p><div class="controls ranked-grid-actions"><button id="copyRankedGridId" class="ghost">📋 Copier l’ID de la grille</button>${returnToVictory?'<button id="gridResultBack" class="ghost">← Retour au résultat</button>':''}</div>`,returnToAccount,returnToVictory);
  $('#copyRankedGridId').onclick=()=>navigator.clipboard?.writeText(gridId).then(()=>showToast('Identifiant copié : '+gridId));
  if(returnToVictory) $('#gridResultBack').onclick=()=>closeGridDataModal(true);
  try{
    const rows=await supabaseRpc('orapa_get_grid_scores',{p_grid_id:gridId});
    const wins=(rows||[]).filter(row=>row.success).length;
    $('#gridDataContent').innerHTML=`<div class="global-ranking-summary"><b>${rows?.length||0}</b> participant${rows?.length===1?'':'s'} · <b>${wins}</b> réussite${wins===1?'':'s'}</div>${gridRankingRows(rows)}${rows?.some(row=>row.played_by_creator)?'<p class="stats-note">* Cette personne a créé la grille et l’a jouée après la période de protection.</p>':''}`;
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
}
async function openMyGridHistory(){
  if(!currentPlayerAccount) return;
  const configOptions='<option value="ALL">Toutes les configurations</option>'+RANKING_COMBOS.map(([g,o,s])=>{const key=configKey(g,o,s);return `<option value="${key}">${key}</option>`;}).join('');
  openGridDataShell('🕘 Historique des grilles',`<p>Grilles classées jouées avec ce compte, chargées par 10.</p><select id="accountHistoryConfigSelect" class="ranking-select">${configOptions}</select>`,true);
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
        return `<div class="ranking-row account-history-row${expanded?' expanded':''}" data-grid-index="${i}"><div class="ranking-row-top"><span class="account-result-position"><span class="solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><b>#${row.rank}</b></span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.cost} pts</span></div>${expanded?`<div class="account-grid-id">ID : ${escapeHtml(row.grid_id)}</div><div class="ranking-row-detail">${row.success?'Réussite':'Échec'} · ${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${formatDuration(row.time_ms)} · ${date}</div><div class="controls ranking-compact-actions"><button class="history-summary ghost" data-grid-index="${i}">📋 Résumé</button><button class="history-copy-id ghost" data-grid-index="${i}">📋 ID</button><button class="grid-history-ranking primary" data-grid-index="${i}">🏆 Grille</button></div>`:''}</div>`;
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
    renderHistory();
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
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
        return `<div class="ranking-row account-daily-row${expanded?' expanded':''}" data-daily-index="${i}"><div class="ranking-row-top"><span class="account-result-position"><span class="solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><b>#${row.rank}</b></span><span class="ranking-date">${shortFrenchDate(dateKey)}</span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.cost} pts</span></div>${expanded?`<div class="ranking-row-detail">${row.success?'Réussite':'Échec'} · ${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions daily-history-actions"><button class="daily-history-summary ghost" data-daily-index="${i}">📋 Résumé</button></div>`:''}</div>`;
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
async function openMySharedGrids(){
  if(!currentPlayerAccount) return;
  openGridDataShell('📤 Mes grilles partagées','<p>Les grilles dont ce compte est enregistré comme créateur, chargées par 10.</p>',true);
  const sharedState={rows:[],hasMore:true};
  const loadPage=async()=>{
    const page=await supabaseRpc('orapa_my_shared_grids',{p_session_token:currentPlayerAccount.session_token,p_limit:11,p_offset:sharedState.rows.length});
    const pageRows=Array.isArray(page)?page:[];
    sharedState.rows.push(...pageRows.slice(0,10));
    sharedState.hasMore=pageRows.length>10;
  };
  try{
    await loadPage();
    if(!sharedState.rows.length){ $('#gridDataContent').innerHTML='<div class="history-empty">Aucune grille partagée avec ce compte.</div>'; return; }
    const now=Date.now();
    const renderShared=()=>{
      const rows=sharedState.rows;
      const rowsHtml=rows.map((row,i)=>{
        const key=`shared:${row.grid_id}`,expanded=expandedScores.has(key),decoded=decodeGridId(row.grid_id);
        const gems=decoded?gemFlagsEmojiLine(decoded.includeGray,decoded.includeOnyx,decoded.includeSapphire):'';
        const protectedUntil=row.creator_protected_until?new Date(row.creator_protected_until):null;
        const protection=protectedUntil&&protectedUntil.getTime()>now?`Protection jusqu’au ${protectedUntil.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})}`:'Protection terminée';
        const sharedDate=row.shared_at?new Date(row.shared_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
        return `<div class="ranking-row account-shared-row${expanded?' expanded':''}" data-grid-index="${i}"><div class="ranking-row-top"><span class="ranking-rank">${row.score_count||0} 👥</span><span class="ranking-gems">${gems}</span><span class="ranking-points">${row.best_score==null?'—':`${row.best_score} pts`}</span></div>${expanded?`<div class="account-grid-id">ID : ${escapeHtml(row.grid_id)}</div><div class="ranking-row-detail">${protection}${row.best_time_ms==null?'':` · meilleur temps : ${formatDuration(row.best_time_ms)}`}${sharedDate?` · ${sharedDate}`:''}</div><div class="controls ranking-compact-actions two"><button class="shared-copy ghost" data-grid-index="${i}">📋 ID</button><button class="shared-ranking primary" data-grid-index="${i}">🏆 Grille</button></div>`:''}</div>`;
      }).join('');
      const more=sharedState.hasMore?'<button id="sharedLoadMore" class="ghost solo-load-more">Afficher les résultats suivants</button>':'';
      $('#gridDataContent').innerHTML=rowsHtml+more;
      $('#gridDataContent').querySelectorAll('.account-shared-row').forEach(el=>el.onclick=ev=>{if(ev.target.closest('button'))return;const row=rows[Number(el.dataset.gridIndex)],key=`shared:${row.grid_id}`;expandedScores.has(key)?expandedScores.delete(key):expandedScores.add(key);renderShared();});
      $('#gridDataContent').querySelectorAll('.shared-copy').forEach(btn=>btn.onclick=()=>{const id=rows[Number(btn.dataset.gridIndex)].grid_id;navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));});
      $('#gridDataContent').querySelectorAll('.shared-ranking').forEach(btn=>btn.onclick=()=>openGridRanking(rows[Number(btn.dataset.gridIndex)].grid_id,true));
      const loadMore=$('#sharedLoadMore');
      if(loadMore) loadMore.onclick=async()=>{loadMore.disabled=true;loadMore.textContent='Chargement…';try{await loadPage();renderShared();}catch(e){showToast(`Chargement impossible : ${e.message}`);loadMore.disabled=false;loadMore.textContent='Afficher les résultats suivants';}};
    };
    renderShared();
  }catch(e){ $('#gridDataContent').innerHTML=`<div class="account-error" style="display:block">${escapeHtml(e.message)}</div>`; }
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
    const row=await supabaseRpc('orapa_submit_daily_score',{
      p_name:identity.name,
      p_pin:identity.pin||'',
      p_session_token:identity.sessionToken||'',
      p_daily_date:entry.dailyDate,
      p_success:!!entry.success,
      p_cost:Number(entry.cost)||0,
      p_ray_count:Number(entry.rayCount)||0,
      p_coord_count:Number(entry.coordCount)||0,
      p_time_ms:Math.max(0,Math.round(Number(entry.timeMs)||0))
    });
    await releaseDailyChallengeLock(identity,entry.dailyDate);
    if(row?.accepted===false&&row?.reason==='already_played'){
      showToast('Ce défi du jour est déjà enregistré avec ce compte.');
      return row;
    }
    if(row?.id!=null) rememberGlobalScoreId(entry.dailyDate,row.id);
    delete globalRankingCache[entry.dailyDate]; globalAllScoresCache=null;
    showToast('🌍 Score ajouté au classement global');
    return row;
  }catch(err){
    console.error('Envoi du score global impossible :',err);
    showToast(`⚠️ Envoi global impossible : ${err.message}`);
    return null;
  }
}
async function shareGridGlobally(gridId){
  if(!gridId) return null;
  return supabaseRpc('orapa_share_grid',{
    p_grid_id:gridId,
    p_session_token:currentPlayerAccount?.session_token||''
  });
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
    if(row?.accepted) invalidateGlobalSoloScores();
    if(row?.reason==='already_played') showToast('Cette grille a déjà été classée avec ce profil.');
    else if(row?.reason==='creator_protected') showToast('⭐ Cette grille est la vôtre. Votre résultat n’a pas été ajouté au classement.');
    else showToast(row?.rank ? `🌍 Première tentative enregistrée · rang #${row.rank}` : '🌍 Première tentative enregistrée');
    return row;
  }catch(err){
    console.error('Envoi du score de grille impossible :',err);
    showToast(`⚠️ Envoi global impossible : ${err.message}`);
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
function tryDailyLayoutV2(rngFn){
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
  const placed=[];
  if(needsPartial){
    const partial=findForcedPartialOut(partialType,placed,rngFn);
    if(!partial) return null;
    placed.push(partial);
  }
  if(needsTouch){
    const partialInPair=touchTypes.includes(partialType);
    if(partialInPair){
      const otherType=touchTypes.find(type=>type!==partialType);
      const touching=findForcedSideTouch(otherType,placed,rngFn);
      if(!touching) return null;
      placed.push(touching);
    }else{
      const anchor=placeDailyRegularPiece(touchTypes[0],placed,rngFn);
      if(!anchor) return null;
      placed.push(anchor);
      const touching=findForcedSideTouch(touchTypes[1],placed,rngFn);
      if(!touching) return null;
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
  if(needsPartial ? partialCount<1 : partialCount!==0) return null;
  if(needsTouch ? touches.length<1 : touches.length!==0) return null;
  if(unreachablePieces(placed).length>0) return null;
  return {
    pieces:placed.map(p=>({id:'p'+(pieceIdSeq++),type:p.type,center:p.center,rotation:p.rotation,flipped:p.flipped})),
    flags,exceptionRule,exceptionType:partialType,touchTypes
  };
}
function generateDailyLayout(dateKey){
  const useV2=dateKey>='2026-07-30';
  const rngFn = mulberry32(seedFromString((useV2?'DAILY-V2-':'DAILY-')+dateKey));
  for(let attempt=0; attempt<200; attempt++){
    const result = useV2 ? tryDailyLayoutV2(rngFn) : tryDailyLayout(rngFn);
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
async function startSoloGame(explicitId){
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
  }catch(e){ console.warn('Statut de grille indisponible',e); }
  const unrankedReason=gridStatus?.creator_protected?'creator_protected':(gridStatus?.already_played?'already_played':null);
  setHintMode(false);
  state.mode = 'solo';
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
  else if(unrankedReason==='already_played') setTimeout(()=>alert('Cette grille a déjà été jouée avec ce profil. Vous pouvez rejouer, mais le résultat ne sera pas classé.'),60);
}

function dailyStatusToday(){
  const dateKey = parisDateKey();
  const attempt = loadDailyAttempt();
  return { dateKey, alreadyPlayed: !!(attempt && attempt.date===dateKey), attempt: (attempt && attempt.date===dateKey) ? attempt : null };
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
    alert(`Tu as déjà joué le défi du jour (${attempt.result==='win'?'réussi 🏆':'raté 💥'}). Reviens demain pour un nouveau défi !`);
    return;
  }
  try{
    const lock=await acquireDailyChallengeLock(dateKey);
    if(lock?.accepted===false){
      if(lock.reason==='already_played') alert('Ce défi du jour a déjà été terminé avec ce compte. Reviens demain pour un nouveau défi !');
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
  document.body.classList.remove('solo-menu-open');
  showGame();
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
  $('#victoryRankLine').textContent = lastScoreResult?.alreadyPlayed
    ? 'Ce défi avait déjà été terminé avec ce compte sur un autre appareil. Cette tentative n’a pas été enregistrée.'
    : (lastScoreResult && lastScoreResult.madeList
      ? `Classé #${lastScoreResult.rank} dans « ${lastScoreResult.key} »`
      : (state.isDaily ? '' : (state.gridUnrankedReason==='creator_protected'
      ? '⭐ Cette grille est la vôtre. Votre résultat n’a pas été ajouté au classement.'
      : (state.gridUnrankedReason==='already_played' ? 'Cette grille a déjà été classée avec ce profil.' : ''))));
  $('#victoryGridId').textContent = state.isDaily ? `Défi du jour (${state.dailyDate})` : (state.gridId || '');
  $('#btnVictoryGridRanking').style.display=(!state.isDaily&&state.gridId)?'':'none';
  $('#victoryModal').classList.add('open');
}
async function proposeSolution(){
  if(state.mode!=='solo' || state.soloOver) return;
  if(tutorialActive){tutorialPropose();return;}
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
      saveDailyAttempt({date:state.dailyDate,result:'win'});
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
      saveDailyAttempt({date:state.dailyDate,result:'lose'});
    }else if(state.gridRanked){
      const identity=await requestGridIdentity();
      if(!identity){ state.soloOver=false;state.soloResult=null;state.soloAttempts--;return; }
      if(identity.saveGlobal!==false){
        const entry={...currentEntryForDisplay(),name:identity.name||'Invité',success:false};
        const globalResult=await submitGlobalGridScore(entry,identity);
        if(globalResult?.reason){ state.gridUnrankedReason=globalResult.reason; state.gridRanked=false; }
      }
    }
    saveState();renderAll();setTimeout(()=>{
      let message=state.isDaily?'💥 Solution incorrecte — la grille secrète est révélée ci-dessous (tes gemmes apparaissent en contour).':"💥 C'est encore faux — la grille secrète est révélée ci-dessous (tes gemmes apparaissent en contour).";
      if(state.isDaily&&state.dailyAlreadyRecorded) message+='\n\nCe défi avait déjà été terminé avec ce compte sur un autre appareil. Cette nouvelle tentative n’a pas été enregistrée.';
      if(state.gridUnrankedReason==='creator_protected') message+='\n\n⭐ Cette grille est la vôtre. Votre résultat n’a pas été ajouté au classement.';
      else if(state.gridUnrankedReason==='already_played') message+='\n\nCette grille avait déjà été classée avec ce profil.';
      alert(message);
    },60);
  }else{saveState();setTimeout(()=>alert("C'est faux ! Il te reste un essai avant l'échec."),60);}
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
    if(tutorialActive){text='Tutoriel guidé';cls='live';}
    else if(state.soloOver){
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
  $('#btnStart').style.display = state.mode==='gm' ? '' : 'none';
  $('#btnEndGame').style.display = (state.mode==='gm' && state.started) ? '' : 'none';
  $('#btnShareGrid').style.display = gmPreStart ? '' : 'none';
  let startBlockReason = '';
  if(state.mode==='gm' && !state.started){
    const unplaced = state.pieces.some(p=>!p.center);
    const conflictCount = computeInvalidPieceIds(state.pieces).size;
    if(unplaced) startBlockReason = 'Place toutes les gemmes avant de démarrer.';
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
  const stroke = def.isOnyx ? '#cfd8dc' : 'rgba(0,0,0,.4)';
  return `<svg class="mix-icon" width="${size}" height="${size}" viewBox="${minX-pad} ${minY-pad} ${(maxX-minX)+2*pad} ${(maxY-minY)+2*pad}">
    <polygon points="${polyPointsAttr(pts)}" fill="${fill}" stroke="${stroke}" stroke-width="0.05"/>
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
    <div class="mix-section-title">${shapeIconSVG('sapphire')}<span>Saphir bleu ciel — compte comme bleu + blanc à chaque contact</span></div>
    <p class="mix-reminder mix-warning"><span>⚠️</span><span>Le Saphir bleu ciel doit pouvoir être atteint par au moins 3 rayons sans rebond.</span></p>
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
    <p class="mix-option-text">Le diamant ne modifie pas la couleur du rayon.<br>Si le rayon vient heurter le diamant en plus des autres gemmes, sa couleur reste déterminée uniquement par les autres gemmes.</p>` : ''}
    ${state.includeOnyx ? `
    <hr class="mix-sep">
    <div class="mix-section-title">${shapeIconSVG('onyx')}<span>Corps noir</span></div>
    <p class="mix-option-text">Le corps noir absorbe le rayon sans le renvoyer.</p>
    <img class="mix-onyx-example" src="onyx-absorption-example.png" alt="Exemple d’un rayon absorbé par le corps noir">` : ''}`;
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
  if(tutorialActive&&!((tutorialStage===7&&piece.id===tutorialWrongPieceId)||([11,12].includes(tutorialStage)&&piece.id===tutorialPlacementPieceId))){showToast('Utilise uniquement l’élément mis en évidence.');return;}
  ev.preventDefault();
  try{ el.setPointerCapture(ev.pointerId); }catch(e){}
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
    window.removeEventListener('pointercancel', onCancel);
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
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
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
  state.history.push({ text, hex: result.color.hex, time: timeNow() });
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
  state.history.push({ text, hex, time: timeNow() });
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
  if(state.mode==='solo' && !state.soloOver){ showGame(); return; }
  openSoloChoiceModal();
}
$('#homeSolo').addEventListener('click', enterSolo);
let tutorialActive=false,tutorialStage=0,tutorialTargetLabel=null,tutorialTargetCell=null,tutorialWrongPieceId=null,tutorialLastResult=null,tutorialRayExamples=[],tutorialRayIndex=0,tutorialPlacementIndex=0,tutorialPlacementPieceId=null,tutorialPlacementEnds=[],tutorialStepNumber=0,tutorialStepKey='';
function tutorialClearTargets(){ document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target')); }
function tutorialCoach(title,text,actionLabel=''){
  tutorialClearTargets();
  const coach=$('#tutorialCoach');
  coach.classList.toggle('tutorial-coach-top',![8,11,12].includes(tutorialStage));
  $('#tutorialCoachTitle').innerHTML=title;
  $('#tutorialCoachText').innerHTML=text;
  const stepKey=`${tutorialStage}:${tutorialRayIndex}:${tutorialPlacementIndex}`;
  if(stepKey!==tutorialStepKey){tutorialStepKey=stepKey;tutorialStepNumber++;}
  $('#tutorialCoachStep').textContent=`\u00c9tape ${tutorialStepNumber}`;
  $('#tutorialCoachAction').innerHTML=actionLabel;
  $('#tutorialCoachAction').style.display=actionLabel?'':'none';
  $('#tutorialCoachStep').style.display=([9,10].includes(tutorialStage)||tutorialStage>=13)?'none':'';
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
  if(target){target.classList.add('tutorial-target');target.scrollIntoView({behavior:'smooth',block:'center'});}
}
function tutorialFindUnusedLabel(){
  for(const [side,count] of [['top',COLS],['right',ROWS],['bottom',COLS],['left',ROWS]]){
    for(let index=0;index<count;index++) if(state.labelColor[side][index]===undefined) return {side,index};
  }
  return {side:'top',index:0};
}
function tutorialFindOccupiedCell(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(pieceAtCell(r,c,state.secretPieces)) return {r,c};
  return {r:3,c:4};
}
function tutorialFindEmptyCell(){
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!pieceAtCell(r,c,state.secretPieces))return {r,c};
  return {r:0,c:0};
}
function tutorialResultTextLegacy(result){
  if(result.absorbed) return `Le rayon a rencontrÃ© le <b>corps noir</b> et a Ã©tÃ© absorbÃ© : il nâ€™a donc aucune sortie.`;
  const entry=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);
  const bounced=result.exitSide===tutorialTargetLabel.side&&result.exitIndex===tutorialTargetLabel.index;
  const route=bounced?`Il ressort par son point dâ€™entrÃ©e <b>${entry}</b>.`:`Il ressort en <b>${labelText(result.exitSide,result.exitIndex)}</b>.`;
  return `${route} La couleur observÃ©e est <b>${result.color.name}</b>. Une gemme ne se laisse pas traverser : chacune de ses faces rÃ©flÃ©chit le rayon et modifie sa direction.`;
}
function tutorialShowStageLegacy(){
  if(!tutorialActive) return;
  if(tutorialStage===0) tutorialCoach('Bienvenue dans la partie-école','Une vraie grille est cachée. Tu vas effectuer quelques actions sur le plateau, puis reconstruire la solution. Aucun compte n’est nécessaire et cette partie ne sera pas classée.','Commencer');
  else if(tutorialStage===1){const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);tutorialCoach('Lance ton premier rayon',`Touche l’entrée <b>${name}</b>, mise en évidence sur le bord de la mine. Un rayon coûte <b>1 point</b>.`);}
  else if(tutorialStage===2) tutorialCoach('Lis le résultat du rayon',tutorialResultText(tutorialLastResult),'Essayer un autre rayon');
  else if(tutorialStage===3){const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);tutorialCoach('Compare avec un second indice',`Touche maintenant l’entrée <b>${name}</b>. En croisant plusieurs sorties et couleurs, tu élimines progressivement les placements impossibles.`);}
  else if(tutorialStage===4) tutorialCoach('Les rayons donnent des contraintes',tutorialResultText(tutorialLastResult)+' Observe également le nouvel élément ajouté dans l’historique de la partie.','Vérifier une case');
  else if(tutorialStage===5){const coord=LEFT_LABELS[tutorialTargetCell.r]+(tutorialTargetCell.c+1);tutorialCoach('Utilise une coordonnée',`Touche la case <b>${coord}</b>, mise en évidence. Une coordonnée révèle directement son contenu, mais coûte <b>3 points</b>.`);}
  else if(tutorialStage===6) tutorialCoach('Un indice très précis',`La case interrogée est maintenant marquée sur le vrai plateau et son contenu figure dans l’historique. Les coordonnées sont utiles pour confirmer une hypothèse, mais elles coûtent trois fois plus qu’un rayon.`,'Reconstruire la grille');
  else if(tutorialStage===7) tutorialCoach('Corrige la dernière gemme','Une solution presque complète vient d’être placée. La gemme mise en évidence est mal orientée : <b>touche-la une fois</b> pour la faire pivoter de 90°.');
  else if(tutorialStage===8) tutorialCoach('Propose la solution','Toutes les gemmes correspondent maintenant aux indices. Touche <b>Proposer une solution</b> pour vérifier la disposition.');
  else tutorialCoach('Tutoriel terminé !','Tu sais maintenant interroger la mine, lire les résultats, placer les gemmes et proposer une solution.<br><br><b>Sur l’accueil :</b> joue une grille aléatoire, le défi du jour ou un identifiant partagé ; crée tes propres grilles ; consulte tes historiques et les classements depuis ton compte.','Retour à l’accueil');
}
// Version textuelle normalisee : uniquement ASCII dans le fichier source pour
// eviter tout double encodage lors du deploiement sur GitHub Pages.
function tutorialAllRays(pieces){
  const rows=[];
  for(const [side,count] of [['top',COLS],['right',ROWS],['bottom',COLS],['left',ROWS]]){
    for(let index=0;index<count;index++){
      const result=simulateBeam(side,index,pieces);
      const same=!result.absorbed&&result.exitSide===side&&result.exitIndex===index;
      rows.push({side,index,result,same,colored:result.color.name!=='Transparent'});
    }
  }
  return rows;
}
function tutorialSelectRayExamples(pieces){
  const all=tutorialAllRays(pieces),picked=[],blocked=new Set();
  const key=(side,index)=>side+':'+index;
  const pick=test=>{
    const item=all.find(ray=>!picked.includes(ray)&&!blocked.has(key(ray.side,ray.index))&&test(ray));
    if(!item)return false;
    picked.push(item);blocked.add(key(item.side,item.index));
    if(!item.result.absorbed)blocked.add(key(item.result.exitSide,item.result.exitIndex));
    return true;
  };
  const hits=ray=>ray.result.hitPieceIds||[];
  const isPrimary=ray=>['Rouge','Jaune','Bleu','Blanc'].includes(ray.result.color.name);
  const rayKeys=ray=>[key(ray.side,ray.index),key(ray.result.exitSide,ray.result.exitIndex)];
  const compatible=(...rays)=>{const keys=rays.flatMap(rayKeys);return new Set(keys).size===keys.length;};
  const clears=all.filter(ray=>!ray.result.absorbed&&hits(ray).length===0);
  const singles=all.filter(ray=>!ray.result.absorbed&&hits(ray).length===1&&isPrimary(ray));
  let opening=null;
  for(const first of clears){
    for(const second of singles.filter(ray=>ray.side===first.side&&Math.abs(ray.index-first.index)===1)){
      const third=singles.find(ray=>ray!==second&&ray.side===second.side&&Math.abs(ray.index-second.index)===1&&ray.result.color.name!==second.result.color.name&&compatible(first,second,ray));
      if(third&&compatible(first,second,third)){opening=[first,second,third];break;}
    }
    if(opening)break;
  }
  if(!opening)return {examples:[],ends:[]};
  opening.forEach(chosen=>pick(ray=>ray===chosen));
  pick(ray=>!ray.result.absorbed&&new Set(hits(ray)).size>=2&&!isPrimary(ray)&&ray.result.color.name!=='Transparent');
  if(picked.length<4)return {examples:[],ends:[]};
  const ends=[];
  const placementPieces=['red','yellow','blue','white','rhombus'].map(type=>pieces.find(item=>item.type===type));
  const raysNeeded=[2,3,2,3,0];
  for(let placementIndex=0;placementIndex<placementPieces.length;placementIndex++){
    const piece=placementPieces[placementIndex];
    if(!piece)return {examples:[],ends:[]};
    const before=picked.length;
    pick(ray=>!ray.result.absorbed&&new Set(hits(ray)).size===1&&hits(ray).includes(piece.id));
    while(picked.length<before+raysNeeded[placementIndex]){
      const usedSides=new Set(picked.slice(before).map(ray=>ray.side));
      if(!pick(ray=>!ray.result.absorbed&&new Set(hits(ray)).size===1&&hits(ray).includes(piece.id)&&!usedSides.has(ray.side)))
        pick(ray=>!ray.result.absorbed&&new Set(hits(ray)).size===1&&hits(ray).includes(piece.id));
      if(picked.length===before)return {examples:[],ends:[]};
      if(picked.length<before+raysNeeded[placementIndex]&&!all.some(ray=>!picked.includes(ray)&&!blocked.has(key(ray.side,ray.index))&&!ray.result.absorbed&&new Set(hits(ray)).size===1&&hits(ray).includes(piece.id)))return {examples:[],ends:[]};
    }
    ends.push(picked.length-1);
  }
  return {examples:picked,ends};
}
function tutorialChooseLayout(){
  let pieces=null;
  for(let attempt=0;attempt<80;attempt++){
    pieces=generateRandomLayout(35);
    const lesson=pieces?tutorialSelectRayExamples(pieces):{examples:[],ends:[]};
    if(lesson.examples.length>=14&&pieces.find(piece=>piece.type==='red')?.flipped)return {pieces,...lesson};
  }
  const lesson=tutorialSelectRayExamples(pieces||[]);
  return {pieces,...lesson};
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
  if(!close){piece.center=null;showToast('Place la gemme dans la zone mise en \u00e9vidence.');renderPalette();renderPieces();tutorialHighlightTarget();return;}
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
function tutorialResultText(result){
  if(result.absorbed) return `Le rayon a rencontr&eacute; le <b>corps noir</b> et a &eacute;t&eacute; absorb&eacute; : il n&rsquo;a donc aucune sortie.`;
  const entry=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);
  const bounced=result.exitSide===tutorialTargetLabel.side&&result.exitIndex===tutorialTargetLabel.index;
  const route=bounced?`Il est renvoy&eacute; vers son point d&rsquo;entr&eacute;e <b>${entry}</b>.`:`Il ressort en <b>${labelText(result.exitSide,result.exitIndex)}</b>.`;
  const color=result.color.name==='Transparent'
    ? `Le r&eacute;sultat est <b>Transparent</b> : aucune gemme color&eacute;e n&rsquo;a modifi&eacute; sa couleur.`
    : `La couleur obtenue est <b>${result.color.name}</b>.`;
  return `${route} ${color}`;
}
function tutorialShowStage(){
  if(!tutorialActive) return;
  if(tutorialStage===0) tutorialCoach('Bienvenue dans la partie-\u00e9cole','Une grille est cach&eacute;e. Tu vas utiliser les principales actions du jeu, puis apprendre &agrave; placer et valider une solution. Aucun compte n&rsquo;est n&eacute;cessaire et cette partie ne sera pas class&eacute;e.','Commencer');
  else if(tutorialStage===1){const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);tutorialCoach('Lance ton premier rayon',`Touche l&rsquo;entr&eacute;e <b>${name}</b>, mise en &eacute;vidence sur le bord de la mine. Un rayon co&ucirc;te <b>1 point</b>.`);}
  else if(tutorialStage===2) tutorialCoach('Lis le r\u00e9sultat du rayon',tutorialResultText(tutorialLastResult),'Essayer un autre rayon');
  else if(tutorialStage===3){const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);tutorialCoach('Compare avec un second rayon',`Touche maintenant l&rsquo;entr&eacute;e <b>${name}</b>. En croisant plusieurs sorties et couleurs, tu peux progressivement &eacute;liminer des placements.`);}
  else if(tutorialStage===4) tutorialCoach('Passe au mode indice','Ces deux rayons servent uniquement d&rsquo;exemple : ils ne suffisent pas pour d&eacute;duire toute la grille. Dans une partie, continue tes recherches autant que n&eacute;cessaire.<br><br>Pour v&eacute;rifier une case, il faut d&rsquo;abord toucher le bouton <b>Demander un indice</b>. Le tutoriel va l&rsquo;activer pour toi.','Activer le mode indice');
  else if(tutorialStage===5){const coord=LEFT_LABELS[tutorialTargetCell.r]+(tutorialTargetCell.c+1);tutorialCoach('V\u00e9rifie une coordonn\u00e9e',`Le mode indice est actif. Touche la case <b>${coord}</b>, mise en &eacute;vidence. Son contenu sera r&eacute;v&eacute;l&eacute; pour un co&ucirc;t de <b>3 points</b>.`);}
  else if(tutorialStage===6) tutorialCoach('Lis le r\u00e9sultat de l\u2019indice',`La case interrog&eacute;e est maintenant marqu&eacute;e sur le plateau et son contenu figure dans l&rsquo;historique. Une coordonn&eacute;e permet de confirmer une hypoth&egrave;se, mais co&ucirc;te trois fois plus qu&rsquo;un rayon.`,'Apprendre \u00e0 placer la solution');
  else if(tutorialStage===7) tutorialCoach('Corrige la derni\u00e8re gemme','Pour apprendre la manipulation sans te demander de r&eacute;soudre toute la grille, le tutoriel a pr&eacute;rempli la solution et laiss&eacute; volontairement une orientation incorrecte.<br><br><b>Touche une fois la gemme mise en &eacute;vidence</b> pour la faire pivoter de 90&deg;.');
  else if(tutorialStage===8) tutorialCoach('Propose cette solution','La disposition pr&eacute;remplie est maintenant correcte. Dans une vraie partie, attends d&rsquo;avoir recueilli suffisamment d&rsquo;indices avant de proposer.<br><br>Ici, touche <b>Proposer une solution</b> pour d&eacute;couvrir la validation.');
  else tutorialCoach('Tutoriel termin\u00e9 !','Tu as effectu&eacute; les principales actions d&rsquo;une partie : lancer des rayons, activer le mode indice, v&eacute;rifier une case, manipuler les gemmes et valider une proposition.<br><br><b>Sur l&rsquo;accueil :</b> joue une grille al&eacute;atoire, le d&eacute;fi du jour ou un identifiant partag&eacute; ; cr&eacute;e tes propres grilles ; consulte tes historiques et les classements depuis ton compte.','Retour \u00e0 l\u2019accueil');
}
function tutorialShowStage(){
  if(!tutorialActive)return;
  if(tutorialStage===0) tutorialCoach('Bienvenue dans le tutoriel','Une grille est cach&eacute;e. Tu vas essayer plusieurs rayons, utiliser un indice, puis apprendre &agrave; manipuler et valider une solution. Aucun compte n&rsquo;est n&eacute;cessaire et cette partie ne sera pas class&eacute;e.','Commencer');
  else if(tutorialStage===1){
    const name=labelText(tutorialTargetLabel.side,tutorialTargetLabel.index);
    tutorialCoach('Teste un rayon',`Touche l&rsquo;entr&eacute;e <b>${name}</b>, mise en &eacute;vidence sur le bord. Le moteur calculera r&eacute;ellement son trajet, sa sortie et sa couleur.`);
  }else if(tutorialStage===2){
    const more=tutorialRayIndex<tutorialRayExamples.length-1;
    tutorialCoach('Observe ce r\u00e9sultat',tutorialResultText(tutorialLastResult),more?'Rayon suivant':'Voir l\u2019aide des couleurs');
  }else if(tutorialStage===3) tutorialCoach('Comprends les couleurs','Un rayon peut rencontrer plusieurs gemmes au fil de ses d&eacute;viations. Le r&eacute;sultat combine alors leurs couleurs.<br><br>Ouvre l&rsquo;aide pour voir les m&eacute;langes possibles, puis ferme-la avec la croix.','Afficher l\u2019aide des couleurs');
  else if(tutorialStage===4) tutorialCoach('Passe au mode indice','Les rayons pr&eacute;c&eacute;dents montrent plusieurs comportements possibles, mais ne suffisent pas &agrave; d&eacute;duire cette grille enti&egrave;re.<br><br>Dans une partie, pour v&eacute;rifier une case, touche d&rsquo;abord <b>Demander un indice</b>. Le tutoriel va activer ce mode pour toi.','Activer le mode indice');
  else if(tutorialStage===5){const coord=LEFT_LABELS[tutorialTargetCell.r]+(tutorialTargetCell.c+1);tutorialCoach('V\u00e9rifie une coordonn\u00e9e',`Le mode indice est actif. Touche la case <b>${coord}</b>, mise en &eacute;vidence. Son contenu sera r&eacute;v&eacute;l&eacute; pour un co&ucirc;t de <b>3 points</b>.`);}
  else if(tutorialStage===6) tutorialCoach('Lis le r\u00e9sultat de l\u2019indice','La case interrog&eacute;e est maintenant marqu&eacute;e sur le plateau et son contenu figure dans l&rsquo;historique. Une coordonn&eacute;e confirme une hypoth&egrave;se, mais co&ucirc;te trois fois plus qu&rsquo;un rayon.','Apprendre \u00e0 placer la solution');
  else if(tutorialStage===7) tutorialCoach('Corrige la derni\u00e8re gemme','Pour apprendre la manipulation sans te demander de r&eacute;soudre toute la grille, le tutoriel a pr&eacute;rempli la solution et laiss&eacute; volontairement une orientation incorrecte.<br><br><b>Touche une fois la gemme mise en &eacute;vidence</b> pour la faire pivoter de 90&deg;.');
  else if(tutorialStage===8) tutorialCoach('Propose cette solution','La disposition pr&eacute;remplie est maintenant correcte. Dans une vraie partie, attends d&rsquo;avoir recueilli suffisamment d&rsquo;indices avant de proposer.<br><br>Ici, touche <b>Proposer une solution</b> pour d&eacute;couvrir la validation.');
  else if(tutorialStage===9) tutorialCoach('Les gemmes optionnelles','Certaines grilles ajoutent jusqu&rsquo;&agrave; trois gemmes :<br><br>💎 <b>Diamant</b> : d&eacute;vie le rayon sans ajouter de couleur.<br>⬛ <b>Corps noir</b> : absorbe le rayon, qui ne ressort pas.<br>🟦 <b>Saphir bleu ciel</b> : ajoute simultan&eacute;ment le bleu et le blanc au r&eacute;sultat.<br><br>Les classements s&eacute;parent les diff&eacute;rentes configurations.','Terminer');
  else tutorialCoach('Tutoriel termin\u00e9 !','Tu as effectu&eacute; les principales actions d&rsquo;une partie et observ&eacute; plusieurs comportements possibles des rayons.<br><br><b>Sur l&rsquo;accueil :</b> joue une grille al&eacute;atoire, le d&eacute;fi du jour ou un identifiant partag&eacute; ; cr&eacute;e tes propres grilles ; consulte tes historiques et les classements depuis ton compte.','Retour \u00e0 l\u2019accueil');
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
function tutorialPrepareSolution(){
  state.pieces=state.secretPieces.map(p=>({...p,id:'p'+(pieceIdSeq++),center:{...p.center}}));
  const wrong=state.pieces.find(p=>p.type==='red')||state.pieces[0];
  wrong.rotation=(wrong.rotation+270)%360;
  tutorialWrongPieceId=wrong.id;
  renderPalette();renderPieces();
}
function startInteractiveTutorial(){
  if(state.mode==='solo'&&!state.soloOver&&!confirm('Quitter la partie solo en cours pour lancer le tutoriel ?')) return;
  state.includeGray=false;state.includeOnyx=false;state.includeSapphire=false;
  const lesson=tutorialFixedLesson();
  if(!lesson.pieces||lesson.examples.length<11){showToast('Le tutoriel est momentan\u00e9ment indisponible.');return;}
  tutorialRayExamples=lesson.examples;tutorialPlacementEnds=lesson.ends;tutorialRayIndex=0;tutorialPlacementIndex=0;tutorialPlacementPieceId=null;
  tutorialActive=true;tutorialStage=0;tutorialStepNumber=0;tutorialStepKey='';tutorialTargetLabel={side:tutorialRayExamples[0].side,index:tutorialRayExamples[0].index};tutorialTargetCell=null;tutorialWrongPieceId=null;tutorialLastResult=null;
  document.body.classList.add('tutorial-active');
  state.mode='solo';state.started=false;state.secretPieces=lesson.pieces.map(p=>({...p,center:{...p.center}}));state.pieces=freshPieceSet();
  state.gridId=null;state.gridRanked=false;state.gridUnrankedReason='tutorial';state.soloAttempts=0;state.soloOver=false;state.soloResult=null;state.soloShowGuess=true;state.soloShowSecret=true;state.moveCost=0;state.firstActionTime=null;state.finalTimeMs=null;state.rayCount=0;state.coordCount=0;state.isDaily=false;state.dailyDate=null;state.history=[];state.labelColor={top:{},bottom:{},left:{},right:{}};state.labelBounce={top:{},bottom:{},left:{},right:{}};state.labelPair={top:{},bottom:{},left:{},right:{}};state.labelPartner={top:{},bottom:{},left:{},right:{}};state.cellUsed={};state.traces=[];state.emptyMarks=[];state.coordDots=[];
  showGame();setTimeout(tutorialShowStage,80);
}
function exitInteractiveTutorial(){tutorialActive=false;document.body.classList.remove('tutorial-active');tutorialClearTargets();resetAll();showHome();}
function tutorialAfterRay(result){tutorialLastResult=result;tutorialStage=2;tutorialShowStage();}
function tutorialAfterCell(){
  if(tutorialStage===15)tutorialStage=16;
  else if(tutorialStage===17)tutorialStage=18;
  else tutorialStage=6;
  tutorialShowStage();
}
function tutorialAfterPieceAction(piece){
  if(!tutorialActive||tutorialStage!==12||piece.id!==tutorialPlacementPieceId)return;
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
$('#tutorialCoachClose').addEventListener('click',exitInteractiveTutorial);
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
  else if(tutorialStage===22){tutorialStage=23;tutorialShowStage();}
  else if(tutorialStage===23) exitInteractiveTutorial();
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
  showGame();
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
  const gridId=encodeGridId(state.pieces,state.includeGray,state.includeOnyx,state.includeSapphire);
  if(!gridId) return;
  const gems=gemFlagsEmojiLine(state.includeGray,state.includeOnyx,state.includeSapphire);
  const text=`Je te défie à Orapa Mine !\n${gems}\nID: ${gridId}\nhttps://argone57.github.io/Orapa-Mine/`;
  try{
    await shareGridGlobally(gridId);
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
    const text = `Je te défie à Orapa Mine !\n${gems}\nID: ${state.gridId}\nhttps://argone57.github.io/Orapa-Mine/`;
    try{
      await shareGridGlobally(state.gridId);
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
    openSoloSetupModal();
    return;
  }
  if(!confirm("Recommencer efface le placement des gemmes et tout l'historique. Continuer ?")) return;
  resetAll();
});

function openSoloChoiceModal(){
  document.body.classList.add('solo-menu-open');
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
function closeSoloChoiceModal(){ $('#soloChoiceModal').classList.remove('open'); document.body.classList.remove('solo-menu-open'); }
$('#soloChoiceCancel').addEventListener('click', closeSoloChoiceModal);
$('#soloChoiceModal').addEventListener('click', e=>{ if(e.target.id==='soloChoiceModal') closeSoloChoiceModal(); });
$('#soloChoiceDaily').addEventListener('click', ()=>{
  const { alreadyPlayed } = dailyStatusToday();
  if(alreadyPlayed){
    startDailyChallenge();
    return;
  }
  closeSoloChoiceModal();
  document.body.classList.add('solo-menu-open');
  $('#dailyRulesModal').classList.add('open');
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
  if(!confirm('Lancer cette grille ? Ton meilleur score pourra être ajouté à son classement global.')) return;
  closeSoloChoiceModal();
  startSoloGame(id);
}

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
$('#btnVictoryGridRanking').addEventListener('click',()=>openGridRanking(state.gridId,false,true));
function closeGridDataModal(returnToOrigin=true){
  $('#gridDataModal').classList.remove('open');
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
function buildRankingConfigOptions(){
  const select = $('#rankingConfigSelect');
  if(rankingView==='daily' || rankingView==='global'){
    const todayKey = parisDateKey();
    const prefix = rankingView==='global' ? 'GLOBAL:' : 'DAILY:';
    if(rankingView==='global'){
      select.innerHTML = Array.from({length:7},(_,index)=>{
        const dateKey = shiftDateKey(todayKey,-index);
        return `<option value="${prefix}${dateKey}">${globalDateLabel(dateKey,index)}</option>`;
      }).join('');
    }else{
      const yesterdayKey = shiftDateKey(todayKey,-1);
      let options = `<option value="${prefix}${todayKey}">Défi du jour (${todayKey})</option>`;
      if(pruneDailyBoards(loadDailyBoards())[yesterdayKey]) options += `<option value="${prefix}${yesterdayKey}">Défi d'hier (${yesterdayKey})</option>`;
      select.innerHTML = options;
    }
  } else {
    select.innerHTML = '<option value="GLOBAL_SOLO:ALL">Toutes les configurations</option>'+RANKING_COMBOS.map(([g,o,s])=>{
      const key=configKey(g,o,s);
      return `<option value="GLOBAL_SOLO:${key}">${key}</option>`;
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
  $('#btnStatsGlobal').style.display = view==='global' ? '' : 'none';
  const picker=$('#rankingDatePicker');
  $('#rankingDatePickerWrap').style.display=view==='global'?'flex':'none';
  picker.max=parisDateKey();
  buildRankingConfigOptions();
  if(view==='solo') $('#rankingConfigSelect').value = 'GLOBAL_SOLO:ALL';
  if(view==='global') picker.value=($('#rankingConfigSelect').value||'').replace('GLOBAL:','')||parisDateKey();
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
      const expanded=expandedScores.has(`g${e.id}`);
      const mine=String(e.id)===String(myId) || (!!myAccountName && String(e.name||'').trim().toLocaleLowerCase('fr-FR')===myAccountName);
      const failTag=e.success ? '' : '<span class="ranking-fail">Échec</span>';
      const detail=expanded ? `<div class="ranking-row-detail">${e.rayCount} rayon${e.rayCount===1?'':'s'} 🔦 + ${e.coordCount} coordonnée${e.coordCount===1?'':'s'} 📍 · ${formatDuration(e.timeMs)}</div><div class="controls" style="justify-content:flex-start;gap:8px;margin:8px 0 2px 34px;"><button class="ranking-copy-summary" data-global-idx="${i}">📋 Copier le résumé</button></div>` : '';
      return `<div class="ranking-row global-row${expanded?' expanded':''}${mine?' ranking-mine':''}" data-global-id="${e.id}"><div class="ranking-row-top"><span class="ranking-rank${i===0?' top1':''}">${rankingMedal(i)}</span><span class="ranking-name">${escapeHtml(e.name||'Anonyme')}</span>${failTag}<span class="ranking-points">${e.cost} pts</span><span class="ranking-time">${formatDuration(e.timeMs)}</span></div>${detail}</div>`;
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
  return `<div class="stats-details">
    <div><span>Meilleur score réussi</span><b>${bestScore==null?'—':bestScore+' pts'}</b></div>
    <div><span>Temps record réussi</span><b>${bestTime==null?'—':formatDuration(bestTime)}</b></div>
    <div><span>Score moyen</span><b>${averageScore==null?'—':formatDecimal(averageScore)+' pts'}</b></div>
    <div><span>Temps moyen</span><b>${averageTime==null?'—':formatDuration(averageTime)}</b></div>
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
  return `<div class="stats-section-title"><h3>${daily?'Joueurs du défi':'Statistiques par pseudo'}</h3><small>Clique un nom</small></div><div class="stats-player-list">${players.map(player=>{
    const wins=player.rows.filter(r=>r.success).length;
    const rate=Math.round(wins/player.rows.length*100);
    return `<button class="stats-player" data-player-key="${escapeHtml(player.key)}"><span>${escapeHtml(player.name)}</span><b>${player.rows.length} partie${player.rows.length>1?'s':''}</b><em>${rate} % de réussite</em></button>`;
  }).join('')}</div>`;
}
function bindStatsPlayerButtons(){
  $('#globalStatsContent').querySelectorAll('[data-player-key]').forEach(button=>button.addEventListener('click',()=>renderPlayerStats(button.dataset.playerKey)));
}
function renderPlayerStats(playerKey){
  const content=$('#globalStatsContent');
  const playerRows=globalStatsRows.filter(row=>statsPlayerKey(row.player_name)===playerKey);
  if(!playerRows.length) return;
  const name=(playerRows[0].player_name||'Anonyme').trim()||'Anonyme';
  const dates=playerRows.map(row=>row.daily_date).filter(Boolean).sort();
  const uniqueDays=new Set(dates).size;
  content.innerHTML=`<button class="ghost stats-back" id="backToGlobalStats">← Retour aux statistiques</button>
    <h3>${escapeHtml(name)}</h3><p class="stats-subtitle">Statistiques associées à ce pseudo, sans compte ni vérification d'identité.</p>
    ${statsSummaryCards(playerRows)}
    <div class="stats-details">
      <div><span>Défis différents</span><b>${uniqueDays}</b></div>
      <div><span>Première participation</span><b>${dates.length?formatStatsDate(dates[0]):'—'}</b></div>
      <div><span>Dernière participation</span><b>${dates.length?formatStatsDate(dates[dates.length-1]):'—'}</b></div>
    </div>${statsDetails(playerRows)}`;
  $('#backToGlobalStats').addEventListener('click',renderGlobalStatsView);
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
      content.innerHTML=`<div class="stats-daily-heading"><h3>Défi du ${formatStatsDate(dateKey)}</h3><label class="ranking-date-picker-wrap stats-date-picker-wrap" aria-label="Choisir une autre date"><span aria-hidden="true">&#128197;</span><input id="globalStatsDatePicker" class="ranking-date-picker" type="date" value="${dateKey}" max="${parisDateKey()}"></label></div>${rows.length ? statsSummaryCards(rows)+statsDetails(rows)+statsPlayerButtons(rows,true) : '<div class="history-empty">Aucune participation pour cette date.</div>'}`;
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
      const extra=`<div class="stats-details"><div><span>Pseudos différents</span><b>${uniquePlayers}</b></div><div><span>Défis enregistrés</span><b>${uniqueDays}</b></div></div>`;
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
  globalStatsMode='daily';
  $('#globalStatsDateSelect').innerHTML=statsDateOptions(selectedDate);
  $('#globalStatsDateSelect').value=selectedDate;
  $('#globalStatsModal').classList.add('open');
  await renderGlobalStatsView();
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
  $('#btnResetRanking').style.display='none';
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
      return `<div class="ranking-row solo-global-row${expanded?' expanded':''}" data-solo-row="${i}"><div class="ranking-row-top"><span class="solo-ranking-player"><span class="ranking-rank solo-result-mark ${row.success?'win':'fail'}">${row.success?'✓':'✕'}</span><span class="ranking-name${row.is_mine?' mine':''}">${escapeHtml(row.player_name||'Anonyme')}${row.played_by_creator?' *':''}</span></span><span class="solo-ranking-config ranking-gems">${gems}</span><span class="solo-ranking-score"><span class="ranking-points">${row.cost} pts</span><span class="ranking-date">${new Date(row.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})}</span></span></div>${expanded?`<div class="ranking-row-detail">Grille <b>${escapeHtml(row.grid_id)}</b> · ${row.ray_count} 🔦 + ${row.coord_count} 📍 · ${formatDuration(row.time_ms)}</div><div class="controls ranking-compact-actions"><button class="solo-copy-summary ghost" data-solo-index="${i}">📋 Résumé</button><button class="solo-copy-id ghost" data-solo-index="${i}">📋 ID</button><button class="solo-grid-ranking primary" data-solo-index="${i}">🏆 Grille</button></div>`:''}</div>`;
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

function renderRankingList(){
  const key = $('#rankingConfigSelect').value || '';
  if(key.startsWith('GLOBAL_SOLO:')){
    renderGlobalSoloScores(key.slice(12));
    return;
  }
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
$('#btnStatsGlobal').addEventListener('click', openGlobalStats);
$('#closeGlobalStats').addEventListener('click', ()=> $('#globalStatsModal').classList.remove('open'));
$('#globalStatsModal').addEventListener('click', e=>{ if(e.target.id==='globalStatsModal') $('#globalStatsModal').classList.remove('open'); });
$('#statsModeDaily').addEventListener('click', ()=>{ globalStatsMode='daily'; renderGlobalStatsView(); });
$('#statsModeAll').addEventListener('click', ()=>{ globalStatsMode='all'; renderGlobalStatsView(); });
$('#globalStatsDateSelect').addEventListener('change', ()=> renderGlobalStatsView());
$('#rankingsFab').addEventListener('click', ()=>{
  setRankingView(state.isDaily ? 'global' : 'solo');
  $('#rankingsModal').classList.add('open');
});
$('#closeRankings').addEventListener('click', ()=> $('#rankingsModal').classList.remove('open'));
$('#rankingsModal').addEventListener('click', e=>{ if(e.target.id==='rankingsModal') $('#rankingsModal').classList.remove('open'); });
$('#rankingConfigSelect').addEventListener('change', ()=>{
  const value=$('#rankingConfigSelect').value;
  if(value.startsWith('GLOBAL:')) $('#rankingDatePicker').value=value.slice(7);
  renderRankingList();
});
$('#rankingDatePicker').addEventListener('change',()=>{
  const dateKey=$('#rankingDatePicker').value;
  if(!dateKey) return;
  const select=$('#rankingConfigSelect'),value=`GLOBAL:${dateKey}`;
  let option=[...select.options].find(item=>item.value===value);
  if(!option){
    option=document.createElement('option');
    option.value=value;
    option.textContent=shortFrenchDate(dateKey);
    select.prepend(option);
  }
  select.value=value;
  renderRankingList();
});
$('#btnResetRanking').addEventListener('click', ()=>{
  const key = $('#rankingConfigSelect').value;
  if(key.startsWith('DAILY:') || key.startsWith('GLOBAL:')) return;
  if(!confirm(`Réinitialiser le classement « ${key} » ? Cette action est irréversible.`)) return;
  const rankings = loadRankings(); rankings[key]=[]; saveRankings(rankings); renderRankingList();
});

$('#accountFab').addEventListener('click',openAccountModal);
$('#closeAccount').addEventListener('click',()=>$('#accountModal').classList.remove('open'));
$('#accountModal').addEventListener('click',e=>{if(e.target.id==='accountModal')$('#accountModal').classList.remove('open');});
$('#cancelScoreIdentity').addEventListener('click',()=>closeScoreIdentity(null));
$('#scoreIdentityModal').addEventListener('click',e=>{if(e.target.id==='scoreIdentityModal')closeScoreIdentity(null);});

window.addEventListener('resize', ()=>{ renderBgGrid(); renderPieces(); renderTraces(); });
document.addEventListener('dblclick',event=>event.preventDefault(),{passive:false});

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
function init(){
  updateAccountFab();
  validateSavedAccount();
  buildMixBoard();
  const restored = loadState();
  if(!restored){ state.pieces = freshPieceSet(); }
  $('#optGray').checked = state.includeGray;
  $('#optOnyx').checked = state.includeOnyx;
  $('#optSapphire').checked = state.includeSapphire;
  computeCellSize();
  renderAll();
  const hasActiveGame = state.mode==='solo' || state.started || state.history.length>0;
  if(!hasActiveGame) showHome();
}
init();
