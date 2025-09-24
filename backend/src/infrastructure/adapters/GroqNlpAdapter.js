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

SCHEDULE MANAGEMENT:
- SCHEDULE_ARM_SYSTEM: Schedule system arming ("arm the system on Monday at 10 PM", "schedule arming for Tuesday at 9:00 AM", "set system to arm weekdays at 11 PM")
- SCHEDULE_DISARM_SYSTEM: Schedule system disarming ("disarm system at 7 AM", "schedule disarming for weekdays at morning")
- LIST_SCHEDULES: Show all schedules ("show my schedules", "list arm schedules", "what schedules are active")
- CANCEL_SCHEDULE: Remove schedules ("remove Monday schedule", "cancel weekend scheduling", "delete all schedules")
- UPDATE_SCHEDULE: Modify existing schedules ("change Tuesday schedule to 11 PM", "update weekend arming to 10:30 PM")

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

For SCHEDULE_ARM_SYSTEM/SCHEDULE_DISARM_SYSTEM:
- days: Array of days ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
- time: Time in 24-hour format "HH:MM" (e.g., "20:00" for 8 PM, "09:30" for 9:30 AM)
- action: "ARM" or "DISARM" 
- mode: "away" or "stay" (for arming commands, default: "away")
- zoneIds: Array of zone IDs if specific zones mentioned (default: [] for system-level)

For LIST_SCHEDULES:
- filterType: "active", "inactive", "today", "week" (optional filter)
- scheduleType: "arm", "disarm", "all" (default: "all")

For CANCEL_SCHEDULE:
- scheduleId: Specific schedule ID to cancel (if mentioned)
- days: Array of days to cancel schedules for (e.g., ["MONDAY"] for "cancel Monday schedule")
- scheduleType: "arm", "disarm", "all" (default: "all")
- deleteAll: true if "all schedules" or similar mentioned

For UPDATE_SCHEDULE:
- scheduleId: Specific schedule ID to update (if mentioned) 
- days: Array of days for schedule to update
- newTime: New time in 24-hour format "HH:MM"
- newMode: New mode "away" or "stay" (for arm schedules)
- newAction: "ARM" or "DISARM" if changing action type

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

Schedule patterns:
- Day groups: "weekdays" = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"], "weekends" = ["SATURDAY","SUNDAY"], "everyday" = all 7 days
- Time formats: "9 PM" = "21:00", "9:30 AM" = "09:30", "21:30" = "21:30", "noon" = "12:00", "midnight" = "00:00"
- Schedule keywords: "schedule", "set", "arm at", "disarm at", "every", "on [day]", "at [time]"
- Management keywords: "show schedules", "list schedules", "cancel", "remove", "delete", "update", "change"
- Complex patterns: "arm on Monday, Wednesday, and weekends at 8 PM" = expand day groups and parse multiple days

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
