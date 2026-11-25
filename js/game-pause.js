/* ===== Pausenbildschirm ===== */
document.body.insertAdjacentHTML('beforeend','<div id="pause" hidden role="dialog" aria-label="Pause"><div class="box"><h2>Pause</h2><p id="pauseInfo"></p><button class="btn primary" id="pResume" type="button">Weiter spielen</button><button class="btn danger" id="pEnd" type="button">Spiel beenden</button></div></div>');
let prevSpeed=2,endAsk=false;
function showPause(){
  if(!started||over)return;
  $('#pauseInfo').textContent=`${clockT(rtime())} · ${T.filter(t=>t.owner===0).length} Gebiete`;
  endAsk=false;$('#pEnd').textContent='Spiel beenden';$('#pause').hidden=false;$('#pResume').focus();
}
function setSpeedUI(v){speed=v>0?SIMV:0}
function resumeGame(){$('#pause').hidden=true;setSpeedUI(SIMV)}
$('#speed [data-sp="0"]').addEventListener('click',showPause);
$('#pResume').onclick=resumeGame;
$('#pEnd').onclick=()=>{
  if(!endAsk){endAsk=true;$('#pEnd').textContent='Wirklich beenden? Der Spielstand geht verloren';return}
  $('#pause').hidden=true;setSpeedUI(1);$('#endBtn').click();
};
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!started||over||MP.open)return;
  if(!$('#pause').hidden){resumeGame();return}
  setSpeedUI(0);showPause();
});

