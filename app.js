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
  gray:    { pts: isocelesPts(2,1) }                                 // base 2, hauteur 1
};

const CONFIG = {
  PIECES: {
    red:     { label:'Trapèze rouge',  hex:'#d1293d', colorKey:'red' },
    yellow:  { label:'Triangle jaune', hex:'#e0a72e', colorKey:'yellow' },
    blue:    { label:'Triangle bleu',  hex:'#2f6fd1', colorKey:'blue' },
    white:   { label:'Triangle blanc', hex:'#f5f1e8', colorKey:'white' },
    rhombus: { label:'Losange blanc',  hex:'#f5f1e8', colorKey:'white' },
    gray:    { label:'Diamant',        hex:'#cfd8dc', colorKey:null, isDiamond:true },
    onyx:    { label:'Corps noir',     hex:'#0d0b08', colorKey:null, isOnyx:true }
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
  started:false,
  includeGray:true,
  includeOnyx:true,
  pieces:[],
  history:[],
  labelColor:{ top:{}, bottom:{}, left:{}, right:{} },
  labelBounce:{ top:{}, bottom:{}, left:{}, right:{} },
  cellUsed:{},
  traces:[],
  emptyMarks:[],
  occupiedMarks:[]
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

function saveState(){ try{ localStorage.setItem('orapaMineStateV3', JSON.stringify(state)); }catch(e){} }
function loadState(){
  try{
    const raw = localStorage.getItem('orapaMineStateV3');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.pieces)) return false;
    state = s;
    state.labelBounce = state.labelBounce || {top:{},bottom:{},left:{},right:{}};
    state.cellUsed = state.cellUsed || {};
    state.occupiedMarks = state.occupiedMarks || [];
    pieceIdSeq = 1 + state.pieces.reduce((m,p)=>Math.max(m, parseInt((p.id||'p0').slice(1))||0), 0);
    return true;
  }catch(e){ return false; }
}
function resetAll(){
  const g = state.includeGray, o = state.includeOnyx;
  state = { started:false, includeGray:g, includeOnyx:o, pieces:[], history:[],
            labelColor:{top:{},bottom:{},left:{},right:{}}, labelBounce:{top:{},bottom:{},left:{},right:{}},
            cellUsed:{}, traces:[], emptyMarks:[], occupiedMarks:[] };
  state.pieces = freshPieceSet();
  saveState();
  renderAll();
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
function resnapAfterTransform(piece){
  if(!piece.center) return;
  const {hw,hh} = boundingHalfExtents(piece);
  let cx = snapCoord(piece.center.x, hw), cy = snapCoord(piece.center.y, hh);
  cx = Math.min(COLS-hw, Math.max(hw, cx));
  cy = Math.min(ROWS-hh, Math.max(hh, cy));
  piece.center = {x:cx, y:cy};
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
function placementValid(candidate, excludeId){
  const {hw,hh} = boundingHalfExtents(candidate);
  if(candidate.center.x-hw < -1e-6 || candidate.center.x+hw > COLS+1e-6) return false;
  if(candidate.center.y-hh < -1e-6 || candidate.center.y+hh > ROWS+1e-6) return false;
  const polyA = pieceVertices(candidate);
  for(const other of state.pieces){
    if(!other.center || other.id===excludeId) continue;
    if(touchesBySide(polyA, pieceVertices(other))) return false;
  }
  return true;
}

// Chaque gemme posée doit pouvoir être touchée par au moins un rayon SANS rebond
// (un tir direct depuis un bord qui l'atteint avant toute autre pièce).
function firstHitPieceId(side, index){
  let pos, dir;
  if(side==='top'){ pos={x:index+0.5,y:0}; dir={dx:0,dy:1}; }
  else if(side==='bottom'){ pos={x:index+0.5,y:ROWS}; dir={dx:0,dy:-1}; }
  else if(side==='left'){ pos={x:0,y:index+0.5}; dir={dx:1,dy:0}; }
  else { pos={x:COLS,y:index+0.5}; dir={dx:-1,dy:0}; }
  let best = { ...intersectBoundary(pos,dir), kind:'boundary' };
  for(const piece of state.pieces){
    if(!piece.center) continue;
    for(const [A,B] of pieceEdges(piece)){
      const hit = intersectRaySegment(pos,dir,A,B);
      if(hit && hit.t < best.t - EPS) best = { t:hit.t, kind:'edge', pieceId:piece.id };
    }
  }
  return best.kind==='edge' ? best.pieceId : null;
}
function unreachablePieces(){
  const reached = new Set();
  for(let i=0;i<COLS;i++){
    let id=firstHitPieceId('top',i); if(id) reached.add(id);
    id=firstHitPieceId('bottom',i); if(id) reached.add(id);
  }
  for(let i=0;i<ROWS;i++){
    let id=firstHitPieceId('left',i); if(id) reached.add(id);
    id=firstHitPieceId('right',i); if(id) reached.add(id);
  }
  return state.pieces.filter(p=>p.center && !reached.has(p.id));
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
  let skipPieceId=null, skipEdgeIdx=null;

  while(true){
    guard++;
    if(guard>400){ absorbed='loop'; break; }
    let best = { ...intersectBoundary(pos,dir), kind:'boundary' };
    for(const piece of placed){
      const edges = pieceEdges(piece);
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
  div.className='label'+(state.started && !used ? ' clickable':'');
  div.textContent = labelText(side,index);
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
  if(state.started && !used) div.addEventListener('click', ()=> onLabelClick(side,index));
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
      cell.style.border='1px solid rgba(0,0,0,.18)';
      cell.dataset.row=r; cell.dataset.col=c;
      const used = state.cellUsed[r+','+c];
      if(state.started && !used) cell.addEventListener('click', ()=> onCellClick(r,c,cell));
      frag.appendChild(cell);
    }
  }
  bg.appendChild(frag);
}

function polyPointsAttr(verts){ return verts.map(v=> v.x+','+v.y).join(' '); }

function svgPolyForPiece(piece){
  const def = CONFIG.PIECES[piece.type];
  const verts = pieceVertices(piece);
  const poly = document.createElementNS(SVGNS,'polygon');
  poly.setAttribute('points', polyPointsAttr(verts));
  poly.setAttribute('fill', def.isDiamond ? 'rgba(207,216,220,0.55)' : def.hex);
  poly.setAttribute('stroke', def.isOnyx ? '#cfd8dc' : 'rgba(0,0,0,.4)');
  poly.setAttribute('stroke-width', def.isOnyx ? 0.03 : 0.045);
  poly.setAttribute('vector-effect','non-scaling-stroke');
  poly.setAttribute('class','piece-poly'+(state.started?'':' interactive'));
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
  const cs = computeCellSize();
  inPalette.forEach(piece=>{
    const shape = SHAPES[piece.type];
    const pts = shape.pts.map(v=> transformVertex(v,false,0,{x:0,y:0}));
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY, pad=0.15;
    const svg = document.createElementNS(SVGNS,'svg');
    svg.setAttribute('viewBox', `${minX-pad} ${minY-pad} ${w+2*pad} ${h+2*pad}`);
    svg.style.width = ((w+2*pad)*cs)+'px';
    svg.style.height = ((h+2*pad)*cs)+'px';
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

function lighten(hex, amt){
  const [r,g,b] = hexToRgb(hex);
  const mix = c => Math.round(c + (255-c)*amt);
  return 'rgb('+mix(r)+','+mix(g)+','+mix(b)+')';
}
function renderTraces(){
  let html = state.traces.map(t=>{
    const d = t.points.map((p,i)=> (i===0?'M':'L')+p.x+','+p.y).join(' ');
    const core = lighten(t.hex, 0.55);
    return `<path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.4" stroke-linejoin="round" stroke-linecap="round" opacity="0.35" vector-effect="non-scaling-stroke"/>
            <path d="${d}" fill="none" stroke="${t.hex}" stroke-width="0.18" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" vector-effect="non-scaling-stroke"/>
            <path d="${d}" fill="none" stroke="${core}" stroke-width="0.06" stroke-linejoin="round" stroke-linecap="round" opacity="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  html += state.emptyMarks.map(m=>{
    const s=0.14;
    return `<g stroke="rgba(20,16,12,0.55)" stroke-width="0.045" vector-effect="non-scaling-stroke">
      <line x1="${m.x-s}" y1="${m.y-s}" x2="${m.x+s}" y2="${m.y+s}"/>
      <line x1="${m.x-s}" y1="${m.y+s}" x2="${m.x+s}" y2="${m.y-s}"/>
    </g>`;
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
    </div>`;
}

// ---------------------------------------------------------------------
// INTERACTIONS — tap = pivoter, appui long = miroir, glisser = déplacer
// ---------------------------------------------------------------------
function attachPieceInteraction(el, piece){
  el.addEventListener('pointerdown', ev=> onPieceDown(ev, piece, el));
}
function flashInvalid(el){
  el.classList.add('invalid-pulse');
  setTimeout(()=> el.classList.remove('invalid-pulse'), 400);
  if(navigator.vibrate) navigator.vibrate([10,30,10]);
}
function snapshotOf(piece){ return { center: piece.center? {...piece.center} : null, rotation: piece.rotation, flipped: piece.flipped }; }
function restoreSnapshot(piece, snap){ piece.center = snap.center; piece.rotation = snap.rotation; piece.flipped = snap.flipped; }
function isFullyValid(piece){
  if(!piece.center) return true;
  return placementValid(piece, piece.id) && unreachablePieces().length===0;
}

function onPieceDown(ev, piece, el){
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
      const snap = snapshotOf(piece);
      piece.flipped = !piece.flipped;
      resnapAfterTransform(piece);
      if(!isFullyValid(piece)){
        restoreSnapshot(piece, snap);
        flashInvalid(el);
      } else {
        saveState();
        el.classList.add('flip-pulse');
        setTimeout(()=>el.classList.remove('flip-pulse'),350);
        if(navigator.vibrate) navigator.vibrate(15);
      }
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
      let cx = snapCoord(rawX, hw), cy = snapCoord(rawY, hh);
      cx = Math.min(COLS-hw, Math.max(hw, cx));
      cy = Math.min(ROWS-hh, Math.max(hh, cy));
      const withinBoard = e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom;
      const snap = snapshotOf(piece);
      piece.center = withinBoard ? {x:cx,y:cy} : null;
      if(!isFullyValid(piece)){
        restoreSnapshot(piece, snap);
        flashInvalid(el);
      }
      ghost.remove();
      el.classList.remove('dragging');
      saveState();
      renderPalette();
      renderPieces();
    } else if(!longPressed){
      const snap = snapshotOf(piece);
      piece.rotation = (piece.rotation + 90) % 360;
      resnapAfterTransform(piece);
      if(!isFullyValid(piece)){
        restoreSnapshot(piece, snap);
        flashInvalid(el);
      } else {
        saveState();
      }
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
  const result = simulateBeam(side,index);
  state.labelColor[side][index] = result.color.hex;
  let text;
  if(result.absorbed){
    text = `<b>${labelText(side,index)}</b> — Absorbé`;
  } else {
    const bounced = result.exitSide===side && result.exitIndex===index;
    const exitLabel = labelText(result.exitSide, result.exitIndex);
    if(state.labelColor[result.exitSide][result.exitIndex] === undefined){
      state.labelColor[result.exitSide][result.exitIndex] = result.color.hex;
    }
    if(bounced) state.labelBounce[side][index] = true;
    text = bounced
      ? `<b>${labelText(side,index)}</b> ↔ — ${result.color.name}`
      : `<b>${labelText(side,index)}</b> — <b>${exitLabel}</b> — ${result.color.name}`;
  }
  state.history.push({ text, hex: result.color.hex, time: timeNow() });
  state.traces.push({ points: result.points, hex: result.color.hex });
  saveState();
  renderLabels(); renderHistory(); renderTraces();
}

function gemDisplayName(piece){
  const def = CONFIG.PIECES[piece.type];
  if(def.colorKey) return CONFIG.MIX[def.colorKey].name;
  return def.label;
}
function onCellClick(r,c,cellEl){
  const key = r+','+c;
  if(state.cellUsed[key]) return;
  state.cellUsed[key] = true;
  const piece = pieceAtCell(r,c);
  const coord = LEFT_LABELS[r] + (c+1);
  let text, hex;
  if(piece){
    const def = CONFIG.PIECES[piece.type];
    text = `<b>${coord}</b> — ${gemDisplayName(piece)}`;
    hex = def.hex;
  } else {
    text = `<b>${coord}</b> — Vide`;
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
