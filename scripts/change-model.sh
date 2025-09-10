#!/bin/bash

# Script to change the Groq model in the environment configuration
# Usage: ./scripts/change-model.sh <model-name>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <model-name>"
    echo ""
    echo "Available models:"
    echo "  - llama3-8b-8192 (default, fast and efficient)"
    echo "  - llama3-70b-8192 (more capable, slower)"
    echo "  - mixtral-8x7b-32768 (good balance)"
    echo "  - gemma-7b-it (Google's model)"
    echo "  - openai/gpt-oss-20b (OpenAI compatible)"
    echo "  - openai/gpt-4o-mini (OpenAI GPT-4 mini)"
    echo "  - openai/gpt-3.5-turbo (OpenAI GPT-3.5)"
    echo ""
    echo "Example: $0 openai/gpt-4o-mini"
    exit 1
fi

MODEL_NAME="$1"
ENV_FILE=".env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env first:"
    echo "  cp .env.example .env"
    exit 1
fi

# Update or add GROQ_MODEL in .env file
if grep -q "^GROQ_MODEL=" "$ENV_FILE"; then
    # Update existing GROQ_MODEL line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/^GROQ_MODEL=.*/GROQ_MODEL=$MODEL_NAME/" "$ENV_FILE"
    else
        # Linux
        sed -i "s/^GROQ_MODEL=.*/GROQ_MODEL=$MODEL_NAME/" "$ENV_FILE"
    fi
    echo "✅ Updated GROQ_MODEL to: $MODEL_NAME"
else
    # Add GROQ_MODEL line after GROQ_API_KEY
    if grep -q "^GROQ_API_KEY=" "$ENV_FILE"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "/^GROQ_API_KEY=/a\\
GROQ_MODEL=$MODEL_NAME
" "$ENV_FILE"
        else
            # Linux
            sed -i "/^GROQ_API_KEY=/a GROQ_MODEL=$MODEL_NAME" "$ENV_FILE"
        fi
        echo "✅ Added GROQ_MODEL: $MODEL_NAME"
    else
        echo "Error: GROQ_API_KEY not found in .env file"
        exit 1
    fi
fi

echo ""
echo "🔄 Model changed successfully!"
echo "📝 Current configuration:"
grep "^GROQ_" "$ENV_FILE"
echo ""
echo "🚀 Restart the backend server to apply changes:"
echo "  cd backend && npm start"
