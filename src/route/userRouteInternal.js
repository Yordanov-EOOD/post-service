import { Router } from 'express';
import { createInternalUser } from '../controllers/userController.js';

const router = Router();

router.post('/', createInternalUser);

export default router;
