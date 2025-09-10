// Test setup configuration
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.ADMIN_PIN = '0000';
process.env.GROQ_API_KEY = 'test_key';
process.env.GROQ_MODEL = 'test_model';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
