/* ===== Touch: lange drücken = Rechtsklick, ein Finger = verschieben, zwei Finger = zoomen ===== */
(function(){
  const LONG=480,MOVE=10;
  let supUntil=0;
  function setup(el,kind){
    const ptrs=new Map();let pan=null,pinch=null,timer=null;
    const cam=()=>kind==='c'?ccam:mcam,W=kind==='c'?VW:MW,Hh=kind==='c'?VH:MH;
    const clampIt=()=>kind==='c'?clampCam():clampMapCam();
    const world=e=>kind==='c'?colWorld(e):mapWorld(e);
    function longPress(pt){
      supUntil=Date.now()+700;
      try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}
      if(kind==='m'){
        if(!(started&&openRadial(pt))){selT=null;updateSide()}
      }else if(col){
        if(col.buildSel==='tunnel'&&col.tun)col.tun=null;else col.buildSel=null;
        col.pin=null;refreshLive();toast(LANG==='de'?'Auswahl abgebrochen':'Selection cancelled');
      }
    }
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch')return;
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});try{el.setPointerCapture(e.pointerId)}catch(_){}
      clearTimeout(timer);
      if(ptrs.size===1){
        pan={sx:e.clientX,sy:e.clientY,cx:cam().x,cy:cam().y,moved:false,long:false};
        timer=setTimeout(()=>{if(pan&&!pan.moved&&ptrs.size===1){pan.long=true;longPress({clientX:pan.sx,clientY:pan.sy})}},LONG);
      }else if(ptrs.size===2){
        pan=null;const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,push:0};
      }
    });
    el.addEventListener('pointermove',e=>{
      if(e.pointerType!=='touch'||!ptrs.has(e.pointerId))return;
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&ptrs.size>=2){
        const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,ratio=d/pinch.d;pinch.d=d;
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,c=cam(),r=el.getBoundingClientRect();
        const[wx,wy]=world({clientX:mx,clientY:my}),sx=(mx-r.left)/r.width*W,sy=(my-r.top)/r.height*Hh;
        supUntil=Date.now()+400;
        if(kind==='c'){
          const zmin=Math.max(VW/CW,VH/CH);
          if(ratio<1&&c.z<=zmin*1.001){pinch.push+=1;if(pinch.push>=12&&!warping){pinch.push=0;warp('out')}return}
          c.z*=ratio;clampCam();c.x=wx-sx/c.z;c.y=wy-sy/c.z;clampCam();
        }else{
          if(ratio>1&&c.z>=3.99&&started){const id=terrAtEvent({clientX:mx,clientY:my});if(id!=null&&T[id].owner===0&&T[id].col){pinch.push+=1;if(pinch.push>=12&&!warping){pinch.push=0;warp('in',id)}return}}
          c.z=clamp(c.z*ratio,1,4);clampMapCam();c.x=wx-sx/c.z;c.y=wy-sy/c.z;clampMapCam();
        }
        return;
      }
      if(pan){
        const dx=e.clientX-pan.sx,dy=e.clientY-pan.sy;
        if(!pan.moved&&Math.abs(dx)+Math.abs(dy)>MOVE){pan.moved=true;clearTimeout(timer)}
        if(pan.moved&&!pan.long){const r=el.getBoundingClientRect(),k=W/r.width/cam().z;cam().x=pan.cx-dx*k;cam().y=pan.cy-dy*k;clampIt()}
      }
    });
    const end=e=>{
      if(e.pointerType!=='touch')return;
      ptrs.delete(e.pointerId);clearTimeout(timer);
      if(pan&&(pan.moved||pan.long))supUntil=Date.now()+350;
      if(ptrs.size<2)pinch=null;
      if(ptrs.size===0)pan=null;
    };
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    el.addEventListener('click',e=>{if(Date.now()<supUntil){e.stopImmediatePropagation();e.preventDefault()}},true);
    el.addEventListener('dblclick',e=>{if(Date.now()<supUntil)e.stopImmediatePropagation()},true);
  }
  setup(cv,'c');setup(mv,'m');
})();
