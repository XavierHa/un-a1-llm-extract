# Service de Matching Unnest (Article 1)

Ce microservice agit comme une couche d'extraction intelligente pour la plateforme de mentorat d'Article 1. Il traite les demandes brutes (étudiants, mentors, etc.) et extrait des données structurées (Secteur, Confiance, Raisonnement) pour faciliter le matching.

Il utilise les modèles **Mistral AI**, capables de fonctionner soit via la plateforme SaaS de Mistral, soit hébergés sur Google Vertex AI, assurant flexibilité et conformité des données.

## 🚀 Fonctionnalités

*   **Architecture Multi-Tâches** : Supporte plusieurs types d'extraction (ex: `student`, `mentor`) dynamiquement en ajoutant simplement des dossiers de configuration.
*   **Stratégie Double Fournisseur** : Basculez facilement entre Mistral SaaS (La Plateforme) et Google Vertex AI (Model Garden).
*   **Extraction Structurée** : Convertit du texte non structuré en JSON strict basé sur une taxonomie prédéfinie.
*   **Privacy First** : Inclut une couche de nettoyage PII (Données Personnelles) pour masquer numéros de téléphone et emails avant l'envoi au LLM.
*   **Configuration Robuste** : Le service valide l'intégrité de toutes les tâches au démarrage et refuse de se lancer si une configuration est manquante.
*   **Cloud Native** : Dockerisé et prêt pour Google Cloud Run avec intégration Secret Manager.

## 🛠️ Prérequis

*   Node.js v20+
*   Projet Google Cloud Platform (si utilisation de Vertex AI ou déploiement Cloud Run).
*   Clé API Mistral AI (si utilisation du endpoint SaaS).

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration Dynamique

Le service utilise une architecture de configuration basée sur le système de fichiers dans le dossier `config/`.
Chaque sous-dossier de `config/` représente une **tâche** (taskId) accessible via l'API.

### Structure des dossiers

Pour ajouter une nouvelle tâche (ex: `mentor`), créez un dossier `config/mentor/` avec deux fichiers obligatoires :

1.  **`taxonomy.json`** : Un tableau JSON ou un objet définissant les catégories valides.
2.  **`system_prompt.txt`** : Les instructions système définissant la persona de l'IA et les règles de sortie.

```
config/
├── student/                # Accessible via POST /student
│   ├── system_prompt.txt
│   └── taxonomy.json
└── mentor/                 # Accessible via POST /mentor
    ├── system_prompt.txt
    └── taxonomy.json
```

### Variables d'Environnement

| Variable | Description | Défaut |
| :--- | :--- | :--- |
| `MISTRAL_API_KEY` | Clé API pour la plateforme SaaS Mistral | Requis pour le provider `saas` |
| `GOOGLE_CLOUD_PROJECT` | ID du projet GCP | Auto-détecté sur Cloud Run |

## 🏃‍♂️ Exécution Locale

1.  Définir la clé API Mistral :
    ```bash
    export MISTRAL_API_KEY="votre_cle_api_ici"
    ```

2.  Lancer le service :
    ```bash
    # Mode développement
    npm run start

    # Mode watch
    npm run start:dev
    ```

Le serveur démarrera sur le port `3000`.

## 🔌 Endpoints API

L'API est dynamique. La route dépend du nom du dossier créé dans `config/`.

### Extraction Générique

*   **URL** : `POST /:taskId` (ex: `/student`)
*   **Headers** : `Content-Type: application/json`
*   **Body** :
    ```json
    {
      "text": "Votre texte à analyser ici...",
      "provider": "saas" // Optionnel : "saas" (défaut) ou "vertex"
    }
    ```

### Exemple : Tâche Étudiant

Supposons que le dossier `config/student` existe.

**Requête :**
```bash
curl -X POST http://localhost:3000/student \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Bonjour, je cherche un mentor en Data Science.",
    "provider": "saas"
  }'
```

**Réponse :**
```json
{
  "task_id": "student",
  "provider": "MISTRAL_SAAS",
  "duration": "450ms",
  "data": {
    "secteur": "Informatique / Tech",
    "confidence": "High",
    "reasoning": "L'étudiant mentionne explicitement 'Data Science'."
  }
}
```

## 🚢 Déploiement

Le projet inclut un `cloudbuild.yaml` pour la construction et le déploiement automatisés sur **Google Cloud Run**.

Il s'attend à ce qu'un secret Google Secret Manager nommé `mistral_api_key` soit disponible.

```bash
# Déclenchement manuel via gcloud
gcloud builds submit --config cloudbuild.yaml .
```

### Étapes de build :
1.  Construction de l'image Docker.
2.  Push vers l'Artifact Registry (`europe-west9-docker.pkg.dev`).
3.  Déploiement sur le service Cloud Run `unnest-microservice`.

## 📁 Structure du Projet

```
├── config/            # Dossier racine des configurations de tâches
│   ├── student/       # Configuration pour la tâche 'student'
│   └── ...            # Autres tâches
├── src/
│   ├── app.controller.ts  # Routeur dynamique (/:taskId)
│   ├── app.service.ts     # Logique métier & Appels LLM
│   ├── config.service.ts  # Chargeur de config & Validation
│   └── main.ts            # Point d'entrée
├── Dockerfile             # Définition du conteneur
└── cloudbuild.yaml        # Pipeline CI/CD
```

## 🔒 Confidentialité & RGPD

La méthode `cleanPii` dans `AppService` effectue un passage regex pour supprimer les numéros de téléphone et adresses email potentiels avant qu'ils ne quittent le périmètre du service.

```typescript
// Exemple de nettoyage
"Contactez-moi au 06 12 34 56 78" -> "Contactez-moi au [PHONE]"
```
