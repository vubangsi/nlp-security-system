const FallbackNlpAdapter = require('../../../../src/infrastructure/adapters/FallbackNlpAdapter');

describe('FallbackNlpAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new FallbackNlpAdapter();
  });

  describe('interpretCommand', () => {
    test('should recognize arm system commands', async () => {
      const testCases = [
        { command: 'arm system', intent: 'ARM_SYSTEM' },
        { command: 'lock the house', intent: 'ARM_SYSTEM' },
        { command: 'secure home', intent: 'ARM_SYSTEM' },
        { command: 'sesame close', intent: 'ARM_SYSTEM' },
        { command: 'activate security', intent: 'ARM_SYSTEM' }
      ];

      for (const testCase of testCases) {
        const result = await adapter.interpretCommand(testCase.command);
        expect(result.success).toBe(true);
        expect(result.intent).toBe(testCase.intent);
        expect(result.confidence).toBe(0.7);
      }
    });

    test('should recognize disarm system commands', async () => {
      const testCases = [
        { command: 'disarm system', intent: 'DISARM_SYSTEM' },
        { command: 'unlock the house', intent: 'DISARM_SYSTEM' },
        { command: 'unsecure home', intent: 'DISARM_SYSTEM' },
        { command: 'sesame open', intent: 'DISARM_SYSTEM' },
        { command: 'deactivate security', intent: 'DISARM_SYSTEM' }
      ];

      for (const testCase of testCases) {
        const result = await adapter.interpretCommand(testCase.command);
        expect(result.success).toBe(true);
        expect(result.intent).toBe(testCase.intent);
        expect(result.confidence).toBe(0.7);
      }
    });

    test('should recognize list users commands', async () => {
      const testCases = [
        { command: 'list users', intent: 'LIST_USERS' },
        { command: 'show users', intent: 'LIST_USERS' },
        { command: 'get users', intent: 'LIST_USERS' },
        { command: 'all users', intent: 'LIST_USERS' }
      ];

      for (const testCase of testCases) {
        const result = adapter.interpretCommand(testCase.command);
        expect(result.success).toBe(true);
        expect(result.intent).toBe(testCase.intent);
        expect(result.confidence).toBe(0.8);
      }
    });

    test('should extract mode entities from arm commands', async () => {
      const testCases = [
        { command: 'arm system stay', expectedMode: 'stay' },
        { command: 'lock house away', expectedMode: 'away' },
        { command: 'secure home', expectedMode: 'away' } // default mode
      ];

      for (const testCase of testCases) {
        const result = adapter.interpretCommand(testCase.command);
        expect(result.success).toBe(true);
        expect(result.intent).toBe('ARM_SYSTEM');
        expect(result.entities.mode).toBe(testCase.expectedMode);
      }
    });

    test('should return unknown intent for unrecognized commands', async () => {
      const result = adapter.interpretCommand('play music');

      expect(result.success).toBe(false);
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.0);
      expect(result.entities).toEqual({});
    });

    test('should handle empty commands', async () => {
      const result = adapter.interpretCommand('');

      expect(result.success).toBe(false);
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.0);
    });

    test('should be case insensitive', async () => {
      const result = adapter.interpretCommand('ARM SYSTEM');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('ARM_SYSTEM');
      expect(result.confidence).toBe(0.7);
    });
  });
});
