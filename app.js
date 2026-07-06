// =====================================================================
// ORAPA MINE — Console du maître du jeu
// =====================================================================
// MODÈLE PHYSIQUE (hypothèse assumée, voir README) :
//  - Chaque gemme occupe 1 case.
//  - Rotation par pas de 45° (8 états : 0,45,90,...,315).
//  - Orientation multiple de 90° (0/90/180/270)  => MUR   : renvoie le rayon
//    en sens inverse (retour par le même point d'entrée).
//  - Orientation impaire de 45°   (45/135/225/315) => MIROIR OBLIQUE : dévie
//    le rayon à angle droit. Le sens de la déviation dépend de la diagonale
//    ("/" ou "\"), déterminée par la rotation ET l'état "miroir" (flip).
//  - Le "retournement miroir" (appui long) inverse la diagonale utilisée à
//    l'orientation courante — pratique pour accéder rapidement à l'autre
//    sens sans faire 2 clics de rotation, en particulier pour la gemme rouge.
// =====================================================================

const CONFIG = {
  SIZE: 18,
  ROW_LABELS: 'ABCDEFGHIJKLMNOPQR'.split(''),
  GEM_DEFS: {
    red:    { label:'Rouge',  hex:'#d1293d' },
    blue:   { label:'Bleu',   hex:'#2f6fd1' },
    yellow: { label:'Jaune',  hex:'#e0a72e' },
    white:  { label:'Blanc',  hex:'#f5f1e8' },
    diamond:{ label:'Diamant',hex:'#cfe8f0', isDiamond:true },
    onyx:   { label:'Corps noir', hex:'#100c08', isOnyx:true }
  },
  BASE_COUNTS: { red:1, blue:1, yellow:1, white:2 },
  EXT_COUNTS: { diamond:1, onyx:1 },
  // Table de mélange des couleurs — reprise du plateau d'aide officiel du jeu.
  // Clé = types de gemmes touchées, triés alphabétiquement, séparés par "+".
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
  NONE: { name:'Incolore (rien touché)', hex:'#6b6355' },
  ABSORBED: { name:'Absorbé — Corps noir', hex:'#100c08' }
};

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let state = {
  started:false,
  includeDiamond:true,
  includeOnyx:true,
  pieces:[],       // {id,type,row,col,rotation,flipped}  row/col null => in palette
  board:null,      // [row][col] -> piece or null (rebuilt from pieces)
  history:[],      // {text, hex, time}
  labelColor:{ top:{}, bottom:{}, left:{}, right:{} }, // index -> hex
  traces:[]        // array of {points:[{x,y}], hex}
};

let pieceIdSeq = 1;

function freshPieceSet(){
  const list = [];
  Object.entries(CONFIG.BASE_COUNTS).forEach(([type,count])=>{
    for(let i=0;i<count;i++) list.push(newPiece(type));
  });
  if(state.includeDiamond) list.push(newPiece('diamond'));
  if(state.includeOnyx) list.push(newPiece('onyx'));
  return list;
}
function newPiece(type){
  return { id:'p'+(pieceIdSeq++), type, row:null, col:null, rotation:0, flipped:false };
}

function rebuildBoard(){
  const b = Array.from({length:CONFIG.SIZE},()=>Array(CONFIG.SIZE).fill(null));
  state.pieces.forEach(p=>{ if(p.row!=null && p.col!=null) b[p.row][p.col] = p; });
  state.board = b;
}

function saveState(){
  try{ localStorage.setItem('orapaMineState', JSON.stringify(state)); }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem('orapaMineState');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.pieces)) return false;
    state = s;
    pieceIdSeq = 1 + state.pieces.reduce((m,p)=>Math.max(m, parseInt((p.id||'p0').slice(1))||0), 0);
    rebuildBoard();
    return true;
  }catch(e){ return false; }
}

function resetAll(keepOptions){
  const inclD = state.includeDiamond, inclO = state.includeOnyx;
  state = {
    started:false,
    includeDiamond: keepOptions? inclD : true,
    includeOnyx: keepOptions? inclO : true,
    pieces:[], board:null, history:[],
    labelColor:{ top:{}, bottom:{}, left:{}, right:{} },
    traces:[]
  };
  state.pieces = freshPieceSet();
  rebuildBoard();
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------
// GEOMETRY HELPERS
// ---------------------------------------------------------------------
function isWallOrientation(rotation){ return (rotation % 90) === 0; }
function diagType(rotation, flipped){
  // base '/' at 45 & 225 ; '\' at 135 & 315
  let base = (rotation === 45 || rotation === 225) ? '/' : '\\';
  if(flipped) base = (base === '/') ? '\\' : '/';
  return base;
}
function reflect(dr,dc,type){
  if(type === '/'){
    if(dc=== 1) return [-1,0];
    if(dc===-1) return [1,0];
    if(dr===-1) return [0,1];
    if(dr=== 1) return [0,-1];
  } else {
    if(dc=== 1) return [1,0];
    if(dc===-1) return [-1,0];
    if(dr===-1) return [0,-1];
    if(dr=== 1) return [0,1];
  }
  return [dr,dc];
}

function colorKey(colorsSet){
  return [...colorsSet].sort().join('+');
}
function resolveColor(colorsSet){
  const key = colorKey(colorsSet);
  if(key === '') return CONFIG.NONE;
  return CONFIG.MIX[key] || { name:'Mélange ('+[...colorsSet].map(c=>CONFIG.GEM_DEFS[c].label).join('+')+')', hex: blendHex([...colorsSet].map(c=>CONFIG.GEM_DEFS[c].hex)) };
}
function blendHex(hexes){
  let r=0,g=0,b=0;
  hexes.forEach(h=>{ const [rr,gg,bb]=hexToRgb(h); r+=rr; g+=gg; b+=bb; });
  const n = hexes.length || 1;
  return rgbToHex(Math.round(r/n),Math.round(g/n),Math.round(b/n));
}
function hexToRgb(hex){
  hex = hex.replace('#','');
  return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
}
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }

// Simulate a beam. side: 'top'|'bottom'|'left'|'right', index: 0..17
function simulateBeam(side, index){
  let r,c,dr,dc;
  if(side==='top'){ r=0; c=index; dr=1; dc=0; }
  else if(side==='bottom'){ r=17; c=index; dr=-1; dc=0; }
  else if(side==='left'){ r=index; c=0; dr=0; dc=1; }
  else { r=index; c=17; dr=0; dc=-1; }

  const colorsHit = new Set();
  const points = [ entryBoundaryPoint(side,index) ];
  let absorbed = false, steps = 0, exitSide=null, exitIndex=null;

  while(true){
    if(r<0||r>=18||c<0||c>=18){
      // exited
      if(c<0){ exitSide='left'; exitIndex=r; }
      else if(c>=18){ exitSide='right'; exitIndex=r; }
      else if(r<0){ exitSide='top'; exitIndex=c; }
      else { exitSide='bottom'; exitIndex=c; }
      points.push(boundaryPointOutside(exitSide, exitIndex));
      break;
    }
    const gem = state.board[r][c];
    if(gem){
      if(gem.type==='onyx'){ absorbed=true; points.push({x:c+0.5,y:r+0.5}); break; }
      if(gem.type!=='diamond') colorsHit.add(gem.type);
      if(isWallOrientation(gem.rotation)){ dr=-dr; dc=-dc; }
      else { const t=diagType(gem.rotation,gem.flipped); [dr,dc]=reflect(dr,dc,t); }
      points.push({x:c+0.5,y:r+0.5});
    }
    r+=dr; c+=dc;
    steps++;
    if(steps>800){ absorbed='loop'; points.push({x:c+0.5,y:r+0.5}); break; }
  }
  const color = absorbed==='loop' ? {name:'Boucle infinie détectée', hex:'#c1503f'} : (absorbed ? CONFIG.ABSORBED : resolveColor(colorsHit));
  return { entrySide:side, entryIndex:index, exitSide, exitIndex, absorbed, color, points };
}

function entryBoundaryPoint(side,index){
  if(side==='top') return {x:index+0.5, y:0};
  if(side==='bottom') return {x:index+0.5, y:18};
  if(side==='left') return {x:0, y:index+0.5};
  return {x:18, y:index+0.5};
}
function boundaryPointOutside(side,index){ return entryBoundaryPoint(side,index); }

function labelText(side,index){
  return (side==='top'||side==='bottom') ? String(index+1) : CONFIG.ROW_LABELS[index];
}

// ---------------------------------------------------------------------
// RENDERING
// ---------------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const boardEl = $('#board');
const piecesLayer = $('#piecesLayer');
const traceLayer = $('#traceLayer');
const paletteEl = $('#palette');

function computeCellSize(){
  const frame = $('#boardFrame');
  const available = Math.min(window.innerWidth - 24, 680);
  let cs = Math.floor((available - 48) / 18);
  cs = Math.max(26, Math.min(cs, 34));
  document.documentElement.style.setProperty('--cs', cs+'px');
  return cs;
}

function renderLabels(){
  const top = $('#labelsTop'), bottom = $('#labelsBottom'), left = $('#labelsLeft'), right = $('#labelsRight');
  [top,bottom,left,right].forEach(el=>el.innerHTML='');
  for(let i=0;i<18;i++){
    top.appendChild(makeLabel('top',i));
    bottom.appendChild(makeLabel('bottom',i));
  }
  for(let i=0;i<18;i++){
    left.appendChild(makeLabel('left',i));
    right.appendChild(makeLabel('right',i));
  }
}
function makeLabel(side,index){
  const div = document.createElement('div');
  div.className = 'label' + (state.started ? ' clickable' : '');
  div.textContent = labelText(side,index);
  const stored = state.labelColor[side][index];
  if(stored){
    div.classList.add('used');
    div.style.color = stored;
    div.style.textShadow = '0 0 8px '+stored+'99';
  }
  if(state.started){
    div.addEventListener('click', ()=> onLabelClick(side,index));
  }
  return div;
}

function renderBoardCells(){
  boardEl.querySelectorAll('.cell').forEach(c=>c.remove());
  const frag = document.createDocumentFragment();
  for(let r=0;r<18;r++){
    for(let c=0;c<18;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r; cell.dataset.col = c;
      if(state.started){
        cell.addEventListener('click', ()=> onCellClick(r,c,cell));
      }
      frag.appendChild(cell);
    }
  }
  boardEl.insertBefore(frag, piecesLayer);
}

function gemInnerSVG(piece){
  const def = CONFIG.GEM_DEFS[piece.type];
  const hex = def.hex;
  const rot = piece.rotation;
  const wall = isWallOrientation(rot);
  const opacity = def.isDiamond ? 0.6 : 1;
  let inner = '';
  if(def.isOnyx){
    // Le corps noir absorbe quelle que soit son orientation : rendu fixe.
    inner = `<circle cx="50" cy="50" r="36" fill="#0b0805" stroke="#3a2f22" stroke-width="5"/>
              <circle cx="36" cy="36" r="7" fill="#241c13" opacity=".7"/>`;
  } else if(wall){
    // Mur : une barre pleine, orientée horizontale/verticale selon la rotation.
    inner = `<g transform="rotate(${rot} 50 50)">
                <rect x="6" y="42" width="88" height="16" rx="4" fill="${hex}" opacity="${opacity}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
                <rect x="6" y="42" width="88" height="6" rx="3" fill="rgba(255,255,255,.35)"/>
              </g>`;
  } else {
    // Miroir oblique : la diagonale affichée dépend de la rotation ET du flip,
    // via diagType() — donc le retournement miroir est visuellement réel.
    const type = diagType(rot, piece.flipped);
    const p = (type === '/') ? {x1:14,y1:86,x2:86,y2:14} : {x1:14,y1:14,x2:86,y2:86};
    inner = `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${hex}" stroke-width="15" stroke-linecap="round" opacity="${opacity}"/>
             <line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="rgba(255,255,255,.4)" stroke-width="4" stroke-linecap="round" opacity="${opacity}"/>`;
  }
  return `<svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,.22)"/>
            ${inner}
          </svg>`;
}
function pieceHTML(piece){ return gemInnerSVG(piece); }

function renderPalette(){
  paletteEl.innerHTML='';
  const inPalette = state.pieces.filter(p=>p.row==null);
  paletteEl.classList.toggle('empty', inPalette.length===0 && !state.started);
  if(state.started){
    $('#paletteTitle').style.display='none';
    paletteEl.style.display='none';
    $('#setupOptions').style.display='none';
    $('#setupHint').style.display='none';
  } else {
    $('#paletteTitle').style.display='';
    paletteEl.style.display='flex';
    $('#setupOptions').style.display='flex';
    $('#setupHint').style.display='block';
  }
  inPalette.forEach(p=>{
    const tile = document.createElement('div');
    tile.className='palette-tile';
    tile.innerHTML = pieceHTML(p);
    tile.dataset.id = p.id;
    attachPieceInteraction(tile, p, true);
    paletteEl.appendChild(tile);
  });
}

function renderPieces(){
  piecesLayer.innerHTML='';
  const cs = computeCellSize();
  state.pieces.filter(p=>p.row!=null).forEach(p=>{
    const el = document.createElement('div');
    el.className='piece' + (state.started?' locked':'');
    el.style.width = cs+'px'; el.style.height = cs+'px';
    el.style.left = (p.col*cs)+'px';
    el.style.top = (p.row*cs)+'px';
    el.innerHTML = pieceHTML(p);
    el.dataset.id = p.id;
    if(!state.started) attachPieceInteraction(el, p, false);
    piecesLayer.appendChild(el);
  });
}

function renderTraces(){
  traceLayer.innerHTML = state.traces.map(t=>{
    const d = t.points.map((pt,i)=> (i===0?'M':'L')+pt.x+','+pt.y ).join(' ');
    return `<path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.12" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" style="filter:drop-shadow(0 0 0.15px ${t.hex})"/>`;
  }).join('');
}

function renderHistory(){
  const el = $('#history');
  if(state.history.length===0){
    el.innerHTML = '<div class="history-empty">Démarre la partie puis clique sur une lettre, un chiffre ou une case pour interroger la mine.</div>';
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
  const pill = $('#modePill');
  pill.classList.toggle('live', state.started);
  pill.querySelector('span:last-child').textContent = state.started ? 'Partie en cours' : 'Placement des gemmes';
  $('#btnStart').disabled = state.started;
}

function renderAll(){
  renderModePill();
  renderLabels();
  renderBoardCells();
  renderPalette();
  renderPieces();
  renderTraces();
  renderHistory();
}

function buildLegend(){
  const grid = $('#legendGrid');
  const seen = new Set();
  const entries = Object.values(CONFIG.MIX);
  grid.innerHTML = entries.map(e=>`<div class="legend-item"><span class="legend-swatch" style="background:${e.hex}"></span>${e.name}</div>`).join('')
    + `<div class="legend-item"><span class="legend-swatch" style="background:${CONFIG.NONE.hex}"></span>${CONFIG.NONE.name}</div>`
    + `<div class="legend-item"><span class="legend-swatch" style="background:${CONFIG.ABSORBED.hex}"></span>${CONFIG.ABSORBED.name}</div>`;
}

// ---------------------------------------------------------------------
// INTERACTIONS — rotate / flip / drag (Pointer Events)
// ---------------------------------------------------------------------
function attachPieceInteraction(el, piece, fromPalette){
  el.addEventListener('pointerdown', (ev)=> onPieceDown(ev, piece, el, fromPalette));
}

function onPieceDown(ev, piece, el, fromPalette){
  if(state.started) return;
  ev.preventDefault();
  const startX=ev.clientX, startY=ev.clientY;
  let moved=false, longPressed=false, dragging=false;
  let ghost=null, cs=computeCellSize();
  const boardRect = ()=> boardEl.getBoundingClientRect();

  const longPressTimer = setTimeout(()=>{
    if(!moved){
      longPressed = true;
      piece.flipped = !piece.flipped;
      saveState();
      el.classList.add('flip-flash');
      el.innerHTML = pieceHTML(piece);
      setTimeout(()=>el.classList.remove('flip-flash'),350);
      if(navigator.vibrate) navigator.vibrate(15);
    }
  }, 480);

  function startDrag(){
    dragging = true;
    cs = computeCellSize();
    ghost = document.createElement('div');
    ghost.className = 'piece dragging';
    ghost.style.width = cs+'px'; ghost.style.height = cs+'px';
    ghost.innerHTML = pieceHTML(piece);
    ghost.style.position='fixed';
    ghost.style.zIndex=999;
    document.body.appendChild(ghost);
    el.style.opacity='0.25';
    positionGhost(ev.clientX, ev.clientY);
    highlightTarget(ev.clientX, ev.clientY);
  }
  function positionGhost(x,y){
    ghost.style.left = (x - cs/2)+'px';
    ghost.style.top = (y - cs/2)+'px';
  }
  function highlightTarget(x,y){
    boardEl.querySelectorAll('.cell.hover-target').forEach(c=>c.classList.remove('hover-target'));
    const rect = boardRect();
    if(x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom){
      const col = Math.min(17,Math.max(0,Math.floor((x-rect.left)/cs)));
      const row = Math.min(17,Math.max(0,Math.floor((y-rect.top)/cs)));
      const cell = boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
      if(cell && !(state.board[row][col] && state.board[row][col].id!==piece.id)) cell.classList.add('hover-target');
    }
  }

  function onMove(e){
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(!moved && Math.hypot(dx,dy) > 9){
      moved = true;
      clearTimeout(longPressTimer);
      startDrag();
    }
    if(dragging){ positionGhost(e.clientX,e.clientY); highlightTarget(e.clientX,e.clientY); }
  }

  function onUp(e){
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    clearTimeout(longPressTimer);
    boardEl.querySelectorAll('.cell.hover-target').forEach(c=>c.classList.remove('hover-target'));

    if(dragging){
      const rect = boardRect();
      const x=e.clientX, y=e.clientY;
      if(x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom){
        const col = Math.min(17,Math.max(0,Math.floor((x-rect.left)/cs)));
        const row = Math.min(17,Math.max(0,Math.floor((y-rect.top)/cs)));
        const occupant = state.board[row][col];
        if(!occupant || occupant.id===piece.id){
          piece.row = row; piece.col = col;
        }
      } else {
        piece.row = null; piece.col = null;
      }
      ghost.remove();
      el.style.opacity='';
      rebuildBoard();
      saveState();
      renderPalette();
      renderPieces();
    } else if(!longPressed){
      piece.rotation = (piece.rotation + 45) % 360;
      saveState();
      el.innerHTML = pieceHTML(piece);
    }
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------------------------------------------------------------------
// GAME ACTIONS (post-start)
// ---------------------------------------------------------------------
function timeNow(){
  const d = new Date();
  return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function onLabelClick(side,index){
  const result = simulateBeam(side,index);
  state.labelColor[side][index] = result.color.hex;
  let text;
  if(result.absorbed){
    text = `<b>${labelText(side,index)}</b> → ${result.color.name}`;
  } else {
    const exitLabel = labelText(result.exitSide, result.exitIndex);
    state.labelColor[result.exitSide][result.exitIndex] = result.color.hex;
    text = `<b>${labelText(side,index)}</b> — <b>${exitLabel}</b> — ${result.color.name}`;
  }
  state.history.push({ text, hex: result.color.hex, time: timeNow() });
  state.traces.push({ points: result.points, hex: result.color.hex });
  saveState();
  renderLabels();
  renderHistory();
  renderTraces();
}

function onCellClick(r,c,cellEl){
  const gem = state.board[r][c];
  const coord = CONFIG.ROW_LABELS[r] + (c+1);
  let text, hex;
  if(gem){
    const def = CONFIG.GEM_DEFS[gem.type];
    text = `<b>${coord}</b> — Gemme présente (${def.label})`;
    hex = def.hex;
  } else {
    text = `<b>${coord}</b> — Case vide`;
    hex = '#6b6355';
  }
  state.history.push({ text, hex, time: timeNow() });
  saveState();
  renderHistory();
  cellEl.classList.remove('queried'); void cellEl.offsetWidth; cellEl.classList.add('queried');
}

// ---------------------------------------------------------------------
// TOP LEVEL EVENTS
// ---------------------------------------------------------------------
$('#btnStart').addEventListener('click', ()=>{
  if(state.started) return;
  state.started = true;
  saveState();
  renderAll();
});
$('#btnReset').addEventListener('click', ()=>{
  if(!confirm('Recommencer efface le placement des gemmes et tout l\'historique. Continuer ?')) return;
  resetAll(true);
});
$('#optDiamond').addEventListener('change', (e)=>{
  state.includeDiamond = e.target.checked;
  syncOptionalPiece('diamond', e.target.checked);
});
$('#optOnyx').addEventListener('change', (e)=>{
  state.includeOnyx = e.target.checked;
  syncOptionalPiece('onyx', e.target.checked);
});
function syncOptionalPiece(type, include){
  const existing = state.pieces.filter(p=>p.type===type);
  if(include && existing.length===0){
    state.pieces.push(newPiece(type));
  } else if(!include){
    state.pieces = state.pieces.filter(p=>p.type!==type);
  }
  rebuildBoard();
  saveState();
  renderPalette();
  renderPieces();
}

$('#helpFab').addEventListener('click', ()=> $('#helpModal').classList.add('open'));
$('#closeHelp').addEventListener('click', ()=> $('#helpModal').classList.remove('open'));
$('#helpModal').addEventListener('click', (e)=>{ if(e.target.id==='helpModal') $('#helpModal').classList.remove('open'); });

$('#btnCopyHistory').addEventListener('click', ()=>{
  const lines = state.history.map(h=> h.text.replace(/<\/?b>/g,'') );
  const txt = lines.join('\n') || 'Aucun historique.';
  if(navigator.clipboard){
    navigator.clipboard.writeText(txt).then(()=>{
      const btn = $('#btnCopyHistory'); const old = btn.textContent;
      btn.textContent = 'Copié !'; setTimeout(()=>btn.textContent=old, 1200);
    });
  }
});

window.addEventListener('resize', ()=>{ computeCellSize(); renderPieces(); });

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
function init(){
  buildLegend();
  const restored = loadState();
  if(!restored){
    state.pieces = freshPieceSet();
    rebuildBoard();
  }
  $('#optDiamond').checked = state.includeDiamond;
  $('#optOnyx').checked = state.includeOnyx;
  computeCellSize();
  renderAll();
}
init();
