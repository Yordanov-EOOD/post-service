import { Router } from 'express';
import {
  createYeet,
  getAllYeets,
  getYeetById,
  deleteYeet,
} from '../controllers/yeetController.js';

const router = Router();

router.post('/', createYeet);
router.get('/', getAllYeets);
router.get('/:id', getYeetById);
router.delete('/:id', deleteYeet);

export default router;