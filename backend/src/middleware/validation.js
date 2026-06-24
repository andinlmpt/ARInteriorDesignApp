/**
 * Request validation middleware
 * Provides comprehensive input validation and sanitization
 */

const ROOM_TYPES = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office', 'Dining Room', 'Kids Room', 'Outdoor'];
const DESIGN_MOODS = ['Cozy', 'Minimalist', 'Vibrant', 'Calm', 'Luxurious', 'Rustic', 'Playful', 'Professional'];
const DESIGN_STYLES = ['Modern', 'Contemporary', 'Minimalist', 'Scandinavian', 'Industrial', 'Bohemian', 'Traditional', 'Rustic', 'Mid-Century', 'Eclectic'];
const BUDGET_VALUES = ['low', 'medium', 'high', 'luxury'];

/**
 * Generic request validation middleware
 * @param {Object} schema - Validation schema with body, params, query properties
 * @returns {Function} Express middleware function
 */
export function validateRequest(schema = {}) {
  return (req, res, next) => {
    const errors = [];

    // Validate body
    if (schema.body) {
      const bodyErrors = validateObject(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    // Validate params
    if (schema.params) {
      const paramsErrors = validateObject(req.params, schema.params, 'params');
      errors.push(...paramsErrors);
    }

    // Validate query
    if (schema.query) {
      const queryErrors = validateObject(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        errors,
      });
    }

    next();
  };
}

/**
 * Validate an object against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @param {string} prefix - Prefix for error messages (body, params, query)
 * @returns {Array} Array of error messages
 */
function validateObject(data, schema, prefix = '') {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldPath,
        message: `${fieldPath} is required`,
      });
      continue;
    }

    // Skip validation if field is not required and not present
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    if (rules.type && value !== undefined && value !== null) {
      const typeCheck = validateType(value, rules.type);
      if (!typeCheck.valid) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be of type ${rules.type}, received ${typeCheck.actualType}`,
        });
        continue;
      }
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be at least ${rules.minLength} characters`,
        });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be at most ${rules.maxLength} characters`,
        });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} does not match required pattern`,
        });
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be one of: ${rules.enum.join(', ')}`,
        });
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be at least ${rules.min}`,
        });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must be at most ${rules.max}`,
        });
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must have at least ${rules.minItems} items`,
        });
      }
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push({
          field: fieldPath,
          message: `${fieldPath} must have at most ${rules.maxItems} items`,
        });
      }
    }

    // Custom validation function
    if (rules.validate && typeof rules.validate === 'function') {
      try {
        const customResult = rules.validate(value);
        if (customResult !== true && typeof customResult === 'string') {
          errors.push({
            field: fieldPath,
            message: customResult,
          });
        }
      } catch (error) {
        errors.push({
          field: fieldPath,
          message: `Custom validation failed: ${error.message}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate value type
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type
 * @returns {Object} Validation result
 */
function validateType(value, expectedType) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  
  if (expectedType === 'array' && Array.isArray(value)) {
    return { valid: true, actualType: 'array' };
  }
  
  if (expectedType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { valid: true, actualType: 'object' };
  }
  
  if (actualType === expectedType) {
    return { valid: true, actualType };
  }
  
  return { valid: false, actualType };
}

/**
 * Sanitize string input to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Sanitize object recursively
 * @param {*} obj - Object to sanitize
 * @returns {*} Sanitized object
 */
export function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

export function validateLayoutRequest(req, res, next) {
  const { constraints, context } = req.body;

  // Validate room dimensions
  if (!constraints?.room_dimensions) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'room_dimensions are required in constraints',
    });
  }

  const { width, length, height } = constraints.room_dimensions;

  if (typeof width !== 'number' || typeof length !== 'number' || typeof height !== 'number') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'room_dimensions must contain numeric width, length, and height',
    });
  }

  if (width <= 0 || length <= 0 || height <= 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'room_dimensions must be positive numbers',
    });
  }

  if (width > 50 || length > 50 || height > 10) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'room_dimensions are unreasonably large',
    });
  }

  // Validate walkway clearance if provided
  if (constraints.walkway_clearance !== undefined) {
    if (typeof constraints.walkway_clearance !== 'number' || constraints.walkway_clearance < 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'walkway_clearance must be a non-negative number',
      });
    }
  }

  next();
}

/**
 * Validate theme recommendation request
 */
export function validateThemeRecommendationRequest(req, res, next) {
  const { room_type, mood, style, budget, colors, user_history } = req.query;

  // Required parameters
  if (!room_type || !mood || !style) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'room_type, mood, and style are required',
      received: { room_type: !!room_type, mood: !!mood, style: !!style },
    });
  }

  // Validate room_type
  if (!ROOM_TYPES.includes(room_type)) {
    return res.status(400).json({
      error: 'Invalid room_type',
      message: `room_type must be one of: ${ROOM_TYPES.join(', ')}`,
      received: room_type,
    });
  }

  // Validate mood
  if (!DESIGN_MOODS.includes(mood)) {
    return res.status(400).json({
      error: 'Invalid mood',
      message: `mood must be one of: ${DESIGN_MOODS.join(', ')}`,
      received: mood,
    });
  }

  // Validate style
  if (!DESIGN_STYLES.includes(style)) {
    return res.status(400).json({
      error: 'Invalid style',
      message: `style must be one of: ${DESIGN_STYLES.join(', ')}`,
      received: style,
    });
  }

  // Validate budget if provided
  if (budget && !BUDGET_VALUES.includes(budget)) {
    return res.status(400).json({
      error: 'Invalid budget',
      message: `budget must be one of: ${BUDGET_VALUES.join(', ')}`,
      received: budget,
    });
  }

  // Validate colors if provided
  if (colors) {
    const colorArray = colors.split(',');
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const invalidColors = colorArray.filter(color => !hexColorRegex.test(color.trim()));
    
    if (invalidColors.length > 0) {
      return res.status(400).json({
        error: 'Invalid color format',
        message: 'Colors must be valid hex codes (e.g., #FF0000)',
        invalidColors,
      });
    }
  }

  // Validate user_history if provided
  if (user_history) {
    try {
      const parsed = JSON.parse(user_history);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('user_history must be an object');
      }
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid user_history',
        message: 'user_history must be a valid JSON object',
        details: parseError.message,
      });
    }
  }

  next();
}

/**
 * Validate theme feedback request
 */
export function validateThemeFeedbackRequest(req, res, next) {
  const { themeId, action, timestamp } = req.body;

  if (!themeId || typeof themeId !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid themeId',
      message: 'themeId is required and must be a string',
    });
  }

  const validActions = ['like', 'dislike', 'apply', 'view'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({
      error: 'Invalid action',
      message: `action must be one of: ${validActions.join(', ')}`,
      received: action,
    });
  }

  if (timestamp !== undefined && (typeof timestamp !== 'number' || timestamp < 0)) {
    return res.status(400).json({
      error: 'Invalid timestamp',
      message: 'timestamp must be a non-negative number',
    });
  }

  next();
}

