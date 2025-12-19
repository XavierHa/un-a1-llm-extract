# Service d'Extraction IA - Unnest (Article 1)

Microservice d'extraction de données structurées pour le matching mentorat. Il analyse les demandes (étudiants, bénévoles) via **Mistral AI** (SaaS ou Vertex AI) pour en extraire des informations clés (secteur, cursus, objectifs) selon une taxonomie définie.

## ⚙️ Configuration Dynamique

Le comportement du service est piloté par le dossier `config/`. Chaque sous-dossier correspond à une **tâche** accessible via l'API (ex: `POST /student`).

### Structure Requise
Pour ajouter une nouvelle typologie d'extraction, créez un dossier dans `config/` :

```
config/
├── student/                # Endpoint: POST /student
│   ├── system_prompt.txt   # Instructions système (Persona, Règles de sortie)
│   └── taxonomy.json       # Liste/Arbre des catégories valides
└── mentor/                 # Endpoint: POST /mentor
    ├── ...
```

*Le service refuse de démarrer si une configuration est incomplète.*

## ☁️ Déploiement Google Cloud

Ce projet est conçu pour **Cloud Run** avec un pipeline CI/CD via **Cloud Build**.

### 1. Prérequis Infrastructure

Assurez-vous d'avoir un projet GCP et les API activées :
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
```

### 2. Gestion des Secrets

La clé API Mistral ne doit pas être versionnée. Utilisez **Secret Manager** :

```bash
# Création du secret
printf "votre_api_key_mistral" | gcloud secrets create mistral_api_key --data-file=-

# Accorder les droits à Cloud Run (une fois le service déployé ou via le compte de service par défaut)
# Le fichier cloudbuild.yaml s'attend à trouver ce secret lors du déploiement.
```

### 3. Artifact Registry

Créez un dépôt Docker pour stocker les images :
```bash
gcloud artifacts repositories create unnest-repo \
    --repository-format=docker \
    --location=europe-west9 \
    --description="Repository pour le microservice Unnest"
```

### 4. Déploiement (CI/CD)

Le fichier `cloudbuild.yaml` à la racine orchestre le build et le déploiement.

**Déploiement manuel immédiat :**
```bash
gcloud builds submit --config cloudbuild.yaml .
```

**Variables substituées automatiquement par Cloud Build :**
*   `$PROJECT_ID`
*   `$COMMIT_SHA`

L'image sera construite, poussée sur l'Artifact Registry, et déployée sur Cloud Run avec l'injection du secret `MISTRAL_API_KEY` en variable d'environnement.

## 🔌 Utilisation de l'API

Une fois déployé, le service expose les endpoints correspondant à vos dossiers de config.

**Exemple d'appel (Tâche `student`) :**

```bash
curl -X POST https://votre-service-url.run.app/student \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Je suis en L3 Biologie et je cherche un stage en R&D pharmaceutique.",
    "provider": "saas" 
  }'
```

*   **provider** (optionnel) : `"saas"` (Mistral La Plateforme) ou `"vertex"` (Google Vertex AI).

## 🛡️ Sécurité & Privacy

*   **PII Scrubbing** : Les emails et numéros de téléphone sont masqués par regex avant l'envoi au LLM.
*   **Fail-Fast** : Le conteneur crash au démarrage si la configuration (JSON/Prompt) est invalide, empêchant le déploiement de versions corrompues.