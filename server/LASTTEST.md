# Lasttest: 10 Räume

Messung mit `cd server && node --expose-gc test/load.js` (je Modus eigener Lauf möglich: Argument `classic` oder `unlimited`).

- Maschine: Entwicklungsmaschine, Intel Xeon 2,1 GHz, 2 Kerne, x86_64
- Node: v22.23.5
- Datum: 2026-11-23
- Aufbau: 10 Räume über `Rooms`, je 8 Menschen (Bereit mit gültigem Start, Arten ground/leaf im Wechsel), Produktionsschritt `STEP_DT`=0,1 s, `snap` alle `SNAP_MS`=500 ms als JSON serialisiert, 300 simulierte Sekunden nach dem Countdown, keine echten Timer.

| Messwert | classic | unlimited |
|---|---|---|
| RSS vor den Räumen (leerer Prozess) | 40 MB | 40 MB |
| RSS nach Setup (10 laufende Räume) | 71 MB | 113 MB |
| RSS am Ende (nach gc) | 96 MB | 123 MB |
| RSS Spitze | 95 MB | 123 MB |
| heapUsed am Ende | 9 MB | 11 MB |
| CPU je simulierter Sekunde (alle 10 Räume) | 2,4 ms | 3,0 ms |
| `init` (Bytes) | 950 | 1394 |
| `snap` (Bytes, Maximum) | 567 | 998 |
| Räume nach 300 s noch laufend | 5 von 10 | 10 von 10 |

Hinweise: Die Menschen sind untätig, in classic sind nach 300 s fünf Räume durch Bots entschieden und geschlossen worden (CPU dort daher eher niedrig geschätzt). Die Karten-Attrappen und das Laden der Quellen je vm-Kontext kosten zusammen nur etwa 3 bis 7 MB je Raum, der Normalfall bleibt weit unter 1 GB, daher keine Ursachensuche nötig.

## Empfehlung für Task 8

- `MemoryMax=256M` (Spitze 123 MB, 2-fach Reserve, aufgerundet)
- `CPUQuota=50%` (Last unter 1 % eines Kerns, reichlich Luft für Verbindungen und Lastspitzen)
