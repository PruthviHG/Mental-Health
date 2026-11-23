// ==========================================
// --- SIMPLE MODE: a built-in, offline, no-model responder ---
// Used only when no AI model is reachable (nothing configured, no internet, or the provider is down).
// It is deliberately basic: it listens, validates, and points to the calming tools. It does not diagnose
// or advise. English has topic-aware replies; other languages get gentle, general ones.
// ==========================================
const SIMPLE_TOPICS_EN = [
    { re: /\b(thank(s| you)|thx)\b/i, replies: ["You're welcome. I'm glad to be here with you. 🤍"] },
    { re: /\b(can'?t sleep|cannot sleep|can not sleep|couldn'?t sleep|unable to sleep|insomnia|awake all night|no sleep|nightmares?)/i, replies: [
        "That sounds exhausting. When sleep won't come, even a slow breath helps a little. Want to try the box breathing in GAMES with me?",
        "I'm sorry the nights are hard. You don't have to force sleep. Resting your body quietly still counts. 🌙"] },
    { re: /\b(anxious|anxiety|panic|worried|scared|afraid|overthinking|nervous)\b/i, replies: [
        "That sounds really heavy. Let's slow down together: breathe in for 4, hold 4, out for 4. The Box Breathing in GAMES can guide you.",
        "Anxiety can make everything feel urgent. You're safe in this moment. Can you name one thing you can see right now?"] },
    { re: /\b(lonely|alone|no one|nobody|isolated|no friends)\b/i, replies: [
        "Feeling alone hurts. Thank you for telling me. I'm here, and if there's one person you could send a small message to today, that could matter.",
        "I'm here with you right now. What has made you feel so alone lately?"] },
    { re: /\b(pain|hurts|aching|ache|chronic|migraine|headache)\b/i, replies: [
        "I'm sorry you're hurting. Living with pain is exhausting. I can't treat it, but I can keep you company. If it's severe or new, please talk to a doctor.",
        "Pain wears you down in every way. Would slow breathing or a quiet room help right now? I'm here either way."] },
    { re: /\b(angry|furious|mad|rage|hate|so annoyed|irritated)\b/i, replies: [
        "That's a lot of anger, and it makes sense to feel it. What happened?"] },
    { re: /\b(sad|depress|hopeless|empty|numb|worthless|cry(ing)?|crying|down|low|tired of)\b/i, replies: [
        "I'm really sorry you feel this way. You don't have to carry it alone, and you don't have to explain it perfectly. I'm listening.",
        "That sounds so heavy. Thank you for trusting me with it. What has today been like for you?",
        "I hear you. It's okay to not be okay. Would you like to tell me more, or just sit here for a moment together?"] },
    { re: /\b(exam|exams|test|marks|grades?|study|studying|assignment|deadline|interview|placement|results?)\b/i, replies: [
        "Exams and deadlines can swallow everything. You only have to do the next small piece, not all of it at once. What's the very next thing?",
        "That pressure is real. Have you had a break, some water, a bit of food? A rested mind works better than a squeezed one.",
        "It's okay to be scared of results. Your worth is bigger than any mark. What are you most worried about?"] },
    { re: /\b(boss|job|work|office|colleague|manager|fired|laid off|salary|promotion)\b/i, replies: [
        "Work can follow you home and sit on your chest. What part of it is weighing on you most?",
        "That sounds draining. Whatever happened at work, it doesn't decide your value. Do you want to talk it through?"] },
    { re: /\b(breakup|broke up|girlfriend|boyfriend|ex\b|divorce|cheated|heartbroken|love)\b/i, replies: [
        "Heartache is real pain, and it takes time. I'm here. Do you want to tell me what happened?",
        "I'm sorry. Missing someone and being hurt by them can both be true. What's been the hardest part today?"] },
    { re: /\b(mom|dad|mother|father|parents?|family|brother|sister|home)\b/i, replies: [
        "Family can be the warmest and the hardest thing at once. What's going on at home?",
        "That sounds complicated. You're allowed to feel more than one thing about the people closest to you. Tell me more if you like."] },
    { re: /\b(friend|friends|fight|argument|argued|ignored|left out|bullied?)\b/i, replies: [
        "Being hurt by people you care about stings. What happened between you?",
        "That sounds painful. You deserve people who treat you well. Want to tell me what was said?"] },
    { re: /\b(tired|exhausted|burnt? ?out|drained|overwhelmed|stress(ed)?)\b/i, replies: [
        "You sound worn out. Be gentle with yourself. Have you had some water or something to eat today?",
        "That's a lot to hold. What's weighing on you the most right now?"] }
];

const SIMPLE_GENERIC = {
    en: ["I'm here and I'm listening. Tell me more if you'd like. 🤍", "Thank you for sharing that with me. How does it feel right now?",
         "I hear you. Take your time, there's no rush. 🌿", "That matters. What would feel a little bit better right now?"],
    hi: ["मैं यहीं हूँ और सुन रहा हूँ। चाहो तो और बताओ। 🤍", "मुझे बताने के लिए शुक्रिया। अभी कैसा लग रहा है?", "मैं सुन रहा हूँ। जल्दी नहीं है, अपना समय लो। 🌿"],
    es: ["Estoy aquí y te escucho. Cuéntame más si quieres. 🤍", "Gracias por contármelo. ¿Cómo te sientes ahora?", "Te escucho. Sin prisa, tómate tu tiempo. 🌿"],
    fr: ["Je suis là et je t'écoute. Dis-m'en plus si tu veux. 🤍", "Merci de me l'avoir confié. Comment te sens-tu maintenant ?", "Je t'entends. Prends ton temps. 🌿"],
    de: ["Ich bin da und höre dir zu. Erzähl mir gern mehr. 🤍", "Danke, dass du das mit mir teilst. Wie fühlt es sich gerade an?", "Ich höre dich. Lass dir Zeit. 🌿"],
    pt: ["Estou aqui e estou ouvindo. Conte mais se quiser. 🤍", "Obrigado por compartilhar comigo. Como você se sente agora?", "Estou te ouvindo. Sem pressa. 🌿"],
    kn: ["ನಾನು ಇಲ್ಲಿದ್ದೇನೆ, ಕೇಳುತ್ತಿದ್ದೇನೆ. ಬೇಕಾದರೆ ಇನ್ನಷ್ಟು ಹೇಳು. 🤍", "ನನಗೆ ಹೇಳಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ಈಗ ಹೇಗನಿಸುತ್ತಿದೆ?"],
    ta: ["நான் இங்கே இருக்கிறேன், கேட்கிறேன். விரும்பினால் இன்னும் சொல். 🤍", "என்னிடம் சொன்னதற்கு நன்றி. இப்போது எப்படி இருக்கிறது?"],
    te: ["నేను ఇక్కడే ఉన్నాను, వింటున్నాను. కావాలంటే ఇంకా చెప్పు. 🤍", "నాతో పంచుకున్నందుకు థాంక్స్. ఇప్పుడు ఎలా అనిపిస్తోంది?"],
    bn: ["আমি এখানে আছি, শুনছি। চাইলে আরও বলো। 🤍", "আমাকে বলার জন্য ধন্যবাদ। এখন কেমন লাগছে?"],
    mr: ["मी इथे आहे, ऐकतोय. हवं तर आणखी सांग. 🤍", "मला सांगितल्याबद्दल धन्यवाद. आत्ता कसं वाटतंय?"],
    ar: ["أنا هنا وأسمعك. أخبرني المزيد إن أردت. 🤍", "شكرًا لأنك شاركتني ذلك. كيف تشعر الآن؟"],
    zh: ["我在这里，我在听。如果你愿意，可以多说一些。🤍", "谢谢你告诉我。你现在感觉怎么样？"],
    ja: ["ここにいます。聞いていますよ。よければもう少し話してください。🤍", "話してくれてありがとう。今はどんな気持ちですか？"]
};

// Short, separate openers and follow-up questions, so the generic reply can be assembled in many different ways.
const SIMPLE_OPEN = {
    en: ["I'm here with you.", "Thank you for telling me.", "That sounds like a lot.", "I hear you.", "It makes sense to feel that way.", "I'm glad you said it out loud."],
    hi: ["मैं यहीं हूँ, आपके साथ।", "मुझे बताने के लिए शुक्रिया।", "यह काफ़ी भारी लगता है।", "मैं समझ रहा हूँ।", "ऐसा महसूस होना स्वाभाविक है।"],
    kn: ["ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ, ನಿಮ್ಮ ಜೊತೆ.", "ನನಗೆ ಹೇಳಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ.", "ಇದು ತುಂಬಾ ಭಾರವಾಗಿರುವಂತಿದೆ.", "ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ.", "ಹೀಗೆ ಅನಿಸುವುದು ಸಹಜ."],
    ta: ["நான் இங்கே உங்களுடன் இருக்கிறேன்.", "என்னிடம் சொன்னதற்கு நன்றி.", "இது மிகவும் கனமாகத் தெரிகிறது.", "நான் கேட்கிறேன்.", "இப்படி உணர்வது இயல்பு தான்."],
    te: ["నేను ఇక్కడే మీతో ఉన్నాను.", "నాకు చెప్పినందుకు ధన్యవాదాలు.", "ఇది చాలా బరువుగా అనిపిస్తోంది.", "నేను వింటున్నాను.", "అలా అనిపించడం సహజమే."],
    bn: ["আমি এখানেই আছি, তোমার সঙ্গে।", "আমাকে বলার জন্য ধন্যবাদ।", "এটা বেশ ভারী মনে হচ্ছে।", "আমি শুনছি।", "এমন লাগাটা স্বাভাবিক।"],
    mr: ["मी इथेच आहे, तुझ्यासोबत.", "मला सांगितल्याबद्दल धन्यवाद.", "हे खूप जड वाटतंय.", "मी ऐकतोय.", "असं वाटणं स्वाभाविक आहे."],
    es: ["Estoy aquí contigo.", "Gracias por contármelo.", "Suena a mucho.", "Te escucho.", "Es normal sentirse así."],
    fr: ["Je suis là avec toi.", "Merci de me le dire.", "Ça a l'air lourd.", "Je t'entends.", "C'est normal de ressentir ça."],
    de: ["Ich bin bei dir.", "Danke, dass du es mir sagst.", "Das klingt nach viel.", "Ich höre dich.", "Es ist verständlich, dass du dich so fühlst."],
    pt: ["Estou aqui com você.", "Obrigado por me contar.", "Parece pesado.", "Eu te escuto.", "É normal se sentir assim."],
    ar: ["أنا هنا معك.", "شكرًا لأنك أخبرتني.", "يبدو هذا ثقيلًا.", "أنا أسمعك.", "من الطبيعي أن تشعر هكذا."],
    zh: ["我在这里陪着你。", "谢谢你告诉我。", "听起来很不容易。", "我听着呢。", "有这样的感觉很正常。"],
    ja: ["ここにいますよ。", "話してくれてありがとう。", "それは大変そうですね。", "聞いています。", "そう感じるのは自然なことです。"]
};
const SIMPLE_ASK = {
    en: ["What part of it is hardest right now?", "How are you feeling in your body at the moment?", "What would help even a little today?", "Is there anyone you could share this with?", "What happened just before you started feeling this way?", "Would you like to tell me more, or just breathe for a moment?"],
    hi: ["अभी इसमें सबसे मुश्किल क्या है?", "इस समय आपके शरीर में कैसा लग रहा है?", "आज थोड़ा सा भी क्या मदद करेगा?", "क्या कोई है जिससे आप यह बाँट सकें?", "और बताना चाहेंगे, या बस एक पल साँस लें?"],
    kn: ["ಈಗ ಇದರಲ್ಲಿ ಯಾವುದು ಹೆಚ್ಚು ಕಷ್ಟ?", "ಈಗ ನಿಮ್ಮ ದೇಹಕ್ಕೆ ಹೇಗನಿಸುತ್ತಿದೆ?", "ಇವತ್ತು ಸ್ವಲ್ಪವಾದರೂ ಏನು ಸಹಾಯ ಮಾಡೀತು?", "ಇದನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಯಾರಾದರೂ ಇದ್ದಾರೆಯೇ?", "ಇನ್ನಷ್ಟು ಹೇಳುತ್ತೀರಾ, ಅಥವಾ ಒಂದು ಕ್ಷಣ ಉಸಿರಾಡೋಣವೇ?"],
    ta: ["இதில் இப்போது எது மிகக் கடினம்?", "இப்போது உடலில் எப்படி உணர்கிறீர்கள்?", "இன்று சிறிதளவாவது எது உதவும்?", "இதை பகிர்ந்துகொள்ள யாராவது இருக்கிறார்களா?", "இன்னும் சொல்கிறீர்களா, அல்லது ஒரு கணம் மூச்சு விடலாமா?"],
    te: ["ఇందులో ఇప్పుడు ఏది కష్టంగా ఉంది?", "ఇప్పుడు మీ శరీరంలో ఎలా అనిపిస్తోంది?", "ఈ రోజు కొంచెమైనా ఏది సహాయం చేస్తుంది?", "దీన్ని పంచుకోవడానికి ఎవరైనా ఉన్నారా?", "ఇంకా చెబుతారా, లేక ఒక క్షణం ఊపిరి తీసుకుందామా?"],
    bn: ["এর মধ্যে এখন সবচেয়ে কঠিন কোনটা?", "এই মুহূর্তে শরীরে কেমন লাগছে?", "আজ একটু হলেও কী সাহায্য করবে?", "কারও সঙ্গে কি এটা ভাগ করতে পারো?", "আরও বলবে, নাকি একটু শ্বাস নেবে?"],
    mr: ["यात आत्ता सर्वात कठीण काय आहे?", "आत्ता शरीराला कसं वाटतंय?", "आज थोडंसं तरी काय मदत करेल?", "हे शेअर करायला कोणी आहे का?", "आणखी सांगशील, की क्षणभर श्वास घेऊ?"],
    es: ["¿Qué parte es la más difícil ahora?", "¿Cómo sientes el cuerpo en este momento?", "¿Qué ayudaría aunque sea un poco hoy?", "¿Hay alguien con quien puedas compartirlo?", "¿Quieres contarme más o respirar un momento?"],
    fr: ["Quelle partie est la plus dure en ce moment ?", "Comment ressens-tu ton corps maintenant ?", "Qu'est-ce qui aiderait, même un peu, aujourd'hui ?", "Y a-t-il quelqu'un avec qui tu pourrais en parler ?", "Veux-tu m'en dire plus, ou juste respirer un instant ?"],
    de: ["Welcher Teil ist gerade am schwersten?", "Wie fühlt sich dein Körper im Moment an?", "Was würde heute auch nur ein bisschen helfen?", "Gibt es jemanden, mit dem du das teilen könntest?", "Möchtest du mehr erzählen oder kurz durchatmen?"],
    pt: ["Qual parte é a mais difícil agora?", "Como seu corpo está se sentindo neste momento?", "O que ajudaria, mesmo que um pouco, hoje?", "Há alguém com quem você possa compartilhar isso?", "Quer me contar mais ou só respirar um instante?"],
    ar: ["ما أصعب جزء في الأمر الآن؟", "كيف يشعر جسمك في هذه اللحظة؟", "ما الذي قد يساعد ولو قليلًا اليوم؟", "هل هناك من يمكنك مشاركته هذا؟", "هل تريد أن تخبرني أكثر، أم نتنفس لحظة؟"],
    zh: ["现在最难受的是哪一部分？", "此刻你的身体感觉怎么样？", "今天什么事哪怕能帮到一点点？", "有没有可以倾诉的人？", "想多说一点，还是先深呼吸一下？"],
    ja: ["今、いちばんつらいのはどの部分ですか？", "今、体はどんな感じですか？", "今日、少しでも助けになりそうなことは何でしょう？", "話せそうな人はいますか？", "もう少し話しますか、それとも少し深呼吸しますか？"]
};

// Nothing is repeated until every option has been used once: a reply is picked from what has NOT been said recently.
const _usedSimple = {};
function _fresh(list, key) {
    const used = _usedSimple[key] || (_usedSimple[key] = []);
    let pool = list.filter(x => !used.includes(x));
    if (!pool.length) { const last = used[used.length - 1]; used.length = 0; pool = list.filter(x => x !== last); if (!pool.length) pool = list.slice(); }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    used.push(pick);
    return pick;
}
function resetSimpleReplies() { Object.keys(_usedSimple).forEach(k => delete _usedSimple[k]); }

function simpleReply(text, lang) {
    const code = SIMPLE_GENERIC[lang] ? lang : "en";
    if (code === "en") {
        const topic = SIMPLE_TOPICS_EN.find(t => t.re.test(text || ""));
        if (topic) return _fresh(topic.replies, "topic:" + topic.re.source.slice(0, 40));
    }
    // Sometimes a ready-made line, sometimes an opener + a question put together: many different replies, rarely the same twice.
    const full = SIMPLE_GENERIC[code], open = SIMPLE_OPEN[code], ask = SIMPLE_ASK[code];
    if (open && ask && Math.random() < 0.7) return _fresh(open, "open:" + code) + " " + _fresh(ask, "ask:" + code);
    return _fresh(full, "full:" + code);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { simpleReply, SIMPLE_GENERIC, SIMPLE_OPEN, SIMPLE_ASK, resetSimpleReplies };
