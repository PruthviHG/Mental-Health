"""Listen before you decide: makes one calm sample sentence per language with each voice engine, plus a page to play them.

    python tools/voice_check.py            # needs FISH_API_KEY in .env for the Fish Audio column; the Microsoft column needs internet
    -> voice_samples/index.html            # open it, play both columns for each language, and set MINDSENCE_FISH_LANGS to the
                                           #    languages where Fish Audio sounds better to you (native speakers' ears beat any rule of mine)
"""
import asyncio
import html
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import app as backend  # noqa: E402  (reads .env)
import fish_voice  # noqa: E402

SAMPLES = {
    "en": "I'm here with you. What happened just before you started feeling this way?",
    "hi": "मैं यहीं हूँ, आपके साथ। और बताना चाहेंगे, या बस एक पल साँस लें?",
    "kn": "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ, ನಿಮ್ಮ ಜೊತೆ. ಇನ್ನಷ್ಟು ಹೇಳುತ್ತೀರಾ, ಅಥವಾ ಒಂದು ಕ್ಷಣ ಉಸಿರಾಡೋಣವೇ?",
    "ta": "நான் இங்கே உங்களுடன் இருக்கிறேன். இன்னும் சொல்கிறீர்களா, அல்லது ஒரு கணம் மூச்சு விடலாமா?",
    "te": "నేను ఇక్కడే మీతో ఉన్నాను. ఇంకా చెబుతారా, లేక ఒక క్షణం ఊపిరి తీసుకుందామా?",
    "bn": "আমি এখানেই আছি, তোমার সঙ্গে। আরও বলবে, নাকি একটু শ্বাস নেবে?",
    "mr": "मी इथेच आहे, तुझ्यासोबत. आणखी सांगशील, की क्षणभर श्वास घेऊ?",
    "es": "Estoy aquí contigo. ¿Quieres contarme más o respirar un momento?",
    "fr": "Je suis là avec toi. Veux-tu m'en dire plus, ou juste respirer un instant ?",
    "de": "Ich bin bei dir. Möchtest du mehr erzählen oder kurz durchatmen?",
    "pt": "Estou aqui com você. Quer me contar mais ou só respirar um instante?",
    "ar": "أنا هنا معك. هل تريد أن تخبرني أكثر، أم نتنفس لحظة؟",
    "zh": "我在这里陪着你。 想多说一点，还是先深呼吸一下？",
    "ja": "ここにいますよ。 もう少し話しますか、それとも少し深呼吸しますか？",
}


def main():
    out = os.path.join(ROOT, "voice_samples")
    os.makedirs(out, exist_ok=True)
    rows = []
    for lang, text in SAMPLES.items():
        cells = []
        for engine in ("fish", "microsoft"):
            path = os.path.join(out, "%s_%s.mp3" % (lang, engine))
            try:
                if engine == "fish":
                    if not fish_voice.api_key():
                        raise RuntimeError("no FISH_API_KEY")
                    audio = fish_voice.synthesize(text, lang)
                else:
                    audio = asyncio.run(backend.synthesize(text, backend.voice_for(lang)))
                with open(path, "wb") as f:
                    f.write(audio)
                cells.append('<audio controls preload="none" src="%s_%s.mp3"></audio>' % (lang, engine))
            except Exception as e:
                cells.append("<small>not made: %s</small>" % html.escape(str(e)))
        rows.append("<tr><th>%s</th><td lang='%s'>%s</td><td>%s</td><td>%s</td></tr>" % (lang, lang, html.escape(text), cells[0], cells[1]))
    page = ("<!doctype html><meta charset=utf-8><title>Voice check</title><style>body{font:15px system-ui;margin:24px}td,th{padding:8px;border-bottom:1px solid #ddd;vertical-align:middle}"
            "</style><h1>Voice check</h1><p>Fish Audio is used for the languages listed in MINDSENCE_FISH_LANGS (now: %s). Play both and decide.</p>"
            "<table><tr><th>lang</th><th>sample</th><th>Fish Audio</th><th>Microsoft</th></tr>%s</table>") % (", ".join(sorted(fish_voice.enabled_langs())), "".join(rows))
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    print("Open", os.path.join(out, "index.html"))


if __name__ == "__main__":
    main()
