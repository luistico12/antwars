'use strict';
/* Oeffentlicher Prozess: HTTP (/healthz, /matches) + WebSocket hinter Cloudflare Tunnel (127.0.0.1).
   Alles, was ankommt, ist nicht vertrauenswuerdig. Logs: nur Zaehler und Fehlerarten, nie Token/IP/sub/Namen. */
const http=require('node:http');
const net=require('node:net');
const fs=require('node:fs');
const {WebSocketServer}=require('ws');
const baseConfig=require('./config');
const {parseClientMsg}=require('./protocol');
const {TokenBucket,IpCounter}=require('./limits');
const {Rooms}=require('./rooms');

const MAX_BUFFERED=1024*1024;
const BLOCK_RELOAD_MS=30000;
const LOOPBACK=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const stats={conn:0,authFail:0,badMsg:0,flood:0,dup:0,blocked:0,rejected:0,errors:0};

function readBlocklist(p){
  const s=new Set();
  if(!p)return s;
  try{
    const st=fs.statSync(p);if(!st.isFile()||st.size>1024*1024)return s;
    for(const line of fs.readFileSync(p,'utf8').split('\n')){
      const t=line.replace(/#.*/,'').trim();
      if(t&&t.length<=128)s.add(t);
    }
  }catch(e){}
  return s;
}

function clientIp(req){
  const raw=req.socket.remoteAddress||'';
  if(LOOPBACK.has(raw)){
    const h=req.headers['cf-connecting-ip'];
    if(typeof h==='string'&&net.isIP(h.trim()))return h.trim();
  }
  return raw||'unknown';
}

async function start({port=0,verify,now=Date.now,blocklistPath,config}={}){
  const C={...baseConfig,...(config||{})};
  const AUTH_MS=C.AUTH_MS||5000;
  const conns=new Map();      /* sub -> Verbindung, solange der Socket offen ist */
  const all=new Set();
  const ipc=new IpCounter(C.CONN_PER_IP);
  let blocked=readBlocklist(blocklistPath);

  const sendTo=(sub,msg)=>{
    const c=conns.get(sub);
    if(!c||c.ws.readyState!==1)return;
    try{
      if(c.ws.bufferedAmount>MAX_BUFFERED){c.ws.close(1013);return}
      c.ws.send(JSON.stringify(msg));
    }catch(e){stats.errors++}
  };
  const rooms=new Rooms({config:C,send:sendTo});

  const server=http.createServer((req,res)=>{
    try{
      const url=(req.url||'').split('?')[0];
      const hdr={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      const origin=req.headers.origin;
      if(typeof origin==='string'&&C.ALLOWED_ORIGINS.includes(origin)){hdr['Access-Control-Allow-Origin']=origin;hdr['Vary']='Origin'}
      if(req.method==='GET'&&url==='/healthz'){hdr['Content-Type']='text/plain';res.writeHead(200,hdr);return res.end('ok')}
      if(req.method==='GET'&&url==='/matches'){
        const list=rooms.listing().map(r=>({id:r.id,mode:r.mode,state:r.state,humans:r.humans,max:r.max,countdown:r.countdown}));
        hdr['Content-Type']='application/json';res.writeHead(200,hdr);return res.end(JSON.stringify(list));
      }
      hdr['Content-Type']='text/plain';res.writeHead(404,hdr);res.end('not found');
    }catch(e){stats.errors++;try{res.destroy()}catch(e2){}}
  });
  server.headersTimeout=5000;server.requestTimeout=10000;server.keepAliveTimeout=3000;
  server.maxHeadersCount=30;server.maxConnections=1000;
  server.on('error',()=>{stats.errors++});
  server.on('clientError',(e,sock)=>{try{sock.destroy()}catch(e2){}});

  const wss=new WebSocketServer({noServer:true,maxPayload:C.MAX_MSG_BYTES,perMessageDeflate:false});
  wss.on('error',()=>{stats.errors++});

  const refuse=(socket,code,text)=>{try{socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)}catch(e){}try{socket.destroy()}catch(e){}};

  server.on('upgrade',(req,socket,head)=>{
    socket.on('error',()=>{});
    try{
      const url=(req.url||'').split('?')[0];
      const origin=req.headers.origin;
      if(url!=='/'&&url!=='/ws')return refuse(socket,404,'Not Found');
      if(typeof origin!=='string'||!C.ALLOWED_ORIGINS.includes(origin)){stats.rejected++;return refuse(socket,403,'Forbidden')}
      const ip=clientIp(req);
      if(blocked.has(ip)){stats.blocked++;return refuse(socket,403,'Forbidden')}
      if(!ipc.open(ip)){stats.rejected++;return refuse(socket,429,'Too Many Requests')}
      socket.once('close',()=>ipc.close(ip));
      wss.handleUpgrade(req,socket,head,ws=>onConnection(ws));
    }catch(e){stats.errors++;try{socket.destroy()}catch(e2){}}
  });

  function onConnection(ws){
    stats.conn++;
    const c={ws,sub:null,pid:null,authing:false,closed:false,bucket:new TokenBucket(C.MSG_BURST,C.MSG_PER_S,now)};
    all.add(c);
    const kill=(code)=>{try{ws.close(code||1008)}catch(e){}};
    const authTimer=setTimeout(()=>kill(1008),AUTH_MS);
    const idle=setTimeout(()=>kill(1001),C.IDLE_MS);
    const touch=()=>idle.refresh();
    ws.on('error',()=>{stats.errors++;try{ws.terminate()}catch(e){}});
    ws.on('pong',touch);
    ws.on('close',()=>{
      c.closed=true;clearTimeout(authTimer);clearTimeout(idle);all.delete(c);
      if(c.sub!==null&&conns.get(c.sub)===c){
        conns.delete(c.sub);
        try{rooms.leave(c.sub)}catch(e){stats.errors++}
      }
    });
    ws.on('message',(data,isBinary)=>{
      try{
        touch();
        if(isBinary){stats.badMsg++;return kill(1003)}
        if(!c.bucket.take()){stats.flood++;return kill(1008)}
        const p=parseClientMsg(data);
        if(!p.ok){stats.badMsg++;return kill(1008)}
        const m=p.msg;
        if(c.sub===null){
          if(c.authing||m.t!=='auth'){stats.badMsg++;return kill(1008)}
          c.authing=true;
          return doAuth(c,m,authTimer,kill);
        }
        switch(m.t){
          case'auth':stats.badMsg++;return kill(1008);
          case'join':{
            const r=rooms.join(c.sub,c.pid,'',m.mode);
            if(r.err)sendTo(c.sub,{t:'err',why:r.err});
            return;
          }
          case'leave':return rooms.leave(c.sub);
          case'ready':{const r=rooms.roomOf(c.sub);if(r)r.ready(c.sub,m);return}
          case'cmd':{const r=rooms.roomOf(c.sub);if(r)r.cmd(c.sub,m);return}
        }
      }catch(e){stats.errors++;kill(1011)}
    });
  }

  function doAuth(c,m,authTimer,kill){
    let p;
    try{p=Promise.resolve(verify(m.token))}catch(e){p=Promise.reject(e)}
    p.then(id=>{
      if(c.closed)return;
      const sub=id&&typeof id.sub==='string'?id.sub:null;
      if(!sub){stats.authFail++;return kill(1008)}
      if(blocked.has(sub)){stats.blocked++;return kill(1008)}
      const other=conns.get(sub);
      if(other&&other.ws.readyState===1){
        stats.dup++;
        try{c.ws.send(JSON.stringify({t:'err',why:'duplicate'}))}catch(e){}
        return kill(1008);
      }
      c.sub=sub;c.pid=m.pid;conns.set(sub,c);
      clearTimeout(authTimer);
      sendTo(sub,{t:'authed'});
      rooms.resume(sub,m.pid);
    }).catch(()=>{if(!c.closed){stats.authFail++;kill(1008)}});
  }

  /* Welt-Takt: ein Timer je Prozess, Zeit je Aufruf begrenzt */
  let last=now();
  const clock=setInterval(()=>{
    try{
      const t=now();const dt=Math.min((t-last)/1000,1);last=t;
      if(dt>0)rooms.tick(dt);
    }catch(e){stats.errors++}
  },100);
  const reload=setInterval(()=>{blocked=readBlocklist(blocklistPath)},BLOCK_RELOAD_MS);
  const ping=setInterval(()=>{for(const c of all){try{c.ws.ping()}catch(e){}}},Math.max(1000,Math.min(15000,Math.floor(C.IDLE_MS/3))));
  for(const t of [clock,reload,ping])t.unref();

  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,C.HOST,()=>{server.removeListener('error',reject);resolve()})});

  return{
    port:server.address().port,
    reloadBlocklist(){blocked=readBlocklist(blocklistPath)},
    stats:()=>({...stats}),
    close(){
      clearInterval(clock);clearInterval(reload);clearInterval(ping);
      for(const c of [...all]){try{c.ws.terminate()}catch(e){}}
      rooms.dispose();
      return new Promise(resolve=>{server.close(()=>resolve());try{server.closeAllConnections()}catch(e){}});
    }
  };
}

module.exports={start};

if(require.main===module){
  const {createVerifier,jwksFromUrl}=require('./auth');
  const url=process.env.SUPABASE_URL;
  if(!url){console.error('SUPABASE_URL fehlt');process.exit(1)}
  const supabaseUrl=url.replace(/\/+$/,'');
  const verify=createVerifier({getKeys:jwksFromUrl(supabaseUrl+'/auth/v1/.well-known/jwks.json'),supabaseUrl});
  start({port:+process.env.PORT||baseConfig.PORT,verify,now:Date.now,blocklistPath:process.env.BLOCKLIST_PATH,config:{HOST:'127.0.0.1'}}).then(h=>{
    console.log('server listening');
    let closing=false;
    const stop=()=>{if(closing)return;closing=true;h.close().then(()=>process.exit(0),()=>process.exit(1))};
    process.on('SIGTERM',stop);process.on('SIGINT',stop);
    process.on('uncaughtException',()=>{stats.errors++});
    process.on('unhandledRejection',()=>{stats.errors++});
    setInterval(()=>{const s=h.stats();console.log('stats',JSON.stringify(s))},600000).unref();
  }).catch(()=>{console.error('start failed');process.exit(1)});
}
