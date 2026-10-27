// ==========================================
// --- UI + SAFETY TEXT, PER LANGUAGE (part 1: en hi es fr de pt) ---
// Chat replies are generated in the person's language by the model; these are the fixed texts that
// must never depend on a model: crisis message, help modal, greetings, placeholders, check-ins.
// Keys: greet[] ph listen think again idle[] cIntro cOutro cSpoken hTitle hBody hNote simple
//       nHelp nExport nGames nRooms nAi
// SAFETY-CRITICAL TEXT (cIntro, cOutro, cSpoken, hBody): please have a native speaker review it.
// ==========================================
const LOCALES = {};

LOCALES.en = {
    greet: [
        "Hey... I'm so glad you're here. 🤍 Take a deep breath. I'm right here with you. How are you really feeling today?",
        "Hey there. Just wanted you to know I'm here. What's on your mind? 🌿",
        "Hi. 🤍 Take a slow, deep breath. I'm here to listen to whatever you want to talk about."
    ],
    ph: "Message your friend... 🤍", listen: "Listening to your voice... 🤍", think: "Thinking...",
    again: "I'm here. Could you say that again? 🤍",
    idle: ["Just checking in... no pressure to reply. I'm here. 🤍", "Did you have some food or water yet?",
           "I'm still here if you need me. 🌿", "Take a slow breath with me. No need to answer."],
    cIntro: "I'm really glad you told me, and I'm taking it seriously. 🤍 You don't have to carry this alone, and you deserve support from a real person right now.\n\nIf you might act on these thoughts, or you're in danger, please call your local emergency number (112 in India, 911 in the US) or reach a crisis line:",
    cOutro: "If you can, tell someone near you too: a friend, a family member, someone you trust. I'm staying right here with you in this chat. Do you want to tell me what's happening?",
    cSpoken: "I'm really glad you told me. You don't have to carry this alone. Please reach out to a crisis line or someone you trust right now. The numbers are on your screen. I'm right here with you.",
    hTitle: "/// YOU ARE NOT ALONE",
    hBody: "If you are in danger or thinking about harming yourself, please contact your local emergency number (112 in India, 911 in the US) or a crisis line below. Talking to a real person can help right now.",
    hNote: "Numbers can change, so please verify locally. Mindsence is an AI and cannot call for help on your behalf.",
    simple: "I'm in simple mode right now (no AI model is connected), so my replies are basic. I'm still here with you. The breathing exercise in GAMES can help too. 🤍",
    nHelp: "NEED HELP?", nExport: "EXPORT LOG", nGames: "GAMES", nRooms: "ROOMS",
    nAi: "GET SMARTER AI (1 GB, once)"
};

LOCALES.hi = {
    greet: [
        "हे... तुम यहाँ हो, मुझे बहुत अच्छा लगा। 🤍 एक गहरी साँस लो। मैं तुम्हारे साथ हूँ। आज सच में कैसा महसूस कर रहे हो?",
        "हे। बस बताना चाहता था कि मैं यहीं हूँ। मन में क्या चल रहा है? 🌿",
        "हाय। 🤍 धीरे से एक गहरी साँस लो। जो भी कहना चाहो, मैं सुन रहा हूँ।"
    ],
    ph: "अपने दोस्त को लिखो... 🤍", listen: "मैं तुम्हारी आवाज़ सुन रहा हूँ... 🤍", think: "सोच रहा हूँ...",
    again: "मैं यहीं हूँ। क्या तुम फिर से बोल सकते हो? 🤍",
    idle: ["बस हाल पूछ रहा था... जवाब देना ज़रूरी नहीं। मैं यहीं हूँ। 🤍", "क्या तुमने कुछ खाया या पानी पिया?",
           "ज़रूरत हो तो मैं यहीं हूँ। 🌿", "मेरे साथ एक धीमी साँस लो। जवाब देने की ज़रूरत नहीं।"],
    cIntro: "तुमने मुझे बताया, यह मेरे लिए बहुत मायने रखता है, और मैं इसे गंभीरता से ले रहा हूँ। 🤍 तुम्हें यह अकेले नहीं उठाना है, और अभी तुम्हें किसी असली इंसान का साथ मिलना चाहिए।\n\nअगर तुम इन विचारों पर अमल कर सकते हो, या खतरे में हो, तो कृपया अपने स्थानीय आपातकालीन नंबर (भारत में 112) पर कॉल करो या किसी हेल्पलाइन से बात करो:",
    cOutro: "हो सके तो अपने पास किसी को बताओ: कोई दोस्त, परिवार का सदस्य, या कोई भरोसेमंद इंसान। मैं इस चैट में तुम्हारे साथ यहीं हूँ। क्या तुम बताना चाहोगे कि क्या हो रहा है?",
    cSpoken: "तुमने मुझे बताया, यह अच्छा किया। तुम्हें यह अकेले नहीं उठाना है। कृपया अभी किसी हेल्पलाइन या किसी भरोसेमंद इंसान से बात करो। नंबर तुम्हारी स्क्रीन पर हैं। मैं यहीं हूँ।",
    hTitle: "/// तुम अकेले नहीं हो",
    hBody: "अगर तुम खतरे में हो या खुद को नुकसान पहुँचाने के बारे में सोच रहे हो, तो कृपया अपने स्थानीय आपातकालीन नंबर (भारत में 112) या नीचे दी गई हेल्पलाइन पर संपर्क करो। किसी असली इंसान से बात करने से अभी मदद मिल सकती है।",
    hNote: "नंबर बदल सकते हैं, इसलिए कृपया अपने इलाके में जाँच लो। Mindsence एक AI है और तुम्हारी तरफ़ से मदद के लिए कॉल नहीं कर सकता।",
    simple: "अभी मैं सरल मोड में हूँ (कोई AI मॉडल जुड़ा नहीं है), इसलिए मेरे जवाब साधारण हैं। फिर भी मैं तुम्हारे साथ हूँ। GAMES में साँस की कसरत भी मदद कर सकती है। 🤍",
    nHelp: "मदद चाहिए?", nExport: "चैट सेव करें", nGames: "खेल", nRooms: "कमरे",
    nAi: "बेहतर AI पाएँ (1 GB, एक बार)"
};

LOCALES.es = {
    greet: [
        "Hola... me alegra mucho que estés aquí. 🤍 Respira hondo. Estoy contigo. ¿Cómo te sientes de verdad hoy?",
        "Hola. Solo quería que supieras que estoy aquí. ¿Qué tienes en la cabeza? 🌿",
        "Hola. 🤍 Respira despacio y profundo. Estoy aquí para escucharte, de lo que quieras hablar."
    ],
    ph: "Escribe a tu amigo... 🤍", listen: "Escuchando tu voz... 🤍", think: "Pensando...",
    again: "Estoy aquí. ¿Puedes repetirlo? 🤍",
    idle: ["Solo paso a ver cómo estás... sin presión para responder. Aquí estoy. 🤍", "¿Has comido o bebido algo de agua?",
           "Sigo aquí si me necesitas. 🌿", "Respira despacio conmigo. No hace falta responder."],
    cIntro: "Me alegra mucho que me lo hayas contado, y lo tomo en serio. 🤍 No tienes que cargar con esto solo o sola, y mereces el apoyo de una persona real ahora mismo.\n\nSi podrías actuar según esos pensamientos, o estás en peligro, llama a tu número de emergencias local (112 en España, 911 en EE. UU.) o a una línea de crisis:",
    cOutro: "Si puedes, díselo también a alguien cercano: un amigo, un familiar, alguien de confianza. Me quedo aquí contigo en este chat. ¿Quieres contarme qué está pasando?",
    cSpoken: "Me alegra que me lo hayas contado. No tienes que cargar con esto solo. Por favor, llama a una línea de crisis o habla con alguien de confianza ahora. Los números están en tu pantalla. Estoy aquí contigo.",
    hTitle: "/// NO ESTÁS SOLO",
    hBody: "Si estás en peligro o piensas en hacerte daño, contacta con tu número de emergencias local (112 en España, 911 en EE. UU.) o con una línea de crisis de abajo. Hablar con una persona real puede ayudar ahora mismo.",
    hNote: "Los números pueden cambiar, verifícalos en tu zona. Mindsence es una IA y no puede llamar a pedir ayuda por ti.",
    simple: "Ahora estoy en modo simple (no hay un modelo de IA conectado), así que mis respuestas son básicas. Sigo aquí contigo. El ejercicio de respiración en JUEGOS también puede ayudar. 🤍",
    nHelp: "¿AYUDA?", nExport: "EXPORTAR", nGames: "JUEGOS", nRooms: "SALAS",
    nAi: "OBTENER MEJOR IA (1 GB, una vez)"
};

LOCALES.fr = {
    greet: [
        "Salut... je suis vraiment content que tu sois là. 🤍 Respire profondément. Je suis avec toi. Comment te sens-tu vraiment aujourd'hui ?",
        "Coucou. Je voulais juste te dire que je suis là. Qu'est-ce qui te traverse l'esprit ? 🌿",
        "Salut. 🤍 Respire lentement, profondément. Je suis là pour t'écouter, quoi que tu veuilles dire."
    ],
    ph: "Écris à ton ami... 🤍", listen: "J'écoute ta voix... 🤍", think: "Je réfléchis...",
    again: "Je suis là. Peux-tu répéter ? 🤍",
    idle: ["Je prends juste des nouvelles... pas besoin de répondre. Je suis là. 🤍", "As-tu mangé ou bu un peu d'eau ?",
           "Je suis toujours là si tu as besoin de moi. 🌿", "Respire lentement avec moi. Pas besoin de répondre."],
    cIntro: "Je suis vraiment content que tu me l'aies dit, et je le prends au sérieux. 🤍 Tu n'as pas à porter ça seul(e), et tu mérites le soutien d'une vraie personne maintenant.\n\nSi tu risques de passer à l'acte, ou si tu es en danger, appelle le numéro d'urgence local (112 en Europe, 911 aux États-Unis) ou une ligne d'écoute :",
    cOutro: "Si tu peux, parles-en aussi à quelqu'un près de toi : un ami, un proche, une personne de confiance. Je reste ici avec toi dans ce chat. Veux-tu me dire ce qui se passe ?",
    cSpoken: "Je suis content que tu me l'aies dit. Tu n'as pas à porter ça seul. Contacte une ligne d'écoute ou quelqu'un de confiance maintenant. Les numéros sont sur ton écran. Je suis là avec toi.",
    hTitle: "/// TU N'ES PAS SEUL(E)",
    hBody: "Si tu es en danger ou si tu penses à te faire du mal, contacte le numéro d'urgence local (112 en Europe, 911 aux États-Unis) ou une ligne d'écoute ci-dessous. Parler à une vraie personne peut aider tout de suite.",
    hNote: "Les numéros peuvent changer, vérifie-les localement. Mindsence est une IA et ne peut pas appeler à l'aide à ta place.",
    simple: "Je suis en mode simple (aucun modèle d'IA connecté), mes réponses sont donc basiques. Je suis quand même là avec toi. L'exercice de respiration dans JEUX peut aussi aider. 🤍",
    nHelp: "BESOIN D'AIDE ?", nExport: "EXPORTER", nGames: "JEUX", nRooms: "SALLES",
    nAi: "OBTENIR UNE IA PLUS FINE (1 Go, une fois)"
};

LOCALES.de = {
    greet: [
        "Hey... ich freue mich so, dass du da bist. 🤍 Atme tief durch. Ich bin bei dir. Wie fühlst du dich heute wirklich?",
        "Hallo. Ich wollte dir nur sagen, dass ich da bin. Was beschäftigt dich? 🌿",
        "Hi. 🤍 Atme langsam und tief. Ich höre dir zu, worüber auch immer du sprechen möchtest."
    ],
    ph: "Schreib deinem Freund... 🤍", listen: "Ich höre deine Stimme... 🤍", think: "Ich denke nach...",
    again: "Ich bin da. Kannst du das noch einmal sagen? 🤍",
    idle: ["Ich frage nur kurz nach... du musst nicht antworten. Ich bin da. 🤍", "Hast du schon etwas gegessen oder getrunken?",
           "Ich bin weiter da, wenn du mich brauchst. 🌿", "Atme langsam mit mir. Du musst nicht antworten."],
    cIntro: "Ich bin wirklich froh, dass du es mir erzählt hast, und ich nehme es ernst. 🤍 Du musst das nicht allein tragen, und du verdienst jetzt Unterstützung von einem echten Menschen.\n\nWenn du nach diesen Gedanken handeln könntest oder in Gefahr bist, ruf bitte die örtliche Notrufnummer an (112 in Europa, 911 in den USA) oder eine Krisenhotline:",
    cOutro: "Wenn du kannst, sag es auch jemandem in deiner Nähe: einer Freundin, einem Familienmitglied, jemandem, dem du vertraust. Ich bleibe hier bei dir in diesem Chat. Magst du mir erzählen, was los ist?",
    cSpoken: "Ich bin froh, dass du es mir erzählt hast. Du musst das nicht allein tragen. Bitte melde dich jetzt bei einer Krisenhotline oder jemandem, dem du vertraust. Die Nummern stehen auf deinem Bildschirm. Ich bin bei dir.",
    hTitle: "/// DU BIST NICHT ALLEIN",
    hBody: "Wenn du in Gefahr bist oder daran denkst, dir etwas anzutun, wende dich bitte an die örtliche Notrufnummer (112 in Europa, 911 in den USA) oder an eine Krisenhotline unten. Mit einem echten Menschen zu sprechen kann jetzt helfen.",
    hNote: "Nummern können sich ändern, bitte prüfe sie vor Ort. Mindsence ist eine KI und kann nicht für dich Hilfe rufen.",
    simple: "Ich bin gerade im einfachen Modus (kein KI-Modell verbunden), meine Antworten sind daher schlicht. Ich bin trotzdem bei dir. Die Atemübung unter SPIELE kann auch helfen. 🤍",
    nHelp: "HILFE?", nExport: "EXPORT", nGames: "SPIELE", nRooms: "RÄUME",
    nAi: "BESSERE KI LADEN (1 GB, einmalig)"
};

LOCALES.pt = {
    greet: [
        "Oi... fico muito feliz que você esteja aqui. 🤍 Respire fundo. Estou com você. Como você está se sentindo de verdade hoje?",
        "Oi. Só queria que soubesse que estou aqui. O que está passando pela sua cabeça? 🌿",
        "Oi. 🤍 Respire devagar e fundo. Estou aqui para ouvir o que você quiser falar."
    ],
    ph: "Escreva para o seu amigo... 🤍", listen: "Ouvindo a sua voz... 🤍", think: "Pensando...",
    again: "Estou aqui. Pode repetir? 🤍",
    idle: ["Só passando para ver como você está... sem pressa para responder. Estou aqui. 🤍", "Você já comeu ou bebeu água?",
           "Continuo aqui se precisar de mim. 🌿", "Respire devagar comigo. Não precisa responder."],
    cIntro: "Fico muito feliz que você tenha me contado, e estou levando isso a sério. 🤍 Você não precisa carregar isso sozinho(a), e merece o apoio de uma pessoa de verdade agora.\n\nSe você pode agir com base nesses pensamentos, ou está em perigo, ligue para o número de emergência local (192 no Brasil, 911 nos EUA) ou para uma linha de apoio:",
    cOutro: "Se puder, conte também a alguém perto de você: um amigo, um familiar, alguém de confiança. Fico aqui com você neste chat. Quer me contar o que está acontecendo?",
    cSpoken: "Fico feliz que você tenha me contado. Você não precisa carregar isso sozinho. Por favor, procure uma linha de apoio ou alguém de confiança agora. Os números estão na sua tela. Estou aqui com você.",
    hTitle: "/// VOCÊ NÃO ESTÁ SOZINHO(A)",
    hBody: "Se você está em perigo ou pensando em se machucar, ligue para o número de emergência local (192 no Brasil, 911 nos EUA) ou para uma linha de apoio abaixo. Falar com uma pessoa de verdade pode ajudar agora.",
    hNote: "Os números podem mudar, verifique na sua região. O Mindsence é uma IA e não pode pedir ajuda por você.",
    simple: "Estou no modo simples agora (nenhum modelo de IA conectado), então minhas respostas são básicas. Continuo aqui com você. O exercício de respiração em JOGOS também pode ajudar. 🤍",
    nHelp: "PRECISA DE AJUDA?", nExport: "EXPORTAR", nGames: "JOGOS", nRooms: "SALAS",
    nAi: "OBTER IA MELHOR (1 GB, uma vez)"
};


if (typeof module !== "undefined" && module.exports) module.exports = { LOCALES };
