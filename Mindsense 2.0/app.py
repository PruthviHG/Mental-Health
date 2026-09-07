from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import librosa
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor

app = Flask(__name__)
CORS(app)

# Load the emotion model into memory once at startup
model_name = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)

@app.route('/analyze-emotion', methods=['POST'])
def analyze():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    
    # Process raw audio waveform (resample to 16kHz required by Wav2Vec2)
    speech, _ = librosa.load(audio_file, sr=16000)
    inputs = extractor(speech, sampling_rate=16000, return_tensors="pt", padding=True)
    
    # Run the acoustic prediction
    with torch.no_grad():
        logits = model(inputs.input_values).logits
        
    predicted_id = torch.argmax(logits, dim=-1).item()
    predicted_emotion = model.config.id2label[predicted_id]
    
    return jsonify({"emotion": predicted_emotion})

if __name__ == '__main__':
    app.run(port=5000)