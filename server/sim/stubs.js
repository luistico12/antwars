/* Attrappen fuer Oberflaeche und Kolonie, damit js/game-core.js, game-world.js und game-sea.js im vm-Kontext laufen.
   Nichts hier entscheidet ueber Spielregeln. Der Server hat keine Oberflaeche und keine Kolonie. */
var __noop=function(){};
var __ctx2d=new Proxy(function(){},{get:function(t,k){return k==='canvas'?undefined:__ctx2d},set:function(){return true},apply:function(){return __ctx2d}});
var __el=function(){var e={hidden:false,style:{},dataset:{},textContent:'',innerHTML:'',width:0,height:0,children:[],
  getContext:function(){return __ctx2d},addEventListener:__noop,removeEventListener:__noop,appendChild:__noop,
  querySelector:function(){return __el()},querySelectorAll:function(){return[]},getBoundingClientRect:function(){return{left:0,top:0,width:0,height:0}},
  classList:{add:__noop,remove:__noop,toggle:__noop,contains:function(){return false}},setAttribute:__noop};return e};
var document={createElement:__el,getElementById:__el,querySelector:__el,querySelectorAll:function(){return[]},addEventListener:__noop};
var window=globalThis;
var __endResult={over:false,winnerFid:null};
var toast=__noop,flashHit=__noop,renderColSwitch=__noop,openColony=__noop,showConquest=__noop;
var askConquest=__noop;
var makeColony=function(){return null};
var newG=__noop;
var G=null;/* Server hat keinen Spieler 0 und keine Kolonie: updateBotRaids und Haendlerertrag (nur fuer Spieler 0) bleiben aus */
var pwMul=function(){return 1};
var col=null,curT=null;
/* endGame(win): Spielende merken statt Oberflaeche oeffnen. Auf dem Server gibt es keinen Spieler 0, daher meldet world-vm den Sieger selbst. */
var endGame=function(win){over=true;__endResult.over=true;__endResult.win=!!win};
var dugCount=function(){return 0};
/* Hilfsfunktion aus js/game-colony.js (nicht geladen), identisch uebernommen; Zufall kommt aus dem geseedeten Math.random. */
var pick=function(a){return a[Math.floor(Math.random()*a.length)]};
