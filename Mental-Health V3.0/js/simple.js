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

let _simpleCounter = 0;
function simpleReply(text, lang) {
    const code = SIMPLE_GENERIC[lang] ? lang : "en";
    if (code === "en") {
        const topic = SIMPLE_TOPICS_EN.find(t => t.re.test(text || ""));
        if (topic) return topic.replies[_simpleCounter++ % topic.replies.length];
    }
    const list = SIMPLE_GENERIC[code];
    return list[_simpleCounter++ % list.length];
}

if (typeof module !== 'undefined' && module.exports) module.exports = { simpleReply, SIMPLE_GENERIC };
