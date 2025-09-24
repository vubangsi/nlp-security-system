/**
 * Schedule Validation Middleware
 * 
 * Provides comprehensive validation middleware for schedule management endpoints.
 * Follows the same patterns as existing validation middleware in the system.
 * Validates request parameters, body data, and query parameters for schedule operations.
 */

/**
 * Validate schedule ID parameter
 * Ensures the schedule ID is present and follows expected format
 */
const validateScheduleIdParam = (req, res, next) => {
  const { id } = req.params;

  // Check if ID is provided
  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Schedule ID is required',
      errors: {
        id: 'Schedule ID parameter is required'
      }
    });
  }

  // Check if ID is a valid string (basic validation)
  if (typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Schedule ID must be a valid non-empty string',
      errors: {
        id: 'Schedule ID must be a valid non-empty string'
      }
    });
  }

  // Check ID length (reasonable bounds)
  if (id.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Schedule ID is too long',
      errors: {
        id: 'Schedule ID must be 100 characters or less'
      }
    });
  }

  // Sanitize the ID
  req.params.id = id.trim();
  next();
};

/**
 * Validate schedule creation request
 * Validates all required fields and formats for creating a new schedule
 */
const validateScheduleCreation = (req, res, next) => {
  const { scheduleExpression, actionType, actionParameters, description, enabled } = req.body;
  const errors = {};

  // Validate required fields
  if (!scheduleExpression) {
    errors.scheduleExpression = 'Schedule expression is required';
  } else if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
    errors.scheduleExpression = 'Schedule expression must be a non-empty string';
  } else if (scheduleExpression.trim().length > 200) {
    errors.scheduleExpression = 'Schedule expression must be 200 characters or less';
  }

  if (!actionType) {
    errors.actionType = 'Action type is required';
  } else if (typeof actionType !== 'string') {
    errors.actionType = 'Action type must be a string';
  } else {
    const validActionTypes = ['ARM', 'DISARM'];
    if (!validActionTypes.includes(actionType.toUpperCase())) {
      errors.actionType = `Action type must be one of: ${validActionTypes.join(', ')}`;
    }
  }

  // Validate optional fields
  if (actionParameters !== undefined) {
    if (typeof actionParameters !== 'object' || Array.isArray(actionParameters)) {
      errors.actionParameters = 'Action parameters must be an object';
    } else {
      // Check for reasonable size limits
      const jsonString = JSON.stringify(actionParameters);
      if (jsonString.length > 5000) {
        errors.actionParameters = 'Action parameters are too large (max 5000 characters when serialized)';
      }
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.description = 'Description must be a string';
    } else if (description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
  }

  if (enabled !== undefined && typeof enabled !== 'boolean') {
    errors.enabled = 'Enabled flag must be a boolean value';
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Sanitize and normalize the input
  if (scheduleExpression) req.body.scheduleExpression = scheduleExpression.trim();
  if (actionType) req.body.actionType = actionType.toUpperCase();
  if (description) req.body.description = description.trim();

  next();
};

/**
 * Validate schedule update request
 * Validates fields for updating an existing schedule
 */
const validateScheduleUpdate = (req, res, next) => {
  const { scheduleExpression, actionParameters, description, enabled, status } = req.body;
  const errors = {};
  const isAdmin = req.user && req.user.role === 'admin';

  // Check that at least one field is provided
  if (scheduleExpression === undefined && actionParameters === undefined && 
      description === undefined && enabled === undefined && status === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one field must be provided for update',
      errors: {
        general: 'At least one field must be provided for update'
      }
    });
  }

  // Validate schedule expression if provided
  if (scheduleExpression !== undefined) {
    if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
      errors.scheduleExpression = 'Schedule expression must be a non-empty string';
    } else if (scheduleExpression.trim().length > 200) {
      errors.scheduleExpression = 'Schedule expression must be 200 characters or less';
    }
  }

  // Validate action parameters if provided
  if (actionParameters !== undefined) {
    if (typeof actionParameters !== 'object' || Array.isArray(actionParameters)) {
      errors.actionParameters = 'Action parameters must be an object';
    } else {
      const jsonString = JSON.stringify(actionParameters);
      if (jsonString.length > 5000) {
        errors.actionParameters = 'Action parameters are too large (max 5000 characters when serialized)';
      }
    }
  }

  // Validate description if provided
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.description = 'Description must be a string';
    } else if (description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
  }

  // Validate enabled flag if provided
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    errors.enabled = 'Enabled flag must be a boolean value';
  }

  // Validate status if provided (admin only)
  if (status !== undefined) {
    if (!isAdmin) {
      errors.status = 'Only administrators can update schedule status';
    } else if (typeof status !== 'string') {
      errors.status = 'Status must be a string';
    } else {
      const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
      }
    }
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Sanitize and normalize the input
  if (scheduleExpression !== undefined) req.body.scheduleExpression = scheduleExpression.trim();
  if (description !== undefined) req.body.description = description.trim();
  if (status !== undefined) req.body.status = status.toUpperCase();

  next();
};

/**
 * Validate schedule query parameters
 * Validates query parameters for listing and filtering schedules
 */
const validateScheduleQuery = (req, res, next) => {
  const { status, actionType, enabled, upcoming, limit, offset, sortBy, sortOrder, includeAllUsers } = req.query;
  const errors = {};
  const isAdmin = req.user && req.user.role === 'admin';

  // Validate status filter
  if (status !== undefined) {
    const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  // Validate action type filter
  if (actionType !== undefined) {
    const validActionTypes = ['ARM', 'DISARM'];
    if (!validActionTypes.includes(actionType.toUpperCase())) {
      errors.actionType = `Action type must be one of: ${validActionTypes.join(', ')}`;
    }
  }

  // Validate enabled filter
  if (enabled !== undefined) {
    if (!['true', 'false'].includes(enabled.toLowerCase())) {
      errors.enabled = 'Enabled must be true or false';
    }
  }

  // Validate upcoming filter
  if (upcoming !== undefined) {
    if (!['true', 'false'].includes(upcoming.toLowerCase())) {
      errors.upcoming = 'Upcoming must be true or false';
    }
  }

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      errors.limit = 'Limit must be a number between 1 and 200';
    }
  }

  // Validate offset
  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.offset = 'Offset must be a non-negative number';
    }
  }

  // Validate sortBy
  if (sortBy !== undefined) {
    const validSortFields = ['createdAt', 'nextExecution', 'status', 'actionType'];
    if (!validSortFields.includes(sortBy)) {
      errors.sortBy = `Sort field must be one of: ${validSortFields.join(', ')}`;
    }
  }

  // Validate sortOrder
  if (sortOrder !== undefined) {
    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      errors.sortOrder = `Sort order must be one of: ${validSortOrders.join(', ')}`;
    }
  }

  // Validate includeAllUsers (admin only)
  if (includeAllUsers !== undefined) {
    if (!isAdmin) {
      errors.includeAllUsers = 'Only administrators can access all users\' schedules';
    } else if (!['true', 'false'].includes(includeAllUsers.toLowerCase())) {
      errors.includeAllUsers = 'includeAllUsers must be true or false';
    }
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors
    });
  }

  next();
};

/**
 * Validate bulk schedule creation request
 * Validates the bulk creation payload
 */
const validateBulkScheduleCreation = (req, res, next) => {
  const { schedules } = req.body;
  const errors = {};

  // Validate schedules array
  if (!schedules) {
    errors.schedules = 'Schedules array is required';
  } else if (!Array.isArray(schedules)) {
    errors.schedules = 'Schedules must be an array';
  } else if (schedules.length === 0) {
    errors.schedules = 'At least one schedule must be provided';
  } else if (schedules.length > 50) {
    errors.schedules = 'Cannot create more than 50 schedules at once';
  } else {
    // Validate each schedule in the array
    schedules.forEach((schedule, index) => {
      const scheduleErrors = {};

      // Validate required fields for each schedule
      if (!schedule.scheduleExpression) {
        scheduleErrors.scheduleExpression = 'Schedule expression is required';
      } else if (typeof schedule.scheduleExpression !== 'string' || schedule.scheduleExpression.trim().length === 0) {
        scheduleErrors.scheduleExpression = 'Schedule expression must be a non-empty string';
      }

      if (!schedule.actionType) {
        scheduleErrors.actionType = 'Action type is required';
      } else if (typeof schedule.actionType !== 'string') {
        scheduleErrors.actionType = 'Action type must be a string';
      } else {
        const validActionTypes = ['ARM', 'DISARM'];
        if (!validActionTypes.includes(schedule.actionType.toUpperCase())) {
          scheduleErrors.actionType = `Action type must be one of: ${validActionTypes.join(', ')}`;
        }
      }

      // Validate optional fields
      if (schedule.description !== undefined && typeof schedule.description !== 'string') {
        scheduleErrors.description = 'Description must be a string';
      }

      if (schedule.enabled !== undefined && typeof schedule.enabled !== 'boolean') {
        scheduleErrors.enabled = 'Enabled flag must be a boolean value';
      }

      // If there are errors for this schedule, add them to the main errors object
      if (Object.keys(scheduleErrors).length > 0) {
        errors[`schedule_${index}`] = scheduleErrors;
      }
    });
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Bulk schedule validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate bulk schedule deletion request
 * Validates the bulk deletion payload
 */
const validateBulkScheduleDeletion = (req, res, next) => {
  const { scheduleIds, criteria } = req.body;
  const errors = {};

  // Must provide either scheduleIds or criteria
  if (!scheduleIds && !criteria) {
    errors.general = 'Either scheduleIds or criteria must be provided';
  }

  // Validate scheduleIds if provided
  if (scheduleIds !== undefined) {
    if (!Array.isArray(scheduleIds)) {
      errors.scheduleIds = 'scheduleIds must be an array';
    } else if (scheduleIds.length === 0) {
      errors.scheduleIds = 'scheduleIds array cannot be empty if provided';
    } else if (scheduleIds.length > 100) {
      errors.scheduleIds = 'Cannot delete more than 100 schedules at once';
    } else {
      // Validate each ID
      scheduleIds.forEach((id, index) => {
        if (typeof id !== 'string' || id.trim().length === 0) {
          errors[`scheduleId_${index}`] = `Schedule ID at index ${index} must be a non-empty string`;
        }
      });
    }
  }

  // Validate criteria if provided
  if (criteria !== undefined) {
    if (typeof criteria !== 'object' || Array.isArray(criteria)) {
      errors.criteria = 'Criteria must be an object';
    } else {
      // Validate criteria fields
      if (criteria.status !== undefined) {
        const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(criteria.status.toUpperCase())) {
          errors['criteria.status'] = `Status must be one of: ${validStatuses.join(', ')}`;
        }
      }

      if (criteria.actionType !== undefined) {
        const validActionTypes = ['ARM', 'DISARM'];
        if (!validActionTypes.includes(criteria.actionType.toUpperCase())) {
          errors['criteria.actionType'] = `Action type must be one of: ${validActionTypes.join(', ')}`;
        }
      }

      if (criteria.enabled !== undefined && typeof criteria.enabled !== 'boolean') {
        errors['criteria.enabled'] = 'Enabled flag must be a boolean value';
      }

      if (criteria.days !== undefined) {
        if (!Array.isArray(criteria.days)) {
          errors['criteria.days'] = 'Days must be an array';
        } else {
          const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
          criteria.days.forEach((day, index) => {
            if (!validDays.includes(day.toUpperCase())) {
              errors[`criteria.days_${index}`] = `Day at index ${index} must be one of: ${validDays.join(', ')}`;
            }
          });
        }
      }
    }
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Bulk deletion validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate schedule expression test request
 * Validates the test schedule expression payload
 */
const validateScheduleExpressionTest = (req, res, next) => {
  const { scheduleExpression } = req.body;
  const errors = {};

  // Validate schedule expression
  if (!scheduleExpression) {
    errors.scheduleExpression = 'Schedule expression is required';
  } else if (typeof scheduleExpression !== 'string' || scheduleExpression.trim().length === 0) {
    errors.scheduleExpression = 'Schedule expression must be a non-empty string';
  } else if (scheduleExpression.trim().length > 200) {
    errors.scheduleExpression = 'Schedule expression must be 200 characters or less';
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Schedule expression validation failed',
      errors
    });
  }

  // Sanitize the input
  req.body.scheduleExpression = scheduleExpression.trim();

  next();
};

/**
 * Validate upcoming schedules query parameters
 * Validates query parameters for getting upcoming schedules
 */
const validateUpcomingSchedulesQuery = (req, res, next) => {
  const { days, limit, includeAllUsers } = req.query;
  const errors = {};
  const isAdmin = req.user && req.user.role === 'admin';

  // Validate days parameter
  if (days !== undefined) {
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      errors.days = 'Days must be a number between 1 and 30';
    }
  }

  // Validate limit parameter
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      errors.limit = 'Limit must be a number between 1 and 500';
    }
  }

  // Validate includeAllUsers (admin only)
  if (includeAllUsers !== undefined) {
    if (!isAdmin) {
      errors.includeAllUsers = 'Only administrators can access all users\' schedules';
    } else if (!['true', 'false'].includes(includeAllUsers.toLowerCase())) {
      errors.includeAllUsers = 'includeAllUsers must be true or false';
    }
  }

  // Return validation errors if any
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors
    });
  }

  next();
};

module.exports = {
  validateScheduleIdParam,
  validateScheduleCreation,
  validateScheduleUpdate,
  validateScheduleQuery,
  validateBulkScheduleCreation,
  validateBulkScheduleDeletion,
  validateScheduleExpressionTest,
  validateUpcomingSchedulesQuery
};