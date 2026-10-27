// ==========================================
// --- COMPANION: a friend who asks things, not a form ---
//   1. After sign-in and a full page load, Mindsence says hello out loud and asks your name and how you are.
//   2. After the first exchange it asks what kind of songs you like, and puts some on.
//   3. After 3-4 messages it asks your favourite colour and slowly shifts the whole site towards it.
// Nothing here talks to a model, runs during a crisis, or repeats itself. Everything is skippable by just chatting on.
// ==========================================

const COMPANION_TEXT = {
    en: { cGreet: "Hi, I'm Mindsence 🤍 I'm really glad you're here. What should I call you? And how are you doing today?",
          cSongs: "By the way, what kind of songs do you like? Tell me, and I'll put something on for you.",
          cSongsOk: "Lovely choice. Putting on {g} for you now. The little player is there if you want to change it.",
          cSongsNone: "I don't have that exact style yet, so I put on something calm for now. Tell me anything you like and I'll try to match it.",
          cColor: "One more thing, I'm curious: what's your favourite colour? I'd love to make this place feel a bit more like you.",
          cColorOk: "{c}! I love that. Watch, I'll slowly let this place warm up to it.",
          cColorNone: "I couldn't catch that colour. Try a simple one, like blue, pink or green?",
          cColorReset: "Back to the original look.", cMusicOff: "Okay, music off. Say the word and I'll put something on again.", cMusicNext: "Next one coming up." },
    hi: { cGreet: "नमस्ते, मैं Mindsence हूँ 🤍 आप यहाँ हैं, मुझे बहुत अच्छा लगा। मैं आपको किस नाम से बुलाऊँ? और आज आप कैसे हैं?",
          cSongs: "वैसे, आपको कैसे गाने पसंद हैं? बताइए, मैं आपके लिए कुछ चला देता हूँ।",
          cSongsOk: "बहुत बढ़िया पसंद। अभी आपके लिए {g} चला रहा हूँ। चाहें तो छोटे प्लेयर से बदल सकते हैं।",
          cSongsNone: "ऐसा ठीक वही स्टाइल मेरे पास अभी नहीं है, इसलिए कुछ शांत चला दिया है। जो पसंद हो बताइए, मैं मिलाने की कोशिश करूँगा।",
          cColor: "एक बात और, मुझे जानना है: आपका पसंदीदा रंग कौन सा है? मैं इस जगह को थोड़ा आपके जैसा बनाना चाहता हूँ।",
          cColorOk: "{c}! मुझे बहुत पसंद आया। देखिए, मैं धीरे-धीरे इस जगह को उसी रंग में ढाल दूँगा।",
          cColorNone: "मैं वो रंग समझ नहीं पाया। कोई सीधा सा रंग बताइए, जैसे नीला, गुलाबी या हरा?" },
    kn: { cGreet: "ಹಾಯ್, ನಾನು Mindsence 🤍 ನೀವು ಇಲ್ಲಿದ್ದೀರಿ ಎಂದು ತುಂಬಾ ಖುಷಿ. ನಿಮ್ಮನ್ನು ಏನೆಂದು ಕರೆಯಲಿ? ಇವತ್ತು ಹೇಗಿದ್ದೀರಿ?",
          cSongs: "ಅಂದಹಾಗೆ, ನಿಮಗೆ ಯಾವ ರೀತಿಯ ಹಾಡುಗಳು ಇಷ್ಟ? ಹೇಳಿ, ನಾನು ಏನಾದರೂ ಹಾಕುತ್ತೇನೆ.",
          cSongsOk: "ಒಳ್ಳೆಯ ಆಯ್ಕೆ. ಈಗ {g} ಹಾಕುತ್ತಿದ್ದೇನೆ. ಬದಲಾಯಿಸಬೇಕಿದ್ದರೆ ಪುಟ್ಟ ಪ್ಲೇಯರ್ ಇಲ್ಲಿದೆ.",
          cSongsNone: "ಆ ಶೈಲಿ ಇನ್ನೂ ನನ್ನ ಬಳಿ ಇಲ್ಲ, ಹಾಗಾಗಿ ಸದ್ಯಕ್ಕೆ ಶಾಂತವಾದದ್ದನ್ನು ಹಾಕಿದ್ದೇನೆ. ನಿಮಗೆ ಇಷ್ಟವಾದದ್ದನ್ನು ಹೇಳಿ, ಹೊಂದಿಸಲು ಪ್ರಯತ್ನಿಸುತ್ತೇನೆ.",
          cColor: "ಇನ್ನೊಂದು ವಿಷಯ, ಕುತೂಹಲ: ನಿಮ್ಮ ನೆಚ್ಚಿನ ಬಣ್ಣ ಯಾವುದು? ಈ ಜಾಗ ನಿಮ್ಮಂತೆಯೇ ಅನಿಸಲಿ ಎಂದು ಬಯಸುತ್ತೇನೆ.",
          cColorOk: "{c}! ತುಂಬಾ ಇಷ್ಟವಾಯಿತು. ನೋಡಿ, ನಿಧಾನವಾಗಿ ಈ ಜಾಗವನ್ನು ಆ ಬಣ್ಣಕ್ಕೆ ತರುತ್ತೇನೆ.",
          cColorNone: "ಆ ಬಣ್ಣ ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ನೀಲಿ, ಗುಲಾಬಿ ಅಥವಾ ಹಸಿರು ಅಂತಹ ಸರಳ ಬಣ್ಣ ಹೇಳುತ್ತೀರಾ?" },
    ta: { cGreet: "வணக்கம், நான் Mindsence 🤍 நீங்கள் இங்கே இருப்பது மகிழ்ச்சி. உங்களை எப்படி அழைக்கட்டும்? இன்று எப்படி இருக்கிறீர்கள்?",
          cSongs: "சொல்லப்போனால், உங்களுக்கு எந்த மாதிரி பாடல்கள் பிடிக்கும்? சொல்லுங்கள், நான் ஏதாவது போடுகிறேன்.",
          cSongsOk: "நல்ல தேர்வு. இப்போது {g} போடுகிறேன். மாற்ற வேண்டுமானால் சிறிய பிளேயர் இங்கே இருக்கிறது.",
          cSongsNone: "அந்த பாணி என்னிடம் இன்னும் இல்லை, அதனால் இப்போதைக்கு அமைதியான இசையைப் போட்டிருக்கிறேன். உங்களுக்குப் பிடித்ததைச் சொல்லுங்கள், பொருத்த முயல்கிறேன்.",
          cColor: "இன்னொன்று, எனக்கு ஆர்வம்: உங்களுக்குப் பிடித்த நிறம் எது? இந்த இடம் உங்களைப் போல உணர வேண்டும் என்று விரும்புகிறேன்.",
          cColorOk: "{c}! எனக்கு ரொம்பப் பிடித்தது. பாருங்கள், மெதுவாக இந்த இடத்தை அந்த நிறத்துக்கு மாற்றுகிறேன்.",
          cColorNone: "அந்த நிறம் எனக்குப் புரியவில்லை. நீலம், இளஞ்சிவப்பு அல்லது பச்சை போன்ற எளிய நிறத்தைச் சொல்லுங்களேன்?" },
    te: { cGreet: "హాయ్, నేను Mindsence 🤍 మీరు ఇక్కడ ఉన్నందుకు చాలా సంతోషం. మిమ్మల్ని ఏమని పిలవాలి? ఈ రోజు ఎలా ఉన్నారు?",
          cSongs: "ఇంతకీ, మీకు ఎలాంటి పాటలు ఇష్టం? చెప్పండి, నేను ఏదైనా పెడతాను.",
          cSongsOk: "మంచి ఎంపిక. ఇప్పుడు {g} పెడుతున్నాను. మార్చాలంటే చిన్న ప్లేయర్ ఇక్కడ ఉంది.",
          cSongsNone: "ఆ శైలి ఇంకా నా దగ్గర లేదు, అందుకే ప్రస్తుతానికి ప్రశాంతమైనది పెట్టాను. మీకు ఇష్టమైనది చెప్పండి, సరిపోల్చడానికి ప్రయత్నిస్తాను.",
          cColor: "ఇంకొకటి, ఆసక్తిగా ఉంది: మీకు ఇష్టమైన రంగు ఏది? ఈ చోటు మీలా అనిపించేలా చేయాలని ఉంది.",
          cColorOk: "{c}! నాకు చాలా నచ్చింది. చూడండి, నెమ్మదిగా ఈ చోటును ఆ రంగులోకి మారుస్తాను.",
          cColorNone: "ఆ రంగు నాకు అర్థం కాలేదు. నీలం, గులాబీ లేదా ఆకుపచ్చ లాంటి సరళమైన రంగు చెప్పగలరా?" },
    bn: { cGreet: "হাই, আমি Mindsence 🤍 আপনি এখানে আছেন, খুব ভালো লাগছে। আপনাকে কী নামে ডাকব? আর আজ কেমন আছেন?",
          cSongs: "আচ্ছা, আপনার কেমন গান ভালো লাগে? বলুন, আমি কিছু চালিয়ে দিই।",
          cSongsOk: "দারুণ পছন্দ। এখন আপনার জন্য {g} চালাচ্ছি। বদলাতে চাইলে ছোট প্লেয়ারটা এখানেই আছে।",
          cSongsNone: "ঠিক ওই ধরনটা এখনও আমার কাছে নেই, তাই আপাতত শান্ত কিছু চালিয়েছি। যা ভালো লাগে বলুন, মেলানোর চেষ্টা করব।",
          cColor: "আরেকটা কথা, জানতে ইচ্ছে করছে: আপনার প্রিয় রং কী? এই জায়গাটাকে একটু আপনার মতো করে তুলতে চাই।",
          cColorOk: "{c}! আমার খুব ভালো লাগল। দেখুন, ধীরে ধীরে এই জায়গাটাকে ওই রঙে সাজিয়ে দেব।",
          cColorNone: "ওই রংটা বুঝতে পারলাম না। নীল, গোলাপি বা সবুজের মতো সহজ একটা রং বলবেন?" },
    mr: { cGreet: "हाय, मी Mindsence 🤍 तुम्ही इथे आहात याचा मला खूप आनंद आहे. तुम्हाला काय म्हणून हाक मारू? आणि आज कसे आहात?",
          cSongs: "तसं, तुम्हाला कशा प्रकारची गाणी आवडतात? सांगा, मी काहीतरी लावतो.",
          cSongsOk: "छान निवड. आता तुमच्यासाठी {g} लावतो आहे. बदलायचं असेल तर छोटा प्लेयर इथे आहे.",
          cSongsNone: "ती शैली माझ्याकडे अजून नाही, म्हणून सध्या शांत काहीतरी लावलं आहे. तुम्हाला आवडेल ते सांगा, जुळवण्याचा प्रयत्न करतो.",
          cColor: "आणखी एक, उत्सुकता आहे: तुमचा आवडता रंग कोणता? ही जागा थोडी तुमच्यासारखी वाटावी असं वाटतं.",
          cColorOk: "{c}! मला खूप आवडला. बघा, हळूहळू ही जागा त्या रंगात रंगवतो.",
          cColorNone: "तो रंग मला समजला नाही. निळा, गुलाबी किंवा हिरवा असा साधा रंग सांगाल का?" },
    es: { cGreet: "Hola, soy Mindsence 🤍 Me alegra mucho que estés aquí. ¿Cómo quieres que te llame? ¿Y cómo estás hoy?",
          cSongs: "Por cierto, ¿qué tipo de canciones te gustan? Dime y pongo algo para ti.",
          cSongsOk: "Buena elección. Pongo {g} ahora mismo. El pequeño reproductor está ahí por si quieres cambiarlo.",
          cSongsNone: "Ese estilo exacto aún no lo tengo, así que puse algo tranquilo por ahora. Cuéntame lo que te gusta e intentaré acercarme.",
          cColor: "Una cosa más, tengo curiosidad: ¿cuál es tu color favorito? Me gustaría que este lugar se parezca un poco más a ti.",
          cColorOk: "¡{c}! Me encanta. Mira, poco a poco haré que este lugar se acerque a ese color.",
          cColorNone: "No pillé ese color. ¿Pruebas con uno sencillo, como azul, rosa o verde?" },
    fr: { cGreet: "Salut, je suis Mindsence 🤍 Je suis vraiment content que tu sois là. Comment dois-je t'appeler ? Et comment vas-tu aujourd'hui ?",
          cSongs: "Au fait, quel genre de chansons aimes-tu ? Dis-moi, je te mets quelque chose.",
          cSongsOk: "Joli choix. Je mets {g} pour toi. Le petit lecteur est là si tu veux changer.",
          cSongsNone: "Je n'ai pas encore exactement ce style, alors j'ai mis quelque chose de calme pour l'instant. Dis-moi ce que tu aimes, j'essaierai de m'en approcher.",
          cColor: "Encore une chose, je suis curieux : quelle est ta couleur préférée ? J'aimerais que cet endroit te ressemble un peu plus.",
          cColorOk: "{c} ! J'adore. Regarde, je vais doucement amener cet endroit vers cette couleur.",
          cColorNone: "Je n'ai pas reconnu cette couleur. Essaie une couleur simple, comme bleu, rose ou vert ?" },
    de: { cGreet: "Hallo, ich bin Mindsence 🤍 Schön, dass du da bist. Wie darf ich dich nennen? Und wie geht es dir heute?",
          cSongs: "Übrigens, welche Art von Liedern magst du? Sag es mir, dann mache ich etwas für dich an.",
          cSongsOk: "Schöne Wahl. Ich spiele jetzt {g} für dich. Der kleine Player ist da, falls du wechseln willst.",
          cSongsNone: "Genau diesen Stil habe ich noch nicht, deshalb läuft erst mal etwas Ruhiges. Sag mir, was du magst, ich versuche, es zu treffen.",
          cColor: "Noch etwas, ich bin neugierig: Was ist deine Lieblingsfarbe? Ich möchte diesen Ort ein bisschen mehr nach dir aussehen lassen.",
          cColorOk: "{c}! Ich liebe das. Schau, ich lasse diesen Ort langsam in diese Farbe übergehen.",
          cColorNone: "Diese Farbe habe ich nicht verstanden. Magst du eine einfache nennen, wie Blau, Rosa oder Grün?" },
    pt: { cGreet: "Oi, eu sou o Mindsence 🤍 Fico muito feliz que você esteja aqui. Como devo te chamar? E como você está hoje?",
          cSongs: "Aliás, que tipo de música você gosta? Me conta que eu coloco algo para você.",
          cSongsOk: "Ótima escolha. Estou colocando {g} para você. O pequeno player está aí se quiser mudar.",
          cSongsNone: "Esse estilo exato eu ainda não tenho, então coloquei algo calmo por enquanto. Me diga o que você gosta e eu tento chegar perto.",
          cColor: "Mais uma coisa, fiquei curioso: qual é a sua cor favorita? Quero deixar este lugar um pouco mais com a sua cara.",
          cColorOk: "{c}! Adorei. Olha, vou levando este lugar devagar para essa cor.",
          cColorNone: "Não entendi essa cor. Tenta uma simples, como azul, rosa ou verde?" },
    ar: { cGreet: "مرحبًا، أنا Mindsence 🤍 يسعدني جدًا أنك هنا. بماذا أناديك؟ وكيف حالك اليوم؟",
          cSongs: "بالمناسبة، ما نوع الأغاني التي تحبها؟ أخبرني وسأشغّل لك شيئًا.",
          cSongsOk: "اختيار جميل. سأشغّل {g} لك الآن. المشغّل الصغير موجود إن أردت التغيير.",
          cSongsNone: "ليس لدي هذا النمط بالضبط بعد، فشغّلت شيئًا هادئًا الآن. أخبرني بما تحب وسأحاول مطابقته.",
          cColor: "شيء آخر، أنا فضولي: ما لونك المفضل؟ أريد أن يشبهك هذا المكان أكثر.",
          cColorOk: "{c}! أحببته. انظر، سأقرّب هذا المكان من هذا اللون ببطء.",
          cColorNone: "لم أفهم هذا اللون. جرّب لونًا بسيطًا مثل الأزرق أو الوردي أو الأخضر؟" },
    zh: { cGreet: "你好，我是 Mindsence 🤍 你在这里，我很开心。我该怎么称呼你？你今天过得怎么样？",
          cSongs: "对了，你喜欢听什么类型的歌？告诉我，我来为你放一些。",
          cSongsOk: "很棒的选择。现在为你播放{g}。想换的话，小播放器就在那里。",
          cSongsNone: "我暂时还没有这种风格，先放了一些平静的音乐。告诉我你喜欢什么，我会尽量贴近。",
          cColor: "还有一件事，我很好奇：你最喜欢什么颜色？我想让这里更像你。",
          cColorOk: "{c}！我也喜欢。看，我会慢慢把这里变成这个颜色。",
          cColorNone: "我没听懂这个颜色。可以说个简单的吗，比如蓝色、粉色或绿色？" },
    ja: { cGreet: "こんにちは、Mindsenceです 🤍 来てくれてうれしいです。なんて呼べばいいですか？今日の調子はどうですか？",
          cSongs: "ところで、どんな曲が好きですか？教えてくれたら、何か流しますね。",
          cSongsOk: "いい選択ですね。{g}を流します。変えたいときは小さなプレーヤーからどうぞ。",
          cSongsNone: "その系統はまだないので、いまは落ち着いた曲を流しています。好きなものを教えてくれたら、近づけてみます。",
          cColor: "もうひとつ、気になります：好きな色は何ですか？ここを少しあなたらしくしたいんです。",
          cColorOk: "{c}！いいですね。見ていてください、ゆっくりこの場所をその色に染めていきます。",
          cColorNone: "その色が分かりませんでした。青、ピンク、緑のようなシンプルな色を教えてくれますか？" }
};
function ctext(key, vars) {
    const lang = (typeof convLang !== "undefined" ? convLang : "en");
    let s = (COMPANION_TEXT[lang] || COMPANION_TEXT.en)[key] || COMPANION_TEXT.en[key];
    Object.keys(vars || {}).forEach(k => { s = s.split(`{${k}}`).join(vars[k]); });
    return s;
}

// ---- NCS (NoCopyrightSounds) official YouTube playlists, played through YouTube's own embedded player ----
// NCS publishes these for listening; the player shows YouTube's controls and the credit below. No audio is copied.
const MUSIC_GENRES = [
    { key: "electronic", label: "NCS Electronic", list: "PLRBp0Fe2GpgnZOm5rCopMAOYhZCPoUyO5",
      re: /\b(electronic|electro|edm|dance|house|club|party|techno|pop|remix|trance|future bass)\b|इलेक्ट्रॉनिक|डांस|पॉप|ಪಾಪ್|பாப்|పాప్|পপ|electr[oó]nica|[eé]lectro|elektronisch|eletr[oô]nica|إلكترون|电子|流行|エレクトロ|ポップ/i },
    { key: "melodic", label: "NCS Melodic Dubstep", list: "PLRBp0Fe2Gpgm57nFVNM7qYZ9u64U9Q-Bf", re: /\b(melodic|emotional|sad songs?|heartbreak|feels?|melody)\b/i },
    { key: "dnb", label: "NCS Drum & Bass", list: "PLRBp0Fe2GpgnzYdHtTCoBYPyIJG9_opMn", re: /\b(dnb|drum\s*(and|&|n)?\s*bass|rock|metal|energetic|workout|gym|fast|upbeat|hype)\b|रॉक|ರಾಕ್|ராக்|రాక్|রক|ロック|摇滚|روك/i },
    { key: "dubstep", label: "NCS Dubstep", list: "PLRBp0Fe2Gpglq-J-Hv0p-y0wk3lQk570u", re: /\b(dubstep|heavy bass|wobble)\b/i },
    { key: "trap", label: "NCS Trap", list: "PLRBp0Fe2Gpgm0WF6DEGmb7ab4qHAGlPzg", re: /\b(trap|hip[\s-]?hop|rap)\b|हिप\s?हॉप|ラップ|说唱/i },
    { key: "calm", label: "calm music", list: null,
      re: /\b(chill|lo[\s-]?fi|calm|relax\w*|soft|slow|sleep\w*|ambient|nature|piano|classical|instrumental|peace\w*|soothing|meditat\w*|devotional|bhajan|tranquil\w*|calme|ruhig|sereno|tranquilo)\b|शांत|सुकून|आराम|ಶಾಂತ|ಪ್ರಶಾಂತ|அமைதி|ప్రశాంత|শান্ত|शांतता|هادئ|平静|安静|穏やか|落ち着/i }
];
const MUSIC_UNKNOWN = /\b(bollywood|filmi|kollywood|tollywood|sandalwood|punjabi|ghazal|folk|country|jazz|reggae|k-?pop)\b|बॉलीवुड|ಬಾಲಿವುಡ್|ಕನ್ನಡ ಹಾಡು|பாடல்|పాటలు|গান|गाणी|गाने/i;
const NOT_NOW = /^\s*(no|nope|nah|not now|later|skip|nothing|none|नहीं|ना|ಬೇಡ|வேண்டாம்|వద్దు|না|नको|no gracias|non merci|nein|não|لا|不用|いいえ)\b/i;

function matchGenre(text) {
    const s = String(text || "");
    for (const g of MUSIC_GENRES) if (g.re.test(s)) return g;
    return MUSIC_UNKNOWN.test(s) ? { key: "unknown", label: "calm music", list: null } : null;
}

// ---- YouTube dock (music from NCS) ----
let ytDock = null, ytFrame = null;
function ytCommand(func, args) {
    try { if (ytFrame && ytFrame.contentWindow) ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: args || [] }), "*"); } catch (e) { /* ignore */ }
}
function ytDuck(on) { if (ytFrame) ytCommand("setVolume", [on ? 12 : 60]); }

function closeYtDock() { if (ytDock) { ytDock.remove(); ytDock = null; ytFrame = null; } }
function openYtDock(genre) {
    closeYtDock();
    if (typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof toggleMainPlay === "function") toggleMainPlay();   // one source of music at a time
    ytDock = document.createElement("div");
    ytDock.id = "yt-dock"; ytDock.className = "yt-dock";
    const head = document.createElement("div"); head.className = "yt-dock-head";
    const title = document.createElement("span"); title.textContent = genre.label;
    const close = document.createElement("button"); close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Close music"); close.onclick = closeYtDock;
    head.append(title, close);
    ytFrame = document.createElement("iframe");
    ytFrame.title = genre.label;
    ytFrame.allow = "autoplay; encrypted-media; picture-in-picture";
    ytFrame.referrerPolicy = "strict-origin-when-cross-origin";
    const origin = encodeURIComponent(location.origin && location.origin !== "null" ? location.origin : "");
    ytFrame.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${genre.list}&autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${origin}`;
    ytFrame.addEventListener("load", () => setTimeout(() => ytCommand("setShuffle", [true]), 1200));
    const credit = document.createElement("a"); credit.className = "yt-dock-credit"; credit.href = "https://ncs.io"; credit.target = "_blank"; credit.rel = "noopener noreferrer";
    credit.textContent = "Music: NoCopyrightSounds (ncs.io)";
    ytDock.append(head, ytFrame, credit);
    document.body.appendChild(ytDock);
}

function startGenre(genre) {
    if (genre.list) { openYtDock(genre); return; }
    closeYtDock();                                                // calm = the app's own relaxing tracks
    if (typeof playlist !== "undefined" && playlist.length && typeof isMusicPlaying !== "undefined" && !isMusicPlaying && typeof toggleMainPlay === "function") toggleMainPlay();
}

// ---- favourite colour -> slow shift of the whole site ----
const NEUTRAL = { black: 0.8, white: 0.0, gray: 0.9 };
const COLOR_WORDS = [
    [0,   /\b(red|crimson|maroon|rojo|rouge|rot|vermelho|lal|laal)\b|लाल|ಕೆಂಪು|சிவப்பு|ఎరుపు|লাল|أحمر|红|赤|レッド/i],
    [28,  /\b(orange|naranja|laranja|narangi)\b|नारंगी|ಕಿತ್ತಳೆ|ஆரஞ்சு|నారింజ|কমলা|برتقالي|橙|オレンジ/i],
    [50,  /\b(yellow|amarillo|jaune|gelb|amarelo|golden|gold|peela)\b|पीला|ಹಳದಿ|மஞ்சள்|పసుపు|হলুদ|أصفر|黄|イエロー|黄色/i],
    [125, /\b(green|verde|vert|gr[uü]n|hara)\b|हरा|ಹಸಿರು|பச்சை|ఆకుపచ్చ|সবুজ|أخضر|绿|緑|グリーン/i],
    [170, /\b(teal|turquoise|turquesa|t[uü]rkis)\b|पीरोज़ा|ಪಿರೋಜ|ஊதா பச்சை|青绿/i],
    [183, /\b(cyan|aqua)\b|सियान/i],
    [215, /\b(blue|azul|bleu|blau|neela|nila)\b|नीला|ನೀಲಿ|நீலம்|నీలం|নীল|أزرق|蓝|青|ブルー/i],
    [270, /\b(purple|violet|violeta|lila|roxo|violett|lavender|jamuni)\b|बैंगनी|जामुनी|ನೇರಳೆ|ஊதா|ఊదా|বেগুনি|بنفسجي|紫|パープル/i],
    [300, /\b(magenta|fuchsia|fucsia)\b/i],
    [330, /\b(pink|rosa|rose|gulabi)\b|गुलाबी|ಗುಲಾಬಿ|இளஞ்சிவப்பு|గులాబీ|গোলাপি|وردي|粉|ピンク/i]
];
const NEUTRAL_WORDS = [
    ["black", /\b(black|negro|noir|schwarz|preto|kala)\b|काला|ಕಪ್ಪು|கருப்பு|கறுப்பு|నలుపు|কালো|أسود|黑|黒/i],
    ["white", /\b(white|blanco|blanc|wei[sß]|branco|safed)\b|सफेद|सफ़ेद|ಬಿಳಿ|வெள்ளை|తెలుపు|সাদা|أبيض|白/i],
    ["gray",  /\b(gr[ae]y|gris|grau|cinza|slate)\b|स्लेटी|ধূসর|灰/i]
];
const BASE_HUE = 183;                 // the site's default cyan

function hexToHue(hex) {
    const m = /#?([0-9a-f]{3}|[0-9a-f]{6})\b/i.exec(hex); if (!m) return null;
    let h = m[1]; if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 0.08) return { neutral: max > 0.5 ? "white" : "black", word: "#" + m[1] };
    let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { hue: (hue * 60 + 360) % 360, word: "#" + m[1] };
}

// -> { hue, word } | { neutral, word } | null
function parseColor(text) {
    const s = String(text || "");
    const hx = /#[0-9a-f]{3,6}\b/i.test(s) ? hexToHue(s) : null; if (hx) return hx;
    for (const [hue, re] of COLOR_WORDS) { const m = re.exec(s); if (m) return { hue, word: m[0] }; }
    for (const [neutral, re] of NEUTRAL_WORDS) { const m = re.exec(s); if (m) return { neutral, word: m[0] }; }
    return null;
}

function hueRotationFor(hue) { return ((hue - BASE_HUE + 540) % 360) - 180; }     // shortest way round, -180..180

function applyTheme(color, fraction) {
    const root = document.documentElement;
    if (!color) { root.style.setProperty("--hue-rot", "0deg"); root.style.setProperty("--gray", "0"); root.classList.remove("themed"); return; }
    const f = Math.max(0, Math.min(1, fraction));
    root.classList.add("themed");
    if (color.neutral) { root.style.setProperty("--hue-rot", "0deg"); root.style.setProperty("--gray", String((NEUTRAL[color.neutral] || 0) * f)); }
    else { root.style.setProperty("--gray", "0"); root.style.setProperty("--hue-rot", Math.round(hueRotationFor(color.hue) * f) + "deg"); }
}
function saveColor(color) { try { if (color) localStorage.setItem("mindsence_color", JSON.stringify(color)); else localStorage.removeItem("mindsence_color"); } catch (e) { /* ignore */ } }
function loadColor() { try { return JSON.parse(localStorage.getItem("mindsence_color") || "null"); } catch (e) { return null; } }

// ---- the conversation script ----
const companion = { name: null, userMsgs: 0, awaiting: null, askedSongs: false, askedColor: false, colorTries: 0, color: null, stage: 0, greeted: false, busy: false };
const COLOR_STAGES = [0.4, 0.7, 1];

function companionReset() {
    Object.assign(companion, { name: null, userMsgs: 0, awaiting: null, askedSongs: false, askedColor: false, colorTries: 0, greeted: false, busy: false });
}

const NAME_RE = /(?:my name is|i am called|i'm called|call me|this is|mera naam|naam hai|मेरा नाम|मुझे .{0,12} बुलाओ|me llamo|je m'appelle|ich hei(?:ss|ß)e|me chamo|meu nome [ée])\s+([^\s,.!?;:]{2,24})/i;
const IM_RE = /^\s*(?:[Ii]['’]?m|[Ii] am)\s+([A-Z][a-z]{1,20})\b(?!\s*(?:fine|good|ok|okay|sad|tired|happy|great|bad|down|here|alone|lonely|anxious|stressed))/;
const NOT_NAMES = new Set(["fine", "good", "ok", "okay", "sad", "tired", "happy", "great", "bad", "down", "here", "alone", "lonely", "not", "so", "very", "feeling", "doing", "a", "the"]);
function extractName(text) {
    const m = NAME_RE.exec(text) || IM_RE.exec(text);
    if (!m) return null;
    const n = m[1].replace(/[^\p{L}'-]/gu, "");
    if (n.length < 2 || NOT_NAMES.has(n.toLowerCase())) return null;
    return n.charAt(0).toUpperCase() + n.slice(1, 24);
}

function companionLine(boxes, text, opts) {
    boxes.forEach(box => {
        const { wrapper, actionRow } = createMessageElement(text, "ai");
        box.appendChild(wrapper);
        if (actionRow) actionRow.classList.remove("opacity-0");
    });
    scrollBoxes();
    rememberAssistant(text);
    if (!opts || opts.speak !== false) playLocalVoice(text);
}

// The greeting is shown on the chat screen straight away; this speaks it once the app is signed in and fully loaded.
function speakWhenUnlocked(text) {
    const ctxOk = () => { try { const c = speechAudioContext(); return !!c && c.state === "running"; } catch (e) { return false; } };
    const go = () => playLocalVoice(text);
    if (ctxOk()) return go();
    const once = () => { ["pointerdown", "keydown", "touchend"].forEach(ev => document.removeEventListener(ev, once, true)); setTimeout(go, 250); };
    ["pointerdown", "keydown", "touchend"].forEach(ev => document.addEventListener(ev, once, true));
}

function companionOnUnlock() {
    if (companion.greeted) return;
    const run = () => {
        if (companion.greeted) return;
        companion.greeted = true;
        const text = lastGreetingText || ctext("cGreet");
        setTimeout(() => speakWhenUnlocked(text), 700);
    };
    if (document.readyState === "complete") run(); else window.addEventListener("load", run, { once: true });
}
let lastGreetingText = "";
function companionGreetingText() { lastGreetingText = ctext("cGreet"); return lastGreetingText; }

function inHardMoment(text) { return (typeof inCrisisMode === "function" && inCrisisMode()) || (typeof detectDistress === "function" && detectDistress(text)); }

// ---- requests made on the person's own initiative ----
const MUSIC_NOUN = /\b(music|songs?|tracks?|playlist|ncs|beats?|tunes?|dj)\b|संगीत|गाना|गाने|म्यूज़िक|म्यूजिक|ಹಾಡು|ಹಾಡ|ಸಂಗೀತ|பாடல்|இசை|మ్యూజిక్|పాట|సంగీతం|গান|সংগীত|गाणी|गाणं|m[uú]sica|canci[oó]n|musique|chanson|musik|lied|موسيقى|音乐|歌|音楽/i;
const PLAY_VERB = /\b(play|put on|put some|start|turn on|switch on|listen|hear|i want|i wanna|can you|could you|let'?s|give me|need)\b|चला|बजा|सुना|सुनना|सुनाओ|ಹಾಕ|ಹಚ್ಚ|ಕೇಳ|போடு|போடுங்கள்|கேட்க|పెట్టు|వేయ|వినాలి|চালা|শুন|लाव|ऐक|pon|reproduce|escuchar|joue|mets|spiel|abspielen|toca|ouvir|شغل|播放|放一|听|流して|かけて|聴/i;
const MUSIC_STOP = /\b(stop|pause|turn off|switch off|shut)\b.{0,20}\b(music|songs?|player|it)\b|बंद\s*कर|रोक|ನಿಲ್ಲಿಸು|நிறுத்து|ఆపు|বন্ধ|आवर|para la m|arr[eê]te|stopp|pare|أوقف|停止|止めて/i;
const MUSIC_NEXT = /\b(next|skip|change)\b.{0,12}\b(song|track|music)\b/i;
const COLOR_NOUN = /\b(colou?rs?|theme|shade|tint|background)\b|रंग|ಬಣ್ಣ|நிறம்|రంగు|রং|color|couleur|farbe|\bcor\b|لون|颜色|色/i;
const COLOR_CHANGE = /\b(make|turn|change|set|switch|paint|go|use|prefer|want|wanna|like|love|favou?rite|show)\b/i;
const COLOR_RESET = /\b(default|original|normal|reset|remove|undo|back to)\b.{0,20}\b(colou?r|theme|look)\b|पहले जैसा|डिफ़ॉल्ट/i;
const FEELING = /\b(feel|feeling|felt|mood|sad|depress\w*)\b/i;

function handleRequests(text, boxes) {
    const s = String(text || "");
    if (MUSIC_STOP.test(s) && (MUSIC_NOUN.test(s) || /\b(it|that)\b/i.test(s)) && (ytDock || (typeof isMusicPlaying !== "undefined" && isMusicPlaying))) {
        rememberUser(s); stopMusic(); companionLine(boxes, ctext("cMusicOff")); return true;
    }
    if (MUSIC_NEXT.test(s) && typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof nextTrack === "function") {
        rememberUser(s); nextTrack(); companionLine(boxes, ctext("cMusicNext")); return true;
    }
    const g = matchGenre(s);
    const wantsMusic = PLAY_VERB.test(s) && (MUSIC_NOUN.test(s) || (g && g.key !== "unknown" && /\b(play|put on|listen|hear)\b/i.test(s)));
    if (wantsMusic || (g && MUSIC_NOUN.test(s) && !/\b(what|which|why|how|tell)\b/i.test(s) && s.length < 60)) {
        const pick = g || MUSIC_GENRES[0];                                  // "play some music" -> NCS Electronic
        rememberUser(s); startGenre(pick);
        companionLine(boxes, pick.key === "unknown" ? ctext("cSongsNone") : ctext("cSongsOk", { g: pick.label }));
        return true;
    }
    if (COLOR_RESET.test(s)) { rememberUser(s); setThemeColor(null); companionLine(boxes, ctext("cColorReset")); return true; }
    const c = parseColor(s);
    if (c && !FEELING.test(s) && (COLOR_NOUN.test(s) || (COLOR_CHANGE.test(s) && /\b(it|this|site|app|everything|screen|theme|background|whole)\b/i.test(s)))) {
        rememberUser(s); setThemeColor(c);
        companionLine(boxes, ctext("cColorOk", { c: c.word.charAt(0).toUpperCase() + c.word.slice(1) }));
        return true;
    }
    return false;
}

// Apply a colour for good (typed request, or a swatch). Warming up is gradual by default: three steps over a few seconds.
function setThemeColor(color, instant) {
    companion.awaiting = companion.awaiting === "color" ? null : companion.awaiting;
    companion.askedColor = true;
    if (!color) { companion.color = null; companion.stage = 0; saveColor(null); applyTheme(null, 0); return; }
    companion.color = color; saveColor(color);
    if (instant) { companion.stage = COLOR_STAGES.length; applyTheme(color, 1); return; }
    companion.stage = 1; applyTheme(color, COLOR_STAGES[0]);
    setTimeout(() => { if (companion.color === color && companion.stage < 2) { companion.stage = 2; applyTheme(color, COLOR_STAGES[1]); } }, 2500);
    setTimeout(() => { if (companion.color === color && companion.stage < COLOR_STAGES.length) { companion.stage = COLOR_STAGES.length; applyTheme(color, 1); } }, 5000);
}

function stopMusic() {
    closeYtDock();
    if (typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof toggleMainPlay === "function") toggleMainPlay();
}

// Called for every message the person sends (after the crisis check). Returns true when the message was answered here.
function companionIntercept(text, boxes) {
    companion.userMsgs++;
    const nm = !companion.name && extractName(text);
    if (nm) companion.name = nm;
    if (companion.color && companion.stage > 0 && companion.stage < COLOR_STAGES.length) {     // keep warming the site over the next messages
        companion.stage++; applyTheme(companion.color, COLOR_STAGES[companion.stage - 1]);
    }
    // Things the person asks for at any time, not only when asked: music and colour. These always work.
    const asked = handleRequests(text, boxes);
    if (asked) { companion.awaiting = null; return true; }
    if (inHardMoment(text)) { companion.awaiting = null; return false; }

    if (companion.awaiting === "songs") {
        companion.awaiting = null;
        const g = matchGenre(text);
        if (g) {
            rememberUser(text);
            startGenre(g);
            companionLine(boxes, g.list ? ctext("cSongsOk", { g: g.label }) : (g.key === "unknown" ? ctext("cSongsNone") : ctext("cSongsOk", { g: g.label })));
            return true;
        }
        return false;                                              // not a style: just chat normally
    }
    if (companion.awaiting === "color") {
        const c = parseColor(text);
        if (c) {
            companion.awaiting = null; setThemeColor(c);
            rememberUser(text);
            companionLine(boxes, ctext("cColorOk", { c: c.word.charAt(0).toUpperCase() + c.word.slice(1) }));
            return true;
        }
        if (NOT_NOW.test(text) || ++companion.colorTries >= 2) { companion.awaiting = null; return false; }
        rememberUser(text);
        companionLine(boxes, ctext("cColorNone"));
        return true;
    }
    return false;
}

// Called after a normal model reply is complete: this is where the friend asks its next question.
function companionAfterReply(boxes, userText) {
    if (companion.busy || inHardMoment(userText)) return;
    let key = null;
    if (!companion.askedSongs && companion.userMsgs >= 1) key = "songs";
    else if (!companion.askedColor && companion.userMsgs >= 4 && companion.askedSongs) key = "color";
    if (!key) return;
    companion.busy = true;
    (typeof whenSpeechIdle === "function" ? whenSpeechIdle() : Promise.resolve()).then(() => new Promise(r => setTimeout(r, 900))).then(() => {
        companion.busy = false;
        if (receiving || companion.awaiting || (typeof inCrisisMode === "function" && inCrisisMode())) return;
        if (key === "songs") { companion.askedSongs = true; companion.awaiting = "songs"; companionLine(boxes, ctext("cSongs")); }
        else { companion.askedColor = true; companion.awaiting = "color"; companionLine(boxes, ctext("cColor")); }
    });
}

// ---- always-visible controls: music chips in the player panel, colour swatches under the chat box ----
const SWATCHES = [["Cyan", 183], ["Blue", 215], ["Purple", 270], ["Pink", 330], ["Red", 0], ["Orange", 28], ["Yellow", 50], ["Green", 125]];
function buildControls() {
    const panel = document.getElementById("floating-player");
    if (panel && !document.getElementById("genre-row")) {
        const row = document.createElement("div"); row.id = "genre-row"; row.className = "genre-row";
        const lab = document.createElement("div"); lab.className = "genre-label"; lab.textContent = "NCS MUSIC · pick a style";
        row.appendChild(lab);
        MUSIC_GENRES.forEach(g => {
            const b = document.createElement("button"); b.type = "button"; b.className = "genre-chip";
            b.textContent = g.key === "calm" ? "Calm" : g.label.replace("NCS ", "").replace("Melodic Dubstep", "Melodic").replace("Drum & Bass", "DnB");
            b.onclick = () => startGenre(g);
            row.appendChild(b);
        });
        const off = document.createElement("button"); off.type = "button"; off.className = "genre-chip off"; off.textContent = "Stop"; off.onclick = stopMusic; row.appendChild(off);
        panel.appendChild(row);
    }
    const bar = document.querySelector(".about-bar");
    if (bar && !document.getElementById("color-btn")) {
        const btn = document.createElement("button"); btn.id = "color-btn"; btn.type = "button"; btn.className = "about-link"; btn.textContent = "🎨 Colour";
        btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
        const pop = document.createElement("div"); pop.id = "color-pop"; pop.className = "color-pop hidden"; pop.setAttribute("role", "group"); pop.setAttribute("aria-label", "Pick a colour");
        SWATCHES.forEach(([name, hue]) => {
            const sw = document.createElement("button"); sw.type = "button"; sw.className = "swatch"; sw.title = name; sw.setAttribute("aria-label", name);
            sw.style.background = `hsl(${hue} 85% 55%)`;
            sw.onclick = () => { setThemeColor(name === "Cyan" ? null : { hue, word: name }, true); };
            pop.appendChild(sw);
        });
        btn.onclick = (e) => { e.stopPropagation(); const open = pop.classList.toggle("hidden") === false; btn.setAttribute("aria-expanded", String(open)); };
        document.addEventListener("pointerdown", (e) => { if (!pop.classList.contains("hidden") && !pop.contains(e.target) && e.target !== btn) { pop.classList.add("hidden"); btn.setAttribute("aria-expanded", "false"); } });
        bar.insertBefore(btn, bar.firstChild); bar.appendChild(pop);
    }
}
if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildControls); else buildControls(); }

// A saved favourite colour is applied at load (no animation), so the site greets you in your colour.
(function restoreColor() {
    if (typeof document === "undefined") return;
    const c = loadColor();
    if (c) { companion.color = c; companion.stage = COLOR_STAGES.length; applyTheme(c, 1); }
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = { COMPANION_TEXT, MUSIC_GENRES, matchGenre, parseColor, hueRotationFor, extractName, companion, COLOR_STAGES };
}
