(function(){
  'use strict';

  const SVG_NS='http://www.w3.org/2000/svg';
  const APP_VERSION=(()=>{try{return new URL(document.currentScript?.src||location.href,location.href).searchParams.get('v')||null;}catch(_error){return null;}})();
  const EDGE=38;
  const TRI_H=Math.sqrt(3)*EDGE/2;
  const STREET_WALL_WIDTH=EDGE*.07;
  const BOARD_ROWS=[
    [4,18],[3,19],[2,20],[1,21],[0,20],[1,19],[2,18],[3,17]
  ];
  const COLORS={blue:'#2f6fd1',white:'#f5f1e8',yellow:'#e0a72e',red:'#d1293d'};
  const STREET_MIX={
    blue:{name:'Bleu',hex:'#2f6fd1'},red:{name:'Rouge',hex:'#d1293d'},white:{name:'Blanc',hex:'#f5f1e8'},yellow:{name:'Jaune',hex:'#e0a72e'},
    'red+yellow':{name:'Orange',hex:'#e0763c'},'blue+red':{name:'Violet',hex:'#9b4fd1'},'blue+yellow':{name:'Vert',hex:'#5cb82f'},
    'red+white':{name:'Rose',hex:'#f2a7bd'},'white+yellow':{name:'Jaune clair',hex:'#f5f0a3'},'blue+white':{name:'Bleu ciel',hex:'#a8d8f0'},
    'red+white+yellow':{name:'Orange clair',hex:'#eec397'},'blue+red+white':{name:'Violet clair',hex:'#cdaee6'},'blue+white+yellow':{name:'Vert clair',hex:'#aee089'},
    'blue+red+yellow':{name:'Noir',hex:'#171310'},'blue+red+white+yellow':{name:'Gris',hex:'#8f8f8f'}
  };
  const STREET_TRANSPARENT={name:'Transparent',hex:'#8a93a3'};
  const LABELS=['5','6','7','8','9','10','11','12','13','14','N','M','L','K','J','I','H','G','F','E','D','C','B','A','1','2','3','4'];
  const EPS=1e-6;

  const PIECES=[
    {id:'blueSmall',name:'Bleue — 1 triangle',color:'blue',pivot:[1/3,1/3],poly:[[0,0],[1,0],[0,1]],walls:[]},
    {id:'blueLarge',name:'Bleue — 4 triangles',color:'blue',pivot:[0,1],poly:[[0,0],[1,0],[1,2],[0,2]],walls:[]},
    {id:'whiteSmall',name:'Blanche — 2 triangles + mur',color:'white',pivot:[1,0],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,0],[2,-1]]]},
    {id:'whiteLarge',name:'Blanche — hexagone + mur',color:'white',pivot:[0,0],poly:[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],walls:[[[1,0],[2,0]]]},
    {id:'yellowLarge',name:'Jaune — 4 triangles',color:'yellow',pivot:[0,1],poly:[[0,0],[1,0],[1,2],[0,2]],walls:[]},
    {id:'yellowBent',name:'Jaune — 2 demi-hexagones décalés',color:'yellow',pivot:[1.5,0],poly:[[0,0],[1,0],[2,-1],[3,-1],[3,0],[2,0],[1,1],[0,1]],walls:[]},
    {id:'redWall',name:'Rouge — 2 triangles + mur',color:'red',pivot:[1,1],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,1],[2,1]]]},
  ];
  // Les pièces officielles d'Orapa Street v2.
  const STREET_PIECES=[
    {id:'red1',name:'Rouge 1 — Rache',color:'red',pivot:[0,0],poly:[[-.5,.5],[.5,.5],[1.5,-.5],[.5,-.5],[-.5,-.5],[-1.5,.5]],walls:[]},
    {id:'red2',name:'Rouge 2 — Violon',color:'red',pivot:[0,0],poly:[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],walls:[[[1,0],[2,0]]]},
    {id:'red3',name:'Rouge 3 — Pipe',color:'red',pivot:[0,0],poly:[[.8,.4],[.8,-.6],[-.2,-.6],[-1.2,.4],[-.2,.4]],walls:[[[-1.2,.4],[-2.2,.4]]],wallStyle:'red'},
    {id:'white1',name:'Blanc 1 — Révolver',color:'white',pivot:[1,1],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,1],[2,1]]],wallStyle:'red'},
    {id:'white2',name:'Blanc 2 — Napoléon',color:'white',pivot:[0,0],poly:[[-1,1],[0,1],[1,0],[1,-1],[0,-1],[-1,0]],walls:[]},
    {id:'white3',name:'Blanc 3 — Hommes dansants',color:'white',pivot:[0,0],poly:[[-.286,.571],[.714,.571],[1.714,-.429],[.714,-.429],[-.286,-.429],[-1.286,-.429],[-1.286,.571]],walls:[]},
    {id:'white4',name:'Blanc 4 — Empreinte',color:'white',pivot:[0,0],poly:[[-.5,1],[.5,1],[1.5,0],[.5,0],[.5,-1],[-.5,-1],[-1.5,0],[-.5,0]],walls:[]},
    {id:'blue1',name:'Bleu 1 — Chien',color:'blue',pivot:[0,0],poly:[[-.125,1.5],[-.125,.5],[-1.125,.5],[-1.125,-.5],[-.125,-.5],[.875,-1.5],[.875,-.5],[.875,.5]],walls:[]},
    {id:'blue2',name:'Bleu 2 — Serpent',color:'blue',pivot:[0,0],poly:[[-.5,.5],[.5,.5],[1.5,-.5],[.5,-.5],[-.5,-.5],[-1.5,.5]],walls:[[[-1.5,.5],[-.5,-.5]],[[-.5,.5],[-.5,-.5]],[[-.5,.5],[.5,-.5]],[[.5,-.5],[.5,.5]],[[.5,.5],[1.5,-.5]]],renderBody:false,rayWallsOnly:true},
    {id:'blue3',name:'Bleu 3 — Escarboucle',color:'blue',pivot:[0,0],poly:[[.667,.667],[.667,-.333],[.667,-1.333],[-.333,-.333],[-1.333,.667],[-.333,.667]],walls:[]},
    {id:'yellow1',name:'Jaune 1 — Machine à écrire',color:'yellow',pivot:[0,0],poly:[[.8,.4],[.8,-.6],[-.2,-.6],[-1.2,.4],[-.2,.4]],walls:[]},
    {id:'yellow2',name:'Jaune 2 — Loupe',color:'yellow',pivot:[1,0],poly:[[0,0],[1,0],[1,1],[0,1]],walls:[[[1,0],[2,-1]]]},
    {id:'yellow3',name:'Jaune 3 — Chapeau',color:'yellow',pivot:[0,0],poly:[[-.8,.6],[.2,.6],[1.2,-.4],[.2,-.4],[-.8,-.4]],walls:[[[-.8,-.4],[-1.8,-.4]]],wallStyle:'red'},
  ];
  const MIRROR_DISABLED=new Set(['blueSmall','whiteSmall','whiteLarge']);
  const STREET_V2_MIRROR_IDS=new Set(['red1','red3','white1','white4','blue1','blue2','yellow3']);
  const STREET_V2_PROFILES={
    normal:{label:'Normal',count:6,allColors:true,centralZone:true,allowPrototype:false},
    sherlock7:{label:'Sherlock 7',count:7,allColors:true,centralZone:true,allowPrototype:false},
    sherlockExtreme:{label:'Sherlock Extrême',count:5,allColors:true,centralZone:true,allowPrototype:false},
    absurd:{label:'Absurde',count:5,allColors:false,centralZone:true,allowPrototype:false},
    free:{label:'Libre',count:5,allColors:false,centralZone:null,allowPrototype:true}
  };
  const STREET_V2_PROFILE_KEYS=Object.keys(STREET_V2_PROFILES);

  const byId=id=>document.getElementById(id);
  const svgEl=(name,attrs={})=>{
    const el=document.createElementNS(SVG_NS,name);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };
  const keyPoint=p=>`${p.q},${p.r}`;
  const screenPoint=p=>({x:p.q*EDGE/2,y:p.r*TRI_H});
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const mul=(a,n)=>({x:a.x*n,y:a.y*n});
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  const cross=(a,b)=>a.x*b.y-a.y*b.x;
  const norm=a=>{const n=Math.hypot(a.x,a.y)||1;return {x:a.x/n,y:a.y/n};};
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const samePoint=(a,b,e=.02)=>Math.hypot(a.x-b.x,a.y-b.y)<e;
  const pairKey=(a,b)=>[a,b].sort().join('|');

  function makeBoard(){
    const vertices=new Map();
    BOARD_ROWS.forEach(([min,max],r)=>{for(let q=min;q<=max;q+=2)vertices.set(`${q},${r}`,{q,r});});
    const triangles=[];
    let id=0;
    for(let r=0;r<7;r++){
      const min=Math.min(BOARD_ROWS[r][0],BOARD_ROWS[r+1][0])-2;
      const max=Math.max(BOARD_ROWS[r][1],BOARD_ROWS[r+1][1])+2;
      for(let q=min;q<=max;q++){
        const down=[vertices.get(`${q},${r}`),vertices.get(`${q+2},${r}`),vertices.get(`${q+1},${r+1}`)];
        if(down.every(Boolean))triangles.push({id:id++,points:down.map(screenPoint)});
        const up=[vertices.get(`${q},${r}`),vertices.get(`${q-1},${r+1}`),vertices.get(`${q+1},${r+1}`)];
        if(up.every(Boolean))triangles.push({id:id++,points:up.map(screenPoint)});
      }
    }
    const edges=new Map();
    triangles.forEach(tri=>{
      for(let i=0;i<3;i++){
        const a=tri.points[i],b=tri.points[(i+1)%3];
        const ka=`${a.x.toFixed(3)},${a.y.toFixed(3)}`,kb=`${b.x.toFixed(3)},${b.y.toFixed(3)}`;
        const k=pairKey(ka,kb);
        const item=edges.get(k)||{a,b,triangles:[]};
        item.triangles.push(tri);
        edges.set(k,item);
      }
    });
    const boundary=[...edges.values()].filter(edge=>edge.triangles.length===1);
    const adjacency=new Map();
    boundary.forEach((edge,index)=>{
      [edge.a,edge.b].forEach(point=>{
        const k=`${point.x.toFixed(3)},${point.y.toFixed(3)}`;
        if(!adjacency.has(k))adjacency.set(k,[]);
        adjacency.get(k).push({index,point});
      });
    });
    let start=boundary.reduce((best,edge)=>{
      for(const point of [edge.a,edge.b])if(!best||point.y<best.y-EPS||(Math.abs(point.y-best.y)<EPS&&point.x<best.x))best=point;
      return best;
    },null);
    let current=start,previous=null;
    const ordered=[];
    for(let guard=0;guard<boundary.length;guard++){
      const k=`${current.x.toFixed(3)},${current.y.toFixed(3)}`;
      const candidates=(adjacency.get(k)||[]).filter(item=>!ordered.includes(item.index));
      let chosen=candidates[0];
      if(guard===0)chosen=candidates.find(item=>{
        const edge=boundary[item.index],other=samePoint(edge.a,current)?edge.b:edge.a;
        return Math.abs(other.y-current.y)<.02&&other.x>current.x;
      })||chosen;
      if(!chosen)break;
      const edge=boundary[chosen.index];
      const other=samePoint(edge.a,current)?edge.b:edge.a;
      ordered.push(chosen.index);previous=current;current=other;
    }
    const orderedBoundary=ordered.map((index,i)=>({...boundary[index],label:LABELS[i],index:i}));
    const polygon=[start];
    current=start;
    orderedBoundary.forEach(edge=>{current=samePoint(edge.a,current)?edge.b:edge.a;polygon.push(current);});
    polygon.pop();
    const center=polygon.reduce((sum,p)=>add(sum,p),{x:0,y:0});center.x/=polygon.length;center.y/=polygon.length;
    orderedBoundary.forEach(edge=>{
      edge.mid=midpoint(edge.a,edge.b);
      const tri=edge.triangles[0];
      const otherMids=[];
      for(let i=0;i<3;i++){
        const m=midpoint(tri.points[i],tri.points[(i+1)%3]);
        if(!samePoint(m,edge.mid))otherMids.push(m);
      }
      edge.directions=otherMids.map(m=>norm(sub(m,edge.mid))).sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
      const tangent=norm(sub(edge.b,edge.a));
      let outward={x:-tangent.y,y:tangent.x};
      if(dot(outward,sub(edge.mid,center))<0)outward=mul(outward,-1);
      edge.outward=outward;
    });
    return {vertices,triangles,edges:[...edges.values()],boundary:orderedBoundary,polygon,center,width:21*EDGE/2,height:7*TRI_H};
  }

  const BOARD=makeBoard();
  // Zone centrale interdite par les règles du Street actuel. Elle reste traversée
  // par les ondes et ne concerne pas le Street Prototype.
  const STREET_FORBIDDEN_TRIANGLE_IDS=new Set([40,41,43,59,60,61,62,78,80,81]);
  const STREET_FORBIDDEN_WALLS=[
    [[11,5],[10,4]],[[8,4],[10,4]],[[9,5],[10,4]],[[9,3],[10,4]],[[9,3],[11,3]],
    [[11,3],[12,4]],[[11,3],[13,3]],[[11,3],[12,2]],[[11,3],[10,2]],[[10,4],[12,4]],[[10,4],[11,3]]
  ].map(wall=>wall.map(([q,r])=>screenPoint({q,r})));

  function axialTransform(point,rotation,flipped){
    let [a,b]=point;
    if(flipped)[a,b]=[a+b,-b];
    for(let i=0;i<rotation;i++)[a,b]=[-b,a+b];
    return [a,b];
  }
  function axialVectorToScreen([a,b]){return {x:(a+b/2)*EDGE,y:b*TRI_H};}
  const pieceDefinition=piece=>PIECES.find(item=>item.id===piece.id)||STREET_PIECES.find(item=>item.id===piece.id);
  function applyPieceMirror(piece){
    const official=STREET_PIECES.some(item=>item.id===piece.id);
    if((official&&!STREET_V2_MIRROR_IDS.has(piece.id))||(!official&&MIRROR_DISABLED.has(piece.id)))return false;
    const previousAnchor=piece.anchor?.q===undefined&&piece.anchor?{...piece.anchor}:null;
    const turningOn=!piece.flipped;
    const rotationCompensation=piece.id==='redWall'?1:(piece.id==='blueLarge'||piece.id==='yellowLarge'?2:0);
    piece.rotation=(piece.rotation+(turningOn?rotationCompensation:6-rotationCompensation))%6;
    piece.flipped=turningOn;
    // Les pièces v2 sont ancrées en coordonnées écran : après le miroir,
    // on recale leur sommet de référence sur la grille.
    if(official&&previousAnchor)piece.anchor=snapPieceAnchor(piece,previousAnchor);
    return true;
  }
  function pieceGeometry(piece){
    const definition=pieceDefinition(piece);
    const legacyAnchor=piece.anchor?.q!==undefined;
    const center=legacyAnchor?screenPoint(piece.anchor):piece.anchor;
    const transform=point=>{
      if(legacyAnchor){const [a,b]=axialTransform(point,piece.rotation,piece.flipped);return add(center,axialVectorToScreen([a,b]));}
      const relative=[point[0]-definition.pivot[0],point[1]-definition.pivot[1]];
      return add(center,axialVectorToScreen(axialTransform(relative,piece.rotation,piece.flipped)));
    };
    return {definition,poly:definition.poly.map(transform),walls:definition.walls.map(w=>w.map(transform))};
  }
  function visualWallsFor(geometry){
    return geometry.walls.map(wall=>{
      if(geometry.definition.rayWallsOnly)return wall;
      const direction=norm(sub(wall[1],wall[0]));
      return [add(wall[0],mul(direction,-EDGE*.24)),wall[1]];
    });
  }
  function visualWallPolygonsFor(geometry,extendIntoPiece=true){
    const walls=extendIntoPiece?visualWallsFor(geometry):geometry.walls;
    return walls.map((wall,index)=>{
      const direction=norm(sub(wall[1],wall[0]));
      let normal={x:-direction.y,y:direction.x};
      const half=STREET_WALL_WIDTH/2;
      const bevel=half/Math.tan(Math.PI/3);
      const startTop=add(wall[0],mul(normal,half));
      const startBottom=add(wall[0],mul(normal,-half));
      const shoulder=add(wall[1],mul(direction,-bevel));
      if(geometry.definition.id==='redWall'||geometry.definition.wallStyle==='red'){
        const physical=geometry.walls[index];
        const probeBase=add(physical[0],mul(direction,-4));
        if(!pointInPolygon(add(probeBase,mul(normal,STREET_WALL_WIDTH)),geometry.poly,true))normal=mul(normal,-1);
        const innerStart=add(wall[0],mul(normal,STREET_WALL_WIDTH));
        const innerShoulder=add(add(wall[1],mul(direction,-STREET_WALL_WIDTH/Math.tan(Math.PI/3))),mul(normal,STREET_WALL_WIDTH));
        return [wall[0],wall[1],innerShoulder,innerStart];
      }
      return [startTop,add(shoulder,mul(normal,half)),wall[1],add(shoulder,mul(normal,-half)),startBottom];
    });
  }
  function sharedPreviewSvg(reference){
    const decoded=decodeStreetGrid(reference);
    if(!decoded)return '';
    const margin=4;
    const svg=svgEl('svg',{viewBox:`${-margin} ${-margin} ${BOARD.width+margin*2} ${BOARD.height+margin*2}`,class:'street-shared-preview-svg',role:'img','aria-label':'Disposition complète de la grille Orapa Street'});
    const board=svgEl('g',{});
    BOARD.triangles.forEach(triangle=>board.appendChild(svgEl('polygon',{points:pointsAttr(triangle.points),fill:decoded.version===2&&decoded.centralZone&&STREET_FORBIDDEN_TRIANGLE_IDS.has(triangle.id)?'#3a2e20':'#747d8c',stroke:'#4d5663','stroke-width':'1'})));
    svg.appendChild(board);
    decoded.pieces.forEach(piece=>{
      const geometry=pieceGeometry(piece),color=COLORS[geometry.definition.color];
      const group=svgEl('g',{});
      if(geometry.definition.renderBody!==false)group.appendChild(svgEl('polygon',{points:pointsAttr(geometry.poly),fill:color,stroke:'rgba(0,0,0,.4)','stroke-width':'1.15','vector-effect':'non-scaling-stroke'}));
      visualWallPolygonsFor(geometry).forEach(wall=>group.appendChild(svgEl('polygon',{points:pointsAttr(wall),fill:color,stroke:'rgba(0,0,0,.4)','stroke-width':'1.15','vector-effect':'non-scaling-stroke'})));
      svg.appendChild(group);
    });
    return svg.outerHTML;
  }
  function pointOnSegment(p,a,b,tolerance=.05){
    const ab=sub(b,a),ap=sub(p,a);
    return Math.abs(cross(ab,ap))<=tolerance&&dot(ap,ab)>=-tolerance&&dot(sub(p,b),ab)<=tolerance;
  }
  function pointInPolygon(point,poly,includeBoundary=true){
    const onBoundary=poly.some((p,i)=>pointOnSegment(point,p,poly[(i+1)%poly.length]));
    if(onBoundary)return includeBoundary;
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if(((a.y>point.y)!==(b.y>point.y))&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function segmentIntersection(a,b,c,d,includeEnds=true){
    const r=sub(b,a),s=sub(d,c),den=cross(r,s),ca=sub(c,a);
    if(Math.abs(den)<EPS)return null;
    const t=cross(ca,s)/den,u=cross(ca,r)/den;
    const lo=includeEnds?-EPS:EPS,hi=includeEnds?1+EPS:1-EPS;
    if(t>=lo&&t<=hi&&u>=lo&&u<=hi)return {point:add(a,mul(r,t)),t,u};
    return null;
  }
  function collinearOverlap(a,b,c,d){
    const ab=sub(b,a);
    if(Math.abs(cross(ab,sub(c,a)))>.05||Math.abs(cross(ab,sub(d,a)))>.05)return false;
    const length2=dot(ab,ab);if(length2<EPS)return false;
    const t1=dot(sub(c,a),ab)/length2,t2=dot(sub(d,a),ab)/length2;
    return Math.min(1,Math.max(t1,t2))-Math.max(0,Math.min(t1,t2))>.02;
  }
  function polygonsConflict(a,b){
    if(!a.length||!b.length)return null;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
      const a1=a[i],a2=a[(i+1)%a.length],b1=b[j],b2=b[(j+1)%b.length];
      if(collinearOverlap(a1,a2,b1,b2))return 'side';
      const hit=segmentIntersection(a1,a2,b1,b2,false);if(hit)return 'overlap';
    }
    if(pointInPolygon(a[0],b,false)||pointInPolygon(b[0],a,false))return 'overlap';
    const sharedTriangle=BOARD.triangles.some(triangle=>{
      const center=triangle.points.reduce((sum,point)=>add(sum,point),{x:0,y:0});
      center.x/=3;center.y/=3;
      return pointInPolygon(center,a,false)&&pointInPolygon(center,b,false);
    });
    if(sharedTriangle)return 'overlap';
    return null;
  }
  function geometrySegments(geometry){
    const segments=[];
    geometry.poly.forEach((point,index)=>segments.push([point,geometry.poly[(index+1)%geometry.poly.length]]));
    geometry.walls.forEach(wall=>segments.push(wall));
    return segments;
  }
  function geometriesTouch(a,b){
    const first=geometrySegments(a),second=geometrySegments(b);
    return first.some(([a1,a2])=>second.some(([b1,b2])=>collinearOverlap(a1,a2,b1,b2)||!!segmentIntersection(a1,a2,b1,b2,true)));
  }
  function geometryUsesForbiddenStreetZone(geometry){
    const usesTriangle=BOARD.triangles.some(triangle=>{
      if(!STREET_FORBIDDEN_TRIANGLE_IDS.has(triangle.id))return false;
      const center=triangleCenter(triangle);
      const conflict=polygonsConflict(geometry.poly,triangle.points);
      if(conflict==='overlap'||pointInPolygon(center,geometry.poly,false)||geometry.poly.some(point=>pointInPolygon(point,triangle.points,false)))return true;
      return geometry.walls.some(wall=>{
        if(pointInPolygon(midpoint(wall[0],wall[1]),triangle.points,false))return true;
        return triangle.points.some((point,index)=>!!segmentIntersection(wall[0],wall[1],point,triangle.points[(index+1)%triangle.points.length],false));
      });
    });
    if(usesTriangle)return true;
    return geometry.walls.some(wall=>STREET_FORBIDDEN_WALLS.some(blocked=>
      collinearOverlap(wall[0],wall[1],blocked[0],blocked[1])||!!segmentIntersection(wall[0],wall[1],blocked[0],blocked[1],false)
    ));
  }
  function directlyReachablePieceIds(placed,geometries){
    const segments=[];
    placed.forEach(piece=>{
      const geometry=geometries.get(piece.id);
      if(!geometry.definition.rayWallsOnly)geometry.poly.forEach((point,index)=>segments.push({a:point,b:geometry.poly[(index+1)%geometry.poly.length],piece}));
      geometry.walls.forEach(wall=>segments.push({a:wall[0],b:wall[1],piece}));
    });
    const reachable=new Set();
    BOARD.boundary.forEach(edge=>edge.directions.forEach(direction=>{
      const contacts=segments.filter(segment=>pointOnSegment(edge.mid,segment.a,segment.b,.2));
      if(contacts.length){contacts.forEach(segment=>reachable.add(segment.piece.id));return;}
      const origin=add(edge.mid,mul(direction,.1));
      let nearest=null;
      segments.forEach(segment=>{
        const hit=raySegmentHit(origin,direction,segment.a,segment.b);
        if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,...segment};
      });
      if(nearest)reachable.add(nearest.piece.id);
    }));
    return reachable;
  }
  function streetRules(profile=state.profile,centralZone=state.centralZone){
    const config=STREET_V2_PROFILES[profile];
    if(!config)return {v2:false,centralZone:false};
    return {v2:true,centralZone:config.centralZone===null?centralZone!==false:config.centralZone};
  }
  function validatePieces(pieces,checkReachability=true,rules=streetRules()){
    const issues=new Map();
    const strictStreet=!!rules.v2;
    const placed=pieces.filter(piece=>piece.anchor);
    const geometries=new Map(placed.map(piece=>[piece.id,pieceGeometry(piece)]));
    placed.forEach(piece=>{
      const geo=geometries.get(piece.id);
      if(geo.poly.some(p=>!pointInPolygon(p,BOARD.polygon,true))||geo.walls.some(w=>w.some(p=>!pointInPolygon(p,BOARD.polygon,true))))issues.set(piece.id,'La pièce doit rester entièrement dans la grille.');
      else if(rules.centralZone&&geometryUsesForbiddenStreetZone(geo))issues.set(piece.id,'Cette zone centrale est interdite aux pièces.');
    });
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      const pa=placed[i],pb=placed[j],a=geometries.get(pa.id),b=geometries.get(pb.id);
      const conflict=polygonsConflict(a.poly,b.poly);
      const touching=strictStreet&&geometriesTouch(a,b);
      if(conflict||touching){const message=strictStreet?'Les pièces ne peuvent pas se toucher, même par une pointe.':(conflict==='side'?'Deux pièces ne peuvent pas partager un côté.':'Deux pièces ne peuvent pas se chevaucher.');issues.set(pa.id,message);issues.set(pb.id,message);}
      for(const wall of a.walls){
        if(b.poly.some((p,k)=>collinearOverlap(wall[0],wall[1],p,b.poly[(k+1)%b.poly.length])||segmentIntersection(wall[0],wall[1],p,b.poly[(k+1)%b.poly.length],false))||pointInPolygon(midpoint(wall[0],wall[1]),b.poly,false)){issues.set(pa.id,'Un mur traverse ou longe une autre pièce.');issues.set(pb.id,'Un mur traverse ou longe une autre pièce.');}
      }
      for(const wall of b.walls){
        if(a.poly.some((p,k)=>collinearOverlap(wall[0],wall[1],p,a.poly[(k+1)%a.poly.length])||segmentIntersection(wall[0],wall[1],p,a.poly[(k+1)%a.poly.length],false))||pointInPolygon(midpoint(wall[0],wall[1]),a.poly,false)){issues.set(pa.id,'Un mur traverse ou longe une autre pièce.');issues.set(pb.id,'Un mur traverse ou longe une autre pièce.');}
      }
    }
    if(checkReachability){
      const reachable=directlyReachablePieceIds(placed,geometries);
      placed.forEach(piece=>{if(!reachable.has(piece.id)&&!issues.has(piece.id))issues.set(piece.id,'Chaque pièce doit pouvoir être atteinte par au moins une onde sans rebond.');});
    }
    return issues;
  }
  function raySegmentHit(origin,direction,a,b){
    const s=sub(b,a),ao=sub(a,origin),den=cross(direction,s);
    if(Math.abs(den)<EPS)return null;
    const t=cross(ao,s)/den,u=cross(ao,direction)/den;
    if(t>0.02&&u>-EPS&&u<1+EPS)return {t,point:add(origin,mul(direction,t)),segment:[a,b]};
    return null;
  }
  function resolveStreetColor(colors){return colors.size?STREET_MIX[[...colors].sort().join('+')]||STREET_TRANSPARENT:STREET_TRANSPARENT;}
  function reflectedDirection(direction,a,b){
    const tangent=norm(sub(b,a));let normal={x:-tangent.y,y:tangent.x};
    if(dot(direction,normal)>0)normal=mul(normal,-1);
    return norm(sub(direction,mul(normal,2*dot(direction,normal))));
  }
  function matchingExitDirection(edge,outwardDirection){
    const inward=mul(outwardDirection,-1);let best=0,bestDot=-Infinity;
    edge.directions.forEach((direction,index)=>{const score=dot(direction,inward);if(score>bestDot){best=index;bestDot=score;}});
    return best;
  }
  function traceRay(edgeIndex,directionIndex,pieces){
    const entry=BOARD.boundary[edgeIndex],segments=[];
    pieces.filter(p=>p.anchor).forEach(piece=>{
      const geo=pieceGeometry(piece);
      if(!geo.definition.rayWallsOnly)geo.poly.forEach((p,i)=>segments.push({a:p,b:geo.poly[(i+1)%geo.poly.length],piece,color:geo.definition.color}));
      geo.walls.forEach(w=>segments.push({a:w[0],b:w[1],piece,color:geo.definition.color,wall:true}));
    });
    let direction=entry.directions[directionIndex],colorSet=new Set(),points=[entry.mid],exit=null,exitDirectionIndex=null,loop=false;
    // Une pièce peut poser l'un de ses murs exactement sur le bord. L'onde
    // frappe alors ce mur avant même d'entrer : elle ressort par l'autre
    // flèche de la même case, comme un rebond sur place.
    const entryContacts=segments.filter(segment=>pointOnSegment(entry.mid,segment.a,segment.b,.2));
    if(entryContacts.length){
      entryContacts.forEach(segment=>colorSet.add(segment.color));
      const reflected=reflectedDirection(direction,entryContacts[0].a,entryContacts[0].b);
      exitDirectionIndex=matchingExitDirection(entry,reflected);
      return {entry,entryDirectionIndex:directionIndex,exit:entry,exitDirectionIndex,points,colors:[...colorSet],color:resolveStreetColor(colorSet),bounced:true,loop:false};
    }
    let origin=add(entry.mid,mul(direction,.1));
    const visited=new Set();
    for(let bounce=0;bounce<40;bounce++){
      const stateKey=`${origin.x.toFixed(2)},${origin.y.toFixed(2)}:${direction.x.toFixed(3)},${direction.y.toFixed(3)}`;
      if(visited.has(stateKey)){loop=true;break;}visited.add(stateKey);
      let nearest=null;
      segments.forEach(segment=>{const hit=raySegmentHit(origin,direction,segment.a,segment.b);if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,...segment,type:'piece'};});
      BOARD.boundary.forEach(edge=>{const hit=raySegmentHit(origin,direction,edge.a,edge.b);if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,edge,type:'exit'};});
      if(!nearest)break;
      points.push(nearest.point);
      if(nearest.type==='exit'){exit=nearest.edge;exitDirectionIndex=matchingExitDirection(exit,direction);break;}
      colorSet.add(nearest.color);
      direction=reflectedDirection(direction,nearest.a,nearest.b);
      origin=add(nearest.point,mul(direction,.15));
    }
    return {entry,entryDirectionIndex:directionIndex,exit,exitDirectionIndex,points,colors:[...colorSet],color:resolveStreetColor(colorSet),bounced:exit===entry,loop};
  }
  function laneName(labels){
    const [a,b]=labels;
    if(/^[ABC]$/.test(a))return `${a}${b}`;
    if(/^[ABC]$/.test(b))return `${b}${a}`;
    if(/^\d+$/.test(a)&&!/^\d+$/.test(b))return `${a}${b}`;
    if(/^\d+$/.test(b)&&!/^\d+$/.test(a))return `${b}${a}`;
    return `${a}${b}`;
  }
  function emptyLane(edge,directionIndex){
    const direction=edge.directions[directionIndex],origin=add(edge.mid,mul(direction,.1));
    let nearest=null;
    BOARD.boundary.forEach(target=>{
      if(target===edge)return;
      const hit=raySegmentHit(origin,direction,target.a,target.b);
      if(hit&&(!nearest||hit.t<nearest.t))nearest={...hit,target};
    });
    const labels=nearest?[edge.label,nearest.target.label]:null;
    return nearest?{a:edge.mid,b:nearest.point,labels,name:laneName(labels)}:null;
  }
  const LANES=(()=>{
    const map=new Map();
    BOARD.boundary.forEach(edge=>edge.directions.forEach((_,i)=>{
      const lane=emptyLane(edge,i);if(!lane)return;
      const k=pairKey(...lane.labels);if(!map.has(k))map.set(k,lane);
    }));
    return [...map.values()];
  })();
  function coordinateForTriangle(triangle){
    const center=triangle.points.reduce((sum,p)=>add(sum,p),{x:0,y:0});center.x/=3;center.y/=3;
    const options=[];
    for(let i=0;i<LANES.length;i++)for(let j=i+1;j<LANES.length;j++){
      const hit=segmentIntersection(LANES[i].a,LANES[i].b,LANES[j].a,LANES[j].b,true);
      if(hit&&pointInPolygon(hit.point,triangle.points,true))options.push({lanes:[LANES[i],LANES[j]],distance:Math.hypot(hit.point.x-center.x,hit.point.y-center.y)});
    }
    options.sort((a,b)=>a.distance-b.distance||a.lanes[0].name.localeCompare(b.lanes[0].name,undefined,{numeric:true}));
    const selected=options[0]?.lanes;
    if(!selected)return 'Coordonnée indéterminée';
    selected.sort((a,b)=>{
      const angle=lane=>Math.atan2(lane.b.y-lane.a.y,lane.b.x-lane.a.x)*180/Math.PI;
      const aa=angle(a),ab=angle(b);
      if((aa<-90&&ab>90)||(ab<-90&&aa>90))return aa<-90?-1:1;
      return 0;
    });
    return selected.map(l=>l.name).join(' ');
  }
  function triangleCenter(triangle){
    const center=triangle.points.reduce((sum,p)=>add(sum,p),{x:0,y:0});
    center.x/=3;center.y/=3;
    return center;
  }
  function queryPieces(){return state.mode==='solo'?(state.secretPieces||[]):state.pieces;}
  function coordinateResultForTriangle(triangle){
    const center=triangleCenter(triangle);
    const colors=new Set();
    queryPieces().filter(piece=>piece.anchor).forEach(piece=>{
      const geometry=pieceGeometry(piece);
      if(!geometry.definition.rayWallsOnly&&pointInPolygon(center,geometry.poly,true))colors.add(geometry.definition.color);
    });
    if(!colors.size)return {empty:true,name:'Vide',hex:null,colors:[]};
    const result=resolveStreetColor(colors);
    return {empty:false,name:result.name,hex:result.hex,colors:[...colors]};
  }

  const freshPieces=(definitions=PIECES)=>definitions.map(def=>({id:def.id,anchor:null,rotation:0,flipped:false}));
  const streetProfileConfig=profile=>STREET_V2_PROFILES[profile]||null;
  const streetAllowedDefinitions=profile=>streetProfileConfig(profile)?.allowPrototype?[...STREET_PIECES,...PIECES.filter(piece=>piece.id!=='blueLarge')]:STREET_PIECES;
  const streetPlacedPieces=pieces=>pieces.filter(piece=>piece.anchor);
  function streetProfileIssues(pieces,profile=state.profile){
    const config=streetProfileConfig(profile);if(!config)return [];
    const placed=streetPlacedPieces(pieces),issues=[];
    if(!config.allowPrototype&&placed.some(piece=>PIECES.some(definition=>definition.id===piece.id)))issues.push('Cette option utilise uniquement les pièces Street v2.');
    if(new Set(placed.map(piece=>piece.id)).size!==placed.length)issues.push('Une même pièce ne peut être utilisée qu’une seule fois.');
    if(profile==='free'){if(placed.length<config.count)issues.push(`Place au moins ${config.count} pièces avant de démarrer.`);return issues;}
    if(placed.length!==config.count)issues.push(`Cette option demande exactement ${config.count} pièces.`);
    if(config.allColors){
      const colors=new Set(placed.map(piece=>pieceDefinition(piece)?.color));
      const missing=['blue','white','yellow','red'].filter(color=>!colors.has(color));
      if(missing.length)issues.push('Il faut au moins une pièce de chacune des quatre couleurs.');
    }
    return issues;
  }
  function streetV2Ready(pieces=state.pieces){
    return !validatePieces(pieces,true,streetRules()).size&&!streetProfileIssues(pieces).length;
  }
  let state={mode:'gm',pieceSet:'prototype',profile:null,centralZone:false,pieces:freshPieces(),secretPieces:[],selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
  let savedPrototypeCreationPieces=null;
  let wavePreference='auto';
  let streetAttempt=null;
  let streetSync=Promise.resolve();
  let selectedWaveEdge=null;
  let directionChoicesHideTimer=null;
  let streetPieceSurvey={active:false,triangles:new Set(),wallStart:null,walls:[]};
  let streetSurveyUnlocked=false,streetSurveyClicks=0;
  const officialStreetCreationActive=()=>state.mode==='gm'&&!state.started&&!!streetProfileConfig(state.profile);
  function resetV2Creation(profile=state.profile||'normal',centralZone=profile==='free'?state.centralZone!==false:true){
    const config=streetProfileConfig(profile)||STREET_V2_PROFILES.normal;
    state.profile=profile;state.centralZone=config.centralZone===null?centralZone:true;state.pieceSet='official';
    state.pieces=freshPieces(streetAllowedDefinitions(profile));state.selected=state.pieces[0]?.id||'red1';
    state.traces=[];state.coords=[];state.draftCells={};state.gridId=null;state.gridAlias=null;state.previewWave=null;state.tool='pieces';
    resetStreetPieceSurvey();clearDirectionChoicesTimer();selectedWaveEdge=null;
  }
  function resetStreetPieceSurvey(){streetPieceSurvey={active:false,triangles:new Set(),wallStart:null,walls:[]};}
  function surveyVertexKey(vertex){return `${vertex.q},${vertex.r}`;}
  function surveyVertexFromKey(key){const [q,r]=key.split(',').map(Number);return {q,r};}
  function toggleSurveyTriangle(id){
    if(streetPieceSurvey.triangles.has(id))streetPieceSurvey.triangles.delete(id);else streetPieceSurvey.triangles.add(id);
  }
  function selectSurveyVertex(vertex){
    const key=surveyVertexKey(vertex);
    if(!streetPieceSurvey.wallStart){streetPieceSurvey.wallStart=key;return;}
    if(streetPieceSurvey.wallStart===key){streetPieceSurvey.wallStart=null;return;}
    const existing=streetPieceSurvey.walls.findIndex(([start,end])=>(start===streetPieceSurvey.wallStart&&end===key)||(start===key&&end===streetPieceSurvey.wallStart));
    if(existing>=0)streetPieceSurvey.walls.splice(existing,1);else streetPieceSurvey.walls.push([streetPieceSurvey.wallStart,key]);
    streetPieceSurvey.wallStart=null;
  }
  function surveyPayload(){
    const name=byId('streetSurveyName')?.value.trim()||'Pièce Street';
    return {
      name,
      triangles:[...streetPieceSurvey.triangles].sort((a,b)=>a-b),
      walls:streetPieceSurvey.walls.map(([start,end])=>[surveyVertexFromKey(start),surveyVertexFromKey(end)])
    };
  }
  function surveyPlacementsPayload(){
    return {
      profile:state.profile||'prototype',centralZone:!!state.centralZone,
      pieces:state.pieces.filter(piece=>piece.anchor).map(piece=>({
        id:piece.id,anchor:{x:Number(piece.anchor.x.toFixed(3)),y:Number(piece.anchor.y.toFixed(3))},rotation:Number(piece.rotation)||0,flipped:!!piece.flipped
      }))
    };
  }
  const STREET_TUTORIAL_REFERENCE='';
  const STREET_TUTORIAL_PROGRESS_KEY='orapa_street_tutorial_progress_v2';
  const STREET_TUTORIAL_DEMO=[{id:'red1',anchor:{x:370.5,y:115.181},rotation:2,flipped:false},{id:'red2',anchor:{x:266,y:197.454},rotation:3,flipped:false},{id:'red3',anchor:{x:125.4,y:59.236},rotation:1,flipped:false},{id:'white1',anchor:{x:228,y:131.636},rotation:2,flipped:false},{id:'blue1',anchor:{x:59.375,y:127.522},rotation:5,flipped:false},{id:'blue3',anchor:{x:228,y:21.917},rotation:1,flipped:false},{id:'yellow2',anchor:{x:114,y:197.454},rotation:5,flipped:false}];
  const STREET_TUTORIAL_TARGETS=[{id:'red1',anchor:{x:85.5,y:180.999},rotation:1,flipped:true},{id:'yellow2',anchor:{x:133,y:98.727},rotation:2,flipped:false},{id:'blue1',anchor:{x:296.875,y:152.204},rotation:1,flipped:false},{id:'white1',anchor:{x:209,y:32.909},rotation:2,flipped:false}];
  let streetTutorial={active:false,stage:0,puzzle:false,secretPieces:[],draftIndex:0,preference:null,waveIndex:0,phase:0};
  const streetPlayerMode=()=>state.mode==='solo'||state.mode==='tutorial';
  const streetTutorialPlacementOrder=['red1','yellow2','blue1','white1'];
  function streetTutorialTargetPiece(id){
    const piece=STREET_TUTORIAL_TARGETS.find(item=>item.id===id);
    return piece?{...piece,anchor:piece.anchor?{...piece.anchor}:null}:null;
  }
  const EXIT_SIDE_KEYS=['top','upperRight','lowerRight','bottom','lowerLeft','upperLeft'];
  const DEFAULT_EXIT_SIDES={
    top:{arrowDistance:0,arrowOutward:.5,arrowAlong:-2,caseOutward:.5,caseAlong:0},
    upperRight:{arrowDistance:2.5,arrowOutward:1,arrowAlong:-.5,caseOutward:0,caseAlong:-.5},
    lowerRight:{arrowDistance:.5,arrowOutward:2,arrowAlong:-1,caseOutward:-.5,caseAlong:1},
    bottom:{arrowDistance:0,arrowOutward:0,arrowAlong:0,caseOutward:3,caseAlong:0},
    lowerLeft:{arrowDistance:3.5,arrowOutward:-1,arrowAlong:-3.5,caseOutward:-1,caseAlong:-1.5},
    upperLeft:{arrowDistance:6,arrowOutward:1,arrowAlong:-2,caseOutward:-1.5,caseAlong:0}
  };
  const freshExitSides=()=>Object.fromEntries(EXIT_SIDE_KEYS.map(key=>[key,{...DEFAULT_EXIT_SIDES[key]}]));
  const DEFAULT_EXIT_TUNING={arrowSpacing:8,arrowTextSize:8,arrowDistance:6.5,arrowOutward:-1,arrowAlong:2,caseTextSize:9,caseOutward:0,caseAlong:0,sides:freshExitSides()};
  let exitTuning={...DEFAULT_EXIT_TUNING,sides:freshExitSides()};
  function exitSideKey(label){
    if(['5','6','7','8','9','10','11'].includes(label))return 'top';
    if(['12','13','14'].includes(label))return 'upperRight';
    if(['N','M','L','K'].includes(label))return 'lowerRight';
    if(['D','E','F','G','H','I','J'].includes(label))return 'bottom';
    if(['A','B','C'].includes(label))return 'lowerLeft';
    return 'upperLeft';
  }
  function resolvedWavePreference(){
    if(wavePreference!=='auto')return wavePreference;
    return window.matchMedia('(max-width: 640px)').matches?'choices':'arrows';
  }
  function applyWavePreference(value,renderNow=true){
    if(!['auto','arrows','choices'].includes(value))return;
    wavePreference=value;
    const selector=byId('streetWavePreference');
    if(selector)selector.value=value;
    clearDirectionChoicesTimer();selectedWaveEdge=null;
    if(renderNow&&!byId('streetPrototype')?.hidden)render();
  }
  function clearDirectionChoicesTimer(){
    if(directionChoicesHideTimer){clearTimeout(directionChoicesHideTimer);directionChoicesHideTimer=null;}
  }
  function scheduleDirectionChoicesHide(edgeIndex){
    clearDirectionChoicesTimer();
    directionChoicesHideTimer=setTimeout(()=>{
      directionChoicesHideTimer=null;
      if(selectedWaveEdge===edgeIndex){selectedWaveEdge=null;render();}
    },2000);
  }
  function streetSoloShortcutActive(){
    return state.mode==='solo'&&state.started&&!state.over&&!streetTutorial.active;
  }
  function toggleStreetPreviewWave(edgeIndex,directionIndex){
    if(!streetSoloShortcutActive())return false;
    if(state.previewWave?.edgeIndex===edgeIndex&&state.previewWave?.directionIndex===directionIndex)state.previewWave=null;
    else state.previewWave={edgeIndex,directionIndex};
    render();
    return true;
  }
  function toggleStreetDraftCell(triangle){
    if(!streetSoloShortcutActive())return false;
    const key=String(triangle.id);
    state.draftCells=state.draftCells&&typeof state.draftCells==='object'?state.draftCells:{};
    if(state.draftCells[key])delete state.draftCells[key];else state.draftCells[key]=true;
    render();
    return true;
  }
  function streetTutorialExpectedWave(){
    if(!streetTutorial.active)return null;
    if(streetTutorial.stage===3)return {entry:'J',exit:'14'};
    if(streetTutorial.stage===5)return streetTutorial.waveIndex===0?{entry:'11',exit:'G'}:{entry:'C',exit:'7'};
    if(streetTutorial.stage===6&&streetTutorial.phase===1)return {entry:'8',exit:'D'};
    if(streetTutorial.stage===6&&streetTutorial.phase===3)return streetTutorial.waveIndex===0?{entry:'13',exit:'3'}:{entry:'H',exit:'5'};
    return null;
  }
  function streetTutorialExpectedEntry(){return streetTutorialExpectedWave()?.entry||null;}
  function streetTutorialWaveMatches(edge,directionIndex){
    const expected=streetTutorialExpectedWave();
    if(!expected||edge.label!==expected.entry)return false;
    const lane=emptyLane(edge,directionIndex);
    return lane?.labels?.find(label=>label!==edge.label)===expected.exit;
  }
  function streetTutorialAllowLabel(edge){
    if(!streetTutorial.active)return true;
    if(streetTutorial.stage===4){
      if(edge.label==='J')return true;
      showErrorToast('Reclique d’abord sur J pour revoir la sortie.');return false;
    }
    if(streetTutorialExpectedEntry()===edge.label)return true;
    showErrorToast('Touche l’entrée mise en évidence par le tutoriel.');return false;
  }
  function streetTutorialAllowWave(edge,directionIndex){
    if(!streetTutorial.active)return true;
    if(streetTutorialWaveMatches(edge,directionIndex))return true;
    showErrorToast('Choisis la direction mise en évidence.');return false;
  }
  function streetTutorialDraftTargetIds(){
    if(!streetTutorial.active||!streetTutorial.puzzle||streetTutorial.stage!==6||streetTutorial.phase!==5)return [];
    const edge=BOARD.boundary.find(item=>item.label==='4');
    const directionIndex=edge?.directions.findIndex((_direction,index)=>emptyLane(edge,index)?.labels?.includes('G'));
    const lane=directionIndex>=0?emptyLane(edge,directionIndex):null;
    if(!lane)return [];
    const vector=sub(lane.b,lane.a),length2=dot(vector,vector);
    return BOARD.triangles.map(triangle=>{
      const center=triangleCenter(triangle),progress=Math.max(0,Math.min(1,dot(sub(center,lane.a),vector)/length2));
      const nearest=add(lane.a,mul(vector,progress));
      return {id:triangle.id,progress,distance:Math.hypot(center.x-nearest.x,center.y-nearest.y)};
    }).filter(item=>item.distance<TRI_H*.58).sort((a,b)=>a.progress-b.progress||a.distance-b.distance).slice(0,3).map(item=>item.id);
  }
  function streetTutorialDraftTargetId(){return streetTutorialDraftTargetIds()[streetTutorial.draftIndex]??null;}
  function streetTutorialCheckPlacement(piece){
    if(!streetTutorial.active||!streetTutorial.puzzle)return;
    const expected=streetTutorial.stage===6&&streetTutorial.phase===2?streetTutorialPlacementOrder[streetTutorial.draftIndex]:null;
    if(!expected||piece.id!==expected)return;
    const secret=streetTutorialTargetPiece(piece.id);
    if(!piece.anchor||!secret||geometrySignature(piece)!==geometrySignature(secret)){
      piece.anchor=null;showErrorToast('Cette pièce doit être placée à l’emplacement indiqué par le tutoriel.');return;
    }
    streetTutorial.draftIndex++;
    if(streetTutorial.draftIndex>=streetTutorialPlacementOrder.length){streetTutorial.phase=3;streetTutorial.waveIndex=0;}
    streetTutorialShow();
  }
  function streetTutorialAfterWave(edgeIndex,directionIndex){
    if(!streetTutorial.active)return;
    const edge=BOARD.boundary[edgeIndex];
    if(!streetTutorialWaveMatches(edge,directionIndex))return;
    if(streetTutorial.stage===3)streetTutorial.stage=4;
    else if(streetTutorial.stage===5)streetTutorial.waveIndex++;
    else if(streetTutorial.stage===6&&streetTutorial.phase===1)streetTutorial.phase=2;
    else if(streetTutorial.stage===6&&streetTutorial.phase===3){
      streetTutorial.waveIndex++;
      if(streetTutorial.waveIndex>=2)streetTutorial.phase=4;
    }
    streetTutorialShow();render();
  }

  function shuffled(items){
    const result=[...items];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function randomStreetDefinitions(profile){
    const config=streetProfileConfig(profile);
    if(!config)return PIECES;
    const allowed=streetAllowedDefinitions(profile);
    if(profile==='free'){
      const count=config.count+Math.floor(Math.random()*(allowed.length-config.count+1));
      return shuffled(allowed).slice(0,count);
    }
    const mandatory=['blue','white','yellow','red'].map(color=>shuffled(allowed.filter(definition=>definition.color===color))[0]);
    return [...mandatory,...shuffled(allowed.filter(definition=>!mandatory.includes(definition))).slice(0,config.count-mandatory.length)];
  }
  function randomizePieces(){
    const vertices=[...BOARD.vertices.values()].map(screenPoint);
    for(let boardAttempt=0;boardAttempt<180;boardAttempt++){
      const placed=[];
      const definitions=shuffled(randomStreetDefinitions(state.profile));
      let failed=false;
      for(const definition of definitions){
        let accepted=null;
        for(let pieceAttempt=0;pieceAttempt<420;pieceAttempt++){
          const target=vertices[Math.floor(Math.random()*vertices.length)];
          const candidate={id:definition.id,anchor:{...target},rotation:Math.floor(Math.random()*6),flipped:(STREET_PIECES.some(item=>item.id===definition.id)?STREET_V2_MIRROR_IDS.has(definition.id):!MIRROR_DISABLED.has(definition.id))&&Math.random()<.5};
          candidate.anchor=snapPieceAnchor(candidate,target);
          if(validatePieces([...placed,candidate],false,streetRules()).size===0){accepted=candidate;break;}
        }
        if(!accepted){failed=true;break;}
        placed.push(accepted);
      }
      if(!failed&&validatePieces(placed,true,streetRules()).size===0&&!streetProfileIssues(placed,state.profile).length){
        const byPiece=new Map(placed.map(piece=>[piece.id,piece]));
        state.pieces=state.profile?streetAllowedDefinitions(state.profile).map(definition=>byPiece.get(definition.id)||{id:definition.id,anchor:null,rotation:0,flipped:false}):PIECES.map(definition=>byPiece.get(definition.id));
        state.selected=state.pieces.find(piece=>piece.anchor)?.id||state.pieces[0].id;state.traces=[];state.coords=[];state.tool='pieces';
        return true;
      }
    }
    return false;
  }
  const STREET_VERTICES=[...BOARD.vertices.values()].map(screenPoint);
  function encodeStreetV1Grid(pieces){
    if(pieces.length!==PIECES.length||validatePieces(pieces,true,{v2:false,centralZone:false}).size)return null;
    const bytes=[];
    for(const definition of PIECES){
      const piece=pieces.find(item=>item.id===definition.id);if(!piece?.anchor)return null;
      const first=pieceGeometry(piece).poly[0];
      let index=0,distance=Infinity;
      STREET_VERTICES.forEach((point,i)=>{const value=Math.hypot(point.x-first.x,point.y-first.y);if(value<distance){distance=value;index=i;}});
      if(distance>.1||index>255)return null;
      bytes.push(index,(piece.rotation%6)|((piece.flipped?1:0)<<3));
    }
    bytes.push(bytes.reduce((value,byte)=>value^byte,0)^0x5a);
    const hex=bytes.map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
    return `ST1-${hex.match(/.{1,4}/g).join('-')}`;
  }
  function pieceFromStoredVertex(definition,vertex,rotation,flipped){
    const piece={id:definition.id,anchor:{...vertex},rotation,flipped};
    const first=definition.poly[0],relative=[first[0]-definition.pivot[0],first[1]-definition.pivot[1]];
    piece.anchor=sub(vertex,axialVectorToScreen(axialTransform(relative,rotation,flipped)));
    return piece;
  }
  function encodeStreetV2Grid(pieces,profile=state.profile,centralZone=state.centralZone){
    const profileIndex=STREET_V2_PROFILE_KEYS.indexOf(profile);
    const config=STREET_V2_PROFILES[profile],effectiveCentral=config?.centralZone===null?centralZone!==false:true;
    if(profileIndex<0||validatePieces(pieces,true,streetRules(profile,effectiveCentral)).size||streetProfileIssues(pieces,profile).length)return null;
    const placed=streetPlacedPieces(pieces),definitions=[...STREET_PIECES,...PIECES],bytes=[profileIndex|(effectiveCentral?8:0),placed.length];
    for(const piece of placed){
      const definition=pieceDefinition(piece),definitionIndex=definitions.findIndex(item=>item.id===definition?.id);
      if(definitionIndex<0)return null;
      const first=pieceGeometry(piece).poly[0];let index=0,distance=Infinity;
      STREET_VERTICES.forEach((point,i)=>{const value=Math.hypot(point.x-first.x,point.y-first.y);if(value<distance){distance=value;index=i;}});
      if(distance>.1||index>255)return null;
      bytes.push(definitionIndex,index,(piece.rotation%6)|((piece.flipped?1:0)<<3));
    }
    bytes.push(bytes.reduce((value,byte)=>value^byte,0)^0xa7);
    const hex=bytes.map(byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
    return `ST2-${hex.match(/.{1,6}/g).join('-')}`;
  }
  function encodeStreetGrid(pieces,options={}){
    const profile=options.profile??state.profile;
    return profile?encodeStreetV2Grid(pieces,profile,options.centralZone??state.centralZone):encodeStreetV1Grid(pieces);
  }
  function decodeStreetGrid(input){
    const clean=String(input||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(clean.startsWith('ST2')){
      const hex=clean.slice(3);if(hex.length<36||hex.length%6!==0||!/^[0-9A-F]+$/.test(hex))return null;
      const bytes=hex.match(/../g).map(value=>parseInt(value,16)),checksum=bytes.pop();
      if(((bytes.reduce((value,byte)=>value^byte,0)^0xa7)&255)!==checksum)return null;
      const header=bytes[0],profile=STREET_V2_PROFILE_KEYS[header&7],centralZone=!!(header&8),count=bytes[1];
      if(!profile||count<1||bytes.length!==2+count*3)return null;
      if(STREET_V2_PROFILES[profile].centralZone===true&&!centralZone)return null;
      const definitions=[...STREET_PIECES,...PIECES],pieces=[];
      for(let i=0;i<count;i++){
        const definition=definitions[bytes[2+i*3]],vertex=STREET_VERTICES[bytes[3+i*3]],meta=bytes[4+i*3];
        if(!definition||!vertex||meta>13||(meta&7)>5)return null;
        const official=STREET_PIECES.some(item=>item.id===definition.id);
        if((official&&!STREET_V2_MIRROR_IDS.has(definition.id)&&(meta&8))||(!official&&MIRROR_DISABLED.has(definition.id)&&(meta&8)))return null;
        pieces.push(pieceFromStoredVertex(definition,vertex,meta&7,!!(meta&8)));
      }
      const rules=streetRules(profile,centralZone);
      if(validatePieces(pieces,true,rules).size||streetProfileIssues(pieces,profile).length)return null;
      return {variant:'street',version:2,profile,centralZone,pieces,id:encodeStreetV2Grid(pieces,profile,centralZone)};
    }
    if(!clean.startsWith('ST1'))return null;
    const hex=clean.slice(3);if(hex.length!==PIECES.length*4+2||!/^[0-9A-F]+$/.test(hex))return null;
    const bytes=hex.match(/../g).map(value=>parseInt(value,16));
    const checksum=bytes.pop();if(((bytes.reduce((value,byte)=>value^byte,0)^0x5a)&255)!==checksum)return null;
    const pieces=[];
    for(let i=0;i<PIECES.length;i++){
      const vertex=STREET_VERTICES[bytes[i*2]],meta=bytes[i*2+1];if(!vertex||meta>13||(meta&7)>5)return null;
      const definition=PIECES[i];pieces.push(pieceFromStoredVertex(definition,vertex,meta&7,!!(meta&8)));
    }
    if(validatePieces(pieces,true,{v2:false,centralZone:false}).size)return null;
    return {variant:'street',version:1,pieces,id:encodeStreetV1Grid(pieces)};
  }
  function geometrySignature(piece){
    const geometry=pieceGeometry(piece),point=p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    const polygon=geometry.poly.map(point).sort().join('|');
    const walls=geometry.walls.map(wall=>wall.map(point).sort().join('>')).sort().join('|');
    return `${polygon}#${walls}`;
  }
  function streetWaveSignature(pieces){
    // Une solution est aussi définie par l'ensemble des réponses aux ondes.
    // Cette empreinte évite qu'une représentation interne équivalente (pivot,
    // rotation ou miroir) soit rejetée alors que le comportement de la grille
    // est strictement le même pour tous les points d'entrée.
    return BOARD.boundary.flatMap((_edge,edgeIndex)=>BOARD.boundary[edgeIndex].directions.map((_direction,directionIndex)=>{
      const trace=traceRay(edgeIndex,directionIndex,pieces),exit=trace.exit;
      return `${exit?.index??'x'}:${trace.exitDirectionIndex??'x'}:${trace.color?.name??'Transparent'}:${trace.loop?1:0}`;
    })).join('|');
  }
  function guessIsCorrect(){
    const definitions=state.secretPieces.map(piece=>pieceDefinition(piece)).filter(Boolean);
    const exact=definitions.length===state.pieces.length&&definitions.every(definition=>{
      const guess=state.pieces.find(piece=>piece.id===definition.id),secret=state.secretPieces.find(piece=>piece.id===definition.id);
      return guess?.anchor&&secret?.anchor&&geometrySignature(guess)===geometrySignature(secret);
    });
    if(exact)return true;
    return streetWaveSignature(state.pieces)===streetWaveSignature(state.secretPieces);
  }
  function streetProgress(){return {pieces:state.pieces,traces:state.traces.map(trace=>({entryIndex:trace.entry.index,entryDirectionIndex:trace.entryDirectionIndex,exitIndex:trace.exit?.index??null,exitDirectionIndex:trace.exitDirectionIndex,points:trace.points,colors:trace.colors,color:trace.color,bounced:trace.bounced,loop:trace.loop,time:trace.time})),coords:state.coords,draftCells:state.draftCells,attempts:state.attempts,startedAt:state.startedAt};}
  function restoreStreetProgress(progress){
    if(!progress||typeof progress!=='object')return;
    if(Array.isArray(progress.pieces)&&progress.pieces.length===state.pieces.length)state.pieces=progress.pieces;
    state.coords=Array.isArray(progress.coords)?progress.coords:[];state.draftCells=progress.draftCells&&typeof progress.draftCells==='object'?progress.draftCells:{};state.attempts=Math.max(0,Number(progress.attempts)||0);state.startedAt=Number(progress.startedAt)||Date.now();
    state.traces=(Array.isArray(progress.traces)?progress.traces:[]).map(item=>({...item,entry:BOARD.boundary[item.entryIndex],exit:item.exitIndex==null?null:BOARD.boundary[item.exitIndex]})).filter(item=>item.entry);
  }
  function recordStreetAction(kind){
    if(state.mode!=='solo'||state.over||!streetAttempt?.attempt_id||!currentPlayerAccount?.session_token)return;
    if(!state.startedAt)state.startedAt=Date.now();
    const payload={p_session_token:currentPlayerAccount.session_token,p_attempt_id:streetAttempt.attempt_id,p_action_id:crypto.randomUUID(),p_action_kind:kind,p_progress:streetProgress()};
    streetSync=streetSync.then(async()=>{const result=await supabaseRpc('orapa_record_active_attempt_action',payload);if(result?.attempt)streetAttempt=result.attempt;}).catch(error=>{console.warn('Synchronisation Street différée :',error);showErrorToast('Le coup est conservé à l’écran, mais sa synchronisation a échoué.');});
    return streetSync;
  }
  function pointsAttr(points){return points.map(p=>`${p.x},${p.y}`).join(' ');}
  function clipPolygonToHalfPlane(points,center,normal){
    const output=[];
    points.forEach((current,index)=>{
      const previous=points[(index+points.length-1)%points.length];
      const currentDistance=dot(sub(current,center),normal),previousDistance=dot(sub(previous,center),normal);
      const currentInside=currentDistance>=-EPS,previousInside=previousDistance>=-EPS;
      if(currentInside!==previousInside){
        const ratio=previousDistance/(previousDistance-currentDistance);
        output.push(add(previous,mul(sub(current,previous),ratio)));
      }
      if(currentInside)output.push(current);
    });
    return output;
  }
  function caseExitInfoPosition(edge,box,direction,otherDirection){
    const half=norm(sub(direction,otherDirection));
    const side=exitSideKey(edge.label);
    if(side==='top'||side==='bottom'){
      const onLeft=half.x<0;
      const alignBottom=side==='top';
      return {
        x:onLeft?box.left+4:box.right-4,
        y:alignBottom?box.bottom-3:box.top+3,
        anchor:'middle',vertical:true,verticalAlign:alignBottom?'bottom':'top'
      };
    }
    const onTop=half.y<0,descending=side==='upperRight'||side==='lowerLeft';
    if(descending){
      return onTop
        ?{x:box.left+2,y:box.top+4,anchor:'start'}
        :{x:box.right-2,y:box.bottom-4,anchor:'end'};
    }
    return onTop
      ?{x:box.right-2,y:box.top+4,anchor:'end'}
      :{x:box.left+2,y:box.bottom-4,anchor:'start'};
  }
  function svgClientPoint(clientX,clientY,svg){
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  function snapPieceAnchor(piece,target){
    const definition=pieceDefinition(piece),first=definition.poly[0]||definition.walls[0]?.[0];
    if(!first)return {...target};
    const relative=[first[0]-definition.pivot[0],first[1]-definition.pivot[1]];
    const firstOffset=axialVectorToScreen(axialTransform(relative,piece.rotation,piece.flipped));
    let best=null,bestDistance=Infinity;
    BOARD.vertices.forEach(vertex=>{
      const point=screenPoint(vertex),candidate=sub(point,firstOffset),distance=Math.hypot(candidate.x-target.x,candidate.y-target.y);
      if(distance<bestDistance){best={x:candidate.x,y:candidate.y};bestDistance=distance;}
    });
    return best;
  }
  function piecePreview(piece){
    const geo=pieceGeometry({...piece,anchor:{x:0,y:0}}),wallPolygons=visualWallPolygonsFor(geo),all=[...geo.poly,...wallPolygons.flat()];
    const xs=all.map(p=>p.x),ys=all.map(p=>p.y),pad=9;
    const minX=Math.min(...xs)-pad,minY=Math.min(...ys)-pad,width=Math.max(...xs)-Math.min(...xs)+pad*2,height=Math.max(...ys)-Math.min(...ys)+pad*2;
    const body=geo.definition.renderBody===false?'':`<polygon points="${pointsAttr(geo.poly)}" fill="${COLORS[geo.definition.color]}"/>`;
    return `<svg viewBox="${minX} ${minY} ${width} ${height}" aria-hidden="true">${body}${wallPolygons.map(poly=>`<polygon points="${pointsAttr(poly)}" fill="${COLORS[geo.definition.color]}"/>`).join('')}</svg>`;
  }
  function createPieceGhost(piece){
    const geo=pieceGeometry({...piece,anchor:{x:0,y:0}}),wallPolygons=visualWallPolygonsFor(geo),ghost=svgEl('svg',{width:1,height:1,class:'street-drag-ghost','aria-hidden':'true'});
    if(geo.definition.renderBody!==false)ghost.appendChild(svgEl('polygon',{points:pointsAttr(geo.poly),fill:COLORS[geo.definition.color]}));
    wallPolygons.forEach(poly=>ghost.appendChild(svgEl('polygon',{points:pointsAttr(poly),fill:COLORS[geo.definition.color],class:'street-wall'})));
    document.body.appendChild(ghost);return ghost;
  }
  function attachPieceGesture(element,piece){
    element.addEventListener('touchstart',event=>event.preventDefault(),{passive:false});
    element.addEventListener('touchmove',event=>event.preventDefault(),{passive:false});
    element.addEventListener('pointerdown',event=>{
      if((state.started&&!streetPlayerMode())||state.over)return;
      if(streetPlayerMode()&&(state.tool==='hint'||state.tool==='draft'))return;
      if(streetTutorial.active&&streetTutorial.puzzle){
        const expected=streetTutorial.stage===6&&streetTutorial.phase===2?streetTutorialPlacementOrder[streetTutorial.draftIndex]:null;
        if(!expected){showErrorToast('Suis d’abord les étapes du tutoriel.');return;}
        if(piece.id!==expected){showErrorToast('Utilise uniquement la pièce mise en évidence.');return;}
      }else if(streetTutorial.active){
        showErrorToast('Les pièces seront utilisées dans la seconde partie du tutoriel.');return;
      }
      event.preventDefault();event.stopPropagation();state.selected=piece.id;
      const startX=event.clientX,startY=event.clientY,pointerId=event.pointerId;
      try{element.setPointerCapture?.(pointerId);}catch(_error){}
      const board=byId('streetBoard');
      const startPoint=board?svgClientPoint(startX,startY,board):null;
      const originalAnchor=piece.anchor?.q!==undefined?screenPoint(piece.anchor):piece.anchor;
      const dragOffset=startPoint&&originalAnchor?sub(startPoint,originalAnchor):{x:0,y:0};
      let moved=false,longPressed=false,ghost=null,ghostFrame=0,ghostX=startX,ghostY=startY,ghostScale=1,ghostOffset={x:0,y:0};
      element.classList.add('gesture-active');
      const timer=setTimeout(()=>{
        if(moved)return;
        longPressed=true;
        if(!applyPieceMirror(piece))return;
        if(navigator.vibrate)navigator.vibrate(15);
        render();
      },480);
      const positionGhost=(x,y)=>{ghostX=x;ghostY=y;if(ghostFrame)return;ghostFrame=requestAnimationFrame(()=>{ghostFrame=0;if(ghost?.isConnected)ghost.style.transform=`translate3d(${ghostX-ghostOffset.x}px,${ghostY-ghostOffset.y}px,0) scale(${ghostScale})`;});};
      const startDrag=()=>{
        const matrix=board?.getScreenCTM();
        ghostScale=matrix?Math.hypot(matrix.a,matrix.b):1;
        ghostOffset=matrix?{x:matrix.a*dragOffset.x+matrix.c*dragOffset.y,y:matrix.b*dragOffset.x+matrix.d*dragOffset.y}:{...dragOffset};
        ghost=createPieceGhost(piece);element.classList.add('dragging');positionGhost(startX,startY);
      };
      const cleanup=()=>{clearTimeout(timer);if(ghostFrame)cancelAnimationFrame(ghostFrame);element.classList.remove('gesture-active','dragging');try{if(element.hasPointerCapture?.(pointerId))element.releasePointerCapture(pointerId);}catch(_error){}window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);};
      const onMove=moveEvent=>{
        if(moveEvent.pointerId!==pointerId)return;
        if(moveEvent.cancelable)moveEvent.preventDefault();
        if(!moved&&Math.hypot(moveEvent.clientX-startX,moveEvent.clientY-startY)>9){moved=true;clearTimeout(timer);startDrag();}
        if(moved)positionGhost(moveEvent.clientX,moveEvent.clientY);
      };
      const onUp=upEvent=>{
        if(upEvent.pointerId!==pointerId)return;
        const wasMoved=moved;cleanup();
        if(wasMoved){
          const svg=byId('streetBoard'),local=svgClientPoint(upEvent.clientX,upEvent.clientY,svg),anchorPoint=sub(local,dragOffset);
          const tutorialTarget=streetTutorial.active&&streetTutorial.puzzle&&streetTutorial.stage===6&&streetTutorial.phase===2&&streetTutorialPlacementOrder[streetTutorial.draftIndex]===piece.id
            ?streetTutorialTargetPiece(piece.id)
            :null;
          if(tutorialTarget?.anchor&&pointInPolygon(local,pieceGeometry(tutorialTarget).poly,true))piece.anchor={...tutorialTarget.anchor};
          else if(pointInPolygon(local,BOARD.polygon,true))piece.anchor=snapPieceAnchor(piece,anchorPoint);
          else piece.anchor=null;
          ghost?.remove();
          streetTutorialCheckPlacement(piece);
        }else if(!longPressed){piece.rotation=(piece.rotation+1)%6;if(piece.anchor&&piece.anchor.q===undefined)piece.anchor=snapPieceAnchor(piece,piece.anchor);}
        render();
      };
      const onCancel=cancelEvent=>{if(cancelEvent.pointerId!==pointerId)return;cleanup();ghost?.remove();};
      window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',onUp,{passive:false});window.addEventListener('pointercancel',onCancel);
    });
  }
  function renderPalette(){
    const host=byId('streetPalette');host.innerHTML='';
    const allowed=state.mode==='gm'&&state.profile?new Set(streetAllowedDefinitions(state.profile).map(definition=>definition.id)):null;
    const pieces=state.pieces.filter(piece=>!piece.anchor&&(!allowed||allowed.has(piece.id)));
    pieces.forEach(piece=>{
      const def=pieceDefinition(piece),tile=document.createElement('div');
      const tutorialTarget=streetTutorial.active&&streetTutorial.puzzle&&streetTutorial.stage===6&&streetTutorial.phase===2&&streetTutorialPlacementOrder[streetTutorial.draftIndex]===piece.id;
      tile.className=`street-piece-card${state.selected===piece.id?' selected':''}${tutorialTarget?' street-tutorial-target':''}`;
      tile.dataset.piece=piece.id;tile.setAttribute('role','button');tile.setAttribute('tabindex','0');tile.setAttribute('aria-label',def.name);tile.title=def.name;
      tile.innerHTML=piecePreview(piece);
      attachPieceGesture(tile,piece);host.appendChild(tile);
    });
    if(!pieces.length)host.innerHTML='<p class="street-palette-empty">Toutes les pièces sont placées sur la grille.</p>';
  }
  function renderBoard(){
    const svg=byId('streetBoard');svg.innerHTML='';
    const useDirectionChoices=resolvedWavePreference()==='choices';
    const previewTrace=streetPlayerMode()&&state.previewWave
      ?traceRay(state.previewWave.edgeIndex,state.previewWave.directionIndex,state.pieces)
      :null;
    const displayTraceAt=(edgeIndex,directionIndex)=>findTraceAt(edgeIndex,directionIndex);
    svg.classList.toggle('coordinate-mode',state.started);
    svg.classList.toggle('solo',streetPlayerMode());
    svg.classList.toggle('wave-choice-mode',useDirectionChoices);
    svg.classList.toggle('started',!!state.started);
    svg.classList.toggle('cell-tool-active',streetPlayerMode()&&(state.tool==='hint'||state.tool==='draft'));
    svg.classList.toggle('hint-mode',streetPlayerMode()&&state.tool==='hint');
    svg.classList.toggle('draft-mode',streetPlayerMode()&&state.tool==='draft');
    const margin=useDirectionChoices?31:43;
    svg.setAttribute('viewBox',`${-margin} ${-margin} ${BOARD.width+margin*2} ${BOARD.height+margin*2}`);
    const boardGroup=svgEl('g',{class:'street-grid'});
    BOARD.triangles.forEach(triangle=>{
      const key=String(triangle.id),draftEmpty=!!state.draftCells?.[key];
      const draftTarget=streetTutorialDraftTargetId()===triangle.id;
      const forbidden=streetRules().centralZone&&STREET_FORBIDDEN_TRIANGLE_IDS.has(triangle.id);
      const surveyed=streetPieceSurvey.active&&streetPieceSurvey.triangles.has(triangle.id);
      const poly=svgEl('polygon',{points:pointsAttr(triangle.points),class:`street-cell${forbidden?' street-forbidden-cell':''}${surveyed?' street-survey-selected':''}${draftEmpty?' draft-empty':''}${draftTarget?' street-tutorial-target':''}`,'data-cell':triangle.id});
      poly.addEventListener('click',async event=>{
        if(streetPieceSurvey.active&&officialStreetCreationActive()){
          event.stopPropagation();toggleSurveyTriangle(triangle.id);render();return;
        }
        if(!state.started)return;
        if(useDirectionChoices&&selectedWaveEdge!==null)return;
        event.stopPropagation();
        if(streetTutorial.active){
          if(!streetTutorial.puzzle||streetTutorial.stage!==6||streetTutorial.phase!==5||state.tool!=='draft'){showErrorToast('Suis l’étape indiquée par le tutoriel.');return;}
          if(!draftTarget){showErrorToast('Masque la prochaine case mise en évidence.');return;}
          state.draftCells=state.draftCells&&typeof state.draftCells==='object'?state.draftCells:{};
          state.draftCells[key]=true;streetTutorial.draftIndex++;
          if(streetTutorial.draftIndex>=3){streetTutorial.stage=7;streetTutorialShow();}
          render();return;
        }
        if(streetPlayerMode()&&state.tool==='draft'){
          state.draftCells=state.draftCells&&typeof state.draftCells==='object'?state.draftCells:{};
          if(state.draftCells[key])delete state.draftCells[key];else state.draftCells[key]=true;
          render();return;
        }
        if(streetPlayerMode()&&state.tool!=='hint')return;
        if(state.coords.some(item=>item.triangle===triangle.id))return;
        const coord=coordinateForTriangle(triangle);
        if(streetPlayerMode()&&!await gameConfirm(`Révéler le contenu de la case ${coord} ?`,'Demander un indice','Révéler','Annuler'))return;
        const result=coordinateResultForTriangle(triangle);
        state.coords.push({triangle:triangle.id,text:coord,...result,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
        if(streetPlayerMode())state.tool='pieces';
        render();void recordStreetAction('coord');
      });
      poly.addEventListener('contextmenu',event=>{
        if(!toggleStreetDraftCell(triangle))return;
        event.preventDefault();event.stopPropagation();
      });
      boardGroup.appendChild(poly);
    });
    svg.appendChild(boardGroup);
    const labelGroup=svgEl('g',{class:'street-labels'});
    BOARD.boundary.forEach((edge,edgeIndex)=>{
      const sideTuning=exitTuning.sides[exitSideKey(edge.label)];
      const labelPos=add(edge.mid,mul(edge.outward,useDirectionChoices?19:31));
      if(useDirectionChoices){
        const box={left:labelPos.x-16,right:labelPos.x+16,top:labelPos.y-13,bottom:labelPos.y+13};
        const clipId=`street-label-clip-${edgeIndex}`;
        const clip=svgEl('clipPath',{id:clipId});clip.appendChild(svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6}));labelGroup.appendChild(clip);
        labelGroup.appendChild(svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6,class:'street-label-base'}));
        const rectangle=[{x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.right,y:box.bottom},{x:box.left,y:box.bottom}];
        edge.directions.forEach((direction,directionIndex)=>{
          const usedTrace=displayTraceAt(edgeIndex,directionIndex);if(!usedTrace)return;
          const otherDirection=edge.directions[directionIndex===0?1:0];
          const half=clipPolygonToHalfPlane(rectangle,labelPos,sub(direction,otherDirection));
          labelGroup.appendChild(svgEl('polygon',{points:pointsAttr(half),class:`street-label-result${usedTrace.color.name==='Transparent'?' transparent':''}`,style:`--street-result:${usedTrace.color.hex}`,'clip-path':`url(#${clipId})`}));
          const exitInfo=traceExitInfo(usedTrace,edgeIndex,directionIndex);
          if(exitInfo){
            const infoPos=caseExitInfoPosition(edge,box,direction,otherDirection);
            const edgeTangent=norm(sub(edge.b,edge.a));
            const caseOutward=exitTuning.caseOutward+sideTuning.caseOutward,caseAlong=exitTuning.caseAlong+sideTuning.caseAlong;
            infoPos.x+=edge.outward.x*caseOutward+edgeTangent.x*caseAlong;
            infoPos.y+=edge.outward.y*caseOutward+edgeTangent.y*caseAlong;
            if(infoPos.vertical){
              const glyphs=[...exitInfo],lineHeight=exitTuning.caseTextSize*.78;
              const startY=infoPos.verticalAlign==='top'?infoPos.y:infoPos.y-(glyphs.length-1)*lineHeight;
              glyphs.forEach((glyph,index)=>{
                const item=svgEl('text',{x:infoPos.x,y:startY+index*lineHeight,'text-anchor':'middle','dominant-baseline':'middle','alignment-baseline':'middle',class:'street-label-exit-info',style:`font-size:${exitTuning.caseTextSize}px`});
                item.textContent=glyph;labelGroup.appendChild(item);
              });
            }else{
              const info=svgEl('text',{x:infoPos.x,y:infoPos.y,'text-anchor':infoPos.anchor,'dominant-baseline':'middle','alignment-baseline':'middle',class:'street-label-exit-info',style:`font-size:${exitTuning.caseTextSize}px`});
              info.textContent=exitInfo;labelGroup.appendChild(info);
            }
          }
        });
        const tutorialEdge=streetTutorialExpectedEntry()===edge.label||streetTutorial.stage===4&&edge.label==='J';
        const hit=svgEl('rect',{x:box.left,y:box.top,width:32,height:26,rx:6,class:`street-label-hit${selectedWaveEdge===edgeIndex?' active':''}${state.started?'':' disabled'}${tutorialEdge?' street-tutorial-target':''}`,'data-label-edge':edgeIndex});
        hit.addEventListener('click',event=>{
          event.stopPropagation();if(!state.started)return;
          if(!streetTutorialAllowLabel(edge)){return;}
          clearDirectionChoicesTimer();selectedWaveEdge=selectedWaveEdge===edgeIndex?null:edgeIndex;
          if(streetTutorial.active&&streetTutorial.stage===4){streetTutorial.stage=5;streetTutorialShow();}
          render();
        });
        hit.addEventListener('contextmenu',event=>{
          const point=svgClientPoint(event.clientX,event.clientY,svg);
          const directionIndex=dot(sub(point,labelPos),sub(edge.directions[0],edge.directions[1]))>=0?0:1;
          if(!toggleStreetPreviewWave(edgeIndex,directionIndex))return;
          event.preventDefault();event.stopPropagation();
        });
        labelGroup.appendChild(hit);
      }
      const label=svgEl('text',{x:labelPos.x,y:labelPos.y,'text-anchor':'middle','dominant-baseline':'central',class:`street-label${useDirectionChoices?' clickable':''}${selectedWaveEdge===edgeIndex?' active':''}`});label.textContent=edge.label;labelGroup.appendChild(label);
      const tangent=norm(sub(edge.b,edge.a));
      if(useDirectionChoices&&state.started&&selectedWaveEdge===edgeIndex){
        edge.directions.forEach((direction,directionIndex)=>{
          const lane=emptyLane(edge,directionIndex),destination=lane?.labels?.find(value=>value!==edge.label)||'?';
          const center=add(edge.mid,mul(direction,48));
          const usedTrace=displayTraceAt(edgeIndex,directionIndex);
          const tutorialChoice=streetTutorialWaveMatches(edge,directionIndex);
          const choice=svgEl('g',{class:`street-direction-choice-svg${usedTrace?' used':''}${usedTrace?.color?.name==='Transparent'?' transparent':''}${tutorialChoice?' street-tutorial-choice-target':''}`,'data-edge':edgeIndex,'data-direction':directionIndex});
          const box=svgEl('rect',{x:center.x-15,y:center.y-11,width:30,height:22,rx:5,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
          const text=svgEl('text',{x:center.x,y:center.y,'text-anchor':'middle','dominant-baseline':'central'});
          text.textContent=usedTrace?(traceExitInfo(usedTrace,edgeIndex,directionIndex)||'∅'):`→ ${destination}`;
          choice.appendChild(box);choice.appendChild(text);
          choice.addEventListener('click',event=>{event.stopPropagation();if(!streetTutorialAllowWave(edge,directionIndex))return;activateStreetWaveControl(edgeIndex,directionIndex,usedTrace);scheduleDirectionChoicesHide(edgeIndex);});
          choice.addEventListener('contextmenu',event=>{if(!toggleStreetPreviewWave(edgeIndex,directionIndex))return;event.preventDefault();event.stopPropagation();scheduleDirectionChoicesHide(edgeIndex);});
          labelGroup.appendChild(choice);
        });
      }
      if(!useDirectionChoices)edge.directions.forEach((direction,directionIndex)=>{
        const side=dot(direction,tangent)<0?-1:1;
        const pos=add(add(edge.mid,mul(edge.outward,10)),mul(tangent,side*exitTuning.arrowSpacing));
        const perpendicular={x:-direction.y,y:direction.x};
        const rearA=add(add(pos,mul(direction,-5)),mul(perpendicular,4.5));
        const rearB=add(add(pos,mul(direction,-5)),mul(perpendicular,-4.5));
        const arrow=[add(pos,mul(direction,7)),rearA,rearB];
        const usedTrace=displayTraceAt(edgeIndex,directionIndex);
        const button=svgEl('polygon',{points:pointsAttr(arrow),class:`street-ray-button${usedTrace?' used':''}${usedTrace?.color?.name==='Transparent'?' transparent':''}${state.started?'':' disabled'}`,'data-edge':edgeIndex,'data-direction':directionIndex,style:usedTrace?`--street-result:${usedTrace.color.hex}`:''});
        button.addEventListener('click',event=>{event.stopPropagation();if(!streetTutorialAllowWave(edge,directionIndex))return;activateStreetWaveControl(edgeIndex,directionIndex,usedTrace);});labelGroup.appendChild(button);
        button.addEventListener('contextmenu',event=>{if(!toggleStreetPreviewWave(edgeIndex,directionIndex))return;event.preventDefault();event.stopPropagation();});
        const exitInfo=usedTrace&&traceExitInfo(usedTrace,edgeIndex,directionIndex);
        if(exitInfo){
          const leftSide=['1','2','3','4','A','B','C'].includes(edge.label);
          const rightSide=['12','13','14','N','M','L','K'].includes(edge.label);
          let rearOuter,extension,infoPos,anchor;
          const arrowDistance=Math.max(0,exitTuning.arrowDistance+sideTuning.arrowDistance);
          if(leftSide){
            rearOuter=dot(sub(rearA,edge.mid),edge.outward)>dot(sub(rearB,edge.mid),edge.outward)?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,arrowDistance));
            infoPos.x=rearOuter.x-2;anchor='end';
          }else if(rightSide){
            rearOuter=dot(sub(rearA,edge.mid),edge.outward)>dot(sub(rearB,edge.mid),edge.outward)?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,arrowDistance));
            infoPos.x=rearOuter.x+2;anchor='start';
          }else{
            rearOuter=dot(sub(rearA,edge.mid),tangent)*side>dot(sub(rearB,edge.mid),tangent)*side?rearA:rearB;
            extension=norm(sub(rearOuter,pos));infoPos=add(rearOuter,mul(extension,arrowDistance));
            anchor=Math.abs(extension.x)<.28?'middle':extension.x>0?'end':'start';
          }
          infoPos=add(add(infoPos,mul(edge.outward,exitTuning.arrowOutward+sideTuning.arrowOutward)),mul(tangent,exitTuning.arrowAlong+sideTuning.arrowAlong));
          const info=svgEl('text',{x:infoPos.x,y:infoPos.y,'text-anchor':anchor,'dominant-baseline':'central',class:'street-ray-exit-info',style:`font-size:${exitTuning.arrowTextSize}px`});info.textContent=exitInfo;labelGroup.appendChild(info);
        }
      });
    });svg.appendChild(labelGroup);
    if(!streetPlayerMode()||streetTutorial.active&&!streetTutorial.puzzle)state.traces.forEach(trace=>{
      if(trace.points.length>1){
        const stroke=trace.color?.hex||STREET_TRANSPARENT.hex;
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace-halo',stroke}));
        svg.appendChild(svgEl('polyline',{points:pointsAttr(trace.points),class:'street-trace',stroke}));
      }
    });
    if(previewTrace?.points?.length>1){
      const stroke=previewTrace.color?.hex||STREET_TRANSPARENT.hex;
      svg.appendChild(svgEl('polyline',{points:pointsAttr(previewTrace.points),class:'street-trace-halo street-preview-trace',stroke}));
      svg.appendChild(svgEl('polyline',{points:pointsAttr(previewTrace.points),class:'street-trace street-preview-trace',stroke}));
    }
    const issues=validatePieces(state.pieces);
    const tutorialPieceId=streetTutorial.active&&streetTutorial.puzzle&&streetTutorial.stage===6&&streetTutorial.phase===2
      ?streetTutorialPlacementOrder[streetTutorial.draftIndex]
      :null;
    if(tutorialPieceId){
      const target=streetTutorialTargetPiece(tutorialPieceId);
      if(target?.anchor){
        const geo=pieceGeometry(target),targetGroup=svgEl('g',{class:'street-tutorial-placement-target','pointer-events':'none'});
        targetGroup.appendChild(svgEl('polygon',{points:pointsAttr(geo.poly)}));
        visualWallPolygonsFor(geo).forEach(wall=>targetGroup.appendChild(svgEl('polygon',{points:pointsAttr(wall)})));
        svg.appendChild(targetGroup);
      }
    }
    const appendPiece=(piece,display='normal')=>{
      const geo=pieceGeometry(piece),color=COLORS[geo.definition.color],resultClass=display==='guess'?' street-result-guess':(display==='secret'?' street-result-secret':'');
      const group=svgEl('g',{class:`street-piece${resultClass}${display==='normal'&&state.selected===piece.id?' selected':''}${display==='normal'&&!streetPlayerMode()&&issues.has(piece.id)?' invalid':''}`,'data-piece':piece.id,style:display==='guess'?`--street-piece-color:${color}`:''});
      const attrs={points:pointsAttr(geo.poly),fill:display==='guess'?'none':color};
      if(display==='guess')Object.assign(attrs,{stroke:color,'stroke-width':2.2,'vector-effect':'non-scaling-stroke'});
      const body=svgEl('polygon',attrs);
      if(display!=='guess'&&geo.definition.renderBody!==false)group.appendChild(body);
      else if(display==='normal'&&geo.definition.renderBody===false)group.appendChild(svgEl('polygon',{points:pointsAttr(geo.poly),fill:'transparent','pointer-events':'all',class:'street-piece-hit-area'}));
      visualWallPolygonsFor(geo,display!=='guess').forEach(wall=>{
        const wallAttrs={points:pointsAttr(wall),fill:display==='guess'?'none':color,class:'street-wall'};
        if(display==='guess')Object.assign(wallAttrs,{stroke:color,'stroke-width':2.2,'vector-effect':'non-scaling-stroke'});
        group.appendChild(svgEl('polygon',wallAttrs));
      });
      if(display==='guess'&&geo.definition.renderBody!==false)group.appendChild(body);
      if(display==='normal')attachPieceGesture(group,piece);
      svg.appendChild(group);
    };
    if(streetPlayerMode()&&state.over){
      if(state.showSecret!==false)state.secretPieces.filter(piece=>piece.anchor).forEach(piece=>appendPiece(piece,'secret'));
      if(state.showGuess!==false)state.pieces.filter(piece=>piece.anchor).forEach(piece=>appendPiece(piece,'guess'));
    }else state.pieces.filter(piece=>piece.anchor).forEach(piece=>appendPiece(piece));
    state.coords.forEach(item=>{
      const tri=BOARD.triangles.find(t=>t.id===item.triangle);if(!tri)return;
      const center=triangleCenter(tri);
      if(item.empty){
        const group=svgEl('g',{class:'street-coordinate-empty'}),radius=5.2;
        group.appendChild(svgEl('line',{x1:center.x-radius,y1:center.y-radius,x2:center.x+radius,y2:center.y+radius}));
        group.appendChild(svgEl('line',{x1:center.x+radius,y1:center.y-radius,x2:center.x-radius,y2:center.y+radius}));
        svg.appendChild(group);
      }else svg.appendChild(svgEl('circle',{cx:center.x,cy:center.y,r:5.5,fill:item.hex,class:'street-coordinate-color'}));
    });
    if(streetPieceSurvey.active&&officialStreetCreationActive()){
      const surveyGroup=svgEl('g',{class:'street-survey-overlay'});
      BOARD.triangles.forEach(triangle=>{
        const center=triangleCenter(triangle),label=svgEl('text',{x:center.x,y:center.y,'text-anchor':'middle','dominant-baseline':'central',class:'street-survey-triangle-id'});
        label.textContent=triangle.id;surveyGroup.appendChild(label);
      });
      streetPieceSurvey.walls.forEach(([start,end])=>{
        const a=screenPoint(surveyVertexFromKey(start)),b=screenPoint(surveyVertexFromKey(end));
        surveyGroup.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'street-survey-wall'}));
      });
      [...BOARD.vertices.values()].forEach(vertex=>{
        const point=screenPoint(vertex),selected=streetPieceSurvey.wallStart===surveyVertexKey(vertex);
        const hit=svgEl('circle',{cx:point.x,cy:point.y,r:3.4,class:`street-survey-vertex${selected?' selected':''}`});
        hit.addEventListener('click',event=>{event.stopPropagation();selectSurveyVertex(vertex);render();});surveyGroup.appendChild(hit);
        const label=svgEl('text',{x:point.x+3.7,y:point.y-3.7,class:'street-survey-vertex-label'});label.textContent=`${vertex.q},${vertex.r}`;surveyGroup.appendChild(label);
      });
      svg.appendChild(surveyGroup);
    }
    svg.appendChild(labelGroup);
  }
  function findTraceAt(edgeIndex,directionIndex){
    return state.traces.find(trace=>(trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex)||(trace.exit?.index===edgeIndex&&trace.exitDirectionIndex===directionIndex));
  }
  function traceExitInfo(trace,edgeIndex,directionIndex){
    if(!trace?.exit)return '';
    const fromEntry=trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex;
    const partner=fromEntry?trace.exit:trace.entry;
    const partnerDirection=fromEntry?trace.exitDirectionIndex:trace.entryDirectionIndex;
    return partner?`${partner.label}${directionArrowText(partner,partnerDirection)}`:'';
  }
  function traceControl(edgeIndex,directionIndex){
    const board=byId('streetBoard');
    return board.querySelector(`[data-edge="${edgeIndex}"][data-direction="${directionIndex}"]`)||board.querySelector(`[data-label-edge="${edgeIndex}"]`);
  }
  function pulseStreetControl(edgeIndex,directionIndex){
    const control=traceControl(edgeIndex,directionIndex);if(!control)return;
    control.classList.remove('pulse');void control.getBoundingClientRect();control.classList.add('pulse');
    setTimeout(()=>control.classList.remove('pulse'),1000);
  }
  function showStreetBubble(element,text){
    if(!element)return;
    let bubble=byId('labelBubble');
    if(!bubble){bubble=document.createElement('div');bubble.id='labelBubble';bubble.className='label-bubble';document.body.appendChild(bubble);}
    bubble.textContent=text;bubble.style.whiteSpace='pre';bubble.classList.add('show');
    const rect=element.getBoundingClientRect(),width=bubble.offsetWidth,height=bubble.offsetHeight,margin=8;
    let left=rect.left+rect.width/2;left=Math.max(width/2+margin,Math.min(window.innerWidth-width/2-margin,left));
    const above=rect.top-height-10>=0;bubble.classList.toggle('below',!above);bubble.style.left=`${left}px`;bubble.style.top=`${above?rect.top:rect.bottom}px`;
    clearTimeout(showStreetBubble._timer);showStreetBubble._timer=setTimeout(()=>bubble.classList.remove('show'),1600);
  }
  function showStreetTraceFeedback(trace,edgeIndex,directionIndex){
    const origin=trace.entry.index===edgeIndex&&trace.entryDirectionIndex===directionIndex;
    const partner=origin?trace.exit:trace.entry;
    const partnerDirection=origin?trace.exitDirectionIndex:trace.entryDirectionIndex;
    let text;
    if(!trace.exit)text=trace.loop?'Onde prisonnière':'Aucune sortie';
    else if(trace.exit.index===trace.entry.index)text=`${trace.entry.label} ↔\n${trace.color.name}`;
    else text=`Sort en ${partner.label} ${directionArrowText(partner,partnerDirection)}\n${trace.color.name}`;
    const control=traceControl(edgeIndex,directionIndex);showStreetBubble(control,text);pulseStreetControl(edgeIndex,directionIndex);
    if(partner)pulseStreetControl(partner.index,partnerDirection);
  }
  function showPreviewWave(edgeIndex,directionIndex,realTrace=null){
    if(!state.started||!streetPlayerMode()||!state.waveModeActive)return;
    state.previewWave={edgeIndex,directionIndex};
    render();
    if(realTrace)setTimeout(()=>showStreetTraceFeedback(realTrace,edgeIndex,directionIndex),0);
  }
  function activateStreetWaveControl(edgeIndex,directionIndex,knownTrace=null){
    const usedTrace=knownTrace||findTraceAt(edgeIndex,directionIndex);
    // En mode « Afficher une onde », une direction ne doit jamais créer
    // d'entrée réelle dans l'historique : elle ne fait qu'afficher le trajet.
    if(streetPlayerMode()&&state.waveModeActive){
      showPreviewWave(edgeIndex,directionIndex,usedTrace);
      const edge=BOARD.boundary[edgeIndex];
      if(streetTutorial.active&&streetTutorialWaveMatches(edge,directionIndex))streetTutorialAfterWave(edgeIndex,directionIndex);
      return;
    }
    if(usedTrace){showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);return;}
    launchWave(edgeIndex,directionIndex);
  }
  function launchWave(edgeIndex,directionIndex){
    if(!state.started)return;
    const usedTrace=findTraceAt(edgeIndex,directionIndex);
    if(usedTrace)return showStreetTraceFeedback(usedTrace,edgeIndex,directionIndex);
    if(!streetPlayerMode()&&validatePieces(state.pieces).size)return setMessage('Corrige les placements rouges avant de lancer une onde.',true);
    const trace=traceRay(edgeIndex,directionIndex,queryPieces());
    trace.time=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    state.traces.push(trace);
    if(streetPlayerMode()&&state.waveModeActive)state.previewWave={edgeIndex,directionIndex};
    render();void recordStreetAction('ray');streetTutorialAfterWave(edgeIndex,directionIndex);setTimeout(()=>showStreetTraceFeedback(trace,edgeIndex,directionIndex),0);
  }
  function launchAllStreetWaves(){
    if(state.mode!=='gm')return;
    if(!state.started){showToast('Démarre d’abord le test de la grille.');return;}
    if(validatePieces(state.pieces).size){setMessage('Corrige les placements rouges avant de lancer les ondes.',true);return;}
    const time=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    let added=0;
    BOARD.boundary.forEach((edge,edgeIndex)=>edge.directions.forEach((_direction,directionIndex)=>{
      if(findTraceAt(edgeIndex,directionIndex))return;
      const trace=traceRay(edgeIndex,directionIndex,queryPieces());trace.time=time;state.traces.push(trace);added++;
    }));
    clearDirectionChoicesTimer();selectedWaveEdge=null;render();
    showToast(added?`${added} onde${added>1?'s':''} ajoutée${added>1?'s':''}.`:'Toutes les ondes sont déjà affichées.');
  }
  function directionArrowText(edge,directionIndex){
    const direction=edge?.directions?.[directionIndex];if(!direction)return '';
    const angle=Math.atan2(direction.y,direction.x)*180/Math.PI;
    if(angle>=-30&&angle<30)return '→';
    if(angle>=30&&angle<90)return '↘';
    if(angle>=90&&angle<150)return '↙';
    if(angle>=150||angle<-150)return '←';
    if(angle>=-150&&angle<-90)return '↖';
    return '↗';
  }
  function historyDirectionArrow(edge,directionIndex){
    const direction=edge?.directions?.[directionIndex];if(!direction)return '';
    const angle=Math.atan2(direction.y,direction.x)*180/Math.PI;
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" transform="rotate(${angle} 8 8)"/></svg>`;
  }
  function historyEndpoint(edge,directionIndex){
    return `<b>${edge.label} <span class="street-history-arrow">${historyDirectionArrow(edge,directionIndex)}</span></b>`;
  }
  function renderHistory(){
    const host=byId('streetHistory'),items=[];
    state.coords.slice().reverse().forEach(item=>{
      const marker=`<span class="street-history-swatch" style="--street-result:${item.empty?'#6b6355':item.hex}"></span>`;
      items.push(`<li class="street-history-item">${marker}<span><b>${item.text}</b> — ${item.name}</span>${item.time?`<span class="street-history-time">${item.time}</span>`:''}</li>`);
    });
    state.traces.slice().reverse().forEach(trace=>{
      const color=trace.color||resolveStreetColor(new Set(trace.colors||[]));
      const entry=historyEndpoint(trace.entry,trace.entryDirectionIndex);
      const exit=trace.exit?historyEndpoint(trace.exit,trace.exitDirectionIndex):'';
      const result=trace.loop?`${entry} — Prisonnière`:(!trace.exit?`${entry} — Sans sortie`:(trace.exit.index===trace.entry.index?`${entry} ↔ ${exit}`:`${entry} — ${exit}`));
      const special=color.name==='Transparent'?' transparent':'';
      items.push(`<li class="street-history-item"><span class="street-history-swatch${special}" style="--street-result:${color.hex}"></span><span>${result} — ${color.name}</span>${trace.time?`<span class="street-history-time">${trace.time}</span>`:''}</li>`);
    });
    host.innerHTML=items.length?items.join(''):'<li class="empty">Aucun coup joué.</li>';
    byId('streetHistoryMoveCount').textContent=`${state.traces.length}🔦 / ${state.coords.length}📍`;
  }
  function toggleHistory(forceOpen){
    const disclosure=byId('streetHistoryDisclosure');
    const open=forceOpen===undefined?disclosure.classList.contains('collapsed'):!!forceOpen;
    disclosure.classList.toggle('collapsed',!open);
    byId('streetHistoryToggle').setAttribute('aria-expanded',String(open));
    byId('streetHistoryToggleIndicator').textContent=open?'−':'+';
  }
  function setMessage(text,error=false){const el=byId('streetStartBlockMsg');el.textContent=text;el.style.color=error?'#f5b8ae':'var(--text-faint)';}
  function elapsedMs(){return Math.max(0,Date.now()-(state.startedAt||Date.now()));}
  function streetSummaryLabel(decoded={version:state.profile?2:1,profile:state.profile,centralZone:state.centralZone,pieces:state.secretPieces.length?state.secretPieces:state.pieces}){
    if(decoded.version!==2)return 'Orapa Street';
    const profile=STREET_V2_PROFILES[decoded.profile]?.label||'Libre';
    const options=decoded.profile==='free'?` · ${streetPlacedPieces(decoded.pieces||[]).length} 🧩 · ⬢${decoded.centralZone?'✅':'❌'}`:` · ${profile}`;
    return `Orapa Street v2${options}`;
  }
  function streetSummary(success=state.result==='win'){
    const name=currentPlayerAccount?.display_name||'Anonyme',cost=state.traces.length+state.coords.length*3,date=new Date().toLocaleDateString('fr-FR');
    return `${streetSummaryLabel()} · ${date}\n${name} - ${success?'🏅':'😞'} - ${cost} pts (${state.traces.length}🔦/${state.coords.length}📍) - ID: ${publicGridId(state.gridId)}\nhttps://argone57.github.io/Orapa-Mine/`;
  }
  function ensureStreetModal(){
    let backdrop=byId('streetResultModal');if(backdrop)return backdrop;
    backdrop=document.createElement('div');backdrop.id='streetResultModal';backdrop.className='modal-backdrop';
    backdrop.innerHTML='<div class="modal"><button class="close-x" id="streetResultClose">×</button><h2 id="streetResultTitle"></h2><p id="streetResultMessage"></p><div class="ranking-row-detail" id="streetResultScore" style="margin-left:0;font-size:.85rem;"></div><div id="streetResultRank" style="margin-top:4px;color:var(--gold-bright);font-size:.83rem;"></div><div class="ranking-row-id" style="margin-left:0;margin-top:12px;">Grille : <b id="streetResultId"></b></div><div id="streetResultActions" class="controls victory-actions" data-orapa-myludo-result="false" style="justify-content:flex-end;margin-top:16px;"><button class="primary" id="streetResultRanking">🏆 Classement</button><button class="ghost" id="streetResultCopyId">📋 Copier ID</button><button class="ghost" id="streetResultCopy">📋 Copier résumé</button></div></div>';
    document.body.appendChild(backdrop);
    byId('streetResultClose').onclick=()=>backdrop.classList.remove('open');
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)backdrop.classList.remove('open');});
    byId('streetResultCopyId').onclick=()=>{const id=publicGridId(state.gridId);navigator.clipboard?.writeText(id).then(()=>showToast('Identifiant copié : '+id));};
    byId('streetResultCopy').onclick=()=>navigator.clipboard?.writeText(streetSummary()).then(()=>showToast('Résumé copié !'));
    byId('streetResultRanking').onclick=()=>{backdrop.classList.remove('open');openStreetRanking(state.gridId,false,true);};
    return backdrop;
  }
  function openStreetResultModal(){
    if(state.mode!=='solo'||!state.over)return;
    const success=state.result==='win',time=Number.isFinite(state.finalTimeMs)?state.finalTimeMs:elapsedMs(),cost=state.traces.length+state.coords.length*3;
    const modal=ensureStreetModal();
    byId('streetResultTitle').textContent=success?'🏆 Victoire !':'💥 Défaite';
    const count=state.secretPieces.length;
    byId('streetResultMessage').textContent=state.gridRanked===false
      ?`${success?`Tu as retrouvé la disposition exacte des ${count} pièces !`:'La seconde proposition est incorrecte : la grille secrète est révélée.'} Cette nouvelle partie n’est pas enregistrée car cette grille a déjà été jouée avec ce compte.`
      :(success?`Tu as retrouvé la disposition exacte des ${count} pièces !`:'La seconde proposition est incorrecte : la grille secrète est révélée.');
    byId('streetResultScore').textContent=`${cost} pts (${state.traces.length}🔦 + ${state.coords.length}📍) · ${formatDuration(time)}`;
    byId('streetResultRank').textContent=state.rank?`Classé #${state.rank} dans « classement global de la grille »`:'';
    byId('streetResultId').textContent=`Orapa Street · ${publicGridId(state.gridId)}`;
    modal.classList.add('open');
  }
  async function openStreetRanking(gridId,returnToAccount=false,returnToResult=false){
    return openGridRanking(gridId,returnToAccount,false,returnToResult);
  }
  function openStreetRowsModal(title,rows,empty='Aucune partie enregistrée.'){
    let modal=byId('streetRowsModal');if(!modal){modal=document.createElement('div');modal.id='streetRowsModal';modal.className='modal-backdrop';document.body.appendChild(modal);}
    modal.innerHTML=`<div class="modal"><button class="close-x" id="streetRowsClose">×</button><h2>${title}</h2><div class="ranking-list">${rows.length?rows.map((row,index)=>`<button class="ranking-row street-row-open" data-index="${index}" style="width:100%;text-align:left"><span>${row.player_name?escapeHtml(row.player_name):`<b>${escapeHtml(publicGridId(row.grid_id))}</b>`}</span><span>${row.success===undefined?`${row.participation_count||0} 👥`:`${row.success?'✅':'❌'} ${row.cost} pts · ${formatDuration(row.time_ms)}`}</span></button>`).join(''):`<div class="history-empty">${empty}</div>`}</div></div>`;
    byId('streetRowsClose').onclick=()=>modal.classList.remove('open');
    modal.querySelectorAll('.street-row-open').forEach(button=>button.onclick=()=>{
      const row=rows[Number(button.dataset.index)];if(!row.grid_id)return;
      const fromAccountList=byId('gridDataModal')?.classList.contains('open');
      modal.classList.remove('open');
      openStreetRanking(row.grid_id,fromAccountList);
    });
    modal.classList.add('open');
  }
  async function openStreetGlobalHistory(){selectGridHistoryMode('street');byId('rankingsModal')?.classList.add('open');}
  async function openStreetCatalog(){try{const rows=await supabaseRpc('orapa_street_grid_catalog',{p_sort:'popular',p_limit:100,p_offset:0,p_session_token:currentPlayerAccount?.session_token||''});openStreetRowsModal('🏠 Grilles Orapa Street',rows||[],'Aucune grille Street partagée.');}catch(error){showErrorToast(error.message);}}
  async function openMyStreetHistory(){return openMyStreetGridHistory();}
  async function openMySharedStreet(){try{const rows=await supabaseRpc('orapa_my_shared_street_grids',{p_session_token:currentPlayerAccount.session_token,p_limit:100,p_offset:0});openStreetRowsModal('🏠 Mes grilles Street partagées',rows||[],'Aucune grille Street partagée.');}catch(error){showErrorToast(error.message);}}
  async function finishStreetAttempt(success){
    state.over=true;state.result=success?'win':'lose';
    const cost=state.traces.length+state.coords.length*3,time=elapsedMs();state.finalTimeMs=time;
    let submitted=null;
    const closingAttempt=streetAttempt;
    if(state.gridRanked!==false)try{
        submitted=await supabaseRpc('orapa_submit_street_grid_score',{p_grid_id:state.gridId,p_session_token:currentPlayerAccount.session_token,p_success:success,p_cost:cost,p_ray_count:state.traces.length,p_coord_count:state.coords.length,p_time_ms:time,p_first_try:success&&state.attempts===0});
        if(activeAttempt?.attempt_id===closingAttempt?.attempt_id)activeAttempt=null;
        streetAttempt=null;state.rank=Number(submitted?.rank)||null;
      }catch(error){showErrorToast(`Enregistrement Street impossible : ${error.message}`);}
    else {streetAttempt=null;state.rank=null;}
    render();
    ensureStreetModal();
    byId('streetResultActions').dataset.orapaMyludoResult=state.gridRanked===false||submitted?.accepted===false?'false':'true';
    document.dispatchEvent(new Event('orapa:myludo-buttons-refresh'));
    openStreetResultModal();
  }
  async function proposeStreetSolution(){
    if(state.mode!=='solo'||state.over||state.pieces.some(piece=>!piece.anchor)||validatePieces(state.pieces,true).size)return;
    if(state.gridRanked!==false)try{
        const current=await supabaseRpc('orapa_get_active_attempt',{p_session_token:currentPlayerAccount.session_token});
        if(!current||current.game_kind!=='street'||current.reference!==state.gridId){showErrorToast('Cette tentative Street n’est plus active. Elle a peut-être été terminée sur un autre appareil.');return;}
        streetAttempt=current;
      }catch(error){showErrorToast('Impossible de vérifier la tentative avant la proposition.');return;}
    if(guessIsCorrect()){await recordStreetAction('proposal');await finishStreetAttempt(true);return;}
    state.attempts++;
    await recordStreetAction('proposal');
    if(state.attempts>=2){await finishStreetAttempt(false);return;}
    render();setTimeout(openIncorrectSolutionModal,60);
  }
  async function loadStreetPreference(){
    if(!currentPlayerAccount?.session_token)return;
    try{const value=await supabaseRpc('orapa_get_street_preferences',{p_session_token:currentPlayerAccount.session_token});if(['auto','arrows','choices'].includes(value?.wave_controls))wavePreference=value.wave_controls;}catch(error){console.warn('Préférence Street indisponible',error);}
  }
  async function shareStreet(){
    const id=encodeStreetGrid(state.pieces);if(!id)return;
    try{await supabaseRpc('orapa_share_street_grid',{p_grid_id:id,p_session_token:currentPlayerAccount.session_token});state.gridId=id;state.gridAlias=await ensureGridAlias(id,'street');await navigator.clipboard?.writeText(gridChallengeText(id));showToast('Grille Street partagée et identifiant copié !');}
    catch(error){showErrorToast(`Partage impossible : ${error.message}`);}
  }
  function render(){
    renderPalette();renderBoard();renderHistory();
    const v2=!!streetProfileConfig(state.profile),v2Creation=state.mode==='gm'&&!state.started&&v2;
    const issues=validatePieces(state.pieces,true,streetRules()),placed=state.pieces.filter(p=>p.anchor).length;
    const profileIssues=v2?streetProfileIssues(state.pieces,state.profile):[];
    const complete=v2?(!issues.size&&!profileIssues.length):placed===PIECES.length&&!issues.size;
    const canStart=complete;
    const preStart=!state.started;
    const showPalette=preStart||(streetPlayerMode()&&!state.over&&(!streetTutorial.active||streetTutorial.puzzle));
    byId('streetRandom').hidden=!preStart||state.mode!=='gm';
    byId('streetShare').hidden=!preStart||state.mode!=='gm';
    byId('streetStart').hidden=!preStart;
    const streetEnd=byId('streetEnd');
    const showAttemptCounter=state.mode==='solo'&&state.started&&!state.over;
    streetEnd.hidden=preStart||state.over||streetTutorial.active;
    streetEnd.classList.toggle('primary',state.mode==='solo');
    streetEnd.classList.toggle('danger',state.mode==='gm');
    streetEnd.classList.toggle('has-attempt-counter',showAttemptCounter);
    if(showAttemptCounter){
      const remaining=Math.max(1,2-(Number(state.attempts)||0));
      streetEnd.innerHTML=`<span>✅ Proposer une solution</span><span class="attempt-counter${remaining===1?' last':''}" aria-label="${remaining} proposition${remaining>1?'s':''} restante${remaining>1?'s':''}" title="Propositions restantes">${remaining} essai${remaining>1?'s':''}</span>`;
    }else streetEnd.textContent=state.mode==='gm'?'🏁 Fin de partie':'Proposer une solution';
    streetEnd.disabled=state.mode==='solo'&&!complete;
    byId('streetStart').disabled=!canStart;
    byId('streetShare').disabled=!complete;
    byId('streetPaletteTitle').style.display=showPalette?'flex':'none';
    byId('streetPalette').style.display=showPalette?'flex':'none';
    byId('streetSetupHint').style.display=showPalette?'block':'none';
    byId('streetSetupHint').textContent='Glisse une pièce sur la grille · tape dessus pour la faire pivoter de 60° · reste appuyé pour la retourner en miroir';
    byId('streetStartBlockMsg').style.display=preStart?'block':'none';
    const pieceSetToggle=byId('streetPieceSetToggle');
    pieceSetToggle.hidden=true;
    const surveyToggle=byId('streetSurveyToggle'),surveyTools=byId('streetSurveyTools');
    surveyToggle.hidden=!(v2Creation&&streetSurveyUnlocked);
    surveyToggle.setAttribute('aria-pressed',String(streetPieceSurvey.active&&v2Creation));
    surveyToggle.textContent=streetPieceSurvey.active?'Fin du relevé':'Relever';
    surveyTools.hidden=!(v2Creation&&streetSurveyUnlocked&&streetPieceSurvey.active);
    if(v2Creation&&streetPieceSurvey.active){
      const count=streetPieceSurvey.triangles.size,walls=streetPieceSurvey.walls.length;
      byId('streetSurveyStatus').textContent=streetPieceSurvey.wallStart?`Sommet de départ choisi : sélectionne le sommet d’arrivée. (${count} triangles, ${walls} mur${walls>1?'s':''})`:`${count} triangle${count>1?'s':''} · ${walls} mur${walls>1?'s':''}. Clique deux sommets pour ajouter un mur.`;
    }
    const profileControls=byId('streetProfileControls'),profileSelect=byId('streetProfileSelect'),centralControl=byId('streetCentralZoneControl'),centralInput=byId('streetCentralZone');
    profileControls.hidden=!v2Creation;profileSelect.value=state.profile||'normal';centralControl.hidden=state.profile!=='free';centralInput.checked=state.centralZone!==false;
    byId('streetWaveSetting').hidden=true;
    byId('streetWavePreference').value=wavePreference;
    const showCellTools=streetPlayerMode()&&state.started&&!state.over&&(!streetTutorial.active||streetTutorial.puzzle);
    byId('streetCellTools').hidden=!showCellTools;
    byId('streetHint').classList.toggle('active',showCellTools&&state.tool==='hint');
    byId('streetHint').textContent=state.tool==='hint'?'🔍 Mode indice activé':'🔍 Demander un indice';
    byId('streetDraft').classList.toggle('active',showCellTools&&state.tool==='draft');
    byId('streetDraft').textContent=state.tool==='draft'?'◻️ Masquage activé':'◻️ Masquer les cases';
    byId('streetShowWave').classList.toggle('active',showCellTools&&state.waveModeActive);
    byId('streetShowWave').textContent=state.waveModeActive?'〽️ Mode onde activé':'〽️ Afficher une onde';
    byId('streetShowWave').classList.toggle('street-tutorial-target',streetTutorial.active&&streetTutorial.stage===6&&streetTutorial.phase===0);
    byId('streetDraft').classList.toggle('street-tutorial-target',streetTutorial.active&&streetTutorial.stage===6&&streetTutorial.phase===4);
    const showResultTools=state.mode==='solo'&&state.over;
    byId('streetResultTools').hidden=!showResultTools;
    byId('streetToggleGuess').textContent=`${state.showGuess===false?'🚫':'👁'} Mes pièces`;
    byId('streetToggleSecret').textContent=`${state.showSecret===false?'🚫':'👁'} Pièces à trouver`;
    const pill=byId('streetPrototype').querySelector('.mode-pill');
    pill.classList.toggle('live',state.started);
    pill.querySelector('span:last-child').textContent=streetTutorial.active?'Tutoriel interactif':(state.over?(state.result==='win'?'Victoire':'Défaite'):(state.started?(state.mode==='solo'?'Partie en cours':'Test de la grille'):'Placement des pièces'));
    if(preStart){clearDirectionChoicesTimer();selectedWaveEdge=null;}
    if(state.started)setMessage('',false);
    else if(profileIssues.length)setMessage(profileIssues[0],true);
    else if(issues.size)setMessage([...new Set(issues.values())][0],true);
    else setMessage('');
  }
  function ensureStreetTutorialCoach(){
    let coach=byId('streetTutorialCoach');
    if(coach)return coach;
    coach=document.createElement('aside');coach.id='streetTutorialCoach';coach.className='street-tutorial-coach';
    coach.innerHTML='<button class="street-tutorial-close" type="button" aria-label="Quitter le tutoriel">×</button><h3></h3><div class="street-tutorial-copy"></div><div class="street-tutorial-step"></div><div class="street-tutorial-actions"><button class="ghost street-tutorial-minimize" type="button">Réduire</button><button class="primary" type="button"></button></div>';
    coach.querySelector('.street-tutorial-close').addEventListener('click',()=>requestStreetTutorialExit());
    coach.querySelector('.street-tutorial-minimize').addEventListener('click',event=>{event.stopPropagation();coach.classList.add('minimized');});
    coach.addEventListener('click',event=>{if(coach.classList.contains('minimized')&&!event.target.closest('.street-tutorial-close'))coach.classList.remove('minimized');});
    coach.querySelector('.street-tutorial-actions .primary').addEventListener('click',()=>advanceStreetTutorial());
    document.body.appendChild(coach);return coach;
  }
  function streetTutorialContent(stage){
    const content={
      1:{title:'Bienvenue dans Orapa Street v2',text:'<p>Le principe est toujours le même, reconstituer la grille avec les différentes pièces.</p><p>Les 2 actions habituelles constituent toujours le cœur du jeu ; toutefois, compte tenu de la forme de la grille, la gestion des ondes est un peu différente.</p><br><p><strong>Il y a toutefois 2 nouvelles contraintes de placement :<br>– aucune pièce ne peut être placée dans la zone centrale, mais les ondes passent bien à travers<br>– il n’y a plus aucun contact possible entre 2 pièces, y compris par les angles.</strong></p><p><strong>– Contrairement à la règle officielle et pour simplifier, les nouvelles pièces v2 peuvent être retournées en miroir.</strong></p>',action:'Suivant'},
      2:{title:'Voilà à quoi ressemble une grille',text:'',action:'Suivant'},
      3:{title:'Deux directions possibles',text:'<p>La particularité de cette grille est qu’il peut y avoir 2 ondes qui partent depuis un même point de départ.<br>Pour gérer les 2 directions, il y a 2 options d’affichage : <strong>Cases</strong> et <strong>Flèches</strong>.</p><p>Vous pouvez changer à tout moment depuis les options de votre compte.<br>En auto, le mode d’affichage s’adaptera à la taille de l’écran (cases pour les petits écrans).</p><p>Ici, c’est la présentation en mode case, essayez :<br>Cliquer en <strong>J</strong> et choisir la direction vers <strong>14</strong>.</p>'},
      4:{title:'Les informations de sortie',text:'<p>Plusieurs informations s’affichent.<br>Les informations de sortie sont affichées directement dans les cases et celles-ci se colorent à moitié.<br>Si vous recliquez sur une case où vous avez déjà lancé une onde, vous verrez que la direction a également été remplacée par sa sortie.</p><p>Recliquez sur <strong>J</strong>.</p>'},
      5:{title:'Les rebonds',text:'<p>Comme vous pouvez le constater, il y a beaucoup plus de rebonds que dans les autres modes.</p><p>Cliquez sur <strong>11</strong> vers <strong>G</strong>.<br>Puis cliquez en <strong>C</strong> vers <strong>7</strong>.</p>',action:streetTutorial.waveIndex>=2?'Suivant':''},
      6:{title:'Afficher une onde',text:streetTutorial.phase===0
        ?'<p>Afin de vous aider, le mode <strong>Afficher une onde</strong> a été ajouté dans ce mode.</p><p>Activez le mode.</p>'
        :streetTutorial.phase===1
          ?'<p>Cliquez en <strong>8</strong> vers <strong>D</strong>.</p>'
          :streetTutorial.phase===2
            ?`<p>Cette onde n’est pas prise en compte pour la résolution de la grille mais vous aide à placer les pièces.<br>Elle réagit en temps réel aux pièces que vous placez sur son chemin.</p><p>${[
              'Placez la pièce en surbrillance à l’emplacement indiqué. Retournez-la en miroir pour l’orienter correctement.',
              'Placez cette pièce jaune à l’emplacement indiqué.',
              'Placez cette pièce bleue à l’emplacement indiqué.',
              'Placez cette pièce blanche à l’emplacement indiqué.'
            ][streetTutorial.draftIndex]||'Placez la pièce à l’emplacement indiqué.'}</p>`
            :streetTutorial.phase===3
              ?streetTutorial.waveIndex===0
                ?'<p>Tant que le mode onde est activé, vous pouvez la lancer depuis différents points de départ.</p><p>Cliquez sur <strong>13</strong> vers <strong>3</strong>.</p>'
                :'<p>Cliquez sur <strong>H</strong> vers <strong>5</strong>.</p>'
              :streetTutorial.phase===4
                ?'<p>Vous pouvez également combiner le mode pour masquer les cases tout en laissant le mode onde activé.</p><p>Activez le mode <strong>Masquer les cases</strong>.</p>'
                :'<p>Cliquez sur les 3 premières cases surlignées de la ligne <strong>4</strong> vers <strong>G</strong>.</p>',action:''},
      7:{title:'Bonus sur PC',text:'<p>Vous pouvez lancer l’onde de test sans activer le mode en faisant un clic droit sur les cases ou les flèches.</p><p>Vous pouvez activer le mode <strong>Masquer les cases</strong> en appuyant sur la touche <strong>Tab</strong>.</p><p>Vous pouvez directement masquer ou réafficher les cases en faisant un clic droit sur les cases de la grille.</p>',action:'Suivant'},
      8:{title:'Aperçu terminé',text:'<p>Voilà, vous avez un aperçu d’Orapa Street, enfin en espérant que ça sera bien comme ça quand on en saura plus sur le jeu 🙂</p><p>N’hésitez pas à utiliser le mode création de grille en faisant « Démarrer la partie » après avoir placé toutes les pièces, cela vous permettra de mieux voir les interactions.</p><p>Et bon courage !</p>',action:'Terminer'}
    };
    return content[stage]||content[1];
  }
  function streetTutorialShow(){
    if(!streetTutorial.active)return;
    const coach=ensureStreetTutorialCoach(),content=streetTutorialContent(streetTutorial.stage);
    coach.classList.remove('minimized');
    coach.querySelector('.street-tutorial-step').textContent=`Étape ${Math.min(streetTutorial.stage,6)}`;
    coach.querySelector('h3').textContent=content.title;
    coach.querySelector('.street-tutorial-copy').innerHTML=content.text;
    const action=coach.querySelector('.street-tutorial-actions .primary');
    action.hidden=!content.action;action.textContent=content.action||'';
    streetTutorialSaveProgress();
  }
  function streetTutorialDemoState(){
    state={mode:'tutorial',pieces:streetTutorial.secretPieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null})),secretPieces:streetTutorial.secretPieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null})),selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:STREET_TUTORIAL_REFERENCE,gridAlias:STREET_TUTORIAL_REFERENCE,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
    Object.assign(state,{profile:'sherlock7',centralZone:true,pieceSet:'official'});
    streetTutorial.puzzle=false;clearDirectionChoicesTimer();selectedWaveEdge=null;toggleHistory(false);
  }
  function streetTutorialIntroState(){
    state={mode:'tutorial',pieces:freshPieces(),secretPieces:streetTutorial.secretPieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null})),selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:STREET_TUTORIAL_REFERENCE,gridAlias:STREET_TUTORIAL_REFERENCE,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
    Object.assign(state,{profile:'sherlock7',centralZone:true,pieceSet:'official',pieces:freshPieces(STREET_PIECES)});
    streetTutorial.puzzle=false;clearDirectionChoicesTimer();selectedWaveEdge=null;toggleHistory(false);
  }
  function streetTutorialPuzzleState(){
    state={mode:'tutorial',profile:'normal',centralZone:true,pieceSet:'official',pieces:STREET_PIECES.map(definition=>{const target=streetTutorialTargetPiece(definition.id);return target?{...target,anchor:null,flipped:definition.id==='red1'?false:target.flipped}:{id:definition.id,anchor:null,rotation:0,flipped:false};}),secretPieces:streetTutorial.secretPieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null})),selected:'red1',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
    streetTutorial.puzzle=true;streetTutorial.draftIndex=0;streetTutorial.phase=0;clearDirectionChoicesTimer();selectedWaveEdge=null;toggleHistory(false);
  }
  function advanceStreetTutorial(){
    if(!streetTutorial.active)return;
    if(streetTutorial.stage===1){streetTutorialDemoState();streetTutorial.stage=2;}
    else if(streetTutorial.stage===2)streetTutorial.stage=3;
    else if(streetTutorial.stage===5&&streetTutorial.waveIndex>=2){streetTutorialPuzzleState();streetTutorial.stage=6;}
    else if(streetTutorial.stage===7)streetTutorial.stage=8;
    else if(streetTutorial.stage===8){void completeStreetTutorial();return;}
    streetTutorialShow();render();
  }
  function streetTutorialLoadProgress(){
    try{const saved=JSON.parse(localStorage.getItem(STREET_TUTORIAL_PROGRESS_KEY)||'null');return saved?.version===1&&saved?.streetTutorial&&saved?.state?saved:null;}catch(_error){return null;}
  }
  function streetTutorialSaveProgress(){
    if(!streetTutorial.active)return;
    try{localStorage.setItem(STREET_TUTORIAL_PROGRESS_KEY,JSON.stringify({version:1,streetTutorial,state}));}catch(_error){}
  }
  function streetTutorialClearProgress(){try{localStorage.removeItem(STREET_TUTORIAL_PROGRESS_KEY);}catch(_error){}}
  function closeStreetTutorialModal(id){byId(id)?.classList.remove('open');}
  function requestStreetTutorialExit(){
    if(!streetTutorial.active)return;
    streetTutorialSaveProgress();byId('streetTutorialExitModal')?.classList.add('open');
  }
  async function beginStreetTutorial(){
    const previousPreference=wavePreference;
    applyWavePreference('choices',false);
    streetTutorial={active:true,stage:1,puzzle:false,secretPieces:STREET_TUTORIAL_DEMO.map(piece=>({...piece,anchor:{...piece.anchor}})),draftIndex:0,preference:previousPreference,waveIndex:0,phase:0};
    streetTutorialIntroState();
    byId('streetPrototype').querySelector('.subtitle').textContent='Parcours interactif';
    byId('streetPrototype').querySelector('h1').textContent='🏠 Orapa Street v2';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');
    streetTutorialShow();render();return true;
  }
  async function startStreetTutorial(){
    if(streetTutorialLoadProgress()){byId('streetTutorialResumeModal')?.classList.add('open');return true;}
    return beginStreetTutorial();
  }
  function resumeStreetTutorial(){
    const saved=streetTutorialLoadProgress();
    if(!saved)return beginStreetTutorial();
    streetTutorial={...saved.streetTutorial,active:true};
    state=saved.state;state.mode='tutorial';state.started=true;
    applyWavePreference('choices',false);clearDirectionChoicesTimer();selectedWaveEdge=null;
    byId('streetPrototype').querySelector('.subtitle').textContent='Parcours interactif';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');
    closeStreetTutorialModal('streetTutorialResumeModal');streetTutorialShow();render();return true;
  }
  function endStreetTutorial(completed=false){
    if(!streetTutorial.active)return;
    if(completed)streetTutorialClearProgress();else streetTutorialSaveProgress();
    const preference=streetTutorial.preference;
    streetTutorial={active:false,stage:0,puzzle:false,secretPieces:[],draftIndex:0,preference:null,waveIndex:0,phase:0};
    if(preference)applyWavePreference(preference,false);
    clearDirectionChoicesTimer();selectedWaveEdge=null;byId('streetTutorialCoach')?.remove();
    byId('streetPrototype').hidden=true;document.body.classList.remove('street-open');document.body.classList.add('home-view');
  }
  async function completeStreetTutorial(){
    if(!currentPlayerAccount?.session_token){showErrorToast('Connecte-toi pour enregistrer la fin du tutoriel.');return;}
    try{
      const result=await supabaseRpc('orapa_complete_street_v2_tutorial',{p_session_token:currentPlayerAccount.session_token});
      if(!result?.completed)throw new Error('Enregistrement non confirmé');
      endStreetTutorial(true);
      if(result?.newly_unlocked){achievementCatalogCache=null;queueAchievementNotifications?.(['street_irregular']);}
    }catch(error){console.warn('Enregistrement du tutoriel Street impossible',error);showErrorToast('Enregistrement impossible : vérifie ta connexion puis réessaie.');}
  }
  function bind(){
    const create=byId('createStreetMode');
    if(!create)return;
    byId('streetPrototype').querySelector('.mode-pill').addEventListener('click',()=>{
      if(!officialStreetCreationActive())return;
      streetSurveyClicks++;
      if(streetSurveyClicks<5)return;
      streetSurveyClicks=0;streetSurveyUnlocked=!streetSurveyUnlocked;streetPieceSurvey.active=streetSurveyUnlocked;streetPieceSurvey.wallStart=null;
      showToast(streetSurveyUnlocked?'Outil de relevé temporaire activé.':'Outil de relevé masqué.');render();
    });
    create.addEventListener('click',()=>openCreation());
    byId('streetClose').addEventListener('click',()=>streetTutorial.active?requestStreetTutorialExit():close());
    byId('streetPieceSetToggle').addEventListener('click',()=>{
      if(state.profile)return;
      if(state.mode!=='gm'||state.started)return;
      resetStreetPieceSurvey();
      if(state.pieceSet==='official'){
        state.pieceSet='prototype';
        state.pieces=savedPrototypeCreationPieces||freshPieces();
        state.selected=state.pieces[0]?.id||'blueSmall';
      }else{
        savedPrototypeCreationPieces=state.pieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null}));
        state.pieceSet='official';
        state.pieces=freshPieces(STREET_PIECES);
        state.selected=state.pieces[0]?.id||'red1';
      }
      state.traces=[];state.coords=[];state.draftCells={};state.gridId=null;state.gridAlias=null;
      clearDirectionChoicesTimer();selectedWaveEdge=null;render();
    });
    byId('streetSurveyToggle').addEventListener('click',()=>{
      if(!officialStreetCreationActive())return;
      streetPieceSurvey.active=!streetPieceSurvey.active;
      if(!streetPieceSurvey.active)streetPieceSurvey.wallStart=null;
      render();
    });
    byId('streetSurveyClear').addEventListener('click',()=>{
      if(!officialStreetCreationActive())return;
      streetPieceSurvey.triangles.clear();streetPieceSurvey.walls=[];streetPieceSurvey.wallStart=null;render();
    });
    byId('streetSurveyCopy').addEventListener('click',async()=>{
      if(!officialStreetCreationActive())return;
      const payload=JSON.stringify(surveyPayload(),null,2);
      try{await navigator.clipboard?.writeText(payload);showToast('Relevé copié.');}
      catch(_error){showErrorToast('Copie impossible.');}
    });
    byId('streetSurveyCopyPlacements').addEventListener('click',async()=>{
      if(!officialStreetCreationActive())return;
      try{await navigator.clipboard?.writeText(JSON.stringify(surveyPlacementsPayload(),null,2));showToast('Placements copiés.');}
      catch(_error){showErrorToast('Copie impossible.');}
    });
    byId('streetRandom').addEventListener('click',()=>{if(state.started)return;if(!randomizePieces())setMessage('Impossible de trouver un placement valide. Réessaie.',true);render();});
    byId('streetProfileSelect').addEventListener('change',event=>{
      if(state.mode!=='gm'||state.started)return;
      const profile=event.target.value,existing=new Map(state.pieces.map(piece=>[piece.id,piece]));
      const definitions=streetAllowedDefinitions(profile);
      const available=new Set(definitions.map(definition=>definition.id));
      state.pieces=[...definitions.map(definition=>existing.get(definition.id)||freshPieces([definition])[0]),...state.pieces.filter(piece=>piece.anchor&&!available.has(piece.id))];
      state.profile=profile;state.centralZone=profile==='free'?byId('streetCentralZone').checked:true;
      if(!state.pieces.some(piece=>piece.id===state.selected))state.selected=state.pieces[0]?.id||'red1';
      state.gridId=null;state.gridAlias=null;render();
    });
    byId('streetCentralZone').addEventListener('change',event=>{if(state.mode!=='gm'||state.started||state.profile!=='free')return;state.centralZone=event.target.checked;render();});
    byId('streetStart').addEventListener('click',()=>{if(state.started||byId('streetStart').disabled)return;state.started=true;state.startedAt=Date.now();state.tool='pieces';state.traces=[];state.coords=[];clearDirectionChoicesTimer();selectedWaveEdge=null;toggleHistory(false);render();});
    byId('streetEnd').addEventListener('click',async()=>{
      if(state.mode==='gm'){
        if(!state.started||!await gameConfirm('Terminer cette partie et revenir à l’accueil ?','Fin de partie','Terminer','Annuler'))return;
        close(true);return;
      }
      await proposeStreetSolution();
    });
    byId('streetShare').addEventListener('click',()=>void shareStreet());
    byId('streetReset').addEventListener('click',async()=>{
      if(streetTutorial.active){requestStreetTutorialExit();return;}
      if(!confirm(state.mode==='solo'?'Abandonner cette partie et recommencer ?':'Effacer tous les placements et l’historique Street ?'))return;
      if(state.mode==='solo'&&streetAttempt?.attempt_id)try{const abandonedAttempt=streetAttempt;await supabaseRpc('orapa_abandon_street_attempt',{p_session_token:currentPlayerAccount.session_token,p_attempt_id:abandonedAttempt.attempt_id});if(activeAttempt?.attempt_id===abandonedAttempt.attempt_id)activeAttempt=null;streetAttempt=null;}catch(error){showErrorToast('Abandon impossible : '+error.message);return;}
      if(state.mode==='solo'){await openSolo();return;}
      Object.assign(state,{started:false,startedAt:null,finalTimeMs:null,over:false,result:null,attempts:0,secretPieces:[],waveModeActive:false,previewWave:null,showGuess:true,showSecret:true});
      toggleHistory(false);
      if(state.profile){
        resetV2Creation(state.profile,state.centralZone);render();return;
      }
      if(state.pieceSet==='official'){
        resetStreetPieceSurvey();
        state.pieces=freshPieces(STREET_PIECES);state.selected='red1';state.traces=[];state.coords=[];state.draftCells={};state.gridId=null;state.gridAlias=null;clearDirectionChoicesTimer();selectedWaveEdge=null;render();return;
      }
      resetStreetPieceSurvey();savedPrototypeCreationPieces=null;state={mode:'gm',pieceSet:'prototype',pieces:freshPieces(),secretPieces:[],selected:'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};clearDirectionChoicesTimer();selectedWaveEdge=null;render();
    });
    byId('streetHistoryToggle').addEventListener('click',()=>toggleHistory());
    byId('streetHint').addEventListener('click',()=>{if(streetTutorial.active){showErrorToast('Cette action n’est pas utilisée dans le tutoriel.');return;}state.tool=state.tool==='hint'?'pieces':'hint';clearDirectionChoicesTimer();selectedWaveEdge=null;render();});
    byId('streetDraft').addEventListener('click',()=>{
      if(streetTutorial.active){
        if(streetTutorial.stage!==6||streetTutorial.phase!==4){showErrorToast('Suis les étapes du tutoriel avant d’activer le masquage.');return;}
        state.tool='draft';streetTutorial.phase=5;streetTutorial.draftIndex=0;clearDirectionChoicesTimer();selectedWaveEdge=null;streetTutorialShow();render();return;
      }
      state.tool=state.tool==='draft'?'pieces':'draft';clearDirectionChoicesTimer();selectedWaveEdge=null;render();
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Tab'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
      if(byId('streetPrototype').hidden||!streetSoloShortcutActive())return;
      if(event.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();
      state.tool=state.tool==='draft'?'pieces':'draft';
      clearDirectionChoicesTimer();selectedWaveEdge=null;render();
    });
    byId('streetShowWave').addEventListener('click',()=>{
      if(streetTutorial.active&&(streetTutorial.stage!==6||streetTutorial.phase!==0)){showErrorToast('Suis l’étape indiquée par le tutoriel.');return;}
      state.waveModeActive=!state.waveModeActive;if(!state.waveModeActive)state.previewWave=null;clearDirectionChoicesTimer();selectedWaveEdge=null;
      if(streetTutorial.active&&state.waveModeActive){streetTutorial.phase=1;streetTutorialShow();}render();
    });
    byId('streetToggleGuess').addEventListener('click',()=>{state.showGuess=state.showGuess===false;render();});
    byId('streetToggleSecret').addEventListener('click',()=>{state.showSecret=state.showSecret===false;render();});
    byId('streetReplayResult').addEventListener('click',openStreetResultModal);
    const closeStreetExit=()=>closeStreetTutorialModal('streetTutorialExitModal');
    byId('streetTutorialExitContinue').addEventListener('click',closeStreetExit);
    byId('streetTutorialExitContinueX').addEventListener('click',closeStreetExit);
    byId('streetTutorialExitModal').addEventListener('click',event=>{if(event.target.id==='streetTutorialExitModal')closeStreetExit();});
    byId('streetTutorialExitConfirm').addEventListener('click',()=>{closeStreetExit();endStreetTutorial();});
    const closeStreetResume=()=>closeStreetTutorialModal('streetTutorialResumeModal');
    byId('streetTutorialResumeCancel').addEventListener('click',closeStreetResume);
    byId('streetTutorialResumeCancelX').addEventListener('click',closeStreetResume);
    byId('streetTutorialResumeModal').addEventListener('click',event=>{if(event.target.id==='streetTutorialResumeModal')closeStreetResume();});
    byId('streetTutorialResumeContinue').addEventListener('click',()=>void resumeStreetTutorial());
    byId('streetTutorialResumeRestart').addEventListener('click',()=>{streetTutorialClearProgress();closeStreetResume();void beginStreetTutorial();});
    byId('streetWavePreference').addEventListener('change',event=>{
      applyWavePreference(event.target.value);
      if(currentPlayerAccount?.session_token)void supabaseRpc('orapa_set_street_preferences',{p_session_token:currentPlayerAccount.session_token,p_wave_controls:wavePreference}).then(()=>showToast('Préférence Street enregistrée')).catch(error=>showErrorToast('Enregistrement impossible : '+error.message));
    });
    const narrowScreen=window.matchMedia('(max-width: 640px)');
    const refreshAutomaticControls=()=>{if(wavePreference==='auto'&&!byId('streetPrototype').hidden){clearDirectionChoicesTimer();selectedWaveEdge=null;render();}};
    if(narrowScreen.addEventListener)narrowScreen.addEventListener('change',refreshAutomaticControls);else narrowScreen.addListener(refreshAutomaticControls);
  }
  async function openCreation(){
    if(!currentPlayerAccount){byId('createModeModal')?.classList.remove('open');openAccountModal();return;}
    byId('createModeModal')?.classList.remove('open');
    await loadStreetPreference();
    try{localStorage.removeItem('orapa_street_creation_v3');}catch(_error){}
    streetTutorial={active:false,stage:0,puzzle:false,secretPieces:[],draftIndex:0};byId('streetTutorialCoach')?.remove();
    resetStreetPieceSurvey();streetSurveyUnlocked=false;streetSurveyClicks=0;savedPrototypeCreationPieces=null;state={mode:'gm',pieceSet:'official',profile:'normal',centralZone:true,pieces:freshPieces(STREET_PIECES),secretPieces:[],selected:'red1',tool:'pieces',waveModeActive:false,previewWave:null,started:false,traces:[],coords:[],draftCells:{},gridId:null,gridAlias:null,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
    byId('streetPrototype').querySelector('.subtitle').textContent='Console du maître du jeu · v2';
    byId('streetPrototype').querySelector('h1').textContent='🏠 Orapa Street v2';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');toggleHistory(false);render();
  }
  function openStreetProfilePicker(){
    let modal=byId('streetProfileModal');
    if(!modal){modal=document.createElement('div');modal.id='streetProfileModal';modal.className='modal-backdrop';document.body.appendChild(modal);}
    modal.innerHTML=`<div class="modal"><button class="close-x" id="streetProfileClose">×</button><h2>🏠 Orapa Street v2</h2><p>Choisis l’option de la grille aléatoire.</p><div class="street-profile-picker"><label>Options <select id="streetSoloProfileSelect">${STREET_V2_PROFILE_KEYS.map(key=>`<option value="${key}">${STREET_V2_PROFILES[key].label}</option>`).join('')}</select></label><p id="streetSoloProfileDescription"></p><label id="streetSoloCentralZoneLabel" class="street-v2-profile-controls" style="justify-content:flex-start"><input id="streetSoloCentralZone" type="checkbox" checked> Zone centrale</label></div><div class="controls" style="justify-content:flex-end;margin-top:14px"><button class="ghost" id="streetProfileCancel">Annuler</button><button class="primary" id="streetProfileStart">Lancer</button></div></div>`;
    const close=()=>{modal.classList.remove('open');byId('soloChoiceModal')?.classList.add('open');document.body.classList.add('solo-menu-open');};
    byId('streetProfileClose').onclick=close;byId('streetProfileCancel').onclick=close;
    modal.onclick=event=>{if(event.target===modal)close();};
    const select=byId('streetSoloProfileSelect'),description=byId('streetSoloProfileDescription'),centralLabel=byId('streetSoloCentralZoneLabel');
    const sync=()=>{const config=STREET_V2_PROFILES[select.value];description.textContent=`${config.count}${select.value==='free'?' pièces minimum':' pièces'} · ${config.allColors?'au moins une pièce de chacune des quatre couleurs':config.allowPrototype?'pièces v2 et prototypes disponibles':'sans contrainte de couleur'}`;centralLabel.hidden=select.value!=='free';};
    select.addEventListener('change',sync);sync();
    byId('streetProfileStart').onclick=()=>{const profile=select.value,centralZone=profile==='free'?byId('streetSoloCentralZone').checked:true;modal.classList.remove('open');byId('soloChoiceModal')?.classList.remove('open');document.body.classList.remove('solo-menu-open');void openSolo(null,null,profile,centralZone);};
    modal.classList.add('open');
  }
  async function openSolo(gridId=null,resumeAttempt=null,profile=null,centralZone=true){
    if(!currentPlayerAccount?.session_token){closeSoloChoiceModal?.();openAccountModal();return false;}
    if(!gridId&&!resumeAttempt&&!profile){if(typeof verifyStreetTutorialPrerequisite==='function'&&!await verifyStreetTutorialPrerequisite(true))return false;openStreetProfilePicker();return false;}
    streetTutorial={active:false,stage:0,puzzle:false,secretPieces:[],draftIndex:0};byId('streetTutorialCoach')?.remove();
    await loadStreetPreference();
    let decoded=gridId?decodeStreetGrid(gridId):null;
    if(gridId&&!decoded){showErrorToast('Identifiant Street invalide.');return false;}
    if(!decoded){
      const selectedProfile=STREET_V2_PROFILES[profile]?profile:'normal';
      state={...state,profile:selectedProfile,centralZone:selectedProfile==='free'?centralZone!==false:true,pieceSet:'official',pieces:freshPieces(streetAllowedDefinitions(selectedProfile))};
      if(!randomizePieces()){showErrorToast('Impossible de générer une grille Street v2.');return false;}
      decoded={variant:'street',version:2,profile:selectedProfile,centralZone:state.centralZone,pieces:streetPlacedPieces(state.pieces).map(piece=>({...piece,anchor:{...piece.anchor}}))};decoded.id=encodeStreetGrid(decoded.pieces,{profile:decoded.profile,centralZone:decoded.centralZone});
    }
    let alreadyPlayed=false;
    if(gridId&&!resumeAttempt){
      const status=await supabaseRpc('orapa_get_street_grid_status',{p_grid_id:decoded.id,p_session_token:currentPlayerAccount.session_token}).catch(()=>null);
      if(status?.is_creator){showErrorToast('Cette grille Street est la tienne et ne peut pas être résolue avec ce compte.');return false;}
      alreadyPlayed=!!status?.already_played;
    }
    const gridAlias=await ensureGridAlias(decoded.id,'street');
    const target={kind:'street',reference:decoded.id,context:{},progress:{}};
    const start=resumeAttempt?{ok:true,attempt:resumeAttempt,resumed:true}:await prepareNewActiveAttempt(target,!alreadyPlayed);
    if(!start?.ok){if(start?.reason==='already_played')showErrorToast('Cette grille Street a déjà été jouée avec ce compte.');else if(start?.resume&&start.attempt)await resumeServerAttempt(start.attempt);return false;}
    streetAttempt=start.attempt;
    const playerDefinitions=decoded.pieces.map(piece=>pieceDefinition(piece)).filter(Boolean);
    state={mode:'solo',pieceSet:decoded.version===2?'official':'prototype',profile:decoded.profile||null,centralZone:decoded.version===2?decoded.centralZone!==false:false,pieces:freshPieces(playerDefinitions),secretPieces:decoded.pieces.map(piece=>({...piece,anchor:{...piece.anchor}})),selected:playerDefinitions[0]?.id||'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:decoded.id,gridAlias,gridRanked:!alreadyPlayed,gridUnrankedReason:alreadyPlayed?'already_played':null,attempts:0,over:false,result:null,showGuess:true,showSecret:true,startedAt:null,finalTimeMs:null,rank:null};
    if(start.resumed)restoreStreetProgress(start.attempt?.progress);
    byId('soloChoiceModal')?.classList.remove('open');document.body.classList.remove('solo-menu-open');
    byId('streetPrototype').querySelector('.subtitle').textContent=decoded.version===2?`Orapa Street v2 · ${STREET_V2_PROFILES[decoded.profile]?.label||'Libre'}`:'Grille classique';
    byId('streetPrototype').querySelector('h1').textContent=decoded.version===2?'🏠 Orapa Street v2':'🏠 Orapa Street';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');toggleHistory(false);render();
    if(alreadyPlayed)setTimeout(()=>{if(typeof openAlreadyPlayedGridModal==='function')openAlreadyPlayedGridModal();else showToast('Cette grille a déjà été jouée avec ce compte : le nouveau score ne sera pas enregistré.');},60);
    return true;
  }
  function close(force=false){
    if(streetTutorial.active){requestStreetTutorialExit();return;}
    if(state.mode==='solo'&&!state.over&&!force){showToast('La partie Street reste en cours sur ce compte.');}
    clearDirectionChoicesTimer();selectedWaveEdge=null;byId('streetPrototype').hidden=true;document.body.classList.remove('street-open');document.body.classList.add('home-view');
  }

  async function previewResult(reference){
    let decoded=decodeStreetGrid(reference);
    if(!decoded&&typeof resolveGridReference==='function')decoded=await resolveGridReference(reference);
    if(decoded?.variant!=='street')throw new Error('Identifiant Street invalide.');
    const clonePieces=()=>decoded.pieces.map(piece=>({...piece,anchor:piece.anchor?{...piece.anchor}:null}));
    state={mode:'solo',pieceSet:decoded.version===2?'official':'prototype',profile:decoded.profile||null,centralZone:decoded.version===2?decoded.centralZone!==false:false,pieces:clonePieces(),secretPieces:clonePieces(),selected:decoded.pieces[0]?.id||'blueSmall',tool:'pieces',waveModeActive:false,previewWave:null,started:true,traces:[],coords:[],draftCells:{},gridId:decoded.id,gridAlias:String(reference||''),attempts:0,over:true,result:'win',showGuess:true,showSecret:false,startedAt:Date.now(),finalTimeMs:0,rank:null};
    streetAttempt=null;clearDirectionChoicesTimer();selectedWaveEdge=null;
    byId('soloChoiceModal')?.classList.remove('open');document.body.classList.remove('solo-menu-open');
    byId('streetPrototype').querySelector('.subtitle').textContent='Aperçu local du résultat';
    byId('streetPrototype').querySelector('h1').textContent=decoded.version===2?'🏠 Orapa Street v2':'🏠 Orapa Street';
    byId('streetPrototype').hidden=false;document.body.classList.add('street-open');document.body.classList.remove('home-view');toggleHistory(false);render();
    ensureStreetModal();byId('streetResultActions').dataset.orapaMyludoResult='false';byId('streetResultModal').classList.remove('open');
  }

  document.addEventListener('orapa:myludo-request',async()=>{
    if(state.mode!=='solo'||!state.over)return;
    let preferences={player_mode:'default',custom_player_name:'',fill_score:false,location_mode:'default',custom_location:'',exclude_from_statistics:false,auto_submit:false,duplicate_detection:true};
    try{preferences=await loadMyludoPreferences();}catch(_error){}
    const payload={schemaVersion:1,source:'orapa-mine',gameId:101482,gameVariant:'street',isDaily:false,dedupeReference:state.gridId,solo:true,online:true,win:state.result==='win',playerName:preferences.player_mode==='custom'?preferences.custom_player_name:'',resultPlayerName:currentPlayerAccount?.display_name||'',score:preferences.fill_score?(state.traces.length+state.coords.length*3):null,date:new Date().toISOString().slice(0,10),durationMinutes:Math.max(1,Math.round(elapsedMs()/60000)),location:preferences.location_mode==='custom'?preferences.custom_location:'Orapa-Mine',excludeFromStatistics:!!preferences.exclude_from_statistics,autoSubmit:!!preferences.auto_submit,duplicateDetection:preferences.duplicate_detection!==false,comment:streetSummary(),options:{}};
    document.dispatchEvent(new CustomEvent('orapa:myludo-result',{detail:JSON.stringify(payload)}));
  });
  window.OrapaStreetPrototype={open:openCreation,openCreation,openSolo,resume:attempt=>openSolo(attempt.reference,attempt),close,startTutorial:startStreetTutorial,decode:decodeStreetGrid,encode:encodeStreetGrid,setWavePreference:value=>applyWavePreference(value),openRanking:openStreetRanking,openResult:openStreetResultModal,openGlobalHistory:openStreetGlobalHistory,openCatalog:openStreetCatalog,openMyHistory:openMyStreetHistory,openMyShared:openMySharedStreet,previewResult,sharedPreviewSvg,debug:{BOARD,LANES,PIECES,axialTransform,applyPieceMirror,pieceGeometry,visualWallsFor,visualWallPolygonsFor,snapPieceAnchor,coordinateForTriangle,traceRay,validatePieces}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
