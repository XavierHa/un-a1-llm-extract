# Unnest Matching Service (Article 1)

This microservice acts as an intelligent extraction layer for Article 1's mentorship platform. It processes raw student requests and extracts structured data (Sector, Confidence Score, Reasoning) to facilitate matching with mentors.

It leverages **Mistral AI** models, capable of running either via Mistral's SaaS platform or hosted on Google Vertex AI, ensuring flexibility and data sovereignty compliance.

## 🚀 Features

*   **Dual Provider Strategy**: Switch seamlessly between Mistral SaaS (La Plateforme) and Google Vertex AI (Model Garden).
*   **Structured Extraction**: Converts unstructured text into strict JSON output based on a predefined taxonomy.
*   **Privacy First**: Includes a PII (Personally Identifiable Information) scrubbing layer to remove phone numbers and emails before sending data to the LLM.
*   **Fail-Safe Configuration**: The service validates its configuration (taxonomy and prompts) at startup and refuses to launch if integrity is compromised.
*   **Cloud Native**: Dockerized and ready for Google Cloud Run with Secret Manager integration.

## 🛠️ Prerequisites

*   Node.js v20+
*   Google Cloud Platform project (if using Vertex AI or deploying to Cloud Run).
*   Mistral AI API Key (if using SaaS endpoint).

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

The service relies on two critical configuration files located in the `config/` directory:

1.  **`taxonomy.json`**: A JSON array containing the valid list of sectors (e.g., "Aéronautique", "Informatique / Tech"). The LLM uses this to classify requests.
2.  **`system_prompt.txt`**: The system instructions defining the AI's persona and output rules.

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `MISTRAL_API_KEY` | API Key for Mistral SaaS Platform | Required for `/saas` |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | Auto-detected on Cloud Run |

## 🏃‍♂️ Running Locally

1.  Set your Mistral API Key:
    ```bash
    export MISTRAL_API_KEY="your_api_key_here"
    ```

2.  Start the service:
    ```bash
    # Development mode
    npm run start

    # Watch mode
    npm run start:dev
    ```

The server will start on port `3000` (default NestJS port).

## 🔌 API Endpoints

### 1. Extract via Mistral SaaS
Uses the official Mistral SDK to call `mistral-small-latest`.

*   **URL**: `POST /saas`
*   **Body**:
    ```json
    {
      "text": "Bonjour, je suis étudiant en informatique et je cherche un mentor pour m'aider à devenir Data Scientist."
    }
    ```

### 2. Extract via Vertex AI
Uses the Google Vertex AI `rawPredict` endpoint to call `mistral-small` hosted on GCP.

*   **URL**: `POST /vertex`
*   **Body**:
    ```json
    {
      "text": "Je voudrais travailler dans l'hôtellerie."
    }
    ```

### Response Format (Both Endpoints)

```json
{
  "provider": "MISTRAL_SAAS", // or VERTEX_AI
  "duration": "450ms",
  "data": {
    "secteur": "Informatique / Tech",
    "confidence": "High",
    "reasoning": "Student explicitly mentions 'informatique' and 'Data Scientist'."
  }
}
```

## 🚢 Deployment

The project includes a `cloudbuild.yaml` for automated building and deployment to **Google Cloud Run**.

It expects a Google Secret Manager secret named `mistral_api_key` to be available.

```bash
# Manual trigger via gcloud
gcloud builds submit --config cloudbuild.yaml .
```

The build steps:
1.  Builds the Docker image.
2.  Pushes to Artifact Registry (`europe-west9-docker.pkg.dev`).
3.  Deploys to Cloud Run service `unnest-microservice`.

## 📁 Project Structure

```
├── config/
│   ├── system_prompt.txt  # LLM Instructions
│   └── taxonomy.json      # Valid Categories List
├── src/
│   ├── app.controller.ts  # API Routes
│   ├── app.service.ts     # Business Logic & LLM Calls
│   ├── config.service.ts  # Config Loader & Validation
│   └── main.ts            # Entry point
├── Dockerfile             # Container definition
└── cloudbuild.yaml        # CI/CD Pipeline
```

## 🔒 Privacy & GDPR

The `cleanPii` method in `AppService` performs a regex-based pass to redact potential phone numbers and email addresses before they leave the service boundary.

```typescript
// Example Redaction
"Contact me at 06 12 34 56 78" -> "Contact me at [PHONE]"
```
