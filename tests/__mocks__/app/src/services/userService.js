// Mock for /app/src/services/userService.js

export const createUserService = jest.fn(() => ({
  getUserById: jest.fn(),
  validateUser: jest.fn(),
  getUserTimeline: jest.fn(),
  getUserFollowers: jest.fn(),
  getUserFollowing: jest.fn(),
  updateUserProfile: jest.fn(),
  deleteUser: jest.fn()
}));

export const userService = {
  getUserById: jest.fn(),
  validateUser: jest.fn(),
  getUserTimeline: jest.fn(),
  getUserFollowers: jest.fn(),
  getUserFollowing: jest.fn(),
  updateUserProfile: jest.fn(),
  deleteUser: jest.fn()
};

export default userService;
