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
          cColorOk: "{c}! I love that. There, it is yours now.",
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
    let s = (COMPANION_TEXT[lang] || COMPANION_TEXT.en)[key] || ((typeof LOCALES !== "undefined" && LOCALES[lang] && LOCALES[lang][key]) || null) || COMPANION_TEXT.en[key] || (typeof LOCALES !== "undefined" ? LOCALES.en[key] : "");
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
let ytDock = null, ytFrame = null, ytSong = null;     // ytSong = { results, i, query } while a searched song is playing
function ytCommand(func, args) {
    try { if (ytFrame && ytFrame.contentWindow) ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: args || [] }), "*"); } catch (e) { /* ignore */ }
}
let ytVol = 60;           // 0-100, what the person set with "volume down" etc.
function ytDuck(on) { if (ytFrame) ytCommand("setVolume", [on ? Math.min(12, ytVol) : ytVol]); }
function ytSetVolume(v) { ytVol = Math.max(0, Math.min(100, Math.round(v))); ytCommand("setVolume", [ytVol]); }

// YouTube's player lives in another origin, so the page cannot listen to its sound (no Web Audio access across
// origins). While it reports "playing" the background dances to a synthetic beat instead (see scene3d.js) --
// but the player does tell us, for real, its current playback position and its own volume/mute state, so the
// beat's timing and loudness follow the actual video rather than being a guess, even if its true rhythm can't be.
let ytPlaying = false;
if (typeof window !== "undefined") { window.ytCurrentTime = null; window.ytCurrentTimeAt = 0; window.ytVolumeFrac = 1; }
function closeYtDock() {
    if (ytDock) { ytDock.remove(); ytDock = null; ytFrame = null; } ytSong = null; ytPlaying = false;
    if (typeof window !== "undefined") window.ytCurrentTime = null;
}
if (typeof window !== "undefined") window.addEventListener("message", (e) => {
    if (!ytFrame || e.source !== ytFrame.contentWindow) return;
    let d = e.data; try { if (typeof d === "string") d = JSON.parse(d); } catch (err) { return; }
    if (!d) return;
    let st = null;
    if (d.event === "onStateChange") st = d.info;
    else if (d.event === "infoDelivery" && d.info && typeof d.info.playerState === "number") st = d.info.playerState;
    if (st !== null) ytPlaying = (st === 1 || st === 3);
    if (d.event === "infoDelivery" && d.info) {
        // Recorded with the wall-clock moment it arrived, so scene3d.js can keep counting forward smoothly between
        // these messages (they land only every ~100-250ms) while still resyncing to the real position each time.
        if (typeof d.info.currentTime === "number") { window.ytCurrentTime = d.info.currentTime; window.ytCurrentTimeAt = performance.now() / 1000; }
        if (typeof d.info.volume === "number") window.ytVolumeFrac = (d.info.muted ? 0 : d.info.volume / 100);
    }
});
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
    ytFrame.className = "keep-hue";   // the vibe colour tints our own chrome, never the real video pixels
    ytFrame.title = genre.label;
    ytFrame.allow = "autoplay; encrypted-media; picture-in-picture";
    ytFrame.referrerPolicy = "strict-origin-when-cross-origin";
    const origin = encodeURIComponent(location.origin && location.origin !== "null" ? location.origin : "");
    ytFrame.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${genre.list}&autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${origin}`;
    ytFrame.addEventListener("load", () => { try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*"); } catch (e) { /* ignore */ } setTimeout(() => { ytCommand("setShuffle", [true]); ytCommand("setVolume", [ytVol]); }, 1200); });
    const credit = document.createElement("a"); credit.className = "yt-dock-credit"; credit.href = "https://ncs.io"; credit.target = "_blank"; credit.rel = "noopener noreferrer";
    credit.textContent = (typeof t === "function" ? t("ncsCredit") : "Music: NoCopyrightSounds (ncs.io)");
    ytDock.append(head, ytFrame, credit);
    document.body.appendChild(ytDock);
}

// ---- any song: search (server, YouTube Data API) -> play the first embeddable result in YouTube's own player ----
function openSongDock(results, i, query) {
    closeYtDock();
    if (typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof toggleMainPlay === "function") toggleMainPlay();
    const cur = results[i];
    ytSong = { results, i, query };
    if (typeof vibeAuto !== "undefined" && vibeAuto && typeof applyVibe === "function") setTimeout(() => applyVibe(), 400);   // colour follows the song when asked to
    ytDock = document.createElement("div"); ytDock.id = "yt-dock"; ytDock.className = "yt-dock";
    const head = document.createElement("div"); head.className = "yt-dock-head";
    const title = document.createElement("span"); title.textContent = cur.title; title.title = cur.title;
    const nxt = document.createElement("button"); nxt.type = "button"; nxt.textContent = "⏭"; nxt.setAttribute("aria-label", "Next"); nxt.onclick = () => nextSong();
    nxt.style.display = results.length > 1 ? "" : "none";
    const close = document.createElement("button"); close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Close music"); close.onclick = closeYtDock;
    head.append(title, nxt, close);
    ytFrame = document.createElement("iframe"); ytFrame.className = "keep-hue"; ytFrame.title = cur.title;
    ytFrame.allow = "autoplay; encrypted-media; picture-in-picture"; ytFrame.referrerPolicy = "strict-origin-when-cross-origin";
    const origin = encodeURIComponent(location.origin && location.origin !== "null" ? location.origin : "");
    ytFrame.src = `https://www.youtube-nocookie.com/embed/${cur.id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${origin}`;
    ytFrame.addEventListener("load", () => { try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*"); } catch (e) { /* ignore */ } });
    const credit = document.createElement("a"); credit.className = "yt-dock-credit"; credit.href = `https://www.youtube.com/watch?v=${cur.id}`; credit.target = "_blank"; credit.rel = "noopener noreferrer";
    credit.textContent = (cur.channel ? cur.channel + " · " : "") + "YouTube";
    ytDock.append(head, ytFrame, credit);
    document.body.appendChild(ytDock);
}
function nextSong() { if (ytSong && ytSong.results.length > 1) openSongDock(ytSong.results, (ytSong.i + 1) % ytSong.results.length, ytSong.query); }
// A video that cannot be embedded, or one that ended, moves on to the next result.
if (typeof window !== "undefined") window.addEventListener("message", (e) => {
    if (!ytSong || !ytFrame || e.source !== ytFrame.contentWindow) return;
    let d = e.data; try { if (typeof d === "string") d = JSON.parse(d); } catch (err) { return; }
    if (d && (d.event === "onError" || (d.event === "onStateChange" && d.info === 0))) nextSong();
});

// What is left after removing the words that only say "play". Filler is stripped from the START and END of the message only,
// so a title like "Shape of You" or "On Top of the World" is never mangled.
const _lead = [
    "please|plz|pls|kindly|can you|could you|would you|will you|can u|i want to|i wanna|i want|i would like to|i'd like to|i need|let's|lets|now|just|for me|play|put on|put|turn on|start|listen to|listen|hear|stream|queue|sing|some|any|something|anything",
    "कृपया|प्लीज़|प्लीज|मुझे|मेरे लिए|कुछ|कोई|एक|सुनाओ|सुनना है|चलाओ|चला दो|बजाओ|सुनो",
    "ದಯವಿಟ್ಟು|ನನಗೆ|ಯಾವುದಾದರೂ|ಏನಾದರೂ|ಒಂದು|ಕೇಳಿಸು",
    "தயவுசெய்து|எனக்கு|ஏதாவது|ஒரு|போடு",
    "దయచేసి|నాకు|ఏదైనా|ఒక|పెట్టు",
    "অনুগ্রহ করে|আমাকে|আমার জন্য|যেকোনো|কিছু|একটা|চালাও",
    "कृपया|मला|काहीतरी|एक|लाव",
    "por favor|pon|ponme|ponga|reproduce|reproducir|escuchar|escucha|quiero escuchar|quiero|puedes poner|puedes|algo de|algo",
    "s'il te plaît|s'il te plait|s'il vous plaît|joue|jouer|mets|mettre|écouter|ecouter|je veux écouter|je veux|peux-tu mettre|peux-tu|tu peux mettre|tu peux|quelque chose",
    "bitte|spiel|spiele|abspielen|kannst du|ich will|ich möchte|hören|etwas",
    "toca|tocar|ouvir|quero ouvir|quero|pode tocar|pode|alguma coisa|algo",
    "من فضلك|شغل|شغّل|اسمع|أريد|اريد|أي شيء|أغنية|اغنية|أغاني"
].join("|");
const _trail = [
    "please|plz|pls|for me|now|play|song|songs|music|track|tracks|tune|video|audio|karo|kar do|kardo|kijiye|do",
    "कृपया|प्लीज़|गाना|गाने|गीत|का|की|के|को|चलाओ|चलाइए|चला दो|चला दीजिए|चला|बजाओ|बजा|सुनाओ|सुनाइए|सुनना है|सुनो|चाहिए|दो|दीजिए|है",
    "ಹಾಕಿ|ಹಾಕು|ಹಚ್ಚಿ|ಹಚ್ಚು|ಹಾಕಿರಿ|ಹಾಡನ್ನು|ಹಾಡು|ಹಾಡ|ಸಂಗೀತ|ಬೇಕು|ಕೇಳಬೇಕು|ದಯವಿಟ್ಟು|ಕೇಳಿಸು",
    "போடு|போடுங்கள்|போடுங்க|இயக்கு|பாடலை|பாடல்|பாட்டு|இசை|வேண்டும்|கேட்கணும்|தயவுசெய்து",
    "పెట్టు|పెట్టండి|వేయి|వేయండి|పాటను|పాట|పాటలు|సంగీతం|కావాలి|వినాలి|దయచేసి",
    "চালাও|চালান|চালিয়ে দাও|শোনাও|গানটা|গান|সংগীত|শুনতে চাই|অনুগ্রহ করে",
    "लाव|लावा|ऐकव|ऐकायचं|गाणं|गाणी|गाणे|संगीत|हवं|कृपया",
    "por favor|pon|ponme|canción|cancion|canciones|música|musica|tema|de favor",
    "s'il te plaît|s'il te plait|s'il vous plaît|chanson|chansons|musique|morceau|stp",
    "bitte|lied|lieder|musik|song|spielen|abspielen",
    "por favor|música|musica|música|canção|cancao|tocar|toca",
    "من فضلك|أغنية|اغنية|أغاني|موسيقى|شغل|شغّل"
].join("|");
const _w = (list) => "(?:" + list + ")(?=[\\s,.!?]|$)";
const SONG_LEAD = new RegExp("^[\\s\"“'‘]*(?:" + _w(_lead) + "[\\s,]*)+", "iu");
const SONG_TRAIL = new RegExp("(?:[\\s,]*(?<=^|[\\s,])(?:" + _trail + ")[\\s.!?।]*)+$", "iu");
const SONG_CJK = /播放|放一首|放|听|我想听|想听|请|帮我|一首|歌曲|歌|音乐|给我|かけて|流して|再生して|再生|聴きたい|聞きたい|お願い|曲|歌|音楽|を|の/gu;
const SONG_NOT = /\b(what|which|why|how|when|where|who|tell|explain|mean|means|meaning|about)\b|\?|क्या|क्यों|कैसे|ಏನು|ಯಾಕೆ|ಹೇಗೆ|என்ன|ஏன்|எப்படி|ఏమిటి|ఎందుకు|কী|কেন|कसे|qu[eé]|por qu[eé]|pourquoi|comment|warum|wie|por que|لماذا|为什么|なぜ/i;
const SONG_GENERIC = /^(|some|any|something|anything|music|song|songs|a song|the song|good|nice|new|old|latest|best|random|something good|something nice|कुछ|कोई|ಏನಾದರೂ|ஏதாவது|ఏదైనా|কিছু|काहीतरी|algo|quelque chose|etwas)$/i;
const SONG_BAD_Q = /^(in|on|at|with|for|from|to|by|about|of|into|and|or|but)\s+(the\s+)?(background|bg|mind|loop|repeat|here|there|now|case|general|fact|order|time)\b|^(and|or|but)\s|^(it|that|this|them|again|more|louder|quieter|background|silence|something|anything|one|ok|okay|yes|no|b)$/i;
const SONG_STATEMENT = /^(i|i'm|im|i've|my|we|he|she|they|it|it's|this|that|there)\b/i;
function stripSongFiller(str) {
    let q = String(str).replace(SONG_CJK, " ").replace(/\s+/g, " ").trim(), prev;
    do { prev = q; q = q.replace(SONG_LEAD, "").replace(SONG_TRAIL, "").replace(/^["“”‘’'`!?¿¡।。！？,;:\s]+|["“”‘’'`!?¿¡।。！？,;:\s]+$/g, "").trim(); } while (q !== prev);
    return q;
}
// Returns the song / artist the person wants played, or null when they did not ask for one.
function extractSongQuery(text) {
    const s0 = String(text || "").trim();
    if (!s0 || s0.length > 120 || SONG_NOT.test(s0) || FEELING.test(s0)) return null;
    const asksPlay = PLAY_VERB.test(s0), endsNoun = new RegExp("(" + MUSIC_NOUN.source + ")\\s*[.!]*\\s*$", "iu").test(s0);
    if (!asksPlay && !endsNoun) return null;
    if (!asksPlay && SONG_STATEMENT.test(s0)) return null;           // "I love music" is conversation, not a request
    const q = stripSongFiller(s0);
    if (q.length < 2 || !/\p{L}/u.test(q) || SONG_GENERIC.test(q) || SONG_BAD_Q.test(q)) return null;
    if (!asksPlay && q.split(" ").length > 6) return null;           // "<title> song" style needs a short title
    return q.slice(0, 100);
}
function songLink(boxes, url, q) {
    const last = boxes && boxes[0] && boxes[0].querySelectorAll(".ai-bubble");
    const bubble = last && last[last.length - 1];
    if (!bubble) return;
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = "song-link";
    a.textContent = "▶ " + ctext("cSongOpen", { s: q });
    bubble.appendChild(document.createElement("br")); bubble.appendChild(a);
}
const TALK_ASK = /\b(video|videos|speech|speeches|talk|talks|podcast|lecture|interview|motivation|motivational|inspiration|inspirational|meditation)\b/i;
async function playSong(query, boxes, askText) {
    const kind = TALK_ASK.test(askText || query) ? "talk" : "song";
    let data = null;
    try {
        const res = await fetch(`${LOCAL_BACKEND_URL}/song`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: query, kind }) });
        if (res.ok) data = await res.json();
    } catch (e) { /* offline */ }
    if (data && data.mode === "api" && data.results && data.results.length) {
        openSongDock(data.results, 0, query);
        companionLine(boxes, ctext("cSongPlay", { s: data.results[0].title || query }));
    } else if (data && data.url) {
        if (data.error === "search_failed") { companionLine(boxes, ctext("cSongFail")); }
        else companionLine(boxes, ctext("cSongLink", { s: query }));
        songLink(boxes, data.url, query);
    } else {
        companionLine(boxes, ctext("cSongFail"));
    }
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
    [330, /\b(pink|rosa|rose|gulabi)\b|गुलाबी|ಗುಲಾಬಿ|இளஞ்சிவப்பு|గులాబీ|গোলাপি|وردي|粉|ピンク/i],
    [315, /\b(vibrant|vivid|colou?rful|bright|neon)\b/i]
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
const VENT = /\b(fuck\w*|shit\w*|damn|bitch|asshole|crap|hate|stupid|idiot|shut up|wtf)\b/i;
const companion = { name: null, userMsgs: 0, awaiting: null, askedSongs: false, askedColor: false, colorTries: 0, color: null, stage: 0, greeted: false, busy: false };
const COLOR_STAGES = [0.4, 0.7, 1];

function companionReset() {
    Object.assign(companion, { name: null, userMsgs: 0, awaiting: null, askedSongs: false, askedColor: false, colorTries: 0, greeted: false, busy: false });
}

const NAME_RE = /(?:my name is|i am called|i'm called|call me|this is|mera naam|naam hai|मेरा नाम|मुझे .{0,12} बुलाओ|me llamo|je m'appelle|ich hei(?:ss|ß)e|me chamo|meu nome [ée])\s+([^\s,.!?;:]{1,24})/i;
const IM_RE = /^\s*(?:[Ii]['’]?m|[Ii] am)\s+([A-Z][a-z]{1,20})\b(?!\s*(?:fine|good|ok|okay|sad|tired|happy|great|bad|down|here|alone|lonely|anxious|stressed))/;
const NOT_NAMES = new Set(["fine", "good", "ok", "okay", "sad", "tired", "happy", "great", "bad", "down", "here", "alone", "lonely", "not", "so", "very", "feeling", "doing", "a", "the"]);
function extractName(text) {
    const m = NAME_RE.exec(text) || IM_RE.exec(text);
    if (!m) return null;
    const n = m[1].replace(/[^\p{L}'-]/gu, "");
    if (n.length < 1 || NOT_NAMES.has(n.toLowerCase())) return null;
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
const MUSIC_STOP = /\b(stop|pause|turn off|switch off|shut)\b.{0,20}\b(music|songs?|player|it)\b|बंद\s*कर|रोक|ನಿಲ್ಲಿಸು|ನಿಲ್ಲಿಸಿ|நிறுத்து|ఆపు|বন্ধ|आवर|para la m|arr[eê]te|stopp|pare|أوقف|停止|止めて/i;
const MUSIC_NEXT = /\b(next|skip|change)\b.{0,12}\b(song|track|music)\b|अगला\s*(गाना|गाने)|दूसरा\s*गाना|ಮುಂದಿನ\s*ಹಾಡು|ಬೇರೆ\s*ಹಾಡು|அடுத்த\s*பாடல்|తర్వాతి\s*పాట|పాట\s*మార్చు|পরের\s*গান|पुढचं\s*गाणं|siguiente\s+canci|chanson\s+suivante|n[äa]chste[sn]?\s+(lied|song)|pr[óo]xima\s+m[úu]sica|الأغنية التالية|下一首|次の曲/i;
const COLOR_NOUN = /\b(colou?rs?|theme|shade|tint|background)\b|रंग|ಬಣ್ಣ|நிறம்|రంగు|রং|color|couleur|farbe|\bcor\b|لون|颜色|色/i;
const COLOR_CHANGE = /\b(make|turn|change|set|switch|paint|go|use|prefer|want|wanna|like|love|favou?rite|show)\b/i;
const COLOR_RESET = /\b(default|original|normal|reset|remove|undo|back to)\b.{0,20}\b(colou?r|theme|look)\b|पहले जैसा|डिफ़ॉल्ट|मूल\s*रंग|ಮೊದಲಿನ\s*ಬಣ್ಣ|ಮೊದಲಿನಂತೆ|பழைய\s*நிறம்|முந்தைய\s*நிறம்|మునుపటి\s*రంగు|আগের\s*রং|मूळ\s*रंग|color\s+original|couleur\s+d.origine|urspr[üu]ngliche\s+farbe|cor\s+original|اللون الأصلي|原来的颜色|元の色/i;
const FEELING = /\b(feel|feeling|felt|mood|sad|depress\w*)\b/i;

function handleRequests(text, boxes) {
    const s = String(text || "");
    if (MUSIC_STOP.test(s) && (MUSIC_NOUN.test(s) || /\b(it|that)\b/i.test(s)) && (ytDock || (typeof isMusicPlaying !== "undefined" && isMusicPlaying))) {
        rememberUser(s); stopMusic(); companionLine(boxes, ctext("cMusicOff")); return true;
    }
    if (MUSIC_NEXT.test(s) && ytSong) { rememberUser(s); nextSong(); companionLine(boxes, ctext("cMusicNext")); return true; }
    if (MUSIC_NEXT.test(s) && typeof isMusicPlaying !== "undefined" && isMusicPlaying && typeof nextTrack === "function") {
        rememberUser(s); nextTrack(); companionLine(boxes, ctext("cMusicNext")); return true;
    }
    const g = matchGenre(s);
    if (!g || g.key === "unknown") {                                       // a named song or artist (any language), not a style
        const q = extractSongQuery(s);
        if (q) { rememberUser(s); playSong(q, boxes, s); return true; }
    }
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
        rememberUser(s); setThemeColor(c, true);
        companionLine(boxes, ctext("cColorOk", { c: c.word.charAt(0).toUpperCase() + c.word.slice(1) }));
        return true;
    }
    return false;
}

// Apply a colour for good (typed request, or a swatch). Warming up is gradual by default: three steps over a few seconds.
function setThemeColor(color, instant, fromVibe) {
    if (!fromVibe && typeof vibeAuto !== "undefined") vibeAuto = false;       // a colour the person picked themselves stops the automatic one
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
    if (nm && convLang === "en" && text.trim().split(/\s+/).length <= 9 && !PLAY_VERB.test(text)) {          // "you can call me B" is a name, never a song title
        companion.awaiting = null; rememberUser(text);
        companionLine(boxes, _fresh([`Nice to meet you, ${nm}. How are you feeling today?`, `${nm}, I like that. How's your day going so far?`, `Good to know you, ${nm}. What's on your mind right now?`], "name-hello"), { speak: true });
        return true;
    }
    if (companion.color && companion.stage > 0 && companion.stage < COLOR_STAGES.length) {     // keep warming the site over the next messages
        companion.stage++; applyTheme(companion.color, COLOR_STAGES[companion.stage - 1]);
    }
    // Direct commands (colour, volume, song, text size, particles, voice, language, open Games/Rooms/About) always win and apply at once.
    if (typeof runCommand === "function" && runCommand(text, boxes)) { companion.awaiting = null; return true; }
    // Things the person asks for at any time, not only when asked: music and colour. These always work.
    const asked = handleRequests(text, boxes);
    if (asked) { companion.awaiting = null; return true; }
    if (inHardMoment(text)) { companion.awaiting = null; return false; }

    if (companion.awaiting && VENT.test(text)) { companion.awaiting = null; return false; }   // swearing or venting is never a song title or a colour name
    if (companion.awaiting === "songs") {
        companion.awaiting = null;
        const g = matchGenre(text);
        if (g) {
            rememberUser(text);
            startGenre(g);
            companionLine(boxes, g.list ? ctext("cSongsOk", { g: g.label }) : (g.key === "unknown" ? ctext("cSongsNone") : ctext("cSongsOk", { g: g.label })));
            return true;
        }
        const q = !NOT_NOW.test(text) && text.trim().length <= 60 && !FEELING.test(text) && !SONG_STATEMENT.test(text.trim()) && !/^(you|can you|could you|call me|please|my name|one more|so |what|and )/i.test(text.trim()) ? stripSongFiller(text) : "";
        if (q.length >= 2 && !SONG_BAD_Q.test(q) && /\p{L}/u.test(q) && !SONG_GENERIC.test(q) && !SONG_NOT.test(text)) { rememberUser(text); playSong(q, boxes); return true; }   // they named a song or artist
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
        if (NOT_NOW.test(text) || ++companion.colorTries >= 2 || !/^\p{L}+$/u.test(text.trim())) { companion.awaiting = null; return false; }   // only a lone word is a colour attempt; anything else is just conversation
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
const CHIP_KEYS = { electronic: "mElectronic", melodic: "mMelodic", dnb: "mDnb", dubstep: "mDubstep", trap: "mTrap", calm: "mCalm" };
const tt = (k) => (typeof t === "function" ? t(k) : (typeof LOCALES !== "undefined" ? LOCALES.en[k] : k));
const swName = (i) => { const a = typeof t === "function" ? t("swNames") : null; return (a && a[i]) || SWATCHES[i][0]; };
function relabelControls() {
    document.querySelectorAll("#genre-row [data-k], #color-btn[data-k]").forEach(n => { n.textContent = tt(n.dataset.k); });
    document.querySelectorAll("#genre-row [data-kph]").forEach(n => { n.placeholder = tt(n.dataset.kph); n.setAttribute("aria-label", tt(n.dataset.kph)); });
    document.querySelectorAll("#color-pop .swatch").forEach(n => { const nm = swName(Number(n.dataset.sw)); n.title = nm; n.setAttribute("aria-label", nm); });
    const pop = document.getElementById("color-pop"); if (pop) pop.setAttribute("aria-label", tt("colourBtn"));
    const cr = document.querySelector(".yt-dock-credit"); if (cr) cr.textContent = tt("ncsCredit");
}
if (typeof document !== "undefined") document.addEventListener("ms-lang", relabelControls);
function buildControls() {
    const panel = document.getElementById("floating-player");
    if (panel && !document.getElementById("genre-row")) {
        const row = document.createElement("div"); row.id = "genre-row"; row.className = "genre-row";
        const lab = document.createElement("div"); lab.className = "genre-label"; lab.textContent = tt("mPick"); lab.dataset.k = "mPick";
        row.appendChild(lab);
        MUSIC_GENRES.forEach(g => {
            const b = document.createElement("button"); b.type = "button"; b.className = "genre-chip";
            b.dataset.k = CHIP_KEYS[g.key]; b.textContent = tt(CHIP_KEYS[g.key]);
            b.onclick = () => startGenre(g);
            row.appendChild(b);
        });
        const form = document.createElement("form"); form.className = "song-form";
        const inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 100; inp.className = "song-input"; inp.dataset.kph = "songPh"; inp.placeholder = tt("songPh"); inp.setAttribute("aria-label", tt("songPh"));
        const go = document.createElement("button"); go.type = "submit"; go.className = "genre-chip"; go.dataset.k = "songGo"; go.textContent = tt("songGo");
        form.append(inp, go);
        form.addEventListener("submit", (e) => { e.preventDefault(); const q = inp.value.trim(); if (q.length < 2) return; inp.value = ""; if (typeof SFX !== "undefined" && SFX.click) SFX.click(); const boxes = typeof activeBoxes === "function" ? activeBoxes() : []; rememberUser(q); playSong(q, boxes); });
        form.addEventListener("keydown", (e) => e.stopPropagation());       // typing a song must not trigger the Space-to-talk shortcut
        row.appendChild(form);
        const off = document.createElement("button"); off.type = "button"; off.className = "genre-chip off"; off.dataset.k = "mStop"; off.textContent = tt("mStop"); off.onclick = stopMusic; row.appendChild(off);
        panel.appendChild(row);
    }
    const bar = document.querySelector(".about-bar");
    if (bar && !document.getElementById("color-btn")) {
        const btn = document.createElement("button"); btn.id = "color-btn"; btn.type = "button"; btn.className = "about-link"; btn.dataset.k = "colourBtn"; btn.textContent = tt("colourBtn");
        btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
        const pop = document.createElement("div"); pop.id = "color-pop"; pop.className = "color-pop hidden"; pop.setAttribute("role", "group"); pop.setAttribute("aria-label", tt("colourBtn"));
        SWATCHES.forEach(([name, hue], i) => {
            const sw = document.createElement("button"); sw.type = "button"; sw.className = "swatch"; sw.dataset.sw = i; sw.title = swName(i); sw.setAttribute("aria-label", swName(i));
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
    module.exports = { extractSongQuery, MUSIC_STOP, MUSIC_NEXT, MUSIC_NOUN, PLAY_VERB, COLOR_RESET, COLOR_NOUN, COMPANION_TEXT, MUSIC_GENRES, matchGenre, parseColor, hueRotationFor, extractName, companion, COLOR_STAGES };
}
