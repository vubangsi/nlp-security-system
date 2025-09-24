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

SYSTEM LEVEL:
- ARM_SYSTEM: Arm the entire security system (also "sesame close", "lock", "secure")
- DISARM_SYSTEM: Disarm the entire security system (also "sesame open", "unlock", "unsecure")
- GET_STATUS: Get system status (also "status", "state", "check status", "system status")

USER MANAGEMENT:
- ADD_USER: Add a new user
- LIST_USERS: List all users

ZONE MANAGEMENT:
- ARM_ZONE: Arm specific zone(s) ("arm living room", "arm the garage in stay mode")
- DISARM_ZONE: Disarm specific zone(s) ("disarm garage", "turn off bedroom security")
- CREATE_ZONE: Create a new zone ("create zone kitchen", "add new zone called office")
- LIST_ZONES: Show all zones ("show all zones", "list zones", "what zones do we have")
- DELETE_ZONE: Delete a zone ("delete garage zone", "remove kitchen")
- UPDATE_ZONE: Update zone properties ("rename living room to lounge")
- GET_ZONE: Get zone details ("show kitchen zone", "get garage details")
- MANAGE_ZONE_HIERARCHY: Manage zone parent-child relationships ("move kitchen under main floor")

Entity extraction rules:

For ARM_SYSTEM/ARM_ZONE:
- mode: "away" or "stay" (default: "away")
- zones: Array of zone names (for multi-zone commands like "arm living room and garage")
- zoneName: Single zone name (for single zone commands)
- includeChildren: true if "all", "including children", "and child zones" mentioned

For DISARM_SYSTEM/DISARM_ZONE:
- zones: Array of zone names for multi-zone commands
- zoneName: Single zone name
- includeChildren: true if "all", "including children", "and child zones" mentioned
- except: Array of zone names to exclude ("disarm all zones except bedroom")

For CREATE_ZONE:
- name: Zone name to create
- description: Optional zone description
- parentZoneName: Parent zone name if specified

For UPDATE_ZONE:
- zoneName: Current zone name
- newName: New zone name (for renaming)
- description: New description

For DELETE_ZONE:
- zoneName: Zone name to delete
- handleChildren: "delete" or "move" or "block" (default: "block")

For MANAGE_ZONE_HIERARCHY:
- action: "move_zone", "add_child", "remove_child"
- zoneName: Zone to move/modify
- parentZoneName: New parent zone name
- childZoneName: Child zone name

For LIST_ZONES:
- filterType: "armed", "disarmed", "parent" for filtered lists
- parentZoneName: Show zones under specific parent

For GET_ZONE:
- zoneName: Zone name to get details for
- includeChildren: true if hierarchy info requested

For ADD_USER:
- name: user's name
- pin: user's PIN (numeric)

Zone name normalization:
- Convert common room names: "living room", "bedroom", "kitchen", "garage", "office", "bathroom", "basement", "attic", "front door", "back door", "main floor", "upstairs", "downstairs"
- Handle variations: "lounge" = "living room", "family room" = "living room", "study" = "office"
- Extract zone names from natural language patterns

Special patterns:
- "sesame open" = DISARM_SYSTEM
- "sesame close" = ARM_SYSTEM
- "all zones" = include all zones
- "except [zone]" = exclude specific zones
- "and" = multiple zones ("living room and garage")
- "only" = single zone exclusivity ("garage only")

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
