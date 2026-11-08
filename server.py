
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import os

app = Flask(__name__)
CORS(app) # Active CORS pour toutes les routes

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class _LazyClient:
    """Crée le client OpenAI au premier appel, pour que le serveur démarre même sans clé."""

    _client = None

    def __getattr__(self, name):
        if _LazyClient._client is None:
            _LazyClient._client = OpenAI(
                api_key=os.environ.get("OPENAI_API_KEY"),
                base_url=os.environ.get("OPENAI_API_BASE")
            )
        return getattr(_LazyClient._client, name)


# Initialisation du client OpenAI avec les variables d'environnement préconfigurées
client = _LazyClient()

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

# ---------------------------------------------------------------------------
# QG des agents : l'open space animé (static/hq.html) et l'exécution réelle
# des tâches de chaque pôle.
# ---------------------------------------------------------------------------

HQ_POLES = {
    "direction": "Tu es à la Direction du QG. Tu organises la journée et la semaine, tu fixes les priorités et tu fais le lien entre les pôles.",
    "candidatures": "Tu es au Pôle Candidatures. Tu aides un jeune diplômé de la maturité fédérale, à Genève, à trouver un emploi d'étudiant à temps partiel : offres, CV, lettres de motivation, relances, entretiens.",
    "admin": "Tu es au Pôle Administratif. Tu prépares les démarches administratives en Suisse (Genève) : état civil, attestations, pièces justificatives, courriers et relances aux services.",
    "reseaux": "Tu es au Pôle Réseaux de MCI Sport, une agence de sport. LinkedIn d'abord, puis Instagram : posts, scripts de Reels, calendrier éditorial, analyse des statistiques.",
    "stage": "Tu es au Pôle Stage. Tu organises le stage de préparation du Standard de Liège pour MCI Sport : planning, hébergement, transport, feuille de route.",
    "etudes": "Tu es au Pôle Études. Tu compares des écoles et universités (programmes, prix, admission, délais) et tu prépares des fiches de révision et des quiz.",
}


@app.route('/hq')
def hq():
    return send_from_directory(STATIC_DIR, 'hq.html')


@app.route('/hq/health')
def hq_health():
    return jsonify({'ai': bool(os.environ.get("OPENAI_API_KEY"))})


@app.route('/hq/run', methods=['POST'])
def hq_run():
    data = request.json or {}
    pole = data.get('pole')
    task = (data.get('task') or '').strip()
    agent = (data.get('agent') or 'un agent')[:40]
    role = (data.get('role') or '')[:60]

    if pole not in HQ_POLES or not task:
        return jsonify({'error': 'Pôle inconnu ou tâche vide'}), 400

    system = (
        SYSTEM_PROMPT
        + f" Dans le QG, tu incarnes {agent} ({role}). " + HQ_POLES[pole]
        + " Tu réalises la tâche toi-même et tu rends un livrable concret, prêt à l'emploi"
        " (texte rédigé, liste, planning, brouillon de mail...), en français, structuré et concis."
        " Si une information te manque, indique-la entre crochets [à compléter] au lieu de l'inventer."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": task[:2000]}
            ]
        )
        return jsonify({'answer': response.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
