const SystemState = require('../../../src/domain/entities/SystemState');

describe('SystemState Entity', () => {
  describe('constructor', () => {
    test('should create SystemState with default values', () => {
      const systemState = new SystemState();

      expect(systemState.armed).toBe(false);
      expect(systemState.mode).toBe(null);
      expect(systemState.lastModified).toBeInstanceOf(Date);
      expect(systemState.modifiedBy).toBe(null);
    });
  });

  describe('arm', () => {
    test('should arm system in away mode', () => {
      const systemState = new SystemState();
      systemState.arm('away', 'admin');

      expect(systemState.armed).toBe(true);
      expect(systemState.mode).toBe('away');
      expect(systemState.modifiedBy).toBe('admin');
      expect(systemState.lastModified).toBeInstanceOf(Date);
    });

    test('should arm system in stay mode', () => {
      const systemState = new SystemState();
      systemState.arm('stay', 'admin');

      expect(systemState.armed).toBe(true);
      expect(systemState.mode).toBe('stay');
      expect(systemState.modifiedBy).toBe('admin');
    });

    test('should throw error for invalid mode', () => {
      const systemState = new SystemState();

      expect(() => {
        systemState.arm('invalid', 'admin');
      }).toThrow('Invalid arm mode. Must be "away" or "stay"');
    });
  });

  describe('disarm', () => {
    test('should disarm system', () => {
      const systemState = new SystemState();
      systemState.arm('away', 'admin'); // First arm the system
      systemState.disarm('user');

      expect(systemState.armed).toBe(false);
      expect(systemState.mode).toBe(null);
      expect(systemState.modifiedBy).toBe('user');
      expect(systemState.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('isArmed', () => {
    test('should return true when system is armed', () => {
      const systemState = new SystemState();
      systemState.arm('away', 'admin');
      expect(systemState.isArmed()).toBe(true);
    });

    test('should return false when system is disarmed', () => {
      const systemState = new SystemState();
      expect(systemState.isArmed()).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('should return status object', () => {
      const systemState = new SystemState();
      systemState.arm('away', 'admin');
      const status = systemState.getStatus();

      expect(status).toEqual({
        armed: true,
        mode: 'away',
        lastModified: expect.any(Date),
        modifiedBy: 'admin'
      });
    });
  });
});
