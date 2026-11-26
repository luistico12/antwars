/* ===== WebSocket-Transport für Server-Matches (öffentliche Spiele) =====
   Liefert denselben Kanal wie die Lobby (send/leave), damit NET unverändert arbeitet. Eingehende Nachrichten gehen an NET.onmsg.
   Erste Nachricht ist immer auth {token,pid}; der Kanal gilt erst nach der Antwort `authed` des Servers als offen. */
const WSNet={
  open(url,token){
    return new Promise((resolve,reject)=>{
      let ws,authed=false,left=false,why='ws';
      /* nur verschlüsselt; unverschlüsselt ausschließlich für lokale Entwicklung. Sonst weder Socket noch Token */
      let u;try{u=new URL(url)}catch(e){return reject(new Error('url'))}
      if(!(u.protocol==='wss:'||(u.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))return reject(new Error('insecure'));
      try{ws=new WebSocket(u.href)}catch(e){return reject(new Error('ws'))}
      const ch={
        send(m){if(ws.readyState===1)ws.send(JSON.stringify(m))},
        leave(){left=true;try{ws.close(1000)}catch(e){}},
        onclose(){}
      };
      ws.onopen=()=>{try{ws.send(JSON.stringify({t:'auth',token,pid:PID}))}catch(e){}};
      ws.onmessage=ev=>{
        let m;try{m=JSON.parse(ev.data)}catch(e){return}
        if(!m||typeof m!=='object')return;
        if(!authed){
          if(m.t==='authed'){authed=true;resolve(ch);return}
          if(m.t==='err'&&typeof m.why==='string')why=m.why.slice(0,40);
          return;
        }
        NET.onmsg(m);
      };
      ws.onclose=()=>{
        if(!authed){reject(new Error(why));return}
        if(left)return;
        try{ch.onclose()}catch(e){}
        if(typeof NET!=='undefined'&&NET.ch===ch&&NET.active()&&typeof toast==='function')
          toast(LANG==='de'?'Verbindung zum Server verloren.':'Lost connection to the server.','bad');
      };
      ws.onerror=()=>{};
    });
  }
};
