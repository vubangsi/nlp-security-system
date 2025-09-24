class FallbackNlpAdapter {
  constructor() {
    // Common zone name mappings and aliases
    this.zoneAliases = {
      'lounge': 'living room',
      'family room': 'living room',
      'study': 'office',
      'den': 'office',
      'washroom': 'bathroom',
      'restroom': 'bathroom',
      'cellar': 'basement',
      'loft': 'attic'
    };
  }

  interpretCommand(command) {
    const lowerCommand = command.toLowerCase();

    // LIST_ZONES patterns (check first to avoid conflicts with ARM_ZONE)
    const listZonesResult = this._checkListZonesPatterns(lowerCommand);
    if (listZonesResult) return listZonesResult;

    // Zone-specific DISARM patterns (check before system patterns)
    const disarmZoneResult = this._checkDisarmZonePatterns(lowerCommand);
    if (disarmZoneResult) return disarmZoneResult;

    // Zone-specific ARM patterns (check before system patterns)
    const armZoneResult = this._checkArmZonePatterns(lowerCommand);
    if (armZoneResult) return armZoneResult;

    // DISARM_SYSTEM patterns (including "sesame open") - check after zone patterns
    if (/disarm.*system|deactivate.*security|turn.*off.*alarm|sesame.*open/i.test(lowerCommand) && 
        !this._containsZoneReference(lowerCommand)) {
      // Only match if no zone is mentioned
      if (/\b(unlock|unsecure)\b/i.test(lowerCommand) && !this._containsZoneReference(lowerCommand)) {
        return {
          success: true,
          intent: 'DISARM_SYSTEM',
          entities: {},
          confidence: 0.7
        };
      }
      return {
        success: true,
        intent: 'DISARM_SYSTEM',
        entities: {},
        confidence: 0.7
      };
    }

    // ARM_SYSTEM patterns (including "sesame close") - check after zone patterns
    if (/arm.*system|activate.*security|turn.*on.*alarm|sesame.*close/i.test(lowerCommand) && 
        !this._containsZoneReference(lowerCommand)) {
      const modeMatch = lowerCommand.match(/\b(away|stay)\b/);
      const mode = modeMatch ? modeMatch[1] : 'away';

      return {
        success: true,
        intent: 'ARM_SYSTEM',
        entities: { mode },
        confidence: 0.7
      };
    }

    // Generic lock/secure patterns - check if zone is mentioned
    if (/\b(lock|secure)\b/i.test(lowerCommand)) {
      if (this._containsZoneReference(lowerCommand)) {
        return this._checkArmZonePatterns(lowerCommand) || this._createArmZoneResponse(lowerCommand);
      } else {
        const modeMatch = lowerCommand.match(/\b(away|stay)\b/);
        const mode = modeMatch ? modeMatch[1] : 'away';
        return {
          success: true,
          intent: 'ARM_SYSTEM',
          entities: { mode },
          confidence: 0.6
        };
      }
    }

    // CREATE_ZONE patterns
    const createZoneResult = this._checkCreateZonePatterns(lowerCommand);
    if (createZoneResult) return createZoneResult;

    // DELETE_ZONE patterns
    const deleteZoneResult = this._checkDeleteZonePatterns(lowerCommand);
    if (deleteZoneResult) return deleteZoneResult;

    // UPDATE_ZONE patterns
    const updateZoneResult = this._checkUpdateZonePatterns(lowerCommand);
    if (updateZoneResult) return updateZoneResult;


    // GET_ZONE patterns
    const getZoneResult = this._checkGetZonePatterns(lowerCommand);
    if (getZoneResult) return getZoneResult;

    // MANAGE_ZONE_HIERARCHY patterns
    const hierarchyResult = this._checkHierarchyPatterns(lowerCommand);
    if (hierarchyResult) return hierarchyResult;

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
  _checkArmZonePatterns(command) {
    // Skip if this is a system command
    if (/arm.*system/i.test(command)) {
      return null;
    }

    // Patterns for arming specific zones
    if (/arm.*(?:the\s+)?([\w\s]+?)(?:\s+in\s+(away|stay)\s+mode|\s+(away|stay))?(?:\s+mode)?$/i.test(command) ||
        /turn.*on.*security.*(?:for\s+|in\s+)?(?:the\s+)?([\w\s]+)/i.test(command) ||
        /activate.*(?:the\s+)?([\w\s]+?)(?:\s+(?:zone|security))?/i.test(command) ||
        /secure.*(?:the\s+)?([\w\s]+)/i.test(command)) {
      
      return this._createArmZoneResponse(command);
    }
    return null;
  }

  _checkDisarmZonePatterns(command) {
    // Handle "disarm all zones except..." patterns first
    if (/disarm.*all.*zones?.*except\s+([\w\s]+)/i.test(command)) {
      const exceptMatch = command.match(/except\s+([\w\s,and]+)/i);
      if (exceptMatch) {
        const exceptZones = this._extractZoneNames(exceptMatch[1]);
        return {
          success: true,
          intent: 'DISARM_ZONE',
          entities: {
            zones: ['all'],
            except: exceptZones
          },
          confidence: 0.8
        };
      }
    }

    // Skip if this is a system command
    if (/disarm.*system/i.test(command)) {
      return null;
    }

    // Patterns for disarming specific zones
    if (/disarm.*(?:the\s+)?([\w\s]+?)(?:\s+(?:zone|only))?$/i.test(command) ||
        /turn.*off.*(?:the\s+)?([\w\s]+?)(?:\s+security)?/i.test(command) ||
        /deactivate.*(?:the\s+)?([\w\s]+?)(?:\s+(?:zone|security))?/i.test(command) ||
        /unlock.*(?:the\s+)?([\w\s]+)/i.test(command)) {
      
      return this._createDisarmZoneResponse(command);
    }

    return null;
  }

  _createArmZoneResponse(command) {
    const entities = {};
    
    // Extract mode
    const modeMatch = command.match(/\b(away|stay)\b/i);
    entities.mode = modeMatch ? modeMatch[1].toLowerCase() : 'away';
    
    // Extract zones
    const zones = this._extractZoneNames(command);
    if (zones.length === 1) {
      entities.zoneName = zones[0];
    } else if (zones.length > 1) {
      entities.zones = zones;
    }
    
    // Check for "all" or "including children" patterns
    if (/\ball\b|including.*children|and.*child.*zones/i.test(command)) {
      entities.includeChildren = true;
    }
    
    return {
      success: true,
      intent: 'ARM_ZONE',
      entities,
      confidence: zones.length > 0 ? 0.8 : 0.6
    };
  }

  _createDisarmZoneResponse(command) {
    const entities = {};
    
    // Extract zones
    const zones = this._extractZoneNames(command);
    if (zones.length === 1) {
      entities.zoneName = zones[0];
    } else if (zones.length > 1) {
      entities.zones = zones;
    }
    
    // Check for "all" or "including children" patterns
    if (/\ball\b|including.*children|and.*child.*zones/i.test(command)) {
      entities.includeChildren = true;
    }
    
    return {
      success: true,
      intent: 'DISARM_ZONE',
      entities,
      confidence: zones.length > 0 ? 0.8 : 0.6
    };
  }

  _checkCreateZonePatterns(command) {
    if (/create.*zone.*(?:called|named)\s+([\w\s]+)/i.test(command) ||
        /add.*(?:new\s+)?zone.*(?:called|named)\s+([\w\s]+)/i.test(command) ||
        /new.*zone\s+([\w\s]+?)(?:\s+(?:under|in)\s+([\w\s]+))?$/i.test(command)) {
      
      // Handle "create zone called [name]" or "new zone [name]"
      let nameMatch = command.match(/(?:create|add).*zone.*(?:called|named)\s+([\w\s]+?)(?:\s+(?:under|in)\s+([\w\s]+))?$/i);
      if (!nameMatch) {
        nameMatch = command.match(/new.*zone\s+([\w\s]+?)(?:\s+(?:under|in)\s+([\w\s]+))?$/i);
      }
      
      if (nameMatch) {
        const entities = { name: nameMatch[1].trim() };
        if (nameMatch[2]) {
          entities.parentZoneName = this._normalizeZoneName(nameMatch[2].trim());
        }
        
        return {
          success: true,
          intent: 'CREATE_ZONE',
          entities,
          confidence: 0.8
        };
      }
    }
    return null;
  }

  _checkDeleteZonePatterns(command) {
    if (/delete.*(?:zone\s+)?([\w\s]+)/i.test(command) ||
        /remove.*(?:zone\s+)?([\w\s]+)/i.test(command)) {
      
      const zones = this._extractZoneNames(command);
      if (zones.length > 0) {
        return {
          success: true,
          intent: 'DELETE_ZONE',
          entities: { zoneName: zones[0] },
          confidence: 0.8
        };
      }
    }
    return null;
  }

  _checkUpdateZonePatterns(command) {
    if (/rename\s+([\w\s]+?)\s+to\s+([\w\s]+)/i.test(command)) {
      const renameMatch = command.match(/rename\s+([\w\s]+?)\s+to\s+([\w\s]+?)(?:\s|$)/i);
      if (renameMatch) {
        return {
          success: true,
          intent: 'UPDATE_ZONE',
          entities: {
            zoneName: this._normalizeZoneName(renameMatch[1].trim()),
            newName: renameMatch[2].trim()
          },
          confidence: 0.8
        };
      }
    }
    return null;
  }

  _checkListZonesPatterns(command) {
    if (/list.*zones?|show.*(?:all\s+)?zones?|what.*zones?.*(?:do\s+we\s+)?have|get.*zones?/i.test(command)) {
      const entities = {};
      
      // Check for specific filters
      if (/(?:list|show).*armed.*zones?/i.test(command)) {
        entities.filterType = 'armed';
      } else if (/(?:list|show).*disarmed.*zones?/i.test(command)) {
        entities.filterType = 'disarmed';
      }
      
      return {
        success: true,
        intent: 'LIST_ZONES',
        entities,
        confidence: 0.8
      };
    }
    return null;
  }

  _checkGetZonePatterns(command) {
    if (/show.*(?:zone\s+)?([\w\s]+?)(?:\s+(?:details|info|status))?$/i.test(command) ||
        /get.*(?:details.*(?:for|of)\s+)?([\w\s]+?)(?:\s+zone)?$/i.test(command)) {
      
      const zones = this._extractZoneNames(command);
      if (zones.length > 0) {
        const entities = { zoneName: zones[0] };
        
        if (/(?:details|info|hierarchy|children)/i.test(command)) {
          entities.includeChildren = true;
        }
        
        return {
          success: true,
          intent: 'GET_ZONE',
          entities,
          confidence: 0.8
        };
      }
    }
    return null;
  }

  _checkHierarchyPatterns(command) {
    if (/move\s+([\w\s]+?)\s+(?:under|to)\s+([\w\s]+)/i.test(command)) {
      const moveMatch = command.match(/move\s+([\w\s]+?)\s+(?:under|to)\s+([\w\s]+?)(?:\s|$)/i);
      if (moveMatch) {
        return {
          success: true,
          intent: 'MANAGE_ZONE_HIERARCHY',
          entities: {
            action: 'move_zone',
            zoneName: this._normalizeZoneName(moveMatch[1].trim()),
            parentZoneName: this._normalizeZoneName(moveMatch[2].trim())
          },
          confidence: 0.8
        };
      }
    }
    return null;
  }

  _extractZoneNames(text) {
    const normalizedText = text.toLowerCase();
    const zones = [];
    
    // Common zone patterns
    const zonePatterns = [
      /\b(living\s+room|lounge|family\s+room)\b/,
      /\b(bedroom|master\s+bedroom|guest\s+bedroom)\b/,
      /\b(kitchen|dining\s+room)\b/,
      /\b(garage|carport)\b/,
      /\b(office|study|den)\b/,
      /\b(bathroom|washroom|restroom)\b/,
      /\b(basement|cellar)\b/,
      /\b(attic|loft)\b/,
      /\b(front\s+door|back\s+door|main\s+entrance)\b/,
      /\b(main\s+floor|upstairs|downstairs)\b/,
      /\b(patio|deck|balcony)\b/,
      /\b(hallway|corridor)\b/
    ];
    
    // Check for specific zone patterns
    for (const pattern of zonePatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        zones.push(this._normalizeZoneName(match[0]));
      }
    }
    
    // If no specific patterns found, try to extract from common phrases
    if (zones.length === 0) {
      // Extract from "arm the [zone]" or "disarm [zone]" patterns
      const genericMatch = normalizedText.match(/(?:arm|disarm|secure|unlock|the)\s+([\w\s]+?)(?:\s+(?:zone|only|and)|$)/i);
      if (genericMatch) {
        const potentialZone = genericMatch[1].trim();
        if (potentialZone && !['system', 'security', 'alarm'].includes(potentialZone)) {
          zones.push(this._normalizeZoneName(potentialZone));
        }
      }
    }
    
    // Handle multiple zones with "and"
    if (normalizedText.includes(' and ') && zones.length <= 1) {
      const andParts = normalizedText.split(' and ');
      if (andParts.length === 2) {
        const zone1 = this._extractSingleZone(andParts[0]);
        const zone2 = this._extractSingleZone(andParts[1]);
        if (zone1 && zone2) {
          return [zone1, zone2];
        }
      }
    }
    
    return zones;
  }

  _extractSingleZone(text) {
    const normalized = text.trim().toLowerCase();
    const zoneWords = ['living room', 'bedroom', 'kitchen', 'garage', 'office', 'bathroom', 'basement', 'attic'];
    
    for (const zone of zoneWords) {
      if (normalized.includes(zone)) {
        return this._normalizeZoneName(zone);
      }
    }
    
    // Try to extract last meaningful word(s)
    const words = normalized.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'arm', 'disarm'].includes(w));
    if (words.length > 0) {
      return this._normalizeZoneName(words[words.length - 1]);
    }
    
    return null;
  }

  _normalizeZoneName(zoneName) {
    const normalized = zoneName.toLowerCase().trim();
    return this.zoneAliases[normalized] || normalized;
  }

  _containsZoneReference(command) {
    const zoneKeywords = [
      'living room', 'bedroom', 'kitchen', 'garage', 'office', 'bathroom',
      'basement', 'attic', 'front door', 'back door', 'main floor',
      'upstairs', 'downstairs', 'lounge', 'family room', 'study', 'den',
      'zone', 'room'
    ];
    
    const lowerCommand = command.toLowerCase();
    return zoneKeywords.some(keyword => lowerCommand.includes(keyword));
  }
}

module.exports = FallbackNlpAdapter;
