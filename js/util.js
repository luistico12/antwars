/* Gemeinsame Helfer (früher Teil des Mehrspieler-Moduls) */
/* Speicher: Einstellungen/Spielstand nur mit Einwilligung (Präferenz-Cookies) in localStorage, sonst nur im Arbeitsspeicher. */
const _mem={};
const consentRaw=()=>{try{return JSON.parse(localStorage.getItem('aw_consent')||'null')}catch(e){return null}};
const canStore=k=>k==='aw_consent'||(consentRaw()||{}).prefs===true;
const lsGet=(k,d)=>{try{if(k in _mem)return _mem[k];const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const lsSet=(k,v)=>{try{if(canStore(k)){localStorage.setItem(k,JSON.stringify(v));delete _mem[k]}else _mem[k]=v}catch(e){_mem[k]=v}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function myScore(){
  if(!started||!G)return 0;
  const own=T.filter(t=>t.owner===0).length,tt=totals();
  return own*20+tt.w+tt.sold*2+Math.floor(G.food/20);
}
/* Platzhalter, damit Pause/Einstellungen/Tasten die Lobby-Sperre abfragen können */
const MP={open:false};
let CONSENT=consentRaw()||{set:false,prefs:false,ads:false};
