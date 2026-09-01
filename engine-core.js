(function(global){
  'use strict';
  const EPS=1e-6;
  const clonePoint=point=>({x:Number(point.x),y:Number(point.y)});
  function transformVertex(vertex,flipped,rotation,center){let x=Number(vertex[0]),y=Number(vertex[1]);if(flipped)x=-x;let rx=x,ry=y;if(rotation===90){rx=-y;ry=x;}else if(rotation===180){rx=-x;ry=-y;}else if(rotation===270){rx=y;ry=-x;}return{x:Number(center.x)+rx,y:Number(center.y)+ry};}
  function signedArea(poly){let area=0;for(let i=0;i<poly.length;i++){const point=poly[i],next=poly[(i+1)%poly.length];area+=point.x*next.y-next.x*point.y;}return area/2;}
  function ensureCCW(poly){return signedArea(poly)<0?poly.slice().reverse():poly.slice();}
  function cross(a,b,p){return(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
  function segmentIntersection(a,b,p,q){const a1=b.y-a.y,b1=a.x-b.x,c1=a1*a.x+b1*a.y,a2=q.y-p.y,b2=p.x-q.x,c2=a2*p.x+b2*p.y,det=a1*b2-a2*b1;if(Math.abs(det)<1e-12)return clonePoint(p);return{x:(b2*c1-b1*c2)/det,y:(a1*c2-a2*c1)/det};}
  function clipPolygon(subject,clip){let output=subject.slice();for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=output;output=[];if(!input.length)break;for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sideP=cross(a,b,p),sideQ=cross(a,b,q);if(sideP>=-1e-9)output.push(p);if((sideP>1e-9&&sideQ<-1e-9)||(sideP<-1e-9&&sideQ>1e-9))output.push(segmentIntersection(a,b,p,q));}}return output;}
  function polygonArea(poly){return Math.abs(signedArea(poly));}
  function maxExtent(poly){let result=0;for(let i=0;i<poly.length;i++)for(let j=i+1;j<poly.length;j++)result=Math.max(result,Math.hypot(poly[i].x-poly[j].x,poly[i].y-poly[j].y));return result;}
  function contactKind(polyA,polyB){const intersection=clipPolygon(ensureCCW(polyA),ensureCCW(polyB));if(!intersection.length)return'none';if(polygonArea(intersection)>1e-4)return'overlap';if(maxExtent(intersection)>1e-3)return'sideTouch';return'corner';}
  function polygonsConflict(polyA,polyB){const kind=contactKind(polyA,polyB);return kind==='overlap'||kind==='sideTouch';}
  function polygonsMatch(polyA,polyB,tolerance=1e-3){if(polyA.length!==polyB.length)return false;const normalize=poly=>poly.map(point=>({x:Math.round(point.x/tolerance),y:Math.round(point.y/tolerance)})).sort((a,b)=>a.x-b.x||a.y-b.y),a=normalize(polyA),b=normalize(polyB);return a.every((point,index)=>point.x===b[index].x&&point.y===b[index].y);}
  function validatePlacement(options){
    const{candidate,pieces=[],bounds,polygonsFor,edgeConstraintValid}=options;
    const candidatePolygons=polygonsFor(candidate);
    if(!candidatePolygons.length)return false;
    for(const poly of candidatePolygons){
      if(poly.some(point=>point.x<bounds.minX-EPS||point.x>bounds.maxX+EPS||point.y<bounds.minY-EPS||point.y>bounds.maxY+EPS))return false;
    }
    if(edgeConstraintValid&&!edgeConstraintValid(candidate))return false;
    for(const other of pieces){
      if(!other.center||other.id===candidate.id)continue;
      const otherPolygons=polygonsFor(other);
      if(candidatePolygons.some(polyA=>otherPolygons.some(polyB=>polygonsConflict(polyA,polyB))))return false;
    }
    return true;
  }
  function invalidPlacementIds(options){
    const{pieces=[],boundsFor,polygonsFor,edgeConstraintValid}=options,result=new Set(),placed=pieces.filter(piece=>piece.center);
    for(let index=0;index<placed.length;index++){
      const piece=placed[index],bounds=boundsFor(piece),polygons=polygonsFor(piece);
      if(polygons.some(poly=>poly.some(point=>point.x<bounds.minX-EPS||point.x>bounds.maxX+EPS||point.y<bounds.minY-EPS||point.y>bounds.maxY+EPS)))result.add(piece.id);
      if(edgeConstraintValid&&!edgeConstraintValid(piece))result.add(piece.id);
      for(let otherIndex=index+1;otherIndex<placed.length;otherIndex++){
        const other=placed[otherIndex],otherPolygons=polygonsFor(other);
        if(polygons.some(polyA=>otherPolygons.some(polyB=>polygonsConflict(polyA,polyB)))){result.add(piece.id);result.add(other.id);}
      }
    }
    return result;
  }
  function firstDirectHit(options){
    const{side,index,pieces=[],width,height,edgesFor}=options,start=entryVector(side,index,width,height);
    let best={...boundaryIntersection(start.position,start.direction,width,height),kind:'boundary'};
    for(const piece of pieces){
      if(!piece.center)continue;
      for(const[a,b]of edgesFor(piece)){
        const hit=intersectRaySegment(start.position,start.direction,a,b);
        if(hit&&hit.t<best.t-EPS)best={...hit,kind:'piece',pieceId:piece.id};
      }
    }
    return best.kind==='piece'?best.pieceId:null;
  }
  function unreachablePieceIds(options){
    const{pieces=[],width,height,edgesFor,minHitsFor}=options,counts=new Map(),bump=id=>{if(id)counts.set(id,(counts.get(id)||0)+1);};
    for(let index=0;index<width;index++){
      bump(firstDirectHit({side:'top',index,pieces,width,height,edgesFor}));
      bump(firstDirectHit({side:'bottom',index,pieces,width,height,edgesFor}));
    }
    for(let index=0;index<height;index++){
      bump(firstDirectHit({side:'left',index,pieces,width,height,edgesFor}));
      bump(firstDirectHit({side:'right',index,pieces,width,height,edgesFor}));
    }
    return pieces.filter(piece=>piece.center&&(counts.get(piece.id)||0)<(minHitsFor(piece)||1)).map(piece=>piece.id);
  }
  function generateLayout(options){
    const{types,attempts=60,triesPerPiece=250,rng=Math.random,candidateFor,placementValid:accept,layoutValid=()=>true,finalize=piece=>piece}=options;
    for(let attempt=0;attempt<attempts;attempt++){
      const remaining=types.slice();
      for(let index=remaining.length-1;index>0;index--){const swap=Math.floor(rng()*(index+1));[remaining[index],remaining[swap]]=[remaining[swap],remaining[index]];}
      const placed=[];
      let failed=false;
      for(const type of remaining){
        let candidate=null;
        for(let tries=0;tries<triesPerPiece&&!candidate;tries++){
          const probe=candidateFor(type,rng,tries,placed);
          if(probe&&accept(probe,placed))candidate=probe;
        }
        if(!candidate){failed=true;break;}
        placed.push(candidate);
      }
      if(!failed&&layoutValid(placed))return placed.map(finalize);
    }
    return null;
  }
  function intersectRaySegment(position,direction,a,b){if(direction.dx!==0){if(Math.abs(a.y-b.y)<EPS)return null;const ratio=(position.y-a.y)/(b.y-a.y);if(ratio<-EPS||ratio>1+EPS)return null;const x=a.x+ratio*(b.x-a.x),distance=(x-position.x)/direction.dx;return distance<-EPS?null:{t:distance,point:{x,y:position.y}};}if(Math.abs(a.x-b.x)<EPS)return null;const ratio=(position.x-a.x)/(b.x-a.x);if(ratio<-EPS||ratio>1+EPS)return null;const y=a.y+ratio*(b.y-a.y),distance=(y-position.y)/direction.dy;return distance<-EPS?null:{t:distance,point:{x:position.x,y}};}
  function edgeKind(a,b){if(Math.abs(a.x-b.x)<EPS||Math.abs(a.y-b.y)<EPS)return'wall';return(b.y-a.y)/(b.x-a.x)>0?'back':'fwd';}
  function reflect(direction,kind){const{dx,dy}=direction;if(kind==='back'){if(dx===1)return{dx:0,dy:1};if(dx===-1)return{dx:0,dy:-1};if(dy===-1)return{dx:-1,dy:0};if(dy===1)return{dx:1,dy:0};}else{if(dx===1)return{dx:0,dy:-1};if(dx===-1)return{dx:0,dy:1};if(dy===-1)return{dx:1,dy:0};if(dy===1)return{dx:-1,dy:0};}return clonePoint(direction);}
  function boundaryIntersection(position,direction,width,height){if(direction.dx!==0){const x=direction.dx>0?width:0;return{t:(x-position.x)/direction.dx,point:{x,y:position.y}};}const y=direction.dy>0?height:0;return{t:(y-position.y)/direction.dy,point:{x:position.x,y}};}
  function entryVector(side,index,width,height){if(side==='top')return{position:{x:index+.5,y:0},direction:{dx:0,dy:1}};if(side==='bottom')return{position:{x:index+.5,y:height},direction:{dx:0,dy:-1}};if(side==='left')return{position:{x:0,y:index+.5},direction:{dx:1,dy:0}};return{position:{x:width,y:index+.5},direction:{dx:-1,dy:0}};}
  function exitAt(point,width,height){if(Math.abs(point.x)<EPS)return{side:'left',index:Math.floor(point.y)};if(Math.abs(point.x-width)<EPS)return{side:'right',index:Math.floor(point.y)};if(Math.abs(point.y)<EPS)return{side:'top',index:Math.floor(point.x)};return{side:'bottom',index:Math.floor(point.x)};}
  // Une réfraction n'est possible que si la case orthogonalement adjacente au
  // trou noir se trouve entièrement devant l'onde. Le virage intervient au
  // centre de la case suivante, après la traversée complète de cette case.
  // Après un rebond dans ou au bord de la case, cette condition n'est plus
  // remplie : la réfraction de ce passage est donc naturellement annulée.
  function blackHoleGravityCandidate(position,direction,piece){
    const center=piece.center;
    if(direction.dx!==0&&Math.abs(Math.abs(position.y-center.y)-1)<EPS){
      const entryX=center.x-direction.dx*.5;
      if((entryX-position.x)*direction.dx<-EPS)return null;
      const x=center.x+direction.dx,t=(x-position.x)/direction.dx;
      return t>EPS?{t,point:{x,y:position.y}}:null;
    }
    if(direction.dy!==0&&Math.abs(Math.abs(position.x-center.x)-1)<EPS){
      const entryY=center.y-direction.dy*.5;
      if((entryY-position.y)*direction.dy<-EPS)return null;
      const y=center.y+direction.dy,t=(y-position.y)/direction.dy;
      return t>EPS?{t,point:{x:position.x,y}}:null;
    }
    return null;
  }
  function simulateBeam(options){
    const{side,index,pieces,width,height,edgesFor,definitionFor,resolveColor}=options;
    const start=entryVector(side,index,width,height);
    let position=start.position,direction=start.direction,guard=0,absorbed=false;
    let exitSide=null,exitIndex=null,refracted=false,skipPieceId=null,skipEdgeIndex=null;
    let passThroughPieceId=null,firstDirectHitId=null,directPath=true;
    const colors=new Set(),points=[clonePoint(position)],hitPieceIds=[];
    const placed=(pieces||[]).filter(piece=>piece.center);

    while(true){
      if(++guard>400){absorbed='loop';break;}
      let best={...boundaryIntersection(position,direction,width,height),kind:'boundary'};

      for(const piece of placed){
        if(piece.id===passThroughPieceId)continue;
        const definition=definitionFor(piece.type)||{},edges=edgesFor(piece),directHits=[];
        edges.forEach(([a,b],edgeIndex)=>{
          if(piece.id===skipPieceId&&edgeIndex===skipEdgeIndex)return;
          const hit=intersectRaySegment(position,direction,a,b);
          if(hit&&definition.isBlackHole)directHits.push(hit);
          // À distance égale, un impact réel reste prioritaire sur une
          // réfraction : réflexion et réfraction sur la même case => réflexion.
          if(hit&&(hit.t<best.t-EPS||(best.kind==='gravity'&&Math.abs(hit.t-best.t)<=EPS))){
            best={...hit,kind:'edge',piece,edgeType:edgeKind(a,b),edgeIndex};
          }
        });
        if(definition.isBlackHole&&!refracted&&!directHits.length){
          const gravity=blackHoleGravityCandidate(position,direction,piece);
          if(gravity&&gravity.t<best.t-EPS)best={...gravity,kind:'gravity',piece};
        }
      }

      if(best.kind==='boundary'){
        points.push(best.point);
        const exit=exitAt(best.point,width,height);exitSide=exit.side;exitIndex=exit.index;
        break;
      }

      passThroughPieceId=null;
      if(best.kind==='gravity'){
        directPath=false;points.push(best.point);refracted=true;
        const center=best.piece.center;
        direction=direction.dy!==0
          ?{dx:Math.sign(center.x-best.point.x),dy:0}
          :{dx:0,dy:Math.sign(center.y-best.point.y)};
        if(!direction.dx&&!direction.dy){absorbed='disappeared';break;}
        position={x:best.point.x+direction.dx*EPS*20,y:best.point.y+direction.dy*EPS*20};
        skipPieceId=null;skipEdgeIndex=null;
        continue;
      }

      const definition=definitionFor(best.piece.type)||{};
      if(directPath&&firstDirectHitId===null)firstDirectHitId=best.piece.id;
      hitPieceIds.push(best.piece.id);points.push(best.point);
      if(definition.isOnyx){absorbed=true;break;}
      if(definition.isBlackHole){absorbed='disappeared';break;}
      // Les deux trous de ver forment une paire : l'onde entre dans le premier,
      // ressort du second dans la même direction, sans couleur ni réflexion.
      if(definition.isWormhole){
        const partner=placed.find(piece=>piece.id!==best.piece.id&&(definitionFor(piece.type)||{}).isWormhole);
        if(!partner){absorbed='loop';break;}
        points.push(clonePoint(best.piece.center));
        points.push(clonePoint(partner.center));
        position={x:partner.center.x+direction.dx*(.5+EPS*20),y:partner.center.y+direction.dy*(.5+EPS*20)};
        passThroughPieceId=partner.id;skipPieceId=null;skipEdgeIndex=null;continue;
      }
      if(definition.colorKey)colors.add(definition.colorKey);
      if(definition.colorKeys)definition.colorKeys.forEach(key=>colors.add(key));
      direction=best.edgeType==='wall'?{dx:-direction.dx,dy:-direction.dy}:reflect(direction,best.edgeType);
      position=best.point;skipPieceId=best.piece.id;skipEdgeIndex=best.edgeIndex;
    }
    return{entrySide:side,entryIndex:index,exitSide,exitIndex,absorbed,color:resolveColor(colors,absorbed),points,hitPieceIds,firstDirectHitId};
  }
  global.OrapaEngine=Object.freeze({EPS,transformVertex,ensureCCW,clipPolygon,polygonArea,maxExtent,contactKind,polygonsConflict,polygonsMatch,validatePlacement,invalidPlacementIds,firstDirectHit,unreachablePieceIds,generateLayout,intersectRaySegment,edgeKind,reflect,boundaryIntersection,simulateBeam});
})(typeof window!=='undefined'?window:globalThis);
