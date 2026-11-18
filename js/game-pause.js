/* ===== Pausenbildschirm ===== */
document.body.insertAdjacentHTML('beforeend','<div id="pause" hidden role="dialog" aria-label="Pause"><div class="box"><h2>Pause</h2><p id="pauseInfo"></p><button class="btn primary" id="pResume" type="button">Weiter spielen</button><button class="btn danger" id="pEnd" type="button">Spiel beenden</button></div></div>');
let prevSpeed=1,endAsk=false;
function showPause(){
  if(!started||over)return;
  $('#pauseInfo').textContent=`Tag ${dayNo()} · ${T.filter(t=>t.owner===0).length} Gebiete`;
  endAsk=false;$('#pEnd').textContent='Spiel beenden';$('#pause').hidden=false;$('#pResume').focus();
}
function setSpeedUI(v){speed=v;$$('#speed [data-sp]').forEach(x=>x.classList.toggle('on',+x.dataset.sp===v))}
function resumeGame(){$('#pause').hidden=true;setSpeedUI(prevSpeed||1)}
$$('#speed [data-sp]').forEach(b=>b.addEventListener('click',()=>{if(+b.dataset.sp===0){showPause()}else prevSpeed=+b.dataset.sp}));
$('#pResume').onclick=resumeGame;
$('#pEnd').onclick=()=>{
  if(!endAsk){endAsk=true;$('#pEnd').textContent='Wirklich beenden? Der Spielstand geht verloren';return}
  $('#pause').hidden=true;setSpeedUI(1);prevSpeed=1;$('#endBtn').click();
};
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!started||over||MP.open||!$('#conq').hidden)return;
  if(!$('#pause').hidden){resumeGame();return}
  if(speed>0)prevSpeed=speed;setSpeedUI(0);showPause();
});

