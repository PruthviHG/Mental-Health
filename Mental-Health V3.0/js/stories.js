// ==========================================
// --- REAL STORIES + VIDEOS FOR HARD MOMENTS ---
// Shown AFTER the helplines when someone is in crisis, and softly when they are clearly struggling.
// Everything here is plain text: nothing is injected as HTML. Helplines always come first and are never replaced.
// Facts are kept to what is widely documented; the person's own words matter more than any story.
// ==========================================

const SUPPORT_VIDEOS = [
    { id: "ZebSXPUCPFc", title: "If you're feeling depressed, anxious, sad, or angry WATCH THIS!!!", by: "MotivationHub", themes: ["low", "pain"], gentle: true },
    { id: "YuNLNeIorJw", title: "SELF LOVE | Positive Morning Motivation", by: "Mind Motivation Coaching", themes: ["nobody", "low"], gentle: true },
    { id: "fRc3OD_bxZ8", title: "WHEN YOU FEEL BROKEN - Motivational Speech", by: "Ben Lionel Scott", themes: ["pain", "low", "nobody"], gentle: true },
    { id: "0cwtNOq_k4w", title: "WHEN LIFE BREAKS YOU - Powerful Motivational Speech", by: "Ben Lionel Scott", themes: ["pain", "job", "breakup"], gentle: true },
    { id: "zzfREEPbUsA", title: "WHEN IT HURTS - Powerful Motivational Speech", by: "Ben Lionel Scott", themes: ["pain", "breakup", "grief"], gentle: true },
    { id: "kxclCPpc4vE", title: "WHY AM I SO UNLUCKY? | How to be LUCKY", by: "The Learning Bug", themes: ["failure", "luck"], gentle: true },
    { id: "1DkTSscTq0s", title: "How A Loved One's Death Can Influence You Physically", by: "Sadhguru", themes: ["grief"], gentle: true },
    // Talks and readings from public, well-known sources (open in a new tab; no thumbnail)
    { url: "https://www.ted.com/talks/andrew_solomon_how_the_worst_moments_in_our_lives_make_us_who_we_are", title: "How the worst moments in our lives make us who we are", by: "Andrew Solomon · TED", themes: ["pain", "grief", "low"], gentle: true, kind: "talk" },
    { url: "https://jamesclear.com/great-speeches/the-fringe-benefits-of-failure-by-j-k-rowling", title: "The Fringe Benefits of Failure (J. K. Rowling, Harvard speech, text)", by: "J. K. Rowling", themes: ["failure", "job", "breakup"], gentle: true, kind: "talk" },
    { url: "https://inktalks.com/talks/on-top-of-the-world/", title: "On top of the world: Arunima Sinha's story", by: "INK Talks", themes: ["pain", "luck", "low"], gentle: true, kind: "talk" },
    // High-energy "toughen up" style: offered only to people who are low, not to someone in crisis.
    { id: "TLKxdTmk-zc", title: "The Most Eye Opening 10 Minutes Of Your Life | David Goggins", by: "Motivation Madness", themes: ["failure", "job", "pain"], gentle: false },
    { id: "41Zjh3AirjU", title: "Best Motivation Video - Never Give Up! [HD]", by: "Russell O'Neill", themes: ["failure", "job", "low"], gentle: false }
];

const SUPPORT_STORIES = [
    { id: "kohli", who: "Virat Kohli", wiki: "Virat_Kohli", themes: ["grief", "pain", "failure", "low"],
      text: "Virat Kohli was 18 when his father died in the middle of a Ranji Trophy match. He went back the next morning, scored 90 to save his team, and only then went home for the funeral. Years later, in a long slump, he went more than two and a half years without an international century. He kept turning up, and the hundred did come. Grief and a bad patch didn't mean he was finished." },
    { id: "stallone", who: "Sylvester Stallone", wiki: "Sylvester_Stallone", themes: ["failure", "job", "low", "luck"],
      text: "Sylvester Stallone was broke and turned away again and again. He has said he even sold his dog because he couldn't afford to feed him. He wrote Rocky in a few days, refused offers to sell the script unless he could play the lead, and the film went on to win Best Picture. Later he bought his dog back. His luck didn't change because he was lucky. It changed because he stayed in the room one more day." },
    { id: "murthy", who: "N. R. Narayana Murthy", wiki: "N._R._Narayana_Murthy", themes: ["job", "failure", "luck"],
      text: "Before Infosys, N. R. Narayana Murthy's first company, Softronics, failed. He started over in 1981 with six colleagues and ₹10,000 that his wife, Sudha, had saved. It became one of India's best-known companies. A failed business was one chapter, not his whole story." },
    { id: "yash", who: "Yash", wiki: "Yash_(actor)", themes: ["nobody", "low", "failure", "luck"],
      text: "Yash is a bus driver's son from Karnataka. He has spoken about arriving in Bengaluru with almost nothing, working in theatre and small TV roles for years while hardly anyone knew his name. Today he is KGF's Rocky. For years, nobody was watching. That didn't mean he didn't matter." },
    { id: "jobs", who: "Steve Jobs", wiki: "Steve_Jobs", themes: ["job", "failure"],
      text: "Steve Jobs was forced out of Apple, the company he started, at 30. He later said it was awful and also the best thing that happened to him. He went on to start NeXT and Pixar, and returned to Apple more than a decade later. Getting fired hurt, and it wasn't the end." },
    { id: "adele", who: "Adele", wiki: "Adele", themes: ["breakup", "pain", "low"],
      text: "Adele has said her album 21 came out of a painful break-up. She turned her broken heart into songs that millions of people sang their own heartbreak to. Love can end badly and you can still end up somewhere good. It hurts, and it does pass." },
    { id: "kalam", who: "A. P. J. Abdul Kalam", wiki: "A._P._J._Abdul_Kalam", themes: ["failure", "nobody", "job"],
      text: "Abdul Kalam sold newspapers as a boy to help his family. As a young man he missed out on becoming an Air Force pilot, finishing ninth when there were only eight places. He grieved, then found another road, and became a scientist and India's President. The door that closed wasn't the only door." },
    { id: "rowling", who: "J. K. Rowling", wiki: "J._K._Rowling", themes: ["failure", "job", "breakup", "low", "pain"],
      text: "Before Harry Potter, J. K. Rowling's marriage had failed and she was jobless with a young child, living on state benefits. She has spoken openly about a deep depression in those years. Her manuscript was sent to twelve publishers, and all twelve said no. Then Bloomsbury said yes. The rejections were real, and they were not the end of the story." },
    { id: "jordan", who: "Michael Jordan", wiki: "Michael_Jordan", themes: ["failure", "low"],
      text: "As a sophomore, Michael Jordan tried out for his high-school varsity basketball team and was judged too short. He later earned his place and became one of the greatest players the sport has seen. Not being picked that year didn't decide who he would become." },
    { id: "jackma", who: "Jack Ma", wiki: "Jack_Ma", themes: ["job", "failure", "nobody"],
      text: "Jack Ma failed China's college entrance exam twice. He says he was turned down for around thirty jobs, by KFC among them, and rejected by Harvard ten times. In 1999 he started Alibaba in his apartment with a group of 18 friends. Every no got him closer to the one place that said yes: his own idea." },
    { id: "arunima", who: "Arunima Sinha", wiki: "Arunima_Sinha", themes: ["pain", "luck", "low", "grief"],
      text: "In 2011, thieves pushed Arunima Sinha out of a moving train, and doctors had to amputate her leg to save her life. Two years later, on 21 May 2013, she stood on the summit of Mount Everest, the first woman with an amputated leg to do so. She didn't skip the pain. She walked through it, one step at a time." },
    { id: "hawking", who: "Stephen Hawking", wiki: "Stephen_Hawking", themes: ["pain", "luck", "low", "failure"],
      text: "Stephen Hawking was diagnosed with motor neurone disease at 21, and doctors gave him about two years. He lived more than fifty more, kept working, and wrote A Brief History of Time. The future that people predicted for him was wrong." },
    { id: "rajini", who: "Rajinikanth", wiki: "Rajinikanth", themes: ["nobody", "job", "low", "luck"],
      text: "Rajinikanth lost his mother when he was nine. He worked as a coolie and then as a bus conductor in Bangalore before joining an acting course in Madras, where a director noticed him. His first film came in 1975. Nobody was waiting for him, and he still showed up." },
    { id: "ambani", who: "Dhirubhai Ambani", wiki: "Dhirubhai_Ambani", themes: ["job", "nobody", "failure"],
      text: "Dhirubhai Ambani's Reliance began in a 350 sq ft room with one telephone, one table and three chairs. It grew into one of India's biggest companies. Big things can start very small and very quiet." },
    { id: "marykom", who: "Mary Kom", wiki: "Mary_Kom", themes: ["nobody", "luck", "failure", "low"],
      text: "Mary Kom grew up in a poor family of tenant farmers in Manipur. She switched from athletics to boxing in 2000, and became the only woman to win the World Amateur Boxing Championship six times, plus an Olympic bronze medal. Where you start doesn't set where you can get to." },
    { id: "matter", who: "You", themes: ["nobody", "low", "pain", "grief", "breakup", "job", "failure", "luck"],
      text: "It can feel like nobody is looking. I'm sorry it feels like that. But you're here, and you matter, even if the only person who has to believe it today is you. And plenty of people live through nights like this with hardly anything: some don't get one proper meal a day and still hold on to the next morning. I'm not saying that to shrink your pain. Your pain is real. I'm saying you are still here, and something good has not happened yet. Please tell one person today how heavy it is." }
];

// Card text in the 14 app languages. Stories and videos themselves are in English.
const SUPPORT_TEXT = {
    en: { sTitle: "Real people who got through it", sLead: "You don't have to watch anything. But if you'd like to see that people have come back from dark places, here's a story and a few videos.", sWatch: "Watch on YouTube", sNote: "Videos and talks open in a new tab, mostly in English." },
    hi: { sTitle: "असली लोग जो इससे गुज़रकर आगे बढ़े", sLead: "कुछ देखना ज़रूरी नहीं है। पर अगर आप देखना चाहें कि लोग अंधेरे से वापस आए हैं, तो यह एक कहानी और कुछ वीडियो हैं।", sWatch: "YouTube पर देखें", sNote: "वीडियो YouTube पर खुलते हैं, ज़्यादातर अंग्रेज़ी में।" },
    kn: { sTitle: "ಇದರಿಂದ ಹೊರಬಂದ ನಿಜವಾದ ಜನರು", sLead: "ಏನನ್ನೂ ನೋಡಲೇಬೇಕೆಂದಿಲ್ಲ. ಆದರೆ ಕತ್ತಲೆಯಿಂದ ಜನರು ಹೇಗೆ ಮರಳಿ ಬಂದರು ಎಂದು ನೋಡಬೇಕೆನಿಸಿದರೆ, ಇಲ್ಲಿ ಒಂದು ಕಥೆ ಮತ್ತು ಕೆಲವು ವೀಡಿಯೊಗಳಿವೆ.", sWatch: "YouTube ನಲ್ಲಿ ನೋಡಿ", sNote: "ವೀಡಿಯೊಗಳು YouTube ನಲ್ಲಿ ತೆರೆಯುತ್ತವೆ, ಹೆಚ್ಚಾಗಿ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ." },
    ta: { sTitle: "இதைக் கடந்து வந்த உண்மையான மனிதர்கள்", sLead: "எதையும் பார்க்க வேண்டிய அவசியமில்லை. ஆனால் இருளிலிருந்து மனிதர்கள் மீண்டு வந்திருக்கிறார்கள் என்று பார்க்க விரும்பினால், இதோ ஒரு கதையும் சில வீடியோக்களும்.", sWatch: "YouTube-இல் பாருங்கள்", sNote: "வீடியோக்கள் YouTube-இல் திறக்கும், பெரும்பாலும் ஆங்கிலத்தில்." },
    te: { sTitle: "దీన్ని దాటి వచ్చిన నిజమైన మనుషులు", sLead: "ఏదీ చూడాల్సిన అవసరం లేదు. కానీ చీకటి నుంచి మనుషులు తిరిగి వచ్చారని చూడాలనిపిస్తే, ఇదిగో ఒక కథ, కొన్ని వీడియోలు.", sWatch: "YouTube‌లో చూడండి", sNote: "వీడియోలు YouTube‌లో తెరుచుకుంటాయి, ఎక్కువగా ఇంగ్లీష్‌లో." },
    bn: { sTitle: "যাঁরা এই কঠিন সময় পার করে এসেছেন", sLead: "কিছু দেখতেই হবে এমন নয়। তবে অন্ধকার থেকে মানুষ ফিরে এসেছে দেখতে চাইলে, এখানে একটি গল্প আর কয়েকটি ভিডিও আছে।", sWatch: "YouTube-এ দেখুন", sNote: "ভিডিওগুলো YouTube-এ খোলে, বেশিরভাগ ইংরেজিতে।" },
    mr: { sTitle: "यातून बाहेर पडलेली खरी माणसं", sLead: "काही पाहावंच लागेल असं नाही. पण अंधारातून माणसं परत आली आहेत हे पाहावंसं वाटलं, तर ही एक गोष्ट आणि काही व्हिडिओ.", sWatch: "YouTube वर पाहा", sNote: "व्हिडिओ YouTube वर उघडतात, बहुतेक इंग्रजीत." },
    es: { sTitle: "Personas reales que salieron adelante", sLead: "No tienes que ver nada. Pero si quieres comprobar que otras personas han vuelto de lugares oscuros, aquí tienes una historia y algunos videos.", sWatch: "Ver en YouTube", sNote: "Los videos se abren en YouTube, casi todos en inglés." },
    fr: { sTitle: "De vraies personnes qui s'en sont sorties", sLead: "Tu n'as rien à regarder. Mais si tu veux voir que d'autres sont revenus de moments très sombres, voici une histoire et quelques vidéos.", sWatch: "Voir sur YouTube", sNote: "Les vidéos s'ouvrent sur YouTube, surtout en anglais." },
    de: { sTitle: "Echte Menschen, die es geschafft haben", sLead: "Du musst dir nichts ansehen. Aber wenn du sehen möchtest, dass Menschen aus dunklen Zeiten zurückgefunden haben, hier eine Geschichte und ein paar Videos.", sWatch: "Auf YouTube ansehen", sNote: "Die Videos öffnen sich auf YouTube, meist auf Englisch." },
    pt: { sTitle: "Pessoas reais que superaram isso", sLead: "Você não precisa assistir a nada. Mas se quiser ver que outras pessoas voltaram de momentos sombrios, aqui estão uma história e alguns vídeos.", sWatch: "Assistir no YouTube", sNote: "Os vídeos abrem no YouTube, a maioria em inglês." },
    ar: { sTitle: "أشخاص حقيقيون تجاوزوا هذا", sLead: "لست مضطرًا لمشاهدة أي شيء. لكن إن أردت أن ترى أن أناسًا عادوا من أوقات مظلمة، فهذه قصة وبعض المقاطع.", sWatch: "شاهد على YouTube", sNote: "تُفتح المقاطع على YouTube، ومعظمها بالإنجليزية." },
    zh: { sTitle: "走出低谷的真实的人", sLead: "你不必看任何东西。但如果你想看看别人如何从黑暗中走出来，这里有一个故事和几个视频。", sWatch: "在 YouTube 观看", sNote: "视频在 YouTube 打开，大多是英文。" },
    ja: { sTitle: "つらい時期を乗り越えた実在の人たち", sLead: "何も見なくて大丈夫です。でも、暗い場所から戻ってきた人がいると知りたければ、ひとつの話といくつかの動画があります。", sWatch: "YouTubeで見る", sNote: "動画はYouTubeで開きます。ほとんど英語です。" }
};

// ---- what is the person going through? ----
const SUPPORT_THEME_PATTERNS = [
    ["breakup", /\b(break\s?up|broke\s+up|breaking\s+up|heart\s?break|heartbroken|love\s+failure|cheated\s+on|she\s+left\s+me|he\s+left\s+me|dumped\s+me|rejected\s+me)\b/],
    ["job", /\b(fired|laid\s+off|lost\s+my\s+job|jobless|unemployed|no\s+job|business\s+(failed|collapsed)|bankrupt|lost\s+everything|in\s+debt)\b/],
    ["grief", /\b(passed\s+away|funeral|lost\s+my\s+(mom|mum|dad|mother|father|brother|sister|friend|wife|husband|son|daughter|grandma|grandpa)|(mom|dad|mother|father|brother|sister|friend)\s+died)\b/],
    ["nobody", /\b(nobody|no\s*one)\s+(cares|loves|likes|understands|listens|misses)|\b(so\s+)?(lonely|alone)\b|\bno\s+friends\b|\binvisible\b|\bunloved\b|\bunwanted\b/],
    ["luck", /\b(unlucky|bad\s+luck|cursed|nothing\s+(ever\s+)?works|nothing\s+goes\s+right)\b/],
    ["failure", /\b(i\s+failed|failure|failed\s+(my|the|an?)\s+\w+|not\s+good\s+enough|loser|useless|worthless|rejected|can'?t\s+do\s+anything\s+right)\b/]
];

// Clearly struggling but not (necessarily) a crisis: gentle offer only.
const SUPPORT_DISTRESS = /\b(hopeless|no\s+hope|worthless|useless|give\s+up|giving\s+up|i'?m\s+done|depress(ed|ion)|broken|hate\s+myself|can'?t\s+do\s+this|nothing\s+matters|what'?s\s+the\s+point|i'?m\s+a\s+failure|lost\s+everything|heart\s?broken|heartbreak|fired|laid\s+off|unlucky|so\s+lonely|nobody\s+cares|no\s*one\s+cares)\b/;

function supportTheme(text) {
    const s = String(text || "").toLowerCase().replace(/[‘’ʼ]/g, "'");
    for (const [theme, re] of SUPPORT_THEME_PATTERNS) if (re.test(s)) return theme;
    return "pain";
}
function detectDistress(text) { return SUPPORT_DISTRESS.test(String(text || "").toLowerCase().replace(/[‘’ʼ]/g, "'")); }

let supportShown = { count: 0, lastTurn: -99, turn: 0, storyIx: 0, videoIx: 0 };
function supportNextTurn() { supportShown.turn++; }
function resetSupport() { supportShown = { count: 0, lastTurn: -99, turn: 0, storyIx: 0, videoIx: 0 }; }

// Distress cards are rare on purpose (never nag); crisis cards only skip an immediate repeat.
function supportAllowed(crisis) {
    const gap = supportShown.turn - supportShown.lastTurn;
    return crisis ? gap >= 2 : (supportShown.count < 3 && gap >= 6);
}

function pickSupportVideos(theme, n, crisis) {
    const pool = SUPPORT_VIDEOS.filter(v => !crisis || v.gentle);
    const scored = pool.map((v, i) => ({ v, s: (v.themes.includes(theme) ? 2 + (v.themes[0] === theme ? 1 : 0) : 0) + (v.gentle ? 0.5 : 0), i }));
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
    const top = scored.filter(x => x.s >= scored[0].s - 1).map(x => x.v);       // best matches, rotated so repeats differ
    const out = [];
    for (let k = 0; k < top.length && out.length < n; k++) out.push(top[(supportShown.videoIx + k) % top.length]);
    for (const x of scored) { if (out.length >= n) break; if (!out.includes(x.v)) out.push(x.v); }
    return out.slice(0, n);
}

function pickSupportStory(theme) {
    const fits = SUPPORT_STORIES.filter(s => s.themes.includes(theme) && s.id !== "matter");
    const pool = fits.length ? fits : SUPPORT_STORIES.filter(s => s.id !== "matter");
    const story = (theme === "nobody" || supportShown.storyIx % 3 === 2) ? SUPPORT_STORIES.find(s => s.id === "matter") : pool[supportShown.storyIx % pool.length];
    return story;
}

function supportStrings(lang) { return SUPPORT_TEXT[lang] || SUPPORT_TEXT.en; }

// Build the card (DOM, textContent only). Returns null when nothing should be shown.
function buildSupportCard(lang, text, crisis) {
    if (typeof document === "undefined") return null;
    const theme = supportTheme(text);
    const L = supportStrings(lang);
    const story = pickSupportStory(theme);
    const videos = pickSupportVideos(theme, crisis ? 3 : 2, crisis);
    supportShown.count++; supportShown.lastTurn = supportShown.turn; supportShown.storyIx++; supportShown.videoIx++;

    const card = document.createElement("div");
    card.className = "support-card";
    card.dir = (lang === "ar") ? "rtl" : "ltr";
    const h = document.createElement("div"); h.className = "support-title"; h.textContent = L.sTitle;
    const lead = document.createElement("p"); lead.className = "support-lead"; lead.textContent = L.sLead;
    const sName = document.createElement("div"); sName.className = "support-who"; sName.textContent = story.who === "You" ? "" : story.who;
    const sText = document.createElement("p"); sText.className = "support-story"; sText.textContent = story.text;
    card.append(h, lead);
    if (sName.textContent) card.append(sName);
    card.append(sText);
    if (story.wiki) {
        const src = document.createElement("a"); src.className = "support-source"; src.textContent = "Wikipedia";
        src.href = `https://en.wikipedia.org/wiki/${story.wiki}`; src.target = "_blank"; src.rel = "noopener noreferrer";
        const srcWrap = document.createElement("p"); srcWrap.className = "support-note"; srcWrap.append("Source: ", src);
        card.append(srcWrap);
    }

    const list = document.createElement("div"); list.className = "support-videos";
    videos.forEach(v => {
        const a = document.createElement("a");
        a.className = "support-video";
        a.href = v.url || `https://www.youtube.com/watch?v=${v.id}`;
        a.target = "_blank"; a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", `${L.sWatch}: ${v.title}`);
        let img;
        if (v.id) {
            img = document.createElement("img");
            img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
            img.onerror = () => img.remove();
        } else { img = document.createElement("span"); img.className = "support-talk-icon"; img.textContent = "🎙"; }
        const meta = document.createElement("span"); meta.className = "support-video-meta";
        const t1 = document.createElement("span"); t1.className = "support-video-title"; t1.textContent = v.title;
        const t2 = document.createElement("span"); t2.className = "support-video-by"; t2.textContent = v.id ? `${v.by} · ${L.sWatch}` : v.by;
        meta.append(t1, t2);
        a.append(img, meta);
        list.appendChild(a);
    });
    const note = document.createElement("p"); note.className = "support-note"; note.textContent = L.sNote;
    card.append(list, note);
    return card;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SUPPORT_VIDEOS, SUPPORT_STORIES, SUPPORT_TEXT, supportTheme, detectDistress, pickSupportVideos, pickSupportStory, supportAllowed, supportNextTurn, resetSupport, _state: () => supportShown };
}
