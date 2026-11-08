# Architecture

## Flux
`upload` (flux, limite de taille, détection par signature, ffprobe/Pillow/PyMuPDF de validation) → `file_id`
→ `POST /api/{convert|compress|image/edit|trim}` → `job_id` (202) → file de traitements (thread pool)
→ `GET /api/jobs/{id}` (état + progression FFmpeg réelle) → `GET /api/jobs/{id}/preview|download`.

## API
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/health` · `/api/formats` | état (FFmpeg) · matrice de conversions, limites, TTL |
| POST | `/api/upload` | multipart `file` → métadonnées (`format`, `kind`, `targets`, `info`) |
| GET/DELETE | `/api/files/{id}/preview` · `/api/files/{id}` | aperçu (Range supporté) · suppression |
| POST | `/api/convert` `{file_id,target}` | conversion |
| POST | `/api/compress` `{file_id,level,target_size_mb?,quality?,max_width?,max_height?,output_format?,bitrate_kbps?,resolution?,codec?,video_bitrate_kbps?}` | compression |
| POST | `/api/image/edit` `{file_id,crop?,rotate,flip_h,flip_v,resize?,output_format?,quality}` | recadrage/rotation/retournement/redimensionnement (ordre : retournement → rotation → recadrage → redimensionnement) |
| POST | `/api/trim` `{file_id,start,end,output_format?,precise}` | découpe audio/vidéo (`precise=false` : copie de flux sans réencodage) |
| GET | `/api/jobs/{id}` · `/download` · `/preview` | état, résultat, fichier |

Erreurs : `{"error":{"code":"…","params":{…}}}` ; l'interface traduit chaque `code` (`errors.*` dans les 3 langues).

## Choix
- **Codes d'erreur plutôt que messages serveur** : pas de fuite d'informations, traduction côté client.
- **Rotation/recadrage** : les coordonnées de react-easy-crop (boîte englobante après rotation) correspondent à `Image.rotate(expand=True)` côté Pillow ; les retournements sont appliqués avant la rotation des deux côtés.
- **Timeline vidéo** : composant maison (pointer events + clavier, `role="slider"`), toujours en LTR même dans une page RTL.
- **Thème/langue** : script inline dans `index.html` appliqué avant le premier rendu (pas de flash) ; `dir`/`lang` mis à jour à chaque changement de langue.
- **Jobs en mémoire** (processus unique) : simple et sans dépendance ; voir limites dans le README.
