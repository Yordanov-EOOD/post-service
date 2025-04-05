import prisma from '../config/db.js';

export const createYeetService = async (yeetData) => {
  return await prisma.post.create({
    data: yeetData,
    include: { author: true },
  });
};

export const getAllYeetsService = async () => {
  return await prisma.post.findMany({
    include: { author: true },
  });
};

export const getYeetByIdService = async (id) => {
  const yeet = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });

  if (!yeet) {
    throw new Error('Yeet not found');
  }

  return yeet;
};

export const deleteYeetService = async (id) => {
  return await prisma.post.delete({ where: { id } });
};