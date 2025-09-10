import * as commandService from '../commandService';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

describe('CommandService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => 'test-token');
  });

  describe('sendCommand', () => {
    test('should send command successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          command: 'arm system',
          intent: 'ARM_SYSTEM',
          result: {
            success: true,
            message: 'System armed in away mode'
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await commandService.sendCommand('arm system');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/command',
        { command: 'arm system' },
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle command execution failure', async () => {
      const mockResponse = {
        data: {
          success: true,
          command: 'arm system',
          intent: 'ARM_SYSTEM',
          result: {
            success: false,
            error: 'System is already armed'
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await commandService.sendCommand('arm system');

      expect(result).toEqual(mockResponse.data);
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(commandService.sendCommand('arm system')).rejects.toThrow('Network error');
    });

    test('should handle authentication errors', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: 'Access denied'
          }
        }
      };

      axios.post.mockRejectedValue(mockError);

      await expect(commandService.sendCommand('arm system')).rejects.toEqual(mockError);
    });

    test('should include authorization header', async () => {
      const mockResponse = {
        data: { success: true }
      };

      axios.post.mockResolvedValue(mockResponse);

      await commandService.sendCommand('status');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/command',
        { command: 'status' },
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    test('should handle missing token', async () => {
      Storage.prototype.getItem = jest.fn(() => null);

      const mockResponse = {
        data: { success: true }
      };

      axios.post.mockResolvedValue(mockResponse);

      await commandService.sendCommand('status');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/command',
        { command: 'status' },
        {
          headers: {
            'Authorization': 'Bearer null',
            'Content-Type': 'application/json'
          }
        }
      );
    });
  });
});
