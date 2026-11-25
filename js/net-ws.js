/* ===== WebSocket-Transport für Server-Matches (öffentliche Spiele) =====
   Liefert denselben Kanal wie die Lobby (send/leave), damit NET unverändert arbeitet. Eingehende Nachrichten gehen an NET.onmsg.
   Erste Nachricht ist immer auth {token,pid}; der Kanal gilt erst nach der Antwort `authed` des Servers als offen. */
const WSNet={
  open(url,token){
    return new Promise((resolve,reject)=>{
      let ws,authed=false,left=false;
      try{ws=new WebSocket(url)}catch(e){return reject(new Error('ws'))}
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
          if(m.t==='err'){return}
          return;
        }
        NET.onmsg(m);
      };
      ws.onclose=()=>{
        if(!authed){reject(new Error('ws'));return}
        if(left)return;
        try{ch.onclose()}catch(e){}
        if(typeof NET!=='undefined'&&NET.ch===ch&&NET.active()&&typeof toast==='function')
          toast(LANG==='de'?'Verbindung zum Server verloren.':'Lost connection to the server.','bad');
      };
      ws.onerror=()=>{};
    });
  }
};
