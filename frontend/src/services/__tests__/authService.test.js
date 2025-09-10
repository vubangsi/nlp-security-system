import * as authService from '../authService';

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('should login successfully with valid PIN', async () => {
      const mockResponse = {
        data: {
          success: true,
          token: 'test-token',
          user: { id: 'admin', name: 'Admin', role: 'admin' }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await authService.login('0000');

      expect(axios.post).toHaveBeenCalledWith('/api/login', { pin: '0000' });
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle login failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid PIN'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await authService.login('1234');

      expect(result).toEqual(mockResponse.data);
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(authService.login('0000')).rejects.toThrow('Network error');
    });

    test('should handle server errors', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Server error'
          }
        }
      };

      axios.post.mockRejectedValue(mockError);

      await expect(authService.login('0000')).rejects.toEqual(mockError);
    });
  });
});
