import os
import tempfile
import torch
import librosa
import asyncio
import edge_tts
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor

app = Flask(__name__)
CORS(app)

# ==========================================
# 1. SPEECH EMOTION RECOGNITION (Wav2Vec2)
# ==========================================
model_name = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
emotion_model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)

@app.route('/analyze-emotion', methods=['POST'])
def analyze():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    speech, _ = librosa.load(audio_file, sr=16000)
    inputs = extractor(speech, sampling_rate=16000, return_tensors="pt", padding=True)
    
    with torch.no_grad():
        logits = emotion_model(inputs.input_values).logits
        
    predicted_id = torch.argmax(logits, dim=-1).item()
    predicted_emotion = emotion_model.config.id2label[predicted_id]
    
    return jsonify({"emotion": predicted_emotion})

# ==========================================
# 2. LOCAL NEURAL TTS ENGINE (edge-tts)
# ==========================================
async def generate_healing_voice(text, output_path):
    communicate = edge_tts.Communicate(
        text=text, 
        voice="en-GB-SoniaNeural", 
        rate="-20%", 
        pitch="-10Hz"
    )
    await communicate.save(output_path)

@app.route('/tts', methods=['POST'])
def tts():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    temp_audio.close()

    try:
        asyncio.run(generate_healing_voice(text, temp_audio.name))
        return send_file(
            temp_audio.name,
            mimetype="audio/mpeg",
            as_attachment=False
        )
    finally:
        pass

# ==========================================
# 3. FEEDBACK ENDPOINT
# ==========================================
@app.route('/feedback', methods=['POST'])
def feedback():
    data = request.get_json(silent=True) or {}
    email = data.get('email', 'Unknown')
    text = data.get('text', '')
    
    # Save the feedback locally as a log file
    with open("feedback_log.txt", "a", encoding="utf-8") as f:
        f.write(f"--- NEW FEEDBACK ---\nTo: brucewayne4gmail.com\nFrom: {email}\nMessage: {text}\n\n")
        
    return jsonify({"status": "success", "message": "Feedback securely logged."})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)