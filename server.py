
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import os
import re
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


@app.route('/hq/ask', methods=['POST'])
def hq_ask():
    """Fait travailler un agent du QG : le prompt complet (persona, tâche, contexte) vient de la page."""
    data = request.json or {}
    prompt = (data.get('prompt') or '').strip()
    if not prompt:
        return jsonify({'error': 'Prompt vide'}), 400
    try:
        kwargs = {}
        if data.get('json'):
            kwargs['response_format'] = {"type": "json_object"}
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + " Tu travailles au QG des agents de Jarvis et tu rends un travail réel, concret et prêt à l'emploi, en français."},
                {"role": "user", "content": prompt[:60000]},
            ],
            **kwargs,
        )
        return jsonify({'text': response.choices[0].message.content})
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


def _uid_arg():
    uid = str((request.json or {}).get('uid', ''))
    return uid if uid.isdigit() else None


@app.route('/hq/mail/read', methods=['POST'])
def hq_mail_read():
    """Renvoie le texte d'un mail (sans le marquer comme lu)."""
    if not _mail_configured():
        return jsonify({'error': 'Boîte mail non connectée'}), 400
    uid = _uid_arg()
    if not uid:
        return jsonify({'error': 'Identifiant de mail invalide'}), 400
    try:
        conn = _imap()
        conn.select("INBOX", readonly=True)
        msg = _fetch(conn, uid.encode())
        conn.logout()
        if msg is None:
            return jsonify({'error': 'Mail introuvable'}), 404
        return jsonify({'mail': _summary(uid, msg), 'body': _body_text(msg)[:8000]})
    except Exception as e:
        return jsonify({'error': f'Connexion Gmail impossible : {e}'}), 502


@app.route('/hq/mail/draft', methods=['POST'])
def hq_mail_draft():
    """Enregistre un brouillon de réponse dans Gmail. N'envoie jamais rien."""
    if not _mail_configured():
        return jsonify({'error': 'Boîte mail non connectée'}), 400
    uid = _uid_arg()
    body = ((request.json or {}).get('body') or '').strip()
    if not uid or not body:
        return jsonify({'error': 'Mail ou texte manquant'}), 400
    try:
        conn = _imap()
        conn.select("INBOX", readonly=True)
        msg = _fetch(conn, uid.encode())
        if msg is None:
            conn.logout()
            return jsonify({'error': 'Mail introuvable'}), 404
        draft = EmailMessage()
        draft["From"] = os.environ["GMAIL_ADDRESS"]
        draft["To"] = _dec(msg.get("Reply-To")) or _dec(msg.get("From"))
        subject = _dec(msg.get("Subject")) or ""
        draft["Subject"] = subject if subject.lower().startswith("re:") else "Re: " + subject
        draft["Message-ID"] = make_msgid()
        if msg.get("Message-ID"):
            draft["In-Reply-To"] = msg["Message-ID"]
            draft["References"] = ((msg.get("References") or "") + " " + msg["Message-ID"]).strip()
        draft.set_content(body[:20000])
        status, _ = conn.append('"%s"' % _drafts_folder(conn), "\\Draft", imaplib.Time2Internaldate(time.time()), draft.as_bytes())
        conn.logout()
        return jsonify({'saved': status == "OK"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
