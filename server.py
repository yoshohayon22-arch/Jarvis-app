
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import os
import re
import json
import time
import imaplib
import email
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import parseaddr, make_msgid
from datetime import datetime, timedelta

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
    "mail": "Tu es au Pôle Boîte mail. Tu tries la boîte de réception, tu résumes les mails, tu repères ce qui est urgent et tu prépares des brouillons de réponse.",
    "etudes": "Tu es au Pôle Études. Tu compares des écoles et universités (programmes, prix, admission, délais) et tu prépares des fiches de révision et des quiz.",
}


@app.route('/hq')
def hq():
    return send_from_directory(STATIC_DIR, 'hq.html')


@app.route('/hq/health')
def hq_health():
    return jsonify({
        'ai': bool(os.environ.get("OPENAI_API_KEY")),
        'mail': _mail_configured(),
        'mail_address': os.environ.get("GMAIL_ADDRESS", "") if _mail_configured() else "",
    })


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



# ---------------------------------------------------------------------------
# Pôle Boîte mail : connexion à Gmail en IMAP.
#   GMAIL_ADDRESS       ton adresse Gmail
#   GMAIL_APP_PASSWORD  un mot de passe d'application Google (16 caractères)
# Les agents lisent sans marquer comme lu et n'envoient JAMAIS de mail :
# ils enregistrent des brouillons de réponse dans Gmail.
# ---------------------------------------------------------------------------

IMAP_HOST = os.environ.get("GMAIL_IMAP_HOST", "imap.gmail.com")


def _mail_configured():
    return bool(os.environ.get("GMAIL_ADDRESS") and os.environ.get("GMAIL_APP_PASSWORD"))


def _imap():
    conn = imaplib.IMAP4_SSL(IMAP_HOST)
    conn.login(os.environ["GMAIL_ADDRESS"], os.environ["GMAIL_APP_PASSWORD"].replace(" ", ""))
    return conn


def _dec(value):
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _body_text(msg):
    """Texte brut du mail (text/plain de préférence, sinon HTML nettoyé)."""
    html = None
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        if part.get_content_maintype() == "multipart" or part.get("Content-Disposition", "").startswith("attachment"):
            continue
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        except Exception:
            continue
        if part.get_content_type() == "text/plain":
            return text.strip()
        if part.get_content_type() == "text/html" and html is None:
            html = text
    if html:
        html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
        html = re.sub(r"<[^>]+>", " ", html)
        return re.sub(r"\s+", " ", html.replace("&nbsp;", " ")).strip()
    return ""


def _summary(uid, msg):
    name, addr = parseaddr(_dec(msg.get("From")))
    body = _body_text(msg)
    return {
        "uid": uid,
        "from_name": name or addr,
        "from": addr,
        "subject": _dec(msg.get("Subject")) or "(sans objet)",
        "date": msg.get("Date", ""),
        "snippet": re.sub(r"\s+", " ", body)[:280],
    }


def _fetch(conn, uid):
    status, data = conn.uid("fetch", uid, "(BODY.PEEK[])")
    if status != "OK" or not data or not isinstance(data[0], tuple):
        return None
    return email.message_from_bytes(data[0][1])


def _drafts_folder(conn):
    status, boxes = conn.list()
    if status == "OK":
        for line in boxes or []:
            line = line.decode(errors="replace")
            if "\\Drafts" in line:
                m = re.search(r'"([^"]+)"\s*$', line) or re.search(r"(\S+)\s*$", line)
                if m:
                    return m.group(1)
    return "[Gmail]/Drafts"


@app.route('/hq/mail/inbox')
def hq_mail_inbox():
    if not _mail_configured():
        return jsonify({'error': 'Boîte mail non connectée'}), 400
    days = max(1, min(30, int(request.args.get('days', 7))))
    limit = max(1, min(30, int(request.args.get('limit', 15))))
    since = (datetime.now() - timedelta(days=days)).strftime("%d-%b-%Y")
    try:
        conn = _imap()
        conn.select("INBOX", readonly=True)
        status, data = conn.uid("search", None, "UNSEEN", "SINCE", since)
        uids = (data[0].split() if status == "OK" and data and data[0] else [])[-limit:]
        mails = []
        for uid in reversed(uids):
            msg = _fetch(conn, uid)
            if msg is not None:
                mails.append(_summary(uid.decode(), msg))
        conn.logout()
        return jsonify({'mails': mails})
    except Exception as e:
        return jsonify({'error': f'Connexion Gmail impossible : {e}'}), 502


@app.route('/hq/mail/process', methods=['POST'])
def hq_mail_process():
    """Lit un mail, l'analyse avec l'IA et enregistre un brouillon de réponse dans Gmail si besoin."""
    if not _mail_configured():
        return jsonify({'error': 'Boîte mail non connectée'}), 400
    uid = str((request.json or {}).get('uid', ''))
    if not uid.isdigit():
        return jsonify({'error': 'Identifiant de mail invalide'}), 400
    try:
        conn = _imap()
        conn.select("INBOX", readonly=True)
        msg = _fetch(conn, uid.encode())
        if msg is None:
            conn.logout()
            return jsonify({'error': 'Mail introuvable'}), 404
        info = _summary(uid, msg)
        body = _body_text(msg)[:6000]

        system = (
            SYSTEM_PROMPT + " " + HQ_POLES["mail"]
            + " Tu écris pour le compte de " + os.environ["GMAIL_ADDRESS"] + "."
            " Réponds uniquement en JSON avec les clés : resume (2-3 phrases), priorite (haute, moyenne ou basse),"
            " categorie (ex. administratif, emploi, études, MCI Sport, perso, pub/newsletter), action (ce que je dois faire),"
            " besoin_reponse (booléen, faux pour les pubs, newsletters et notifications automatiques),"
            " reponse (brouillon de réponse en français, poli et prêt à envoyer, sans objet ni signature inventée ;"
            " mets [à compléter] pour toute information manquante ; chaîne vide si aucune réponse)."
        )
        user = f"De : {info['from_name']} <{info['from']}>\nObjet : {info['subject']}\nDate : {info['date']}\n\n{body}"
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        result = json.loads(response.choices[0].message.content)

        draft_saved = False
        reply = (result.get("reponse") or "").strip()
        if result.get("besoin_reponse") and reply:
            draft = EmailMessage()
            draft["From"] = os.environ["GMAIL_ADDRESS"]
            draft["To"] = _dec(msg.get("Reply-To")) or _dec(msg.get("From"))
            subject = info["subject"]
            draft["Subject"] = subject if subject.lower().startswith("re:") else "Re: " + subject
            draft["Message-ID"] = make_msgid()
            if msg.get("Message-ID"):
                draft["In-Reply-To"] = msg["Message-ID"]
                draft["References"] = ((msg.get("References") or "") + " " + msg["Message-ID"]).strip()
            draft.set_content(reply)
            folder = _drafts_folder(conn)
            status, _ = conn.append('"%s"' % folder, "\\Draft", imaplib.Time2Internaldate(time.time()), draft.as_bytes())
            draft_saved = status == "OK"
        conn.logout()
        return jsonify({'mail': info, 'analysis': result, 'draft_saved': draft_saved})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
