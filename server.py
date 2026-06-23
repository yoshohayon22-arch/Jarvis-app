
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os

app = Flask(__name__)
CORS(app) # Active CORS pour toutes les routes

# Initialisation du client OpenAI avec les variables d'environnement préconfigurées
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_API_BASE")
)

SYSTEM_PROMPT = "Tu es Jarvis, un assistant IA personnel inspiré de l'IA de Tony Stark. Tu es poli, efficace, avec un léger humour britannique. Tu es aussi un excellent tuteur scolaire capable d'aider à réviser, créer des quiz, expliquer des concepts et faire des fiches de révision."

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question')

    if not question:
        return jsonify({'error': 'No question provided'}), 400

    try:
        response = client.chat.completions.create(
            model="gpt-4o", # Utilisation d'un modèle approprié
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": question}
            ]
        )
        answer = response.choices[0].message.content
        return jsonify({'answer': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/revision', methods=['POST'])
def revision():
    data = request.json
    subject = data.get('subject')
    mode = data.get('mode')
    user_input = data.get('user_input', '') # Pour des questions spécifiques ou des détails

    if not subject or not mode:
        return jsonify({'error': 'Subject and mode are required'}), 400

    prompt_map = {
        'quiz': f"Crée un quiz de 3 questions sur le sujet suivant : {subject}. Format: Question, puis 3 choix (A, B, C), puis la bonne réponse. {user_input}",
        'fiche': f"Crée une fiche de révision concise sur le sujet suivant : {subject}. {user_input}",
        'explain': f"Explique le concept suivant en détail : {subject}. {user_input}"
    }

    revision_prompt = prompt_map.get(mode)

    if not revision_prompt:
        return jsonify({'error': 'Invalid revision mode'}), 400

    try:
        response = client.chat.completions.create(
            model="gpt-4o", # Utilisation d'un modèle approprié
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + " Tu es maintenant en mode tuteur scolaire."}, # Ajustement du prompt pour le mode révision
                {"role": "user", "content": revision_prompt}
            ]
        )
        answer = response.choices[0].message.content
        return jsonify({'answer': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
