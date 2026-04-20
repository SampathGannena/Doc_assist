# Backend API Server Setup Guide

This document describes the expected backend API that the frontend connects to.

## Overview

The frontend expects a REST API server that provides code documentation generation services. You can implement this using any backend framework (Flask, Express, FastAPI, etc.) with an AI model like CodeT5, GPT, or similar.

## Required Endpoints

### 1. Generate Documentation
**Endpoint:** `POST /api/generate-documentation`

**Request Body:**
```json
{
  "code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
  "language": "python",
  "options": {
    "style": "google",  // Optional: google, numpy, sphinx
    "includeExamples": true,
    "includeComplexity": false
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "documentation": "def fibonacci(n):\n    \"\"\"\n    Calculates the nth Fibonacci number using recursion.\n    \n    Args:\n        n (int): The position in the Fibonacci sequence.\n    \n    Returns:\n        int: The nth Fibonacci number.\n    \n    Example:\n        >>> fibonacci(10)\n        55\n    \"\"\"\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
    "metadata": {
      "model": "CodeT5-base",
      "confidence": 0.95,
      "processingTime": 234,
      "tokensUsed": 156
    }
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Invalid code syntax",
  "details": "SyntaxError: unexpected indent"
}
```

### 2. Analyze Code
**Endpoint:** `POST /api/analyze-code`

**Request Body:**
```json
{
  "code": "function example() { ... }",
  "language": "javascript"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "functionName": "example",
    "parameters": ["param1", "param2"],
    "returnType": "void",
    "complexity": 3,
    "linesOfCode": 12,
    "isAsync": false
  }
}
```

### 3. Validate Syntax
**Endpoint:** `POST /api/validate-syntax`

**Request Body:**
```json
{
  "code": "def example():\n    return",
  "language": "python"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": []
  }
}
```

### 4. Health Check
**Endpoint:** `GET /api/health`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600,
    "model": "CodeT5-base"
  }
}
```

## Supported Languages

The API should support at least:
- `python`
- `javascript`
- `java`
- `cpp`
- `csharp`
- `typescript`

## Error Handling

### Status Codes
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid API key)
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Response Format
```json
{
  "success": false,
  "error": "Error message here",
  "status": 400
}
```

## CORS Configuration

The backend must enable CORS for the frontend origin:

```python
# Example for Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'https://your-domain.com'])
```

## Sample Backend Implementation (Python/Flask)

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

# Mock AI model (replace with actual model)
class DocumentationGenerator:
    def generate(self, code, language):
        # Your AI model logic here
        # This is where you'd use CodeT5, GPT, or similar
        return f'"""\nGenerated documentation for {language} code.\n"""'

generator = DocumentationGenerator()

@app.route('/api/generate-documentation', methods=['POST'])
def generate_documentation():
    try:
        data = request.get_json()
        code = data.get('code')
        language = data.get('language')
        
        if not code or not language:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        start_time = time.time()
        documentation = generator.generate(code, language)
        processing_time = int((time.time() - start_time) * 1000)
        
        return jsonify({
            'success': True,
            'data': {
                'documentation': documentation,
                'metadata': {
                    'model': 'CodeT5-base',
                    'confidence': 0.95,
                    'processingTime': processing_time
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'data': {
            'status': 'healthy',
            'version': '1.0.0'
        }
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

## Sample Backend Implementation (Node.js/Express)

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Mock AI model (replace with actual model)
class DocumentationGenerator {
  generate(code, language) {
    // Your AI model logic here
    return `"""\nGenerated documentation for ${language} code.\n"""`;
  }
}

const generator = new DocumentationGenerator();

app.post('/api/generate-documentation', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const startTime = Date.now();
    const documentation = generator.generate(code, language);
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        documentation,
        metadata: {
          model: 'CodeT5-base',
          confidence: 0.95,
          processingTime
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0'
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Testing the API

Use curl or Postman to test:

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test documentation generation
curl -X POST http://localhost:5000/api/generate-documentation \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def hello():\n    print(\"Hello\")",
    "language": "python"
  }'
```

## AI Model Integration

For production use, integrate a proper AI model:

### Option 1: Hugging Face Transformers (CodeT5)
```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tokenizer = AutoTokenizer.from_pretrained("Salesforce/codet5-base")
model = AutoModelForSeq2SeqLM.from_pretrained("Salesforce/codet5-base")

def generate_docs(code):
    input_ids = tokenizer(code, return_tensors="pt").input_ids
    outputs = model.generate(input_ids, max_length=150)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)
```

### Option 2: OpenAI API
```python
import openai

openai.api_key = "your-api-key"

def generate_docs(code, language):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{
            "role": "user",
            "content": f"Generate documentation for this {language} code:\n\n{code}"
        }]
    )
    return response.choices[0].message.content
```

## Deployment

Deploy your backend to:
- Heroku
- AWS Lambda/EC2
- Google Cloud Run
- DigitalOcean
- Railway.app

Update the frontend `.env` file with your deployed API URL:
```
REACT_APP_API_BASE_URL=https://your-api-domain.com/api
```

## Security Considerations

1. **Rate Limiting**: Implement rate limiting to prevent abuse
2. **Authentication**: Add API key authentication if needed
3. **Input Validation**: Validate all input data
4. **HTTPS**: Use HTTPS in production
5. **CORS**: Restrict CORS to your frontend domain only
