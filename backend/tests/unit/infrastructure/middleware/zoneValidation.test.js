const {
  VALIDATION_RULES,
  sanitizeInput,
  validateZoneName,
  validateZoneDescription,
  validateZoneId,
  validateZoneCreation,
  validateZoneUpdate,
  validateZoneIdParam,
  validateZoneParentChange,
  validateZoneQuery
} = require('../../../../src/infrastructure/middleware/zoneValidation');

describe('Zone Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('sanitizeInput', () => {
    test('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Test Zone';
      const result = sanitizeInput(input);
      
      expect(result).toBe('Test Zone');
      expect(result).not.toContain('<script>');
    });

    test('should trim whitespace', () => {
      const input = '  Test Zone  ';
      const result = sanitizeInput(input);
      
      expect(result).toBe('Test Zone');
    });

    test('should escape HTML when option is enabled', () => {
      const input = 'Test & <Zone>';
      const result = sanitizeInput(input, { escapeHtml: true });
      
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('should remove special characters when option is enabled', () => {
      const input = 'Test Zone;<>&"\'';
      const result = sanitizeInput(input, { removeSpecialChars: true });
      
      expect(result).toBe('Test Zone');
    });

    test('should handle non-string input', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('validateZoneName', () => {
    test('should validate correct zone name', () => {
      const result = validateZoneName('Living Room');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedValue).toBe('Living Room');
    });

    test('should validate zone name with allowed characters', () => {
      const validNames = [
        'Zone-123',
        'Zone_Test',
        'Zone 1 2 3',
        'TestZone',
        'Zone-Test_123'
      ];

      validNames.forEach(name => {
        const result = validateZoneName(name);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject empty or null names', () => {
      const invalidNames = [null, undefined, '', '   '];

      invalidNames.forEach(name => {
        const result = validateZoneName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Zone name is required and must be a string');
      });
    });

    test('should reject non-string names', () => {
      const result = validateZoneName(123);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zone name is required and must be a string');
    });

    test('should reject names that are too long', () => {
      const longName = 'A'.repeat(VALIDATION_RULES.ZONE_NAME.MAX_LENGTH + 1);
      const result = validateZoneName(longName);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Zone name must be ${VALIDATION_RULES.ZONE_NAME.MAX_LENGTH} characters or less`);
    });

    test('should reject names with invalid characters', () => {
      const invalidNames = [
        'Zone@Test',
        'Zone#Test',
        'Zone$Test',
        'Zone%Test',
        'Zone&Test',
        'Zone*Test',
        'Zone+Test',
        'Zone=Test',
        'Zone|Test',
        'Zone\\Test',
        'Zone/Test',
        'Zone?Test'
      ];

      invalidNames.forEach(name => {
        const result = validateZoneName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(VALIDATION_RULES.ZONE_NAME.DESCRIPTION);
      });
    });

    test('should reject names with dangerous patterns', () => {
      const dangerousNames = [
        'script',
        'javascript',
        'vbscript',
        'onload',
        'onerror',
        'onclick',
        'Zone script Test',
        'JAVASCRIPT Zone'
      ];

      dangerousNames.forEach(name => {
        const result = validateZoneName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Zone name contains potentially dangerous content');
      });
    });

    test('should sanitize and validate zone name', () => {
      const result = validateZoneName('<script>alert("xss")</script>Living Room');
      
      expect(result.isValid).toBe(false);
      expect(result.sanitizedValue).toBe('Living Room');
    });
  });

  describe('validateZoneDescription', () => {
    test('should validate correct description', () => {
      const result = validateZoneDescription('This is a test zone description');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedValue).toBe('This is a test zone description');
    });

    test('should handle null or undefined description', () => {
      const result1 = validateZoneDescription(null);
      const result2 = validateZoneDescription(undefined);
      
      expect(result1.isValid).toBe(true);
      expect(result1.sanitizedValue).toBe('');
      expect(result2.isValid).toBe(true);
      expect(result2.sanitizedValue).toBe('');
    });

    test('should reject non-string description', () => {
      const result = validateZoneDescription(123);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zone description must be a string');
    });

    test('should reject descriptions that are too long', () => {
      const longDescription = 'A'.repeat(VALIDATION_RULES.ZONE_DESCRIPTION.MAX_LENGTH + 1);
      const result = validateZoneDescription(longDescription);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(VALIDATION_RULES.ZONE_DESCRIPTION.DESCRIPTION);
    });

    test('should reject descriptions with script patterns', () => {
      const dangerousDescriptions = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'vbscript:msgbox("xss")',
        'onload=alert("xss")',
        'onclick=alert("xss")'
      ];

      dangerousDescriptions.forEach(description => {
        const result = validateZoneDescription(description);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Zone description contains potentially dangerous content');
      });
    });

    test('should sanitize HTML in description', () => {
      const result = validateZoneDescription('Test <b>bold</b> description');
      
      expect(result.sanitizedValue).not.toContain('<b>');
      expect(result.sanitizedValue).not.toContain('</b>');
    });
  });

  describe('validateZoneId', () => {
    test('should validate correct zone ID', () => {
      const validIds = [
        'zone-123',
        'zone_test',
        'ZONE123',
        'test-zone_123',
        'a1b2c3'
      ];

      validIds.forEach(id => {
        const result = validateZoneId(id);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedValue).toBe(id);
      });
    });

    test('should reject empty or null IDs', () => {
      const invalidIds = [null, undefined, '', '   '];

      invalidIds.forEach(id => {
        const result = validateZoneId(id);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Zone ID is required and must be a string');
      });
    });

    test('should reject non-string IDs', () => {
      const result = validateZoneId(123);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zone ID is required and must be a string');
    });

    test('should reject IDs with invalid characters', () => {
      const invalidIds = [
        'zone@123',
        'zone#123',
        'zone$123',
        'zone%123',
        'zone&123',
        'zone*123',
        'zone+123',
        'zone=123',
        'zone|123',
        'zone\\123',
        'zone/123',
        'zone?123',
        'zone 123' // spaces not allowed
      ];

      invalidIds.forEach(id => {
        const result = validateZoneId(id);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(VALIDATION_RULES.ZONE_ID.DESCRIPTION);
      });
    });

    test('should reject IDs that are too long', () => {
      const longId = 'A'.repeat(51);
      const result = validateZoneId(longId);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(VALIDATION_RULES.ZONE_ID.DESCRIPTION);
    });
  });

  describe('validateZoneCreation middleware', () => {
    test('should pass validation with valid data', () => {
      req.body = {
        name: 'Test Zone',
        description: 'Test description',
        parentZoneId: 'parent-123'
      };

      validateZoneCreation(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.body.name).toBe('Test Zone');
      expect(req.body.description).toBe('Test description');
      expect(req.body.parentZoneId).toBe('parent-123');
    });

    test('should sanitize input data', () => {
      req.body = {
        name: '  Test Zone  ',
        description: '<script>alert("xss")</script>Safe description',
        parentZoneId: 'parent-123'
      };

      validateZoneCreation(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Test Zone');
      expect(req.body.description).not.toContain('<script>');
    });

    test('should return 400 for invalid name', () => {
      req.body = {
        name: '',
        description: 'Test description'
      };

      validateZoneCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          name: expect.arrayContaining(['Zone name is required and must be a string'])
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid description', () => {
      req.body = {
        name: 'Test Zone',
        description: 123
      };

      validateZoneCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          description: expect.arrayContaining(['Zone description must be a string'])
        }
      });
    });

    test('should return 400 for invalid parent zone ID', () => {
      req.body = {
        name: 'Test Zone',
        description: 'Test description',
        parentZoneId: 'invalid@parent'
      };

      validateZoneCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          parentZoneId: expect.arrayContaining([VALIDATION_RULES.ZONE_ID.DESCRIPTION])
        }
      });
    });

    test('should handle validation exceptions', () => {
      req.body = null; // This will cause an error

      validateZoneCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation process failed',
        error: 'VALIDATION_PROCESS_FAILED'
      });
    });
  });

  describe('validateZoneUpdate middleware', () => {
    test('should pass validation with valid data', () => {
      req.body = {
        name: 'Updated Zone',
        description: 'Updated description'
      };

      validateZoneUpdate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Updated Zone');
      expect(req.body.description).toBe('Updated description');
    });

    test('should pass validation with only name', () => {
      req.body = {
        name: 'Updated Zone'
      };

      validateZoneUpdate(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should pass validation with only description', () => {
      req.body = {
        description: 'Updated description'
      };

      validateZoneUpdate(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should return 400 when no fields provided', () => {
      req.body = {};

      validateZoneUpdate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          general: ['At least one field (name or description) must be provided for update']
        }
      });
    });

    test('should return 400 for invalid name', () => {
      req.body = {
        name: 'invalid@name'
      };

      validateZoneUpdate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          name: expect.arrayContaining([VALIDATION_RULES.ZONE_NAME.DESCRIPTION])
        }
      });
    });

    test('should sanitize provided fields', () => {
      req.body = {
        name: '  Updated Zone  ',
        description: '<b>Bold</b> description'
      };

      validateZoneUpdate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe('Updated Zone');
      expect(req.body.description).not.toContain('<b>');
    });
  });

  describe('validateZoneIdParam middleware', () => {
    test('should pass validation with valid zone ID', () => {
      req.params.id = 'zone-123';

      validateZoneIdParam(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.params.id).toBe('zone-123');
    });

    test('should return 400 for missing zone ID', () => {
      req.params.id = '';

      validateZoneIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Zone ID is required',
        error: 'ZONE_ID_REQUIRED'
      });
    });

    test('should return 400 for invalid zone ID format', () => {
      req.params.id = 'invalid@id';

      validateZoneIdParam(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid zone ID format',
        error: 'INVALID_ZONE_ID',
        errors: {
          id: expect.arrayContaining([VALIDATION_RULES.ZONE_ID.DESCRIPTION])
        }
      });
    });

    test('should sanitize zone ID', () => {
      req.params.id = '  zone-123  ';

      validateZoneIdParam(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.params.id).toBe('zone-123');
    });
  });

  describe('validateZoneParentChange middleware', () => {
    test('should pass validation with valid data', () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'parent-456';

      validateZoneParentChange(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.parentZoneId).toBe('parent-456');
    });

    test('should pass validation with null parent (move to root)', () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = null;

      validateZoneParentChange(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should return 400 for self-assignment', () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'zone-123';

      validateZoneParentChange(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          parentZoneId: ['Zone cannot be its own parent']
        }
      });
    });

    test('should return 400 for invalid zone ID', () => {
      req.params.id = 'invalid@id';
      req.body.parentZoneId = 'parent-456';

      validateZoneParentChange(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          zoneId: expect.arrayContaining([VALIDATION_RULES.ZONE_ID.DESCRIPTION])
        }
      });
    });

    test('should return 400 for invalid parent zone ID', () => {
      req.params.id = 'zone-123';
      req.body.parentZoneId = 'invalid@parent';

      validateZoneParentChange(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors: {
          parentZoneId: expect.arrayContaining([VALIDATION_RULES.ZONE_ID.DESCRIPTION])
        }
      });
    });
  });

  describe('validateZoneQuery middleware', () => {
    test('should pass validation with valid query parameters', () => {
      req.query = {
        includeHierarchy: 'true',
        parentId: 'parent-123',
        armed: 'false',
        limit: '10'
      };

      validateZoneQuery(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should pass validation with root parent filter', () => {
      req.query = {
        parentId: 'root'
      };

      validateZoneQuery(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should return 400 for invalid includeHierarchy', () => {
      req.query.includeHierarchy = 'invalid';

      validateZoneQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter validation failed',
        error: 'QUERY_VALIDATION_FAILED',
        errors: {
          includeHierarchy: ['includeHierarchy must be "true" or "false"']
        }
      });
    });

    test('should return 400 for invalid parentId', () => {
      req.query.parentId = 'invalid@parent';

      validateZoneQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter validation failed',
        error: 'QUERY_VALIDATION_FAILED',
        errors: {
          parentId: expect.arrayContaining([VALIDATION_RULES.ZONE_ID.DESCRIPTION])
        }
      });
    });

    test('should return 400 for invalid armed parameter', () => {
      req.query.armed = 'invalid';

      validateZoneQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter validation failed',
        error: 'QUERY_VALIDATION_FAILED',
        errors: {
          armed: ['armed must be "true" or "false"']
        }
      });
    });

    test('should return 400 for invalid limit', () => {
      const invalidLimits = ['invalid', '-1', '0', '1001'];

      invalidLimits.forEach(limit => {
        req.query = { limit };
        res.status.mockClear();
        res.json.mockClear();
        next.mockClear();

        validateZoneQuery(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Query parameter validation failed',
          error: 'QUERY_VALIDATION_FAILED',
          errors: {
            limit: ['limit must be a number between 1 and 1000']
          }
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    test('should pass validation with valid limit values', () => {
      const validLimits = ['1', '50', '100', '1000'];

      validLimits.forEach(limit => {
        req.query = { limit };
        res.status.mockClear();
        res.json.mockClear();
        next.mockClear();

        validateZoneQuery(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    test('should handle multiple validation errors', () => {
      req.query = {
        includeHierarchy: 'invalid',
        armed: 'invalid',
        limit: 'invalid'
      };

      validateZoneQuery(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter validation failed',
        error: 'QUERY_VALIDATION_FAILED',
        errors: {
          includeHierarchy: ['includeHierarchy must be "true" or "false"'],
          armed: ['armed must be "true" or "false"'],
          limit: ['limit must be a number between 1 and 1000']
        }
      });
    });
  });

  describe('error handling', () => {
    test('should handle exceptions in validation functions', () => {
      // Mock console.error to avoid log output during tests
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force an error by making req.body null
      req.body = null;

      validateZoneCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation process failed',
        error: 'VALIDATION_PROCESS_FAILED'
      });

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('security considerations', () => {
    test('should prevent XSS in zone names', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>'
      ];

      xssAttempts.forEach(xss => {
        const result = validateZoneName(xss);
        expect(result.isValid).toBe(false);
        expect(result.sanitizedValue).not.toContain('<script>');
        expect(result.sanitizedValue).not.toContain('javascript:');
        expect(result.sanitizedValue).not.toContain('onerror');
        expect(result.sanitizedValue).not.toContain('onload');
      });
    });

    test('should prevent SQL injection patterns', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE zones; --",
        "' OR '1'='1",
        "UNION SELECT * FROM users",
        "1' AND 1=1 --"
      ];

      sqlInjectionAttempts.forEach(sql => {
        const result = validateZoneName(sql);
        expect(result.isValid).toBe(false);
      });
    });

    test('should sanitize dangerous content from descriptions', () => {
      const dangerousContent = '<script>fetch("/api/admin").then(r=>r.json())</script>Description';
      const result = validateZoneDescription(dangerousContent);
      
      expect(result.isValid).toBe(false);
      expect(result.sanitizedValue).not.toContain('<script>');
      expect(result.sanitizedValue).not.toContain('fetch');
    });
  });

  describe('validation rules constants', () => {
    test('should have proper validation rule structure', () => {
      expect(VALIDATION_RULES).toBeDefined();
      expect(VALIDATION_RULES.ZONE_NAME).toBeDefined();
      expect(VALIDATION_RULES.ZONE_NAME.MIN_LENGTH).toBe(1);
      expect(VALIDATION_RULES.ZONE_NAME.MAX_LENGTH).toBe(100);
      expect(VALIDATION_RULES.ZONE_NAME.PATTERN).toBeInstanceOf(RegExp);
      
      expect(VALIDATION_RULES.ZONE_DESCRIPTION).toBeDefined();
      expect(VALIDATION_RULES.ZONE_DESCRIPTION.MAX_LENGTH).toBe(200);
      
      expect(VALIDATION_RULES.ZONE_ID).toBeDefined();
      expect(VALIDATION_RULES.ZONE_ID.PATTERN).toBeInstanceOf(RegExp);
    });
  });
});