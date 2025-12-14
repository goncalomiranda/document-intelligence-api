# Document Intelligence API

A TypeScript-based REST API for document analysis using OCR (Tesseract) and LLM (Ollama) technologies.

## Features

- 📄 **PDF & Image OCR**: Extract text from PDFs and images using Tesseract
- 🤖 **Custom LLM Analysis**: Analyze documents with custom prompts using Ollama
- 🔐 **API Key Authentication**: Secure endpoints with API key authentication
- ⚡ **Rate Limiting**: Built-in rate limiting to prevent abuse
- 📊 **Performance Metrics**: Track OCR and LLM processing times
- 🐛 **Debug Mode**: Save intermediate files for debugging
- 📝 **Comprehensive Logging**: Winston-based logging system

## Prerequisites

- Node.js 18+ and npm
- Ollama installed and running locally
- `pdftocairo` (from poppler-utils) for PDF conversion

### Install System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

**Ollama:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the default model
ollama pull llama3.2:3b
```

## Installation

1. Clone the repository and install dependencies:
```bash
cd document-intelligence-api
npm install
```

2. Create your environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
# Generate unique API keys for your clients
API_KEY_CARDOC=cardoc-secret-key-here
API_KEY_MORTGAGE=mortgage-secret-key-here

# Other settings...
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

## Production

Build and start the production server:
```bash
npm run build
npm start
```

## API Usage

### Authentication

All endpoints (except `/health`) require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" ...
```

### Endpoints

#### Health Check
```bash
GET /api/v1/health
```

#### Analyze Document
```bash
POST /api/v1/documents/analyze
Content-Type: multipart/form-data
X-API-Key: your-api-key-here

Form Data:
- file: <PDF or image file>
- prompt: <Your custom LLM prompt>
- model: (optional) Ollama model name (default: llama3.2:3b)
- language: (optional) OCR language (default: eng)
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/api/v1/documents/analyze \
  -H "X-API-Key: cardoc-secret-key-here" \
  -F "file=@document.pdf" \
  -F "prompt=Summarize this document and highlight key points"
```

**Example using JavaScript/fetch:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('prompt', 'Analyze this car document...');

const response = await fetch('http://localhost:3000/api/v1/documents/analyze', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key-here',
  },
  body: formData,
});

const result = await response.json();
console.log(result.data.analysis);
```

### Response Format

```json
{
  "success": true,
  "data": {
    "extractedText": "Full OCR text...",
    "analysis": "LLM analysis based on your prompt...",
    "metadata": {
      "ocrTimeSeconds": 8.45,
      "llmTimeSeconds": 12.32,
      "totalTimeSeconds": 20.77,
      "textLength": 3916,
      "model": "llama3.2:3b",
      "fileType": "application/pdf"
    }
  }
}
```

## Configuration

See `.env.example` for all available configuration options:

- **API Keys**: Set unique keys for each client
- **Ollama Settings**: Configure API URL, model, timeout
- **Rate Limiting**: Adjust window and max requests
- **File Upload**: Set max file size and allowed types
- **Debug Mode**: Enable file saving for debugging

## Client Examples

### CarDoc Integration

```typescript
// CarDoc can use a fixed prompt for car documents
const analyzeCarDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('prompt', `
    You are an expert car appraiser. Analyze this document and provide:
    1. Key vehicle details
    2. Condition assessment
    3. Negotiation opportunities
    4. Money-saving tips
  `);

  const response = await fetch('http://your-api/api/v1/documents/analyze', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.CARDOC_API_KEY },
    body: formData,
  });

  return response.json();
};
```

### Mortgage App Integration

```typescript
// Mortgage app can use a different prompt
const analyzeMortgageDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('prompt', `
    Extract and summarize mortgage document information:
    - Property details
    - Loan terms
    - Interest rate
    - Monthly payment
    - Important dates
  `);

  const response = await fetch('http://your-api/api/v1/documents/analyze', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.MORTGAGE_API_KEY },
    body: formData,
  });

  return response.json();
};
```

## Architecture

```
document-intelligence-api/
├── src/
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic (OCR, LLM)
│   ├── middleware/       # Auth, rate limiting, errors
│   ├── routes/           # API route definitions
│   ├── types/            # TypeScript types
│   ├── utils/            # Helpers (logger)
│   ├── config/           # Configuration
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
└── debug/                # Debug files (if enabled)
```

## Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": "Additional info (dev mode only)"
  }
}
```

## Performance

Typical processing times:
- **PDF → PNG**: ~1-2 seconds
- **OCR (Tesseract)**: ~5-10 seconds
- **LLM Analysis**: ~5-15 seconds
- **Total**: ~15-30 seconds per document

## License

MIT
