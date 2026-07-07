// =====================================================================
// ORAPA MINE — Console du maître du jeu (v2 : grille 10x8, vraies formes)
// =====================================================================
// Chaque gemme est un polygone réel (triangle, trapèze, losange, rectangle),
// pas juste une case. Le rayon est simulé en géométrie continue : il avance
// en ligne droite et rebondit sur la première arête de pièce rencontrée.
//  - Arête droite (horizontale/verticale)  -> renvoie en sens inverse.
//  - Arête oblique (45°)                   -> dévie à angle droit.
//  - Rectangle noir (corps noir)           -> arrête le rayon dès contact.
//  - Triangle transparent                  -> dévie sans jamais colorer.
// =====================================================================

const COLS = 10, ROWS = 8;
const TOP_LABELS    = Array.from({length:COLS}, (_,i)=> String(i+1));               // 1..10
const BOTTOM_LABELS = Array.from({length:COLS}, (_,i)=> String.fromCharCode(73+i)); // I..R
const LEFT_LABELS   = Array.from({length:ROWS}, (_,i)=> String.fromCharCode(65+i)); // A..H
const RIGHT_LABELS  = Array.from({length:ROWS}, (_,i)=> String(11+i));              // 11..18

// Formes de base, sommets en coordonnées LOCALES relatives au centre (unité = 1 case).
function trianglePts(size){ const h=size/2; return [[-h,-h],[h,-h],[h,h]]; }
const SHAPES = {
  onyx:    { pts: [[-1,-0.5],[1,-0.5],[1,0.5],[-1,0.5]] },                 // rectangle 2x1
  red:     { pts: [[-1.5,0.5],[-0.5,-0.5],[1.5,-0.5],[0.5,0.5]] },         // trapèze/parallélogramme
  yellow:  { pts: trianglePts(2) },
  blue:    { pts: trianglePts(3) },
  white:   { pts: trianglePts(3) },
  rhombus: { pts: [[0,-1],[1,0],[0,1],[-1,0]] },                          // losange 2x2
  gray:    { pts: trianglePts(1) }
};

const CONFIG = {
  PIECES: {
    red:     { label:'Trapèze rouge',    hex:'#d1293d', colorKey:'red' },
    yellow:  { label:'Triangle jaune',   hex:'#e0a72e', colorKey:'yellow' },
    blue:    { label:'Triangle bleu',    hex:'#2f6fd1', colorKey:'blue' },
    white:   { label:'Triangle blanc',   hex:'#f5f1e8', colorKey:'white' },
    rhombus: { label:'Losange blanc',    hex:'#f5f1e8', colorKey:'white' },
    gray:    { label:'Triangle transparent', hex:'#cfd8dc', colorKey:null, isDiamond:true },
    onyx:    { label:'Rectangle noir',   hex:'#100c08', colorKey:null, isOnyx:true }
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
  NONE:     { name:'Transparent', hex:'#6b6355' },
  ABSORBED: { name:'Absorbé — Rectangle noir', hex:'#100c08' }
};

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let state = {
  started:false,
  includeGray:true,
  includeOnyx:true,
  pieces:[],      // {id,type,center:{x,y}|null,rotation,flipped}
  history:[],
  labelColor:{ top:{}, bottom:{}, left:{}, right:{} },
  traces:[],
  emptyMarks:[]   // [{x,y}] centres de cases vides interrogées
};
let pieceIdSeq = 1;

function allTypes(){
  const t = ['red','yellow','blue','white','rhombus'];
  if(state.includeGray) t.push('gray');
  if(state.includeOnyx) t.push('onyx');
  return t;
}
function freshPieceSet(){ return allTypes().map(t=> newPiece(t)); }
function newPiece(type){ return { id:'p'+(pieceIdSeq++), type, center:null, rotation:0, flipped:false }; }

function saveState(){ try{ localStorage.setItem('orapaMineStateV2', JSON.stringify(state)); }catch(e){} }
function loadState(){
  try{
    const raw = localStorage.getItem('orapaMineStateV2');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.pieces)) return false;
    state = s;
    pieceIdSeq = 1 + state.pieces.reduce((m,p)=>Math.max(m, parseInt((p.id||'p0').slice(1))||0), 0);
    return true;
  }catch(e){ return false; }
}
function resetAll(){
  const g = state.includeGray, o = state.includeOnyx;
  state = { started:false, includeGray:g, includeOnyx:o, pieces:[], history:[],
            labelColor:{top:{},bottom:{},left:{},right:{}}, traces:[], emptyMarks:[] };
  state.pieces = freshPieceSet();
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------
// GEOMETRY
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
function boundingHalfExtents(piece){
  const shape = SHAPES[piece.type];
  const pts = shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  return { hw:(Math.max(...xs)-Math.min(...xs))/2, hh:(Math.max(...ys)-Math.min(...ys))/2 };
}
function snapCoord(raw, halfExtent){
  const frac = ((halfExtent % 1) + 1) % 1; // 0 ou 0.5
  return Math.round(raw - frac) + frac;
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
function pieceAtCell(row,col){
  const pt = {x:col+0.5, y:row+0.5};
  return state.pieces.find(p=> p.center && pointInPolygon(pt, pieceVertices(p)));
}

const EPS = 1e-6;
function intersectRaySegment(pos, dir, A, B){
  if(dir.dx !== 0){
    if(Math.abs(A.y-B.y) < EPS) return null;
    const s = (pos.y - A.y) / (B.y - A.y);
    if(s < -EPS || s > 1+EPS) return null;
    const x = A.x + s*(B.x-A.x);
    const t = (x - pos.x) / dir.dx;
    if(t <= EPS) return null;
    return { t, point:{x, y:pos.y} };
  } else {
    if(Math.abs(A.x-B.x) < EPS) return null;
    const s = (pos.x - A.x) / (B.x - A.x);
    if(s < -EPS || s > 1+EPS) return null;
    const y = A.y + s*(B.y-A.y);
    const t = (y - pos.y) / dir.dy;
    if(t <= EPS) return null;
    return { t, point:{x:pos.x, y} };
  }
}
function edgeKind(A,B){
  if(Math.abs(A.x-B.x) < EPS || Math.abs(A.y-B.y) < EPS) return 'wall';
  const slope = (B.y-A.y)/(B.x-A.x);
  return slope > 0 ? 'back' : 'fwd'; // 'back' ~ "\", 'fwd' ~ "/"
}
function reflect(dir, kind){
  const {dx,dy} = dir;
  if(kind==='back'){ // "\"
    if(dx=== 1) return {dx:0,dy:1};
    if(dx===-1) return {dx:0,dy:-1};
    if(dy===-1) return {dx:-1,dy:0};
    if(dy=== 1) return {dx:1,dy:0};
  } else { // "/"
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
  const key = colorKeyOf(set);
  return CONFIG.MIX[key] || CONFIG.NONE;
}

function simulateBeam(side,index){
  let pos, dir;
  if(side==='top'){ pos={x:index+0.5,y:0}; dir={dx:0,dy:1}; }
  else if(side==='bottom'){ pos={x:index+0.5,y:ROWS}; dir={dx:0,dy:-1}; }
  else if(side==='left'){ pos={x:0,y:index+0.5}; dir={dx:1,dy:0}; }
  else { pos={x:COLS,y:index+0.5}; dir={dx:-1,dy:0}; }

  const placed = state.pieces.filter(p=>p.center);
  const colorsHit = new Set();
  const points = [pos];
  let guard=0, absorbed=false, exitSide=null, exitIndex=null;

  while(true){
    guard++;
    if(guard>400){ absorbed='loop'; break; }
    let best = { ...intersectBoundary(pos,dir), kind:'boundary' };
    for(const piece of placed){
      for(const [A,B] of pieceEdges(piece)){
        const hit = intersectRaySegment(pos,dir,A,B);
        if(hit && hit.t < best.t - EPS){
          best = { t:hit.t, point:hit.point, kind:'edge', piece, edgeType:edgeKind(A,B) };
        }
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
    dir = best.edgeType==='wall' ? {dx:-dir.dx,dy:-dir.dy} : reflect(dir, best.edgeType);
    pos = { x: best.point.x + dir.dx*1e-4, y: best.point.y + dir.dy*1e-4 };
  }
  const color = absorbed==='loop' ? {name:'Boucle infinie détectée',hex:'#c1503f'} : (absorbed ? CONFIG.ABSORBED : resolveColor(colorsHit));
  return { exitSide, exitIndex, absorbed, color, points };
}

function labelText(side,index){
  if(side==='top') return TOP_LABELS[index];
  if(side==='bottom') return BOTTOM_LABELS[index];
  if(side==='left') return LEFT_LABELS[index];
  return RIGHT_LABELS[index];
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
  let cs = Math.floor((available - 2*40) / COLS);
  cs = Math.max(30, Math.min(cs, 46));
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
  div.className='label'+(state.started?' clickable':'');
  div.textContent = labelText(side,index);
  const stored = state.labelColor[side][index];
  if(stored){ div.classList.add('used'); div.style.color=stored; div.style.textShadow='0 0 8px '+stored+'99'; }
  if(state.started) div.addEventListener('click', ()=> onLabelClick(side,index));
  return div;
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
      cell.style.border='1px solid rgba(91,70,48,.35)';
      cell.dataset.row=r; cell.dataset.col=c;
      if(state.started) cell.addEventListener('click', ()=> onCellClick(r,c,cell));
      frag.appendChild(cell);
    }
  }
  bg.appendChild(frag);
}

function polyPointsAttr(verts){ return verts.map(v=> v.x+','+v.y).join(' '); }

function svgPolyForPiece(piece, opts){
  opts = opts || {};
  const def = CONFIG.PIECES[piece.type];
  const verts = opts.overrideVerts || pieceVertices(piece);
  const poly = document.createElementNS(SVGNS,'polygon');
  poly.setAttribute('points', polyPointsAttr(verts));
  poly.setAttribute('fill', def.isDiamond ? 'rgba(207,216,220,0.45)' : def.hex);
  poly.setAttribute('stroke', def.isOnyx ? '#3a2f22' : 'rgba(0,0,0,.4)');
  poly.setAttribute('stroke-width', 0.045);
  poly.setAttribute('vector-effect','non-scaling-stroke');
  poly.setAttribute('class','piece-poly'+(state.started?' locked':''));
  poly.dataset.id = piece.id;
  return poly;
}

function renderPieces(){
  pieceSvg.innerHTML='';
  state.pieces.filter(p=>p.center).forEach(piece=>{
    const el = svgPolyForPiece(piece);
    pieceSvg.appendChild(el);
    if(!state.started) attachPieceInteraction(el, piece);
  });
}

function renderPalette(){
  paletteEl.innerHTML='';
  const inPalette = state.pieces.filter(p=>!p.center);
  paletteEl.classList.toggle('empty', inPalette.length===0);
  const hideSetup = state.started;
  $('#paletteTitle').style.display = hideSetup?'none':'';
  paletteEl.style.display = hideSetup?'none':'flex';
  $('#setupOptions').style.display = hideSetup?'none':'flex';
  $('#setupHint').style.display = hideSetup?'none':'block';
  if(hideSetup) return;
  inPalette.forEach(piece=>{
    const shape = SHAPES[piece.type];
    const pts = shape.pts.map(v=> transformVertex(v,false,0,{x:0,y:0}));
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const pad=0.25;
    const svg = document.createElementNS(SVGNS,'svg');
    svg.setAttribute('viewBox', `${minX-pad} ${minY-pad} ${(maxX-minX)+2*pad} ${(maxY-minY)+2*pad}`);
    svg.classList.add('palette-tile');
    const def = CONFIG.PIECES[piece.type];
    const poly = document.createElementNS(SVGNS,'polygon');
    poly.setAttribute('points', polyPointsAttr(pts));
    poly.setAttribute('fill', def.isDiamond ? 'rgba(207,216,220,0.45)' : def.hex);
    poly.setAttribute('stroke', def.isOnyx ? '#3a2f22' : 'rgba(0,0,0,.4)');
    poly.setAttribute('stroke-width', 0.05);
    poly.setAttribute('vector-effect','non-scaling-stroke');
    svg.appendChild(poly);
    svg.dataset.id = piece.id;
    paletteEl.appendChild(svg);
    attachPieceInteraction(svg, piece, true);
  });
}

function renderTraces(){
  traceSvg.innerHTML = state.traces.map(t=>{
    const d = t.points.map((p,i)=> (i===0?'M':'L')+p.x+','+p.y).join(' ');
    return `<path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.09" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" vector-effect="non-scaling-stroke"/>`;
  }).join('') + state.emptyMarks.map(m=>{
    const s=0.12;
    return `<g stroke="rgba(239,230,214,0.4)" stroke-width="0.035" vector-effect="non-scaling-stroke">
      <line x1="${m.x-s}" y1="${m.y-s}" x2="${m.x+s}" y2="${m.y+s}"/>
      <line x1="${m.x-s}" y1="${m.y+s}" x2="${m.x+s}" y2="${m.y-s}"/>
    </g>`;
  }).join('');
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
  pill.classList.toggle('live', state.started);
  pill.querySelector('span:last-child').textContent = state.started?'Partie en cours':'Placement des gemmes';
  $('#btnStart').disabled = state.started;
}
function renderAll(){
  renderModePill();
  renderLabels();
  renderBgGrid();
  renderPalette();
  renderPieces();
  renderTraces();
  renderHistory();
}

function shapeIconSVG(type, size){
  size = size||22;
  const shape = SHAPES[type];
  const pts = shape.pts.map(v=> transformVertex(v,false,0,{x:0,y:0}));
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const pad=0.2;
  const def = CONFIG.PIECES[type];
  const fill = def.isDiamond ? 'rgba(207,216,220,0.6)' : def.hex;
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
    </div>`;
}

// ---------------------------------------------------------------------
// INTERACTIONS — rotate / flip / drag
// ---------------------------------------------------------------------
function attachPieceInteraction(el, piece, fromPalette){
  el.addEventListener('pointerdown', ev=> onPieceDown(ev, piece, el, fromPalette));
}

function onPieceDown(ev, piece, el, fromPalette){
  if(state.started) return;
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
      saveState();
      el.classList.add('flip-pulse');
      setTimeout(()=>el.classList.remove('flip-pulse'),350);
      renderPalette(); renderPieces();
      if(navigator.vibrate) navigator.vibrate(15);
    }
  }, 480);

  function startDrag(){
    dragging = true;
    el.classList.add('dragging');
    ghost = document.createElement('div');
    ghost.style.position='fixed'; ghost.style.zIndex=999; ghost.style.pointerEvents='none';
    const size = cs()*3.4;
    ghost.style.width = size+'px'; ghost.style.height = size+'px';
    const shape = SHAPES[piece.type];
    const pts = shape.pts.map(v=> transformVertex(v, piece.flipped, piece.rotation, {x:0,y:0}));
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const pad=0.3;
    const def = CONFIG.PIECES[piece.type];
    ghost.innerHTML = `<svg viewBox="${minX-pad} ${minY-pad} ${(maxX-minX)+2*pad} ${(maxY-minY)+2*pad}" width="100%" height="100%">
      <polygon points="${polyPointsAttr(pts)}" fill="${def.isDiamond?'rgba(207,216,220,0.5)':def.hex}" stroke="rgba(0,0,0,.4)" stroke-width="0.06"/>
    </svg>`;
    document.body.appendChild(ghost);
    positionGhost(ev.clientX, ev.clientY);
  }
  function positionGhost(x,y){
    const s = parseFloat(ghost.style.width);
    ghost.style.left = (x - s/2)+'px';
    ghost.style.top = (y - s/2)+'px';
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
      let cx = snapCoord(rawX, hw), cy = snapCoord(rawY, hh);
      cx = Math.min(COLS-hw, Math.max(hw, cx));
      cy = Math.min(ROWS-hh, Math.max(hh, cy));
      const withinBoard = e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom;
      piece.center = withinBoard ? {x:cx,y:cy} : null;
      ghost.remove();
      el.classList.remove('dragging');
      saveState();
      renderPalette();
      renderPieces();
    } else if(!longPressed){
      piece.rotation = (piece.rotation + 90) % 360;
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
  renderLabels(); renderHistory(); renderTraces();
}

function onCellClick(r,c,cellEl){
  const piece = pieceAtCell(r,c);
  const coord = LEFT_LABELS[r] + (c+1);
  let text, hex;
  if(piece){
    const def = CONFIG.PIECES[piece.type];
    text = `<b>${coord}</b> — Gemme présente (${def.label})`;
    hex = def.hex;
  } else {
    text = `<b>${coord}</b> — Case vide`;
    hex = '#6b6355';
    state.emptyMarks.push({x:c+0.5, y:r+0.5});
  }
  state.history.push({ text, hex, time: timeNow() });
  saveState();
  renderHistory();
  renderTraces();
  cellEl.classList.remove('queried'); void cellEl.offsetWidth; cellEl.classList.add('queried');
}

// ---------------------------------------------------------------------
// TOP LEVEL EVENTS
// ---------------------------------------------------------------------
$('#btnStart').addEventListener('click', ()=>{ if(state.started) return; state.started=true; saveState(); renderAll(); });
$('#btnReset').addEventListener('click', ()=>{
  if(!confirm("Recommencer efface le placement des gemmes et tout l'historique. Continuer ?")) return;
  resetAll();
});
$('#optGray').addEventListener('change', e=> syncOptionalPiece('gray', e.target.checked, 'includeGray'));
$('#optOnyx').addEventListener('change', e=> syncOptionalPiece('onyx', e.target.checked, 'includeOnyx'));
function syncOptionalPiece(type, include, flagName){
  state[flagName] = include;
  const existing = state.pieces.filter(p=>p.type===type);
  if(include && existing.length===0) state.pieces.push(newPiece(type));
  else if(!include) state.pieces = state.pieces.filter(p=>p.type!==type);
  saveState(); renderPalette(); renderPieces();
}
$('#helpFab').addEventListener('click', ()=> $('#helpModal').classList.add('open'));
$('#closeHelp').addEventListener('click', ()=> $('#helpModal').classList.remove('open'));
$('#helpModal').addEventListener('click', e=>{ if(e.target.id==='helpModal') $('#helpModal').classList.remove('open'); });
$('#btnCopyHistory').addEventListener('click', ()=>{
  const lines = state.history.map(h=> h.text.replace(/<\/?b>/g,''));
  const txt = lines.join('\n') || 'Aucun historique.';
  if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>{
    const btn=$('#btnCopyHistory'); const old=btn.textContent;
    btn.textContent='Copié !'; setTimeout(()=>btn.textContent=old,1200);
  });
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
  computeCellSize();
  renderAll();
}
init();
