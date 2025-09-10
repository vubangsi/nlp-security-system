const Groq = require('groq-sdk');

class GroqNlpAdapter {
  constructor(apiKey, model = 'llama3-8b-8192') {
    this.groq = new Groq({ apiKey });
    this.model = model;
  }

  async interpretCommand(command) {
    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a natural language security control assistant. Interpret the user's command and extract the intent and entities.

The possible intents are:
- ARM_SYSTEM: Arm the security system (also "sesame close", "lock", "secure")
- DISARM_SYSTEM: Disarm the security system (also "sesame open", "unlock", "unsecure")
- ADD_USER: Add a new user
- LIST_USERS: List all users
- GET_STATUS: Get system status (also "status", "state", "check status", "system status")

For ARM_SYSTEM:
- mode: "away" or "stay" (default: "away")

For ADD_USER:
- name: user's name
- pin: user's PIN (numeric)

For DISARM_SYSTEM, LIST_USERS, and GET_STATUS: no entities needed

Special patterns:
- "sesame open" = DISARM_SYSTEM
- "sesame close" = ARM_SYSTEM

Respond with a JSON object: { "intent": "INTENT", "entities": { "entity1": "value1", ... } }`
          },
          {
            role: 'user',
            content: command
          }
        ],
        model: this.model,
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0]?.message?.content);
      return {
        success: true,
        intent: result.intent,
        entities: result.entities || {},
        confidence: 0.9 // Groq generally has high confidence
      };
    } catch (error) {
      console.error('Groq API error:', error);
      throw new Error('Failed to process command with Groq API');
    }
  }
}

module.exports = GroqNlpAdapter;
