import {
    createYeetService,
    getAllYeetsService,
    getYeetByIdService,
    deleteYeetService,
  } from '../services/yeetService.js';
  
  export const createYeet = async (req, res) => {
    const { content, image } = req.body;
    const { userId } = req.user;
  
    try {
      const yeet = await createYeetService({ content, image, authorId: userId });
      res.json(yeet);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  export const getAllYeets = async (req, res) => {
    try {
      const yeets = await getAllYeetsService();
      res.json(yeets);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  export const getYeetById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const yeet = await getYeetByIdService(id);
      res.json(yeet);
    } catch (error) {
      res.status(404).json({ error: 'Yeet not found' });
    }
  };
  
  export const deleteYeet = async (req, res) => {
    const { id } = req.params;
  
    try {
      await deleteYeetService(id);
      res.status(204).send();
    } catch (error) {
      res.status(404).json({ error: 'Yeet not found' });
    }
  };