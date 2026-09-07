Markdown  
\# Mindsence \- Safe Space: Local Execution Guide

Welcome to the **\*\*Mindsence\*\*** project. This application uses an HTML/CSS/JS frontend\[cite: 2, 3, 4\] and a local Python machine learning backend (Wav2Vec2) for real-time speech emotion recognition. 

Follow these steps exactly to set up your environment, install the necessary dependencies, and run the project locally.

\---

\#\# ⚙️ Prerequisites

Before you begin, ensure you have the following installed on your system. If you do not, download and install them using the default settings:

1\. **\*\*Node.js\*\***: \[Download here\](https://nodejs.org/) (Required for running a local frontend web server).  
2\. **\*\*Git Bash\*\***: \[Download here\](https://git-scm.com/downloads) (Required for executing terminal commands on Windows).  
3\. **\*\*Python (3.8 \- 3.11)\*\***: \[Download here\](https://www.python.org/downloads/) (Required for the machine learning backend. *\*Make sure to check the box "Add Python to PATH" during installation\!\**).

\---

\#\# 🚀 Step 1: Clone the Repository

Open **\*\*Git Bash\*\***, navigate to the folder where you want to store the project, and run:

\`\`\`bash  
git clone \[https://github.com/PruthviHG/Mental-Health.git\](https://github.com/PruthviHG/Mental-Health.git)  
cd Mental-Health

## **🧠 Step 2: Set Up the ML Backend (Python)**

The backend handles the heavy PyTorch Wav2Vec2 audio processing. It must be running for the voice-emotion features to work.

> 1. Inside the project folder, open your **Git Bash** terminal.  
> 2. Install the required machine learning dependencies. We use the python \-m pip method to ensure it installs to the correct environment:  
>    Bash  
>    python \-m pip install torch transformers librosa soundfile flask flask-cors

>    *(Note: This download is over 1GB because of the PyTorch ML libraries. Let it finish completely).*  
> 3. Start the local Flask server:  
>    Bash  
>    python app.py

> 4. You should see a message in the terminal saying \* Running on http://127.0.0.1:5000.  
>    **⚠️ IMPORTANT: Leave this Git Bash window open and minimized\! If you close it, the emotion engine will die.**

## **🌐 Step 3: Set Up the Frontend UI (Node.js)**

Because web browsers block microphone permissions on raw local files (file://), the frontend must be served over a local HTTP server.

> 1. Open a **new, separate** Git Bash terminal window inside your project folder.  
> 2. Install the serve package globally using Node.js:  
>    Bash  
>    npm install \-g serve

> 3. Start the local web server:  
>    Bash  
>    serve .

> 4. The terminal will output a local address (usually http://localhost:3000). Ctrl+Click that link or paste it into your browser.

(Alternative: If you use VS Code, you can simply open index.html\[cite: 4\] and click the "Go Live" button at the bottom right using the Live Server extension).

## **🎮 Step 4: Using the Application**

> 1. **Live Voice Emotion:** Click the Microphone icon at the bottom of the UI. Speak naturally. When you stop, the frontend packages your voice as a .wav file and sends it to the Python backend.  
> 2. **Terminal Tracking:** You can watch the Python Git Bash terminal to see the Wav2Vec2 model processing your acoustic waveform in real-time.  
> 3. **Arcade & Rooms:** Click **GAMES** or **ROOMS** in the top right to access the mini-games (including Neon Reflex) and relaxation environments.

### **Troubleshooting**

* **"No module named torch" error:** You likely have multiple Python versions. Rerun the installation using py \-m pip install torch transformers librosa soundfile flask flask-cors.  
* **Microphone not working:** Ensure you are accessing the site via http://localhost or http://127.0.0.1. Browsers will block mic access on file:///C:/... URLs.  
* **\[CONNECTION LOST\] error:** If the text generation fails, the free PicoApps WebSocket quota may be depleted. The team lead will need to generate a new free App ID and update it in script.js.