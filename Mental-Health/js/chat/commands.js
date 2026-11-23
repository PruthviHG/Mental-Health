// ==========================================
// --- CHAT COMMANDS: "make it pink", "volume down a bit", "change the song" ... applied at once ---
// This is plain rule-matching on what the person typed or said, not an AI guess and not a mood analysis: a request either
// matches a command and is carried out immediately, or it is left alone and answered as normal conversation.
// parseCommand(text) is pure (easy to test); runCommand(text, boxes) does the work and says one short, varied line back.
// ==========================================
const CMD_LANGS = {
    en: /english|इंग्लिश|अंग्रेज़ी|अंग्रेजी/, hi: /hindi|हिंदी|हिन्दी/, kn: /kannada|ಕನ್ನಡ/, ta: /tamil|தமிழ்/, te: /telugu|తెలుగు/, bn: /bengali|bangla|বাংলা/,
    mr: /marathi|मराठी/, es: /spanish|espa[nñ]ol/, fr: /french|fran[cç]ais/, de: /german|deutsch/, pt: /portuguese|portugu[eê]s/, ar: /arabic|العربية/,
    zh: /chinese|mandarin|中文|汉语/, ja: /japanese|日本語/
};

function _cmdAmount(s, dflt) {
    if (/\b(a (little|bit|tad|touch|notch)|slightly|little|bit|tiny|abit|just a)\b/.test(s)) return 8;
    if (/\b(a lot|much|way|loads|heaps|lot more|a ton|really|very|too much)\b/.test(s)) return 30;
    return dflt;
}

// -> { name, ...args } or null. Messages longer than a short sentence are conversation, never commands.
function parseCommand(text) {
    const raw = String(text || "").trim();
    if (!raw || raw.length > 90) return null;
    const s = raw.toLowerCase().replace(/[!.]+$/g, "").replace(/\s+/g, " ").trim();
    if (/\b(did i|didn'?t i|i (didn'?t|did not|never) (ask|tell|say|want)|who asked|why did you)\b/.test(s)) return { name: "complaint" };
    if (/^(did|didn'?t|didnt|have|haven'?t|has|was|were|why|how come)\b/.test(s)) return null;
    if (/^(how|what|why|where|which|who|when|is|are|do you|does)\b/.test(s) && !/^(what about|how about)\b/.test(s)) return null;   // a question, not an order
    if (/^(i feel|i am|i'm|im|i was|my |it feels|everything|life|people)\b/.test(s)) return null;     // talking about themselves, not giving an order
    let m;

    // ----- volume -----
    if ((m = /\b(?:volume|music|sound|it)\b.{0,15}\b(?:to|at)\s*(\d{1,3})\s*(?:%|percent)?(?:\s|$)/.exec(s)) && /\b(volume|music|sound)\b/.test(s)) return { name: "volumeSet", value: Math.min(100, +m[1]) };
    if (/\b(max|maximum|full|highest)\b.{0,8}\bvolume\b|\bvolume\b.{0,8}\b(max|maximum|full)\b/.test(s)) return { name: "volumeSet", value: 100 };
    if (/\b(min|minimum|lowest)\b.{0,8}\bvolume\b/.test(s)) return { name: "volumeSet", value: 5 };
    if (/\bunmute\b/.test(s) && !/\b(voice|speaking|talking)\b/.test(s)) return { name: "unmute" };
    if (/^(please )?(mute|silence)( the| my)?( music| song| sound| it| everything)?$/.test(s)) return { name: "mute" };
    const downWords = /\b(down|lower|less|quieter|softer|low|reduce|decrease|drop|dim|gentler|quiet)\b|too loud|not so loud|so loud|bit loud|volumen bajo|baja|baisse|leiser|abaixa|कम|धीमा|धीरे/;
    const upWords = /\b(up|higher|louder|raise|increase|more|boost|bigger|loud)\b|too (quiet|soft|low)|can'?t hear|cannot hear|sube|monte|lauter|aumenta|ज़्यादा|ज्यादा|तेज़|तेज/;
    const volNoun = /\b(volume|sound|music|it|that|song|volumen|lautst[aä]rke)\b|आवाज़|आवाज|वॉल्यूम/;
    if (/too loud|not so loud|so loud|bit loud|too noisy|quieter|softer|\bleiser\b/.test(s) || (volNoun.test(s) && downWords.test(s) && /\b(volume|sound|music|it|that|song|turn|make|lower|reduce|volumen|baja|baisse|abaixa)\b|आवाज़|आवाज|वॉल्यूम/.test(s) && !upWords.test(s.replace(/\bmore\b|\bup\b/g, "") ) && !/\bup\b/.test(s))) {
        return { name: "volume", delta: -_cmdAmount(s, 15) };
    }
    if (/too (quiet|soft|low)|can'?t hear|cannot hear|\blouder\b|\blauter\b/.test(s) || (volNoun.test(s) && upWords.test(s) && /\b(volume|sound|music|it|that|song|turn|make|raise|increase|volumen|sube|monte|aumenta)\b|आवाज़|आवाज|वॉल्यूम/.test(s) && !/\bdown\b/.test(s))) {
        return { name: "volume", delta: _cmdAmount(s, 15) };
    }

    // ----- "play it in the background" / "that's not what I meant" -----
    if (/\b(play|keep|continue|run|put)\b.{0,16}\bin (the )?background\b|\bbackground (music|play|playing)\b|^in (the )?background$/.test(s)) return { name: "background" };
    // Rejecting the song that's actually playing: this can be acted on (skip it), unlike a vague "you got it wrong".
    if (/\bnot (this|that) (one|song|track|video)\b|\bwrong (song|one|video|track)\b|\bdon'?t (like|want) (this|that) (one|song|track)\b|\b(this|that)('?s| is) not it\b|\bfind (me )?(a )?(different|another|other) (one|song|track)\b|\bfind (something|anything) else\b/.test(s)) return { name: "rejectSong" };
    if (/\bnot what (i|you)\b|\bthat'?s not (what|it|that)\b|\bnot that one\b|\bwhat i meant\b|\bi meant\b|\bi said\b.{0,20}\b(not|no)\b/.test(s)) return { name: "misunderstood" };

    // ----- colour that follows the vibe of the music / mood -----
    if (/\b(colou?r|theme|background|ui|screen|everything|site|app)\b.{0,28}\b(according to|based on|depending on|match(?:ing)?|follow(?:ing)?|with|to fit|as per|by|from|to)\b.{0,16}\b(vibe|vibes|mood|song|songs|music|feeling|energy)\b|\b(vibe|mood|song|music)\b.{0,16}\b(colou?r|theme)\b|\bmatch\b.{0,24}\b(vibe|mood|song|music)\b/.test(s)) {
        return { name: "vibeColor", auto: /\b(always|keep|every|each|automatic\w*|whenever|according|depending|follow\w*|with the)\b/.test(s) };
    }
    if (/\b(stop|no more|don'?t)\b.{0,16}\b(changing|change)\b.{0,12}\b(colou?r|theme)\b/.test(s)) return { name: "vibeColor", off: true };

    // ----- songs -----
    if (/\b(songs?|music|tracks?|stuff|something|more)\b.{0,12}\b(like|similar to)\b.{0,16}\b(this|that|now|currently|listening|playing|it)\b|\b(like|same as|similar to)\b.{0,10}\b(this|that|what i'?m (listening|hearing)|what'?s playing)\b|\bmore (like (this|that|it)|of (this|that|the same))\b|\bsame (vibe|style|kind|type|genre)\b|\bkeep (it|this|them|the same) (going|vibe|style)\b/.test(s)) return { name: "similar" };
    if (/^(please )?(skip|next)( it| this| song| track)?$/.test(s) || /\b(next|skip|change|switch|another|different|other|new)\b.{0,14}\b(song|track|tune|music)\b|\bplay (something|another|a different|a new) ?(else|one|song)?\b(?!.*\bby\b)/.test(s) && !/\bplay\b.{0,6}\b(something )?by\b/.test(s)) return { name: "next" };
    if (/^(please )?(previous|prev|back|go back|undo)( song| track| one)?$/.test(s) || /\b(previous|prev|last|go back)\b.{0,12}\b(song|track|tune)\b/.test(s)) return { name: "prev" };
    if (/^(please )?(pause)( the| my)?( music| song| it| track)?$/.test(s) || /^pause\b/.test(s)) return { name: "pause" };
    if (/^(please )?(resume|continue|unpause|play)( the| my)?( music| song| it| track)?$/.test(s)) return { name: "resume" };

    // ----- how the page looks -----
    if (/\b(bigger|larger|increase|enlarge)\b.{0,12}\b(text|font|letters|writing|words)\b|\b(text|font|letters|writing)\b.{0,12}\b(bigger|larger|too small)\b|can'?t read/.test(s)) return { name: "textSize", delta: +_cmdAmount(s, 12) };
    if (/\b(smaller|decrease|reduce|shrink)\b.{0,12}\b(text|font|letters|writing|words)\b|\b(text|font|letters|writing)\b.{0,12}\b(smaller|too big|too large)\b/.test(s)) return { name: "textSize", delta: -_cmdAmount(s, 12) };
    if (/\b(normal|default|reset|original)\b.{0,10}\b(text|font|size)\b/.test(s)) return { name: "textSize", reset: true };
    if (/\b(turn off|stop|hide|remove|disable|no more|get rid of)\b.{0,12}\b(particles?|dots|the background|animation|animations)\b/.test(s)) return { name: "particles", on: false };
    if (/\b(turn on|show|start|enable|bring back|restore)\b.{0,12}\b(particles?|dots|the background|animation|animations)\b/.test(s)) return { name: "particles", on: true };
    if (/\b(particles?|dots|background|animation)\b.{0,16}\b(faster|speed up|quicker)\b|\b(faster|speed up)\b.{0,12}\b(particles?|dots|animation)\b/.test(s)) return { name: "particleSpeed", factor: 1.5 };
    if (/\b(particles?|dots|background|animation)\b.{0,16}\b(slower|slow down|calmer|gentler)\b|\b(slower|slow down|calm)\b.{0,12}\b(particles?|dots|animation)\b/.test(s)) return { name: "particleSpeed", factor: 0.65 };
    if (/\b(open|show|launch|take me to|go to|start)\b.{0,10}\b(games?|arcade)\b/.test(s)) return { name: "open", where: "games" };
    if (/\b(open|show|launch|take me to|go to|start)\b.{0,10}\b(rooms?|calm rooms?)\b/.test(s)) return { name: "open", where: "rooms" };
    if (/\b(open|show|launch|take me to|go to)\b.{0,10}\b(about|team|credits)\b/.test(s)) return { name: "open", where: "about" };

    // ----- Mindsence's voice and language -----
    if (/\b(stop|quit|no more|don'?t|do not)\b.{0,8}\b(talking|speaking|reading|speak|talk)\b|\b(mute|silence|turn off|disable)\b.{0,10}\b(your voice|the voice|voice|speaking|tts)\b|\bbe quiet\b|\btext only\b/.test(s)) return { name: "voice", on: false };
    if (/\b(turn on|enable|unmute|start)\b.{0,10}\b(your voice|the voice|voice|speaking|talking)\b|\b(speak|talk) (to me|again|out loud|aloud)\b|\bread (it|that|replies) (out|aloud)\b/.test(s)) return { name: "voice", on: true };
    if (/\b(speak|talk|reply|answer|respond|switch|change|write|use)\b.{0,16}\b(in|to|into)\b|\bplease\b.{0,6}$|^[\p{L} ]{3,16}( please)?$/u.test(s) || /(in|to) \S+$/.test(s)) {
        for (const code of Object.keys(CMD_LANGS)) if (CMD_LANGS[code].test(s) && !/\b(song|music|play)\b/.test(s)) return { name: "language", code };
    }
    return null;
}

// ----- the vibe of a song / mood -> a colour (rules you can read and change; unknown titles get a stable colour of their own) -----
const VIBES = [
    [/\b(?:calm|chill|lo-?fi|sleep|relax|ocean|rain|peace|ambient|soft|slow|quiet|meditat)/, 212, "blue", "calm and gentle"],
    [/\b(?:sad|cry|alone|lonely|broken|heartbreak|miss you|goodbye|tears|hurt|down|depress|low)/, 248, "indigo", "tender and quiet"],
    [/\b(?:love|romanc|heart|kiss|me better|valentine|crush|beautiful|sweet)/, 335, "pink", "warm and romantic"],
    [/\b(?:party|dance|club|thrills|edm|remix|drop|dj|bass|electronic|ncs|dubstep|trap|beat|turn up)/, 300, "magenta", "high-energy"],
    [/\b(?:happy|sunflower|sun|summer|joy|good vibes|upbeat|smile|sunshine|cheer)/, 48, "golden", "bright and warm"],
    [/\b(?:motivat|power|workout|gym|rise|fight|champion|focus|grind|winner|strong|zindagi|inspir)/, 26, "orange", "driven and hopeful"],
    [/\b(?:angry|rage|metal|rock|punk|mad|furious|hate|fuck|shit)/, 2, "red", "intense"],
    [/\b(?:nature|forest|green|yoga|breath|garden|grow|earth)/, 140, "green", "fresh and grounded"]
];
function vibeHueFor(text) {
    const s = String(text || "").toLowerCase();
    for (const [re, hue, name, why] of VIBES) if (re.test(s)) return { hue, name, why };
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;     // no clue in the words: a colour of its own for this title
    const hue = h % 360; return { hue, name: "a new shade", why: "a little different from the rest" };
}
function _cmdCurrentTitle() {
    try { if (typeof ytSong !== "undefined" && ytSong && ytSong.results[ytSong.i]) return ytSong.results[ytSong.i].title; } catch (e) { /* ignore */ }
    try { if (typeof playlist !== "undefined" && playlist.length && typeof currentTrackIndex !== "undefined" && playlist[currentTrackIndex]) return playlist[currentTrackIndex].name || ""; } catch (e) { /* ignore */ }
    return "";
}
function _cmdShortTitle(t) { return String(t || "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/\s+/g, " ").trim().slice(0, 60); }
let vibeAuto = true;    // by default the theme colour follows whatever song or video is playing
function applyVibe(boxes) {
    const title = _cmdCurrentTitle();
    const said = (typeof chatHistory !== "undefined" ? chatHistory.filter(m => m.role === "user").slice(-3).map(m => m.content).join(" ") : "");
    const v = vibeHueFor(title ? title + " " + said.slice(-80) : said);
    if (typeof setThemeColor === "function") setThemeColor({ hue: v.hue, word: v.name }, true, true);
    return { v, title: _cmdShortTitle(title) };
}

// ----- one short line back, never the same one twice in a row -----
const CMD_SAY = {
    volDown: ["Done, a little softer.", "Okay, lowered it.", "Quieter now.", "Turned it down.", "There, gentler."],
    volUp: ["Done, a little louder.", "Turned it up.", "Okay, raised it.", "Louder now.", "There, brighter."],
    volSet: ["Volume is at {v}%.", "Set to {v}%.", "Okay, {v}%."],
    mute: ["Muted. Say \"unmute\" any time.", "Silent now.", "Music is muted."],
    unmute: ["Sound is back.", "Unmuted.", "Okay, music is back on."],
    next: ["Switched to another song.", "Here is a different one.", "Okay, next song.", "Changed it for you."],
    prev: ["Back to the one before.", "Going back a song.", "Previous song."],
    pause: ["Paused.", "Okay, paused.", "Holding the music for you."],
    resume: ["Playing again.", "Music is back.", "Okay, resuming."],
    nothing: ["Nothing is playing right now. Tell me a song or a style and I will put it on.", "There is no music on yet. Name a song, an artist or a mood."],
    textUp: ["Bigger text.", "Made the text larger.", "Larger now."],
    textDown: ["Smaller text.", "Made the text smaller.", "Smaller now."],
    textReset: ["Text size back to normal."],
    pOff: ["Particles off.", "Background is calm now.", "Okay, the particles are gone."],
    pOn: ["Particles are back.", "Background is on again.", "There they are."],
    pFast: ["Particles faster.", "Speeding them up.", "Livelier now."],
    pSlow: ["Particles slower.", "Calmer now.", "Slowing them down."],
    voiceOff: ["Okay, I will stay quiet and just write.", "Voice off. I will type only.", "Understood, no speaking."],
    voiceOn: ["My voice is back on.", "I will speak again.", "Voice on."],
    lang: ["Switching to {l}.", "Okay, {l}.", "{l} it is."],
    opening: ["Opening it.", "Here you go.", "Opening now."],
    background: ["It already plays while we talk, you can keep chatting or switch tabs. YouTube makes its player stay visible, so I can't hide it, but it keeps going.", "The music keeps playing while we chat. I can't hide YouTube's player (their rule), but you can ignore it and it carries on."],
    misunderstood: ["Sorry, I got that wrong. Tell me again in a few words, like a song name, \"volume down\" or \"change the colour to blue\". If it was the song, say \"go back\" or \"stop\".", "My mistake. What did you mean? A song or artist, a colour, the volume, or just talking?", "I misread that, sorry. Say it another way and I'll get it. \"Stop\" ends the music."],
    complaint: ["You're right, you didn't ask for that, and I'm sorry. Say \"go back\" and I'll put the last one back.", "That was me jumping ahead, sorry. Tell me \"go back\" and I'll undo it.", "Fair point, I shouldn't have switched. \"Go back\" brings the last song back."],
    similar: ["Got it. I'll keep it in this style and line up songs like this one.", "Okay, same kind of music then. I'm adding songs like this one next.", "Nice taste. This one keeps playing, and the next ones will sound like it."],
    noPrev: ["That's the only one in the queue, so there is nothing before it. Name another and I'll play it."],
    noNext: ["That's the only version I found of this one, so there isn't another to skip to. Name a different song or artist and I'll look for that instead.", "I only found this one version. Tell me another song, artist or mood and I'll search for it."],
    similarNone: ["Tell me one song you like and I'll build from it."],
    vibeNow: ["{t} feels {w}, so everything is {c} now.", "Matched it: {t} is {w}, so I made it {c}.", "{c} suits {t}, which feels {w}."],
    vibeAuto: ["Done. The colour will follow the vibe from now on. Right now it's {c}, because {t} feels {w}.", "From now on the colours follow the music. Starting with {c}: {t} feels {w}."],
    vibeOff: ["Okay, the colour will stay as it is."]
};
function _cmdLine(key, vars) {
    const pool = CMD_SAY[key] || ["Done."];
    let s = (typeof _fresh === "function") ? _fresh(pool, "cmd:" + key) : pool[0];
    Object.keys(vars || {}).forEach(k => { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
}
function _cmdSay(boxes, key, vars) {
    const line = _cmdLine(key, vars);
    if (typeof companionLine === "function") companionLine(boxes, line, { speak: false });          // short confirmations are written, not spoken
    return true;
}

// ----- the actions -----
function _cmdOwnPct() { return (typeof musicPercent === "number") ? musicPercent : 38; }
function _cmdYtActive() { return typeof ytDock !== "undefined" && !!ytDock && typeof ytFrame !== "undefined" && !!ytFrame; }
function _cmdSetVolumes(own, yt) {
    if (typeof applyVolumePercent === "function") applyVolumePercent(own, true);
    if (typeof ytSetVolume === "function") ytSetVolume(yt);
}
let _cmdPreMute = null;

function _cmdFontApply(pct) { try { document.documentElement.style.fontSize = pct + "%"; } catch (e) { /* ignore */ } }
(function restoreFont() { try { const v = parseInt(localStorage.getItem("mindsence_font"), 10); if (v >= 80 && v <= 160) _cmdFontApply(v); } catch (e) { /* ignore */ } })();
(function restoreFx() { try { if (localStorage.getItem("mindsence_particles") === "off") window.fxParticles = false; const sp = parseFloat(localStorage.getItem("mindsence_particle_speed")); if (sp > 0.1 && sp < 4) window.fxSpeed = sp; } catch (e) { /* ignore */ } })();

async function _cmdQueueSimilar(title) {
    try {
        const res = await fetch(`${LOCAL_BACKEND_URL}/song`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "songs like " + title }) });
        const data = res.ok ? await res.json() : null;
        if (!data || !data.results || typeof ytSong === "undefined" || !ytSong) return;
        const have = new Set(ytSong.results.map(r => r.id));
        data.results.forEach(r => { if (!have.has(r.id)) ytSong.results.push(r); });
        const nxt = document.querySelector("#yt-dock .yt-dock-head button[aria-label='Next']"); if (nxt) nxt.style.display = "";
    } catch (e) { /* offline: the current song just keeps playing */ }
}

function _cmdNextSong(boxes) {
    if (typeof ytSong !== "undefined" && ytSong) {
        // Our own song dock: only claim to have changed it when there is actually another result to move to.
        // Calling the YouTube iframe's "next video" here would be a no-op (it's a single video, not a playlist) and a false promise.
        if (ytSong.results.length > 1) { nextSong(); return _cmdSay(boxes, "next"); }
        return _cmdSay(boxes, "noNext");
    }
    if (_cmdYtActive()) { ytCommand("nextVideo"); return _cmdSay(boxes, "next"); }
    if (typeof playlist !== "undefined" && playlist.length && typeof nextTrack === "function") {
        nextTrack();
        if (typeof isMusicPlaying !== "undefined" && !isMusicPlaying && typeof toggleMainPlay === "function") toggleMainPlay();
        return _cmdSay(boxes, "next");
    }
    return _cmdSay(boxes, "nothing");
}

function runCommand(text, boxes) {
    const c = parseCommand(text);
    if (!c) return false;
    if (typeof rememberUser === "function") rememberUser(text);
    switch (c.name) {
        case "volume": {
            const own = Math.max(0, Math.min(100, _cmdOwnPct() + c.delta));
            const yt = Math.max(0, Math.min(100, (typeof ytVol === "number" ? ytVol : 60) + c.delta));
            _cmdSetVolumes(own, yt); _cmdPreMute = null;
            return _cmdSay(boxes, c.delta < 0 ? "volDown" : "volUp");
        }
        case "volumeSet": _cmdSetVolumes(c.value, c.value); _cmdPreMute = null; return _cmdSay(boxes, "volSet", { v: c.value });
        case "mute": _cmdPreMute = { own: _cmdOwnPct(), yt: (typeof ytVol === "number" ? ytVol : 60) }; _cmdSetVolumes(0, 0); return _cmdSay(boxes, "mute");
        case "unmute": { const p = _cmdPreMute || { own: 38, yt: 60 }; _cmdSetVolumes(p.own || 38, p.yt || 60); _cmdPreMute = null; return _cmdSay(boxes, "unmute"); }
        case "next": return _cmdNextSong(boxes);
        case "rejectSong": {                       // "not this one" / "wrong song" / "find a different one": skip, don't just apologize
            if ((typeof ytSong !== "undefined" && ytSong) || _cmdYtActive() || (typeof playlist !== "undefined" && playlist.length)) return _cmdNextSong(boxes);
            return _cmdSay(boxes, "misunderstood");           // nothing is actually playing: there is nothing to skip
        }
        case "prev": {
            if (typeof ytSong !== "undefined" && ytSong && ytSong.results.length < 2) return _cmdSay(boxes, "noPrev");
            if (typeof ytSong !== "undefined" && ytSong && ytSong.results.length > 1 && typeof openSongDock === "function") { openSongDock(ytSong.results, (ytSong.i - 1 + ytSong.results.length) % ytSong.results.length, ytSong.query); return _cmdSay(boxes, "prev"); }
            if (_cmdYtActive()) { ytCommand("previousVideo"); return _cmdSay(boxes, "prev"); }
            if (typeof playlist !== "undefined" && playlist.length && typeof prevTrack === "function") { prevTrack(); return _cmdSay(boxes, "prev"); }
            return _cmdSay(boxes, "nothing");
        }
        case "pause":
            if (_cmdYtActive()) { ytCommand("pauseVideo"); return _cmdSay(boxes, "pause"); }
            if (typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof toggleMainPlay === "function") { toggleMainPlay(); return _cmdSay(boxes, "pause"); }
            return _cmdSay(boxes, "nothing");
        case "resume":
            if (_cmdYtActive()) { ytCommand("playVideo"); return _cmdSay(boxes, "resume"); }
            if (typeof playlist !== "undefined" && playlist.length && typeof isMusicPlaying !== "undefined" && typeof toggleMainPlay === "function") { if (!isMusicPlaying) toggleMainPlay(); return _cmdSay(boxes, "resume"); }
            return _cmdSay(boxes, "nothing");
        case "textSize": {
            const cur = parseInt((document.documentElement.style.fontSize || "100"), 10) || 100;
            const next = c.reset ? 100 : Math.max(80, Math.min(160, cur + c.delta));
            _cmdFontApply(next); try { localStorage.setItem("mindsence_font", String(next)); } catch (e) { /* ignore */ }
            return _cmdSay(boxes, c.reset ? "textReset" : (c.delta > 0 ? "textUp" : "textDown"));
        }
        case "particles":
            window.fxParticles = c.on; try { localStorage.setItem("mindsence_particles", c.on ? "on" : "off"); } catch (e) { /* ignore */ }
            return _cmdSay(boxes, c.on ? "pOn" : "pOff");
        case "particleSpeed": {
            window.fxSpeed = Math.max(0.25, Math.min(3, (window.fxSpeed || 1) * c.factor));
            try { localStorage.setItem("mindsence_particle_speed", String(window.fxSpeed)); } catch (e) { /* ignore */ }
            if (window.fxParticles === false) { window.fxParticles = true; try { localStorage.setItem("mindsence_particles", "on"); } catch (e) { /* ignore */ } }
            return _cmdSay(boxes, c.factor > 1 ? "pFast" : "pSlow");
        }
        case "open":
            _cmdSay(boxes, "opening");
            setTimeout(() => {
                if (c.where === "games" && typeof openArcade === "function") openArcade();
                else if (c.where === "rooms" && typeof openRooms === "function") openRooms();
                else if (c.where === "about") { const b = document.getElementById("about-open"); if (b) b.click(); }
            }, 350);
            return true;
        case "voice":
            voiceOff = !c.on;
            if (!c.on && typeof stopSpeech === "function") stopSpeech();
            return _cmdSay(boxes, c.on ? "voiceOn" : "voiceOff");
        case "background": return _cmdSay(boxes, "background");
        case "misunderstood": return _cmdSay(boxes, "misunderstood");
        case "complaint": {
            if (typeof ytSong !== "undefined" && ytSong && ytSong.results.length > 1 && typeof openSongDock === "function") window.__undoSong = true;
            return _cmdSay(boxes, "complaint");
        }
        case "similar": {
            const title = _cmdShortTitle(_cmdCurrentTitle());
            if (!title) return _cmdSay(boxes, "similarNone");
            _cmdQueueSimilar(title);
            return _cmdSay(boxes, "similar");
        }
        case "vibeColor": {
            if (c.off) { vibeAuto = false; return _cmdSay(boxes, "vibeOff"); }
            vibeAuto = !!c.auto;
            const { v, title } = applyVibe(boxes);
            return _cmdSay(boxes, vibeAuto ? "vibeAuto" : "vibeNow", { t: title || "this mood", w: v.why, c: v.name });
        }
        case "language": {
            if (typeof setLanguagePref === "function") setLanguagePref(c.code);
            const sel = document.getElementById("lang-select"); const label = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : c.code;
            return _cmdSay(boxes, "lang", { l: label });
        }
    }
    return false;
}

if (typeof module !== "undefined" && module.exports) module.exports = { parseCommand, vibeHueFor };
