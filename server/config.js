'use strict';
/* Startwerte; der Lasttest darf sie aendern. */
module.exports={
  HOST:process.env.HOST||'127.0.0.1',PORT:+process.env.PORT||8787,
  ALLOWED_ORIGINS:['https://luistico12.github.io'],
  MAX_MSG_BYTES:4096,MAX_ROOMS:10,MAX_HUMANS:8,MIN_HUMANS:2,COUNTDOWN_S:60,GRACE_S:30,
  SNAP_MS:500,STEP_DT:0.1,MSG_BURST:20,MSG_PER_S:10,CONN_PER_IP:4,IDLE_MS:60000,
  AUTH_MAX_BYTES:8448,READY_TIMEOUT_S:120,JOIN_PER_MIN:10
};
