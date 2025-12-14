#!/bin/bash

# Quick test script for the Document Intelligence API
# Make sure the API is running before running this script

API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-your-api-key-here}"
TEST_FILE="${1}"

echo "🧪 Testing Document Intelligence API"
echo "===================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
HEALTH_RESPONSE=$(curl -s "$API_URL/api/v1/health")
echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
echo ""

# Test 2: Document Analysis
if [ -z "$TEST_FILE" ]; then
    echo "⚠️  No test file provided. Skipping document analysis test."
    echo "   Usage: ./test.sh <path-to-pdf-or-image>"
    echo ""
    echo "Example:"
    echo "   export API_KEY='your-actual-key'"
    echo "   ./test.sh document.pdf"
    exit 0
fi

if [ ! -f "$TEST_FILE" ]; then
    echo "❌ File not found: $TEST_FILE"
    exit 1
fi

echo "Test 2: Document Analysis"
echo "-------------------------"
echo "File: $TEST_FILE"
echo "API Key: ${API_KEY:0:8}..."
echo ""

PROMPT="Summarize this document and list the key information."

echo "Sending request..."
START_TIME=$(date +%s)

RESPONSE=$(curl -s -X POST "$API_URL/api/v1/documents/analyze" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@$TEST_FILE" \
  -F "prompt=$PROMPT")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "Response received in ${DURATION}s:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | jq -e '.success == true' &>/dev/null; then
    echo "✅ Test passed!"
    
    # Extract metadata
    OCR_TIME=$(echo "$RESPONSE" | jq -r '.data.metadata.ocrTimeSeconds // "N/A"')
    LLM_TIME=$(echo "$RESPONSE" | jq -r '.data.metadata.llmTimeSeconds // "N/A"')
    TOTAL_TIME=$(echo "$RESPONSE" | jq -r '.data.metadata.totalTimeSeconds // "N/A"')
    TEXT_LENGTH=$(echo "$RESPONSE" | jq -r '.data.metadata.textLength // "N/A"')
    
    echo ""
    echo "Performance Metrics:"
    echo "  OCR Time:   ${OCR_TIME}s"
    echo "  LLM Time:   ${LLM_TIME}s"
    echo "  Total Time: ${TOTAL_TIME}s"
    echo "  Text Chars: $TEXT_LENGTH"
else
    echo "❌ Test failed!"
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown error"')
    echo "Error: $ERROR_MSG"
    exit 1
fi
