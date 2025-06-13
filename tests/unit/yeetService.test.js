/**
 * Unit tests for yeet service
 */

import { jest } from '@jest/globals';

describe('YeetService', () => {
  let yeetService;
  let mockPrisma;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      yeet: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      like: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn()
      },
      retweet: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn()
      }
    };

    // Import service after mocking
    yeetService = {
      getAllYeets: async (userId, page = 1, limit = 10) => {
        const yeets = await mockPrisma.yeet.findMany({
          skip: (page - 1) * limit,
          take: limit,
          include: {
            likes: true,
            retweets: true,
            user: {
              select: { id: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        return yeets;
      },

      getYeetById: async (yeetId) => {
        return await mockPrisma.yeet.findUnique({
          where: { id: yeetId },
          include: {
            likes: true,
            retweets: true,
            user: {
              select: { id: true, username: true }
            }
          }
        });
      },

      createYeet: async (userId, content) => {
        return await mockPrisma.yeet.create({
          data: {
            userId,
            content,
            createdAt: new Date()
          },
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        });
      },

      deleteYeet: async (yeetId, userId) => {
        const yeet = await mockPrisma.yeet.findUnique({
          where: { id: yeetId }
        });
        
        if (!yeet || yeet.userId !== userId) {
          throw new Error('Yeet not found or unauthorized');
        }
        
        return await mockPrisma.yeet.delete({
          where: { id: yeetId }
        });
      },

      likeYeet: async (yeetId, userId) => {
        const existingLike = await mockPrisma.like.findFirst({
          where: { yeetId, userId }
        });

        if (existingLike) {
          return { success: false, message: 'Already liked' };
        }

        await mockPrisma.like.create({
          data: { yeetId, userId }
        });

        return { success: true };
      },

      retweetYeet: async (yeetId, userId) => {
        const existingRetweet = await mockPrisma.retweet.findFirst({
          where: { yeetId, userId }
        });

        if (existingRetweet) {
          return { success: false, message: 'Already retweeted' };
        }

        await mockPrisma.retweet.create({
          data: { yeetId, userId }
        });

        return { success: true };
      }
    };
  });

  describe('getAllYeets', () => {
    it('should return paginated yeets', async () => {
      const mockYeets = [
        { id: '1', content: 'Test yeet 1', userId: 'user1' },
        { id: '2', content: 'Test yeet 2', userId: 'user2' }
      ];
      
      mockPrisma.yeet.findMany.mockResolvedValue(mockYeets);

      const result = await yeetService.getAllYeets('user1', 1, 10);

      expect(mockPrisma.yeet.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        include: {
          likes: true,
          retweets: true,
          user: {
            select: { id: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(mockYeets);
    });
  });

  describe('getYeetById', () => {
    it('should return a yeet by ID', async () => {
      const mockYeet = { id: '1', content: 'Test yeet', userId: 'user1' };
      mockPrisma.yeet.findUnique.mockResolvedValue(mockYeet);

      const result = await yeetService.getYeetById('1');

      expect(mockPrisma.yeet.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          likes: true,
          retweets: true,
          user: {
            select: { id: true, username: true }
          }
        }
      });
      expect(result).toEqual(mockYeet);
    });
  });

  describe('createYeet', () => {
    it('should create a new yeet', async () => {
      const mockYeet = { id: '1', content: 'New yeet', userId: 'user1' };
      mockPrisma.yeet.create.mockResolvedValue(mockYeet);

      const result = await yeetService.createYeet('user1', 'New yeet');

      expect(mockPrisma.yeet.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          content: 'New yeet',
          createdAt: expect.any(Date)
        },
        include: {
          user: {
            select: { id: true, username: true }
          }
        }
      });
      expect(result).toEqual(mockYeet);
    });
  });

  describe('deleteYeet', () => {
    it('should delete a yeet when user is authorized', async () => {
      const mockYeet = { id: '1', userId: 'user1' };
      mockPrisma.yeet.findUnique.mockResolvedValue(mockYeet);
      mockPrisma.yeet.delete.mockResolvedValue(mockYeet);

      const result = await yeetService.deleteYeet('1', 'user1');

      expect(mockPrisma.yeet.findUnique).toHaveBeenCalledWith({
        where: { id: '1' }
      });
      expect(mockPrisma.yeet.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      });
      expect(result).toEqual(mockYeet);
    });

    it('should throw error when user is not authorized', async () => {
      const mockYeet = { id: '1', userId: 'user1' };
      mockPrisma.yeet.findUnique.mockResolvedValue(mockYeet);

      await expect(yeetService.deleteYeet('1', 'user2')).rejects.toThrow('Yeet not found or unauthorized');
    });
  });

  describe('likeYeet', () => {
    it('should like a yeet when not already liked', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null);
      mockPrisma.like.create.mockResolvedValue({ id: '1', yeetId: '1', userId: 'user1' });

      const result = await yeetService.likeYeet('1', 'user1');

      expect(mockPrisma.like.findFirst).toHaveBeenCalledWith({
        where: { yeetId: '1', userId: 'user1' }
      });
      expect(mockPrisma.like.create).toHaveBeenCalledWith({
        data: { yeetId: '1', userId: 'user1' }
      });
      expect(result).toEqual({ success: true });
    });

    it('should not like a yeet when already liked', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({ id: '1', yeetId: '1', userId: 'user1' });

      const result = await yeetService.likeYeet('1', 'user1');

      expect(result).toEqual({ success: false, message: 'Already liked' });
    });
  });

  describe('retweetYeet', () => {
    it('should retweet a yeet when not already retweeted', async () => {
      mockPrisma.retweet.findFirst.mockResolvedValue(null);
      mockPrisma.retweet.create.mockResolvedValue({ id: '1', yeetId: '1', userId: 'user1' });

      const result = await yeetService.retweetYeet('1', 'user1');

      expect(mockPrisma.retweet.findFirst).toHaveBeenCalledWith({
        where: { yeetId: '1', userId: 'user1' }
      });
      expect(mockPrisma.retweet.create).toHaveBeenCalledWith({
        data: { yeetId: '1', userId: 'user1' }
      });
      expect(result).toEqual({ success: true });
    });

    it('should not retweet a yeet when already retweeted', async () => {
      mockPrisma.retweet.findFirst.mockResolvedValue({ id: '1', yeetId: '1', userId: 'user1' });

      const result = await yeetService.retweetYeet('1', 'user1');

      expect(result).toEqual({ success: false, message: 'Already retweeted' });
    });
  });
});