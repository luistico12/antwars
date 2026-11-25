'use strict';
/* Nachrichtenschema: alles kommt von nicht vertrauenswuerdigen Clients. Spiegelt cleanName/cosmClean aus js/. */
const {MAX_MSG_BYTES}=require('./config');
const MAXS=64;
const isObj=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const isStr=s=>typeof s==='string'&&s.length<=MAXS;
const isInt=n=>Number.isInteger(n)&&Math.abs(n)<=1e9;
const PID=/^[a-z0-9]{4,8}$/,ID=/^[A-Za-z0-9_-]{1,32}$/;
/* wie cleanName in js/backend.js, zusaetzlich ohne Steuerzeichen */
const cleanName=n=>String(n==null?'':n).replace(/[\u0000-\u001f\u007f-\u009f]/g,'').replace(/[#\s]+/g,' ').trim().slice(0,20);
/* nur bekannte Schluessel, begrenzte Zeichenketten; neues Objekt ohne Prototyp-Zugriff */
const COSM=['crown','pattern','ship','flag'];
const cosmClean=c=>{const o={};if(isObj(c))for(const k of COSM){const v=Object.prototype.hasOwnProperty.call(c,k)?c[k]:undefined;if(typeof v==='string'&&ID.test(v))o[k]=v}return o};
const NOK={ok:false};
function parseClientMsg(raw){
  let s;
  try{
    if(typeof raw==='string')s=raw;
    else if(Buffer.isBuffer(raw)){if(raw.length>MAX_MSG_BYTES)return NOK;s=raw.toString('utf8');if(s.includes('�'))return NOK}
    else return NOK;
    if(s.length>MAX_MSG_BYTES)return NOK;
    const m=JSON.parse(s);
    if(!isObj(m)||typeof m.t!=='string')return NOK;
    switch(m.t){
      case'auth':if(typeof m.token!=='string'||m.token.length>2048||typeof m.pid!=='string'||!PID.test(m.pid))return NOK;return{ok:true,msg:{t:'auth',token:m.token,pid:m.pid}};
      case'join':if(!['classic','fast','chaos','unlimited'].includes(m.mode))return NOK;return{ok:true,msg:{t:'join',mode:m.mode}};
      case'leave':return{ok:true,msg:{t:'leave'}};
      case'ready':
        if(!isStr(m.name)||!isStr(m.sp)||!isInt(m.start)||!(m.c===null||isObj(m.c)))return NOK;
        return{ok:true,msg:{t:'ready',name:m.name,sp:m.sp,start:m.start,c:m.c===null?null:cosmClean(m.c)}};
      case'cmd':
        if(m.k==='launch'){if(!isInt(m.from)||!isInt(m.to)||!isInt(m.n))return NOK;return{ok:true,msg:{t:'cmd',k:'launch',from:m.from,to:m.to,n:m.n}}}
        if(m.k==='tr'){if(!isInt(m.tile))return NOK;return{ok:true,msg:{t:'cmd',k:'tr',tile:m.tile}}}
        return NOK;
      default:return NOK;
    }
  }catch(e){return NOK}
}
module.exports={parseClientMsg,cleanName,cosmClean};
