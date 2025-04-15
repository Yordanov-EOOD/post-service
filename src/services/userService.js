import prisma from '../config/db.js';

export const createUserService = async (userData) => {
  return await prisma.user.create({
    data: {
      authUserId: userData.authUserId,
      username: userData.username,
    },
  });
};
