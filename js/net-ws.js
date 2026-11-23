/* ===== WebSocket-Transport für öffentliche Spiele =====
   Der Server führt die Welt. Der Client nutzt denselben Nachrichtenfluss wie im Host-Prinzip
   (NET.onmsg): auth, ack, room, nack, init, snap, cmd, end. */
const WSNet = {
  /* Öffnet die Verbindung und meldet das Konto an. Liefert einen Kanal für NET.begin. */
  open(url, token) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(new Error('ws')); return; }
      let opened = false;
      const ch = {
        ws,
        send(m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
        leave() { try { ws.close(1000); } catch (e) { } },
        onclose: null
      };
      const fail = () => { if (!opened) reject(new Error('ws')); };
      ws.onopen = () => {
        opened = true;
        try { ws.send(JSON.stringify({ t: 'auth', token, pid: PID })); } catch (e) { }
        resolve(ch);
      };
      ws.onerror = fail;
      ws.onclose = () => {
        if (!opened) { fail(); return; }
        if (ch.onclose) ch.onclose();
        else if (typeof NET !== 'undefined' && NET.onclose) NET.onclose();
      };
      ws.onmessage = ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (typeof NET !== 'undefined' && NET.onmsg) NET.onmsg(m);
      };
    });
  }
};
