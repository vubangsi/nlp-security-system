/**
 * Zone Input Validation Middleware
 * 
 * Comprehensive input validation and sanitization for zone operations
 * Prevents injection attacks and ensures data integrity
 */

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Validation constants and patterns
 */
const VALIDATION_RULES = {
  ZONE_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
    DESCRIPTION: 'Zone names must contain only alphanumeric characters, spaces, hyphens, and underscores'
  },
  ZONE_DESCRIPTION: {
    MAX_LENGTH: 200,
    DESCRIPTION: 'Zone descriptions must be 200 characters or less'
  },
  ZONE_ID: {
    PATTERN: /^[a-zA-Z0-9\-_]{1,50}$/,
    DESCRIPTION: 'Zone IDs must be alphanumeric with hyphens and underscores, 1-50 characters'
  },
  HIERARCHY_DEPTH: {
    MAX_DEPTH: 5,
    DESCRIPTION: 'Zone hierarchy cannot exceed 5 levels deep'
  },
  USER_ZONE_LIMIT: {
    MAX_ZONES: 50,
    DESCRIPTION: 'Users cannot create more than 50 zones'
  }
};

/**
 * Sanitize string input to prevent XSS and injection attacks
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input, options = {}) => {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove HTML tags and dangerous content
  let sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [] 
  });

  // Trim whitespace
  sanitized = sanitized.trim();

  // Additional sanitization based on options
  if (options.escapeHtml) {
    sanitized = validator.escape(sanitized);
  }

  if (options.removeSpecialChars) {
    sanitized = sanitized.replace(/[<>\"';&]/g, '');
  }

  return sanitized;
};

/**
 * Validate zone name format and content
 * @param {string} name - Zone name to validate
 * @returns {Object} Validation result
 */
const validateZoneName = (name) => {
  const errors = [];

  if (!name || typeof name !== 'string') {
    errors.push('Zone name is required and must be a string');
    return { isValid: false, errors };
  }

  const sanitizedName = sanitizeInput(name, { removeSpecialChars: true });

  if (sanitizedName.length < VALIDATION_RULES.ZONE_NAME.MIN_LENGTH) {
    errors.push(`Zone name must be at least ${VALIDATION_RULES.ZONE_NAME.MIN_LENGTH} character long`);
  }

  if (sanitizedName.length > VALIDATION_RULES.ZONE_NAME.MAX_LENGTH) {
    errors.push(`Zone name must be ${VALIDATION_RULES.ZONE_NAME.MAX_LENGTH} characters or less`);
  }

  if (!VALIDATION_RULES.ZONE_NAME.PATTERN.test(sanitizedName)) {
    errors.push(VALIDATION_RULES.ZONE_NAME.DESCRIPTION);
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /onclick/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitizedName)) {
      errors.push('Zone name contains potentially dangerous content');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedName
  };
};

/**
 * Validate zone description
 * @param {string} description - Zone description to validate
 * @returns {Object} Validation result
 */
const validateZoneDescription = (description) => {
  const errors = [];

  if (description === undefined || description === null) {
    return { isValid: true, errors: [], sanitizedValue: '' };
  }

  if (typeof description !== 'string') {
    errors.push('Zone description must be a string');
    return { isValid: false, errors };
  }

  const sanitizedDescription = sanitizeInput(description, { escapeHtml: true });

  if (sanitizedDescription.length > VALIDATION_RULES.ZONE_DESCRIPTION.MAX_LENGTH) {
    errors.push(VALIDATION_RULES.ZONE_DESCRIPTION.DESCRIPTION);
  }

  // Check for script injection attempts
  const scriptPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(description)) {
      errors.push('Zone description contains potentially dangerous content');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedDescription
  };
};

/**
 * Validate zone ID format
 * @param {string} zoneId - Zone ID to validate
 * @returns {Object} Validation result
 */
const validateZoneId = (zoneId) => {
  const errors = [];

  if (!zoneId || typeof zoneId !== 'string') {
    errors.push('Zone ID is required and must be a string');
    return { isValid: false, errors };
  }

  const sanitizedId = sanitizeInput(zoneId, { removeSpecialChars: true });

  if (!VALIDATION_RULES.ZONE_ID.PATTERN.test(sanitizedId)) {
    errors.push(VALIDATION_RULES.ZONE_ID.DESCRIPTION);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedId
  };
};

/**
 * Middleware to validate zone creation data
 */
const validateZoneCreation = (req, res, next) => {
  try {
    const { name, description, parentZoneId } = req.body;
    const errors = {};

    // Validate zone name
    const nameValidation = validateZoneName(name);
    if (!nameValidation.isValid) {
      errors.name = nameValidation.errors;
    }

    // Validate zone description
    const descriptionValidation = validateZoneDescription(description);
    if (!descriptionValidation.isValid) {
      errors.description = descriptionValidation.errors;
    }

    // Validate parent zone ID if provided
    if (parentZoneId) {
      const parentIdValidation = validateZoneId(parentZoneId);
      if (!parentIdValidation.isValid) {
        errors.parentZoneId = parentIdValidation.errors;
      }
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors
      });
    }

    // Update request body with sanitized values
    req.body.name = nameValidation.sanitizedValue;
    req.body.description = descriptionValidation.sanitizedValue;
    if (parentZoneId) {
      req.body.parentZoneId = validateZoneId(parentZoneId).sanitizedValue;
    }

    next();
  } catch (error) {
    console.error('Zone creation validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation process failed',
      error: 'VALIDATION_PROCESS_FAILED'
    });
  }
};

/**
 * Middleware to validate zone update data
 */
const validateZoneUpdate = (req, res, next) => {
  try {
    const { name, description } = req.body;
    const errors = {};

    // Validate zone name if provided
    if (name !== undefined) {
      const nameValidation = validateZoneName(name);
      if (!nameValidation.isValid) {
        errors.name = nameValidation.errors;
      } else {
        req.body.name = nameValidation.sanitizedValue;
      }
    }

    // Validate zone description if provided
    if (description !== undefined) {
      const descriptionValidation = validateZoneDescription(description);
      if (!descriptionValidation.isValid) {
        errors.description = descriptionValidation.errors;
      } else {
        req.body.description = descriptionValidation.sanitizedValue;
      }
    }

    // Check if at least one field is provided
    if (name === undefined && description === undefined) {
      errors.general = ['At least one field (name or description) must be provided for update'];
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Zone update validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation process failed',
      error: 'VALIDATION_PROCESS_FAILED'
    });
  }
};

/**
 * Middleware to validate zone ID in URL parameters
 */
const validateZoneIdParam = (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Zone ID is required',
        error: 'ZONE_ID_REQUIRED'
      });
    }

    const idValidation = validateZoneId(id);
    if (!idValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid zone ID format',
        error: 'INVALID_ZONE_ID',
        errors: {
          id: idValidation.errors
        }
      });
    }

    // Update params with sanitized value
    req.params.id = idValidation.sanitizedValue;

    next();
  } catch (error) {
    console.error('Zone ID validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Zone ID validation failed',
      error: 'ZONE_ID_VALIDATION_FAILED'
    });
  }
};

/**
 * Middleware to validate parent zone change data
 */
const validateZoneParentChange = (req, res, next) => {
  try {
    const { parentZoneId } = req.body;
    const { id: zoneId } = req.params;
    const errors = {};

    // Validate current zone ID
    const zoneIdValidation = validateZoneId(zoneId);
    if (!zoneIdValidation.isValid) {
      errors.zoneId = zoneIdValidation.errors;
    }

    // Validate parent zone ID if provided
    if (parentZoneId) {
      const parentIdValidation = validateZoneId(parentZoneId);
      if (!parentIdValidation.isValid) {
        errors.parentZoneId = parentIdValidation.errors;
      }

      // Check for self-assignment
      if (parentZoneId === zoneId) {
        errors.parentZoneId = ['Zone cannot be its own parent'];
      }
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_FAILED',
        errors
      });
    }

    // Update request with sanitized values
    if (parentZoneId) {
      req.body.parentZoneId = validateZoneId(parentZoneId).sanitizedValue;
    }

    next();
  } catch (error) {
    console.error('Zone parent change validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Parent change validation failed',
      error: 'PARENT_CHANGE_VALIDATION_FAILED'
    });
  }
};

/**
 * Middleware to validate query parameters for zone listing
 */
const validateZoneQuery = (req, res, next) => {
  try {
    const { includeHierarchy, parentId, armed, limit } = req.query;
    const errors = {};

    // Validate includeHierarchy
    if (includeHierarchy && !['true', 'false'].includes(includeHierarchy)) {
      errors.includeHierarchy = ['includeHierarchy must be "true" or "false"'];
    }

    // Validate parentId
    if (parentId && parentId !== 'root') {
      const parentIdValidation = validateZoneId(parentId);
      if (!parentIdValidation.isValid) {
        errors.parentId = parentIdValidation.errors;
      }
    }

    // Validate armed status
    if (armed && !['true', 'false'].includes(armed)) {
      errors.armed = ['armed must be "true" or "false"'];
    }

    // Validate limit
    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        errors.limit = ['limit must be a number between 1 and 1000'];
      }
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter validation failed',
        error: 'QUERY_VALIDATION_FAILED',
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Zone query validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Query validation failed',
      error: 'QUERY_VALIDATION_FAILED'
    });
  }
};

module.exports = {
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
};