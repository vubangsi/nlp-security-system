class FallbackNlpAdapter {
  interpretCommand(command) {
    const lowerCommand = command.toLowerCase();

    // DISARM_SYSTEM patterns (including "sesame open") - check first to avoid "unlock" matching "lock"
    if (/disarm.*system|deactivate.*security|turn.*off.*alarm|sesame.*open|unlock|unsecure/i.test(lowerCommand)) {
      return {
        success: true,
        intent: 'DISARM_SYSTEM',
        entities: {},
        confidence: 0.7
      };
    }

    // ARM_SYSTEM patterns (including "sesame close")
    if (/arm.*system|activate.*security|turn.*on.*alarm|sesame.*close|lock|secure/i.test(lowerCommand)) {
      const modeMatch = lowerCommand.match(/\b(away|stay)\b/);
      const mode = modeMatch ? modeMatch[1] : 'away';

      return {
        success: true,
        intent: 'ARM_SYSTEM',
        entities: { mode },
        confidence: 0.7
      };
    }

    // GET_STATUS patterns
    if (/status|state|check.*status|what.*status|system.*status/i.test(lowerCommand)) {
      return {
        success: true,
        intent: 'GET_STATUS',
        entities: {},
        confidence: 0.8
      };
    }
    
    // ADD_USER patterns
    if (/add.*user|create.*user|new.*user/i.test(lowerCommand)) {
      const nameMatch = lowerCommand.match(/(?:name|user|called?)\s+(?:is\s+)?([a-zA-Z]+)/);
      const pinMatch = lowerCommand.match(/(?:pin|code|password)\s+(?:is\s+)?(\d+)/);
      
      const entities = {};
      if (nameMatch) entities.name = nameMatch[1];
      if (pinMatch) entities.pin = pinMatch[1];
      
      return {
        success: true,
        intent: 'ADD_USER',
        entities,
        confidence: nameMatch && pinMatch ? 0.8 : 0.5
      };
    }
    
    // GET_STATUS patterns
    if (/status|state|check.*status|what.*status|system.*status/i.test(lowerCommand)) {
      return {
        success: true,
        intent: 'GET_STATUS',
        entities: {},
        confidence: 0.8
      };
    }

    // LIST_USERS patterns
    if (/list.*users?|show.*users?|get.*users?|all.*users?/i.test(lowerCommand)) {
      return {
        success: true,
        intent: 'LIST_USERS',
        entities: {},
        confidence: 0.8
      };
    }
    
    // Unknown command
    return {
      success: false,
      intent: 'UNKNOWN',
      entities: {},
      confidence: 0.0,
      error: 'Command not recognized'
    };
  }
}

module.exports = FallbackNlpAdapter;
