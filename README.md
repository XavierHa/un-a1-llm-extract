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
gcloud config set project [PROJECT_ID]
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
gcloud artifacts repositories create llm-extract-microservice \
    --repository-format=docker \
    --location=europe-west9 \
    --description="Repository pour le microservice LLM extract"
```

### 4. Déploiement (CI/CD)

**A. Permissions Cloud Build**
Pour que Cloud Build puisse déployer sur Cloud Run, il faut accorder des droits à son compte de service :

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
```

**B. Accès aux Secrets**
Donner au compte de service par défaut (utilisé par Cloud Run) le droit d'accéder à la clé API :

```bash
# On réutilise le PROJECT_NUMBER récupéré ci-dessus
gcloud secrets add-iam-policy-binding mistral_api_key \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

**C. Lancer le déploiement**
Le fichier `cloudbuild.yaml` orchestre le build et le déploiement.

```bash
gcloud builds submit --config cloudbuild.yaml .
```

**Variables substituées automatiquement par Cloud Build :**
*   `$PROJECT_ID`
*   `$BUILD_ID`

L'image sera construite, poussée sur l'Artifact Registry, et déployée sur Cloud Run avec l'injection du secret `MISTRAL_API_KEY` en variable d'environnement.

### 5. Automatisation (CD Pipeline)

Pour déployer automatiquement à chaque modification sur la branche `main` :

1.  Allez dans la console Google Cloud : **Cloud Build > Déclencheurs**.
2.  Cliquez sur **Créer un déclencheur**.
3.  Sélectionnez votre source (GitHub) et le dépôt.
4.  Configuration :
    *   **Événement** : Push sur une branche.
    *   **Branche** : `^main$`
    *   **Configuration** : Fichier de configuration Cloud Build (emplacement : `/cloudbuild.yaml`).

Désormais, tout `git push` déclenchera le pipeline défini dans `cloudbuild.yaml`.

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
