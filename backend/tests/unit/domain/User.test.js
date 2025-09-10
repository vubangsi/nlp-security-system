const User = require('../../../src/domain/entities/User');

describe('User Entity', () => {
  describe('constructor', () => {
    test('should create User with required fields', () => {
      const user = new User('123', 'Admin User', '0000', 'admin');

      expect(user.id).toBe('123');
      expect(user.name).toBe('Admin User');
      expect(user.pin).toBe('0000');
      expect(user.role).toBe('admin');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    test('should create User with default role', () => {
      const user = new User('123', 'Regular User', '1234');

      expect(user.role).toBe('user');
      expect(user.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('isAdmin', () => {
    test('should return true for admin role', () => {
      const user = new User('123', 'Admin User', '0000', 'admin');
      expect(user.isAdmin()).toBe(true);
    });

    test('should return false for non-admin role', () => {
      const user = new User('123', 'Regular User', '1234', 'user');
      expect(user.isAdmin()).toBe(false);
    });
  });

  describe('validatePin', () => {
    test('should return true for correct PIN', () => {
      const user = new User('123', 'Admin User', '0000', 'admin');
      expect(user.validatePin('0000')).toBe(true);
    });

    test('should return false for incorrect PIN', () => {
      const user = new User('123', 'Admin User', '0000', 'admin');
      expect(user.validatePin('1234')).toBe(false);
    });
  });

  describe('toJSON', () => {
    test('should return JSON representation without PIN', () => {
      const user = new User('123', 'Admin User', '0000', 'admin');
      const json = user.toJSON();

      expect(json).toEqual({
        id: '123',
        name: 'Admin User',
        role: 'admin',
        createdAt: expect.any(Date)
      });
      expect(json.pin).toBeUndefined();
    });
  });
});
