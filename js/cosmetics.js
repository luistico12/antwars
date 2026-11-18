/* Hüte (Pixelart) und Ausrüstung. COSM wird aus dem Profil gesetzt und vom Spiel beim Zeichnen gelesen. */
const HAT_ART={
cap:{p:{r:'#e04b4b',d:'#9f2b2b',w:'#fff'},m:['..rrrr..','.rrrwrr.','rrrrrrrdd']},
flower:{p:{p:'#ff8ac8',y:'#ffd23f',g:'#4caf50'},m:['.p.p.','pypyp','.pyp.','..g..']},
party:{p:{a:'#6fd3ff',b:'#ff6fb5',y:'#ffd23f'},m:['..y..','..a..','.aba.','.bab.','abab']},
helmet:{p:{s:'#aeb8c8',d:'#6d7788',h:'#e8eef8'},m:['..ssss..','.shhsss.','sssssssd','dddddddd']},
top:{p:{k:'#22252e',r:'#ff5757',h:'#4a4f5c'},m:['.kkkkk.','.khkkk.','.krrrk.','kkkkkkk']},
pirate:{p:{k:'#1e2128',w:'#f2f2f2',g:'#caa24a'},m:['..kkkk..','.kkwwkk.','kkkwwkkk','kgkkkkgk']},
wizard:{p:{b:'#5b3fd1',y:'#ffd23f',d:'#3a2796'},m:['...b...','..bb...','..byb..','.bbbbb.','bbbbbbb','ddddddd']},
crown:{p:{y:'#ffcf3a',o:'#d99a12',r:'#ff4d6d'},m:['y.y.y.y','yyyyyyy','yryoyry','ooooooo']},
halo:{p:{y:'#fff3a8',o:'#ffd23f'},m:['.yyyyy.','y.....y','.ooooo.']}
};
const COSM={hat:null,flag:null};
function drawHat(g,id,cx,by,px){
  const a=HAT_ART[id];if(!a)return;const w=a.m.reduce((m,r)=>Math.max(m,r.length),0),h=a.m.length;
  const x0=Math.round(cx-w*px/2),y0=Math.round(by-h*px);
  a.m.forEach((row,j)=>{for(let i=0;i<row.length;i++){const c=row[i];if(c==='.')continue;g.fillStyle=a.p[c]||'#fff';g.fillRect(x0+i*px,y0+j*px,px,px)}});
}
function hatPreview(id,size){const c=document.createElement('canvas');c.width=64;c.height=54;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  /* kleiner Ameisenkopf als Träger */
  g.fillStyle='#2a1a10';g.beginPath();g.arc(32,40,11,0,7);g.fill();g.fillStyle='#fff';g.fillRect(27,38,3,3);g.fillRect(35,38,3,3);g.fillStyle='#000';g.fillRect(28,39,2,2);g.fillRect(36,39,2,2);
  drawHat(g,id,32,32,5);return c}
function syncCosmetics(){const p=AW.profile;COSM.hat=p&&p.hat?p.hat:null;COSM.flag=p&&p.flag?p.flag:null;
  if(typeof ownDirty!=='undefined')ownDirty=true}

const _flagImgs={};
function flagImg(id){if(!_flagImgs[id]){const im=new Image();const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="90" height="60">${FL[id]||''}</svg>`;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);_flagImgs[id]=im}return _flagImgs[id]}
function drawHillFlag(g,C,tm){
  const im=flagImg(COSM.flag);if(!im.complete||!im.naturalWidth)return;
  const top=GY-hillH(C)+6,w=44,h=29,wave=Math.sin(tm*3)*1.5;
  g.fillStyle='#d9d0b8';g.fillRect(ENT_X-1,top-h-12,3,h+14);
  const sm=g.imageSmoothingEnabled;g.imageSmoothingEnabled=true;g.drawImage(im,ENT_X+2,top-h-12+wave*0.3,w,h);g.imageSmoothingEnabled=sm;
}
