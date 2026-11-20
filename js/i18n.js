/* Sprachen und Übersetzung. Quelltexte sind Deutsch; EN übersetzt die Oberfläche. Andere Sprachen fallen auf Englisch zurück. */
const LANGS=[
['de','Deutsch','German','de'],['en','English','English','gb'],['ar','العربية','Arabic','sa'],['bg','Български','Bulgarian','bg'],['bn','বাংলা','Bengali','bd'],['cs','Čeština','Czech','cz'],
['da','Dansk','Danish','dk'],['eo','Esperanto','Esperanto','eo'],['es','Español','Spanish','es'],['fi','Suomi','Finnish','fi'],['fr','Français','French','fr'],['gl','Galego','Galician','gl'],
['he','עברית','Hebrew','il'],['hi','हिन्दी','Hindi','in'],['hu','Magyar','Hungarian','hu'],['it','Italiano','Italian','it'],['ja','日本語','Japanese','jp'],['ko','한국어','Korean','kr'],
['mk','Македонски','Macedonian','mk'],['nl','Nederlands','Dutch','nl'],['pl','Polski','Polish','pl'],['pt-BR','Português (Brasil)','Portuguese (Brazil)','br'],['pt','Português (Portugal)','Portuguese (Portugal)','pt'],
['ru','Русский','Russian','ru'],['sr','Srpskohrvatski','Serbo-Croatian','rs'],['sk','Slovenčina','Slovak','sk'],['sl','Slovenščina','Slovenian','si'],['sv','Svenska','Swedish','se'],
['tr','Türkçe','Turkish','tr'],['uk','Українська','Ukrainian','ua'],['zh','中文','Chinese','cn'],['no','Norsk','Norwegian','no'],['el','Ελληνικά','Greek','gr'],['ro','Română','Romanian','ro']
];
const EN={
'Profil':'Profile','Erfolge':'Achievements','Shop':'Shop','Clan':'Clan','Leaderboard':'Leaderboard','Einstellungen':'Settings','Hauptmenü':'Main menu','Admin':'Admin',
'Spielen':'Play','Lobby erstellen':'Create lobby','Lobby beitreten':'Join lobby','Tutorial':'Tutorial','Nächste Karte':'Next map','Karte':'Map','Neue Karte':'New map',
'Anmelden':'Sign in','Registrieren':'Sign up','Abmelden':'Sign out','E-Mail':'Email','Passwort':'Password','Benutzername':'Username','Passwort vergessen?':'Forgot password?',
'oder':'or','Mit GitHub fortfahren':'Continue with GitHub','Mit Discord fortfahren':'Continue with Discord','Ungültige Zugangsdaten':'Invalid credentials',
'Wenn die Angaben stimmen, haben wir dir eine E-Mail geschickt.':'If the details are correct, we have sent you an email.',
'Bitte bestätige deine E-Mail, falls nötig, und melde dich dann an.':'Please confirm your email if required, then sign in.',
'Gastmodus: Kein Server konfiguriert. Dein Fortschritt liegt nur in diesem Browser.':'Guest mode: no server configured. Your progress is stored in this browser only.',
'Melde dich an, um zu spielen':'Sign in to play','Nur mit Konto spielbar':'Account required',
'Konto-ID':'Account ID','Mitglied seit':'Member since','Link kopieren':'Copy link','Kopiert':'Copied','Alle Spiele':'All games','Spiele':'Games','Siege':'Wins','Siegquote':'Win rate',
'Täglich':'Daily','Wöchentlich':'Weekly','Karriere':'Career','Abholen':'Claim','Abgeholt':'Claimed','Fortschritt':'Progress',
'Hüte':'Hats','Weltflaggen':'World flags','Ameisenflaggen':'Ant flags','Kaufen':'Buy','Ausrüsten':'Equip','Ausgerüstet':'Equipped','Ablegen':'Remove','Nicht genug Rubys':'Not enough Rubys','Rubys':'Rubys',
'Clan-Tag':'Clan tag','Beitreten':'Join','Verlassen':'Leave','Speichern':'Save','Spieler':'Players','Clans':'Clans','Siege ':'Wins','Spiele ':'Games','Quote':'Win %','Mitglieder':'Members',
'Neuigkeiten':'News','Neueste':'Latest','Sprache wählen':'Choose language','Sprachen suchen …':'Search languages …',
'Eigene Lobby':'Your lobby','Eigener Lobby beitreten':'Join a lobby','Lobby-ID eingeben':'Enter lobby ID','Öffentliche Spiele':'Public games','Lobby beitreten ':'Join lobby',
'Regeln & Optionen':'Rules & options','Schwierigkeit':'Difficulty','Leicht':'Easy','Normal':'Normal','Schwer':'Hard','Max. Spieler':'Max players','Öffentlich':'Public','Privat':'Private',
'Warten auf Spieler …':'Waiting for players …','Spiel starten':'Start game','Lobby verlassen':'Leave lobby','Chat':'Chat','Nachricht an die Lobby':'Message the lobby','Noch keine Nachrichten':'No messages yet',
'Zurück':'Back','Schließen':'Close','Weiter spielen':'Resume','Spiel beenden':'End game','Pause':'Pause',
'Cookies & Datenschutz':'Cookies & privacy','Akzeptieren':'Accept','Nur notwendige':'Necessary only','Auswahl speichern':'Save choice',
'Notwendig':'Necessary','Präferenzen':'Preferences','Werbung':'Advertising',
'Telefonnummer (Backup)':'Phone number (backup)','Code senden':'Send code','Bestätigen':'Verify','Sicherheit':'Security',
'News':'News','Titel':'Title','Version':'Version','Text':'Text','Neu':'New','Bearbeiten':'Edit','Löschen':'Delete','Suchen':'Search','Spielerprofile':'Player profiles',
'Kolonie':'Colony','Weltkarte':'World map','Art':'Species','Gegner':'Opponents','Menü':'Menu',
'Mausrad: Zoom · WASD oder Pfeiltasten: bewegen · Rechte Maustaste halten und ziehen: verschieben':'Mouse wheel: zoom · WASD or arrows: move · hold right mouse and drag: pan',
'Zwei Finger: zoomen · Ein Finger ziehen: verschieben · Lange drücken: Menü':'Pinch: zoom · drag: pan · long press: menu'
};
let LANG=lsGet('aw_lang',null)||((navigator.language||'de').toLowerCase().startsWith('de')?'de':'en');
function t(s){return LANG==='de'?s:(EN[s]||s)}
function setLang(l){LANG=l;lsSet('aw_lang',l);document.documentElement.lang=l;}
