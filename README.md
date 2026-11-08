# FileMaster

Application web de **conversion, compression et édition de fichiers** (images, documents, audio, vidéo).
Interface « verre dépoli » strictement monochrome (mode clair *nuage blanc*, mode sombre *fumée*), en **français, anglais et arabe (RTL réel)**.

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, React Router, Framer Motion, Lucide, React Easy Crop, WaveSurfer.js, i18next
- **Backend** : Python 3.12, FastAPI, Pydantic, Pillow, PyMuPDF, python-docx, FFmpeg / FFprobe
- **Tests** : Pytest, Vitest + React Testing Library, Playwright
- **Infra** : Docker, Docker Compose, variables d'environnement

## Fonctionnalités

| Domaine | Ce qui est implémenté |
|---|---|
| Conversion | Images JPG/PNG/WEBP/BMP/TIFF · PDF→TXT/DOCX · DOCX→PDF/TXT · TXT→PDF/DOCX · Audio MP3/WAV/AAC/FLAC/OGG/M4A · Vidéo MP4/MOV/WEBM/MKV · extraction de la bande son d'une vidéo |
| Compression | 4 niveaux (faible → maximale) pour images, PDF, audio, vidéo ; qualité, redimensionnement, débit, résolution, codec (H.264/H.265/VP9), format de sortie ; **taille cible** (best effort, non garantie) ; tailles avant/après et % gagné |
| Éditeur d'images | Recadrage (react-easy-crop) avec ratios 1:1, 4:3, 16:9, 9:16, 3:2, original ou largeur×hauteur personnalisées, zoom, rotation libre, retournement H/V, redimensionnement, qualité, aperçu en direct |
| Éditeur audio | Mode simple (champs début/fin, lecture de la sélection) · mode avancé (forme d'onde WaveSurfer, poignées glissables, zoom, position) |
| Éditeur vidéo | Mode simple · mode avancé (timeline interactive, poignées glissables, tête de lecture, zoom, boutons « début/fin ici ») — la découpe est réalisée par FFmpeg côté serveur |
| Général | Aperçu avant téléchargement, progression réelle (FFmpeg), fichiers récents, réglages, thème persistant sans flash, langue persistante |

Seules les conversions **réellement implémentées et testées** sont proposées pour un fichier donné (`GET /api/formats`).

## Démarrage rapide

### Prérequis
Python ≥ 3.11, Node.js ≥ 20, **FFmpeg + FFprobe** dans le `PATH`
(`sudo apt install ffmpeg` · `brew install ffmpeg` · `choco install ffmpeg`).

### Développement
```bash
./scripts/dev.sh                      # lance backend :8000 et frontend :5173
# ou à la main :
cd backend  && pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxy /api -> :8000)
```

### Docker
```bash
cp .env.example .env
docker compose up --build             # http://localhost:8080 (nginx + API)
# image unique (FastAPI sert aussi le frontend) :
docker build -t filemaster . && docker run -p 8000:8000 filemaster
```

### Production (sans Docker)
```bash
cd frontend && npm ci && npm run build            # génère frontend/dist
FILEMASTER_STATIC_DIR=$PWD/dist uvicorn app.main:app --app-dir ../backend --host 0.0.0.0 --port 8000
```
Placez un reverse proxy HTTPS devant (voir `frontend/nginx.conf`). **L'application n'a pas d'authentification** : à exposer sur un réseau privé, ou derrière votre propre couche d'authentification et de limitation de débit.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `FILEMASTER_MAX_UPLOAD_MB` | 200 | Taille maximale d'un envoi (aussi appliquée côté interface) |
| `FILEMASTER_FILE_TTL_MINUTES` | 60 | Durée de vie des fichiers temporaires |
| `FILEMASTER_FFMPEG_TIMEOUT_S` | 900 | Délai maximal d'un traitement FFmpeg |
| `FILEMASTER_MAX_WORKERS` | 2 | Traitements simultanés |
| `FILEMASTER_CORS_ORIGINS` | localhost | Origines autorisées (liste séparée par des virgules) |
| `FILEMASTER_WORK_DIR` | dossier temp système | Dossier de travail temporaire |
| `FILEMASTER_STATIC_DIR` | vide | Si défini, l'API sert ce frontend compilé |
| `VITE_BACKEND_URL` | `http://127.0.0.1:8000` | Cible du proxy de développement |

## Tests
```bash
cd backend  && pip install -r requirements-dev.txt && pytest          # 58 tests (FFmpeg requis)
cd frontend && npm test                                               # 26 tests Vitest
cd frontend && npx playwright install chromium && npm run test:e2e    # E2E (backend + frontend démarrés automatiquement)
```

## Structure
```
backend/app/  api/ (routes, schémas) · core/ (config, formats, sécurité, erreurs)
              processors/ (image, document, audio, video) · services/ (jobs, operations) · utils/ (ffmpeg, storage)
backend/tests/
frontend/src/ components/ (Glass*, upload, aperçu…) · pages/ · features/ (éditeurs) · hooks/ · services/ (API)
              locales/{fr,en,ar}/translation.json · i18n/ · styles/ · utils/ · test/
frontend/e2e/ · docs/ · scripts/ · docker-compose.yml · Dockerfile
```
Voir `docs/ARCHITECTURE.md` pour l'API et les choix techniques.

## Sécurité (résumé)
Format déterminé par le **contenu** (signatures) et cohérent avec l'extension — le nom et le type MIME envoyés par le navigateur ne sont jamais crus · limite de taille en flux · noms nettoyés, identifiants de fichiers en hexadécimal strict (pas de traversée de chemin) · un dossier isolé par fichier/traitement, nettoyage automatique (TTL) et suppression après échec · FFmpeg appelé **sans shell**, arguments en liste, avec délai maximal · aucune erreur interne ni chemin serveur renvoyé (codes d'erreur traduits côté interface) · en-têtes `nosniff`, `X-Frame-Options`, aperçus servis avec `Content-Security-Policy: sandbox` (sauf PDF) · CORS configurable · aucun secret dans le code ; `.env` ignoré par Git.

## Limites connues
- **DOCX → PDF** : rendu du texte et de la structure (titres, gras/italique/souligné, alignement, tableaux). Images, en-têtes/pieds de page et polices personnalisées ne sont pas reproduits. **PDF → DOCX/TXT** : texte seulement ; un PDF scanné (sans texte) est refusé.
- PDF générés avec du texte arabe : lettres correctement liées, mais paragraphe aligné à gauche.
- **Compression** : le gain dépend du contenu ; BMP, DOCX et TXT ne sont pas compressibles ; WAV/FLAC (sans perte) ne se réduisent que par ré-échantillonnage ; la **taille cible** est une approximation (statut « atteinte / non atteinte » affiché).
- « Recadrage libre » = ratio personnalisé (largeur × hauteur saisies) : react-easy-crop n'offre pas de rectangle totalement libre.
- TIFF ne s'affiche pas dans l'éditeur d'images (aucun navigateur ne l'affiche) : convertissez-le d'abord.
- MOV/MKV peuvent ne pas être lisibles dans l'aperçu de certains navigateurs ; la découpe fonctionne quand même.
- La file de traitements est **en mémoire, dans un seul processus** : un redémarrage du serveur perd le suivi des traitements en cours. Pour plusieurs instances, prévoir un stockage/une file partagés.
- Encodage VP9/H.265 : lent sur CPU modeste (progression affichée).

## Dépôt GitHub
Aucun dépôt n'a été créé. Pour publier : `git init && git add . && git commit -m "feat: FileMaster" && git remote add origin <url> && git push -u origin main` (`.gitignore` exclut `.env`, `node_modules`, builds et fichiers temporaires).
