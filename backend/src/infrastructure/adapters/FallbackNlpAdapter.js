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

    // Day group mappings for schedules
    this.dayGroups = {
      'weekdays': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      'weekday': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      'weekends': ['SATURDAY', 'SUNDAY'],
      'weekend': ['SATURDAY', 'SUNDAY'],
      'everyday': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      'daily': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      'all days': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    };

    // Day name mappings
    this.dayMappings = {
      'monday': 'MONDAY', 'mon': 'MONDAY',
      'tuesday': 'TUESDAY', 'tue': 'TUESDAY', 'tues': 'TUESDAY',
      'wednesday': 'WEDNESDAY', 'wed': 'WEDNESDAY',
      'thursday': 'THURSDAY', 'thu': 'THURSDAY', 'thur': 'THURSDAY', 'thurs': 'THURSDAY',
      'friday': 'FRIDAY', 'fri': 'FRIDAY',
      'saturday': 'SATURDAY', 'sat': 'SATURDAY',
      'sunday': 'SUNDAY', 'sun': 'SUNDAY'
    };

    // Time patterns
    this.timePatterns = {
      time12Hour: /\b(\d{1,2})\s*(am|pm)\b/i,
      time12HourWithMinutes: /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i,
      time24Hour: /\b(\d{1,2}):(\d{2})\b/,
      timeHourOnly: /\b(\d{1,2})\s*(?:o'?clock)?\b/,
      commonTimes: {
        'noon': '12:00',
        'midnight': '00:00',
        'morning': '09:00',
        'afternoon': '14:00', 
        'evening': '18:00',
        'night': '21:00'
      }
    };
  }

  interpretCommand(command) {
    const lowerCommand = command.toLowerCase();

    // SCHEDULE patterns (check first as they have specific keywords)
    const scheduleResult = this._checkSchedulePatterns(lowerCommand);
    if (scheduleResult) return scheduleResult;

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
    // Exclude commands with time patterns to avoid conflicts with schedule commands
    if (/disarm.*system|deactivate.*security|turn.*off.*alarm|sesame.*open/i.test(lowerCommand) && 
        !this._containsZoneReference(lowerCommand) &&
        !/\b(?:at|@)\s+\d/i.test(lowerCommand)) { // Exclude commands with "at [time]" patterns
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
    // Use word boundaries to prevent matching "disarm system" as "arm system"
    if (/\barm.*system|activate.*security|turn.*on.*alarm|sesame.*close/i.test(lowerCommand) && 
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

  // ===== SCHEDULE DETECTION METHODS =====

  _checkSchedulePatterns(command) {
    // Check for schedule creation patterns first
    const scheduleArmResult = this._checkScheduleArmPatterns(command);
    if (scheduleArmResult) return scheduleArmResult;

    const scheduleDisarmResult = this._checkScheduleDisarmPatterns(command);
    if (scheduleDisarmResult) return scheduleDisarmResult;

    // Check for schedule management patterns - ORDER MATTERS: more specific first
    const cancelScheduleResult = this._checkCancelSchedulePatterns(command);
    if (cancelScheduleResult) return cancelScheduleResult;

    const updateScheduleResult = this._checkUpdateSchedulePatterns(command);
    if (updateScheduleResult) return updateScheduleResult;

    const listSchedulesResult = this._checkListSchedulesPatterns(command);
    if (listSchedulesResult) return listSchedulesResult;

    return null;
  }

  _checkScheduleArmPatterns(command) {
    // Primary schedule arm patterns
    const scheduleArmPatterns = [
      /(?:schedule|set up?|create)\s+(?:arm|arming).*?(?:for|on)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:schedule|set up?)\s+(?:for|on)\s+(.*?)(?:\s+at|@)\s+(.+)/i, // "schedule for weekends at 10 PM"
      /(?:arm|activate).*?system.*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:set|schedule).*?system.*?(?:to\s+)?arm.*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:arm|activate).*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:arm)\s+(everyday|weekdays?|weekends?)\s+(?:at|@)\s+(.+)/i // "arm everyday at 11:30 PM"
    ];

    for (const pattern of scheduleArmPatterns) {
      const match = command.match(pattern);
      if (match) {
        try {
          let daysText, timeText;
          
          // Handle "arm everyday at 11:30 PM" pattern specifically
          if (pattern.source.includes('everyday|weekdays?|weekends?')) {
            daysText = match[1].trim(); // everyday/weekdays/weekends
            timeText = match[2].trim(); // time part
          } else if (match.length === 2) {
            // Pattern has combined days and time
            const atMatch = match[1].match(/(.*?)(?:\s+at|@)\s+(.+)/i);
            if (atMatch) {
              daysText = atMatch[1].trim();
              timeText = atMatch[2].trim();
            } else {
              continue; // Skip this pattern if we can't parse it properly
            }
          } else {
            daysText = match[1].trim();
            timeText = match[2].trim();
          }

          const days = this._extractDaysFromText(daysText);
          const time = this._extractTimeFromText(timeText);
          const mode = this._extractModeFromText(command);

          if (days.length > 0 && time) {
            return {
              success: true,
              intent: 'SCHEDULE_ARM_SYSTEM',
              entities: {
                days,
                time,
                action: 'ARM',
                mode,
                zoneIds: []
              },
              confidence: 0.85
            };
          }
        } catch (error) {
          continue; // Try next pattern if parsing fails
        }
      }
    }

    return null;
  }

  _checkScheduleDisarmPatterns(command) {
    // Primary schedule disarm patterns
    const scheduleDisarmPatterns = [
      /(?:schedule|set up?|create)\s+(?:disarm|disarming).*?(?:for|on)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:schedule|set up?)\s+(?:disarming).*?(?:for|on)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:disarm|deactivate).*?system.*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:set|schedule).*?system.*?(?:to\s+)?disarm.*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:disarm|deactivate).*?(?:on|every)\s+(.*?)(?:\s+at|@)\s+(.+)/i,
      /(?:disarm)\s+system\s+(?:at|@)\s+(.+)/i // "disarm system at 7 AM"
    ];

    for (let i = 0; i < scheduleDisarmPatterns.length; i++) {
      const pattern = scheduleDisarmPatterns[i];
      const match = command.match(pattern);
      if (match) {
        try {
          let daysText = '', timeText;
          
          // Handle "disarm system at 7 AM" pattern (last pattern) - only time, no specific days
          if (i === scheduleDisarmPatterns.length - 1) {
            daysText = 'everyday'; // default to everyday if no days specified
            timeText = match[1].trim();
          } else if (match.length === 2) {
            // Pattern has combined days and time
            const atMatch = match[1].match(/(.*?)(?:\s+at|@)\s+(.+)/i);
            if (atMatch) {
              daysText = atMatch[1].trim();
              timeText = atMatch[2].trim();
            } else {
              continue;
            }
          } else {
            daysText = match[1].trim();
            timeText = match[2].trim();
          }

          const days = this._extractDaysFromText(daysText);
          const time = this._extractTimeFromText(timeText);

          if (days.length > 0 && time) {
            return {
              success: true,
              intent: 'SCHEDULE_DISARM_SYSTEM',
              entities: {
                days,
                time,
                action: 'DISARM',
                zoneIds: []
              },
              confidence: 0.85
            };
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  _checkListSchedulesPatterns(command) {
    const listSchedulePatterns = [
      /(?:show|list|display|get).*?(?:my\s+)?(?:schedules?|scheduled?\s+tasks?)/i,
      /(?:what|which)\s+schedules?.*?(?:active|set|running)/i,
      /(?:schedules?\s+list|all\s+schedules?)/i
    ];

    for (const pattern of listSchedulePatterns) {
      if (pattern.test(command)) {
        const entities = {};
        
        // Check for filter types
        if (/\b(?:active|running|enabled)\b/i.test(command)) {
          entities.filterType = 'active';
        } else if (/\b(?:inactive|disabled|paused)\b/i.test(command)) {
          entities.filterType = 'inactive';
        } else if (/\btoday\b/i.test(command)) {
          entities.filterType = 'today';
        } else if (/\b(?:this\s+)?week\b/i.test(command)) {
          entities.filterType = 'week';
        }

        // Check for schedule type
        if (/\b(?:arm|arming)\b/i.test(command) && !/\b(?:disarm|disarming)\b/i.test(command)) {
          entities.scheduleType = 'arm';
        } else if (/\b(?:disarm|disarming)\b/i.test(command) && !/\b(?:arm|arming)\b/i.test(command)) {
          entities.scheduleType = 'disarm';
        } else {
          entities.scheduleType = 'all';
        }

        return {
          success: true,
          intent: 'LIST_SCHEDULES',
          entities,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  _checkCancelSchedulePatterns(command) {
    const cancelSchedulePatterns = [
      /(?:cancel|remove|delete).*?(?:schedule|scheduled?\s+task|scheduling)/i,
      /(?:stop|turn\s+off).*?(?:scheduling|schedules?)/i,
      /(?:clear|remove|delete).*?(?:all\s+)?schedules?/i
    ];

    for (const pattern of cancelSchedulePatterns) {
      if (pattern.test(command)) {
        const entities = {};

        // Check if canceling all schedules
        if (/\b(?:all|every|entire)\s+(?:schedules?|scheduled?\s+tasks?)\b/i.test(command) ||
            /(?:delete|remove|clear)\s+all\s+schedules?/i.test(command)) {
          entities.deleteAll = true;
        }

        // Try to extract specific days
        const days = this._extractDaysFromText(command);
        if (days.length > 0) {
          entities.days = days;
        }

        // Check for schedule type
        if (/\b(?:arm|arming)\b/i.test(command) && !/\b(?:disarm|disarming)\b/i.test(command)) {
          entities.scheduleType = 'arm';
        } else if (/\b(?:disarm|disarming)\b/i.test(command) && !/\b(?:arm|arming)\b/i.test(command)) {
          entities.scheduleType = 'disarm';
        } else {
          entities.scheduleType = 'all';
        }

        return {
          success: true,
          intent: 'CANCEL_SCHEDULE',
          entities,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  _checkUpdateSchedulePatterns(command) {
    const updateSchedulePatterns = [
      /(?:change|update|modify).*?schedule.*?(?:to|at)\s+(.+)/i,
      /(?:reschedule|move).*?(?:to|at)\s+(.+)/i,
      /(?:set|change).*?(?:schedule|time).*?(?:to|at)\s+(.+)/i
    ];

    for (const pattern of updateSchedulePatterns) {
      const match = command.match(pattern);
      if (match) {
        try {
          const entities = {};
          
          // Try to extract days from the beginning of the command
          const days = this._extractDaysFromText(command);
          if (days.length > 0) {
            entities.days = days;
          }

          // Extract new time from the match
          const time = this._extractTimeFromText(match[1]);
          if (time) {
            entities.newTime = time;
          }

          // Extract new mode if present
          const mode = this._extractModeFromText(match[1]);
          if (mode !== 'away') { // Only include if not default
            entities.newMode = mode;
          }

          // Check if changing action type
          if (/\b(?:arm|arming)\b/i.test(match[1])) {
            entities.newAction = 'ARM';
          } else if (/\b(?:disarm|disarming)\b/i.test(match[1])) {
            entities.newAction = 'DISARM';
          }

          if (time || Object.keys(entities).length > 0) {
            return {
              success: true,
              intent: 'UPDATE_SCHEDULE',
              entities,
              confidence: 0.8
            };
          }
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  // ===== HELPER METHODS FOR SCHEDULE PARSING =====

  _extractDaysFromText(text) {
    const days = [];
    const lowerText = text.toLowerCase();

    // Check for day groups first
    for (const [groupName, groupDays] of Object.entries(this.dayGroups)) {
      if (lowerText.includes(groupName)) {
        days.push(...groupDays);
      }
    }

    // Remove duplicates and return if we found day groups
    if (days.length > 0) {
      return [...new Set(days)];
    }

    // Check for specific days
    for (const [dayName, dayCode] of Object.entries(this.dayMappings)) {
      if (new RegExp(`\\b${dayName}\\b`).test(lowerText)) {
        days.push(dayCode);
      }
    }

    // Handle comma-separated and "and" patterns
    if (lowerText.includes(',') || lowerText.includes(' and ')) {
      const parts = lowerText.split(/[,\s]+and\s+|,\s*/);
      for (const part of parts) {
        const trimmedPart = part.trim();
        for (const [dayName, dayCode] of Object.entries(this.dayMappings)) {
          if (new RegExp(`\\b${dayName}\\b`).test(trimmedPart)) {
            days.push(dayCode);
          }
        }
      }
    }

    return [...new Set(days)]; // Remove duplicates
  }

  _extractTimeFromText(text) {
    const lowerText = text.toLowerCase().trim();

    // Check common time expressions first
    for (const [expr, time] of Object.entries(this.timePatterns.commonTimes)) {
      if (lowerText.includes(expr)) {
        return time;
      }
    }

    // Try 12-hour format with minutes (e.g., "9:30 PM")
    let match = text.match(this.timePatterns.time12HourWithMinutes);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const meridiem = match[3].toUpperCase();
      
      let finalHour = hour;
      if (meridiem === 'AM') {
        if (hour === 12) finalHour = 0; // 12 AM = 00:00
      } else { // PM
        if (hour !== 12) finalHour += 12; // 1 PM = 13:00, but 12 PM = 12:00
      }
      
      return `${finalHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    // Try 12-hour format without minutes (e.g., "9 PM")
    match = text.match(this.timePatterns.time12Hour);
    if (match) {
      const hour = parseInt(match[1], 10);
      const meridiem = match[2].toUpperCase();
      
      let finalHour = hour;
      if (meridiem === 'AM') {
        if (hour === 12) finalHour = 0; // 12 AM = 00:00
      } else { // PM
        if (hour !== 12) finalHour += 12; // 1 PM = 13:00, but 12 PM = 12:00
      }
      
      return `${finalHour.toString().padStart(2, '0')}:00`;
    }

    // Try 24-hour format (e.g., "21:30")
    match = text.match(this.timePatterns.time24Hour);
    if (match) {
      const hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    }

    // Try hour only (make educated guess based on context)
    match = text.match(this.timePatterns.timeHourOnly);
    if (match) {
      const hour = parseInt(match[1], 10);
      
      if (hour > 12 && hour <= 23) {
        // Clearly 24-hour format
        return `${hour.toString().padStart(2, '0')}:00`;
      } else if (hour >= 1 && hour <= 12) {
        // Ambiguous - use heuristics
        if (hour >= 6 && hour <= 11) {
          // Morning hours likely AM
          const finalHour = hour === 12 ? 0 : hour;
          return `${finalHour.toString().padStart(2, '0')}:00`;
        } else {
          // Afternoon/evening hours likely PM
          const finalHour = hour === 12 ? 12 : hour + 12;
          return `${finalHour.toString().padStart(2, '0')}:00`;
        }
      }
    }

    return null; // Could not parse time
  }

  _extractModeFromText(text) {
    const lowerText = text.toLowerCase();
    
    if (/\b(?:stay|home)\b/.test(lowerText)) {
      return 'stay';
    } else if (/\baway\b/.test(lowerText)) {
      return 'away';
    }
    
    return 'away'; // Default mode
  }
}

module.exports = FallbackNlpAdapter;
