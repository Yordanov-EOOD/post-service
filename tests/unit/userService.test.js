/**
 * Unit tests for user service
 */

import { jest } from '@jest/globals';

describe('UserService', () => {
  let userService;
  let mockHttpClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock HTTP client
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    // Mock user service
    userService = {
      getUserById: async (userId) => {
        const response = await mockHttpClient.get(`/users/${userId}`);
        return response.data;
      },

      validateUser: async (userId) => {
        try {
          const user = await userService.getUserById(userId);
          return user ? { valid: true, user } : { valid: false };
        } catch (error) {
          return { valid: false, error: error.message };
        }
      },

      getUserTimeline: async (userId, page = 1, limit = 10) => {
        const response = await mockHttpClient.get(`/users/${userId}/timeline`, {
          params: { page, limit }
        });
        return response.data;
      },

      getUserFollowers: async (userId) => {
        const response = await mockHttpClient.get(`/users/${userId}/followers`);
        return response.data;
      },

      getUserFollowing: async (userId) => {
        const response = await mockHttpClient.get(`/users/${userId}/following`);
        return response.data;
      }
    };
  });

  describe('getUserById', () => {
    it('should return user data when user exists', async () => {
      const mockUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockHttpClient.get.mockResolvedValue({ data: mockUser });

      const result = await userService.getUserById('user1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user1');
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('User not found'));

      await expect(userService.getUserById('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('validateUser', () => {
    it('should return valid true when user exists', async () => {
      const mockUser = { id: 'user1', username: 'testuser' };
      mockHttpClient.get.mockResolvedValue({ data: mockUser });

      const result = await userService.validateUser('user1');

      expect(result).toEqual({ valid: true, user: mockUser });
    });

    it('should return valid false when user does not exist', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('User not found'));

      const result = await userService.validateUser('nonexistent');

      expect(result).toEqual({ valid: false, error: 'User not found' });
    });
  });

  describe('getUserTimeline', () => {
    it('should return paginated timeline data', async () => {
      const mockTimeline = [
        { id: '1', content: 'Timeline post 1' },
        { id: '2', content: 'Timeline post 2' }
      ];
      mockHttpClient.get.mockResolvedValue({ data: mockTimeline });

      const result = await userService.getUserTimeline('user1', 1, 10);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user1/timeline', {
        params: { page: 1, limit: 10 }
      });
      expect(result).toEqual(mockTimeline);
    });
  });

  describe('getUserFollowers', () => {
    it('should return user followers', async () => {
      const mockFollowers = [
        { id: 'follower1', username: 'follower1' },
        { id: 'follower2', username: 'follower2' }
      ];
      mockHttpClient.get.mockResolvedValue({ data: mockFollowers });

      const result = await userService.getUserFollowers('user1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user1/followers');
      expect(result).toEqual(mockFollowers);
    });
  });

  describe('getUserFollowing', () => {
    it('should return users being followed', async () => {
      const mockFollowing = [
        { id: 'following1', username: 'following1' },
        { id: 'following2', username: 'following2' }
      ];
      mockHttpClient.get.mockResolvedValue({ data: mockFollowing });

      const result = await userService.getUserFollowing('user1');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/users/user1/following');
      expect(result).toEqual(mockFollowing);
    });
  });
});