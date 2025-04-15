import { createUserService } from '../services/userService.js';

export const createInternalUser = async (req, res) => {
  // Extract userId or authUserId from the request body
  const { userId, authUserId, username } = req.body;
  const actualUserId = userId || authUserId; // Use whichever is provided
  
  if (!actualUserId || !username) {
    return res.status(400).json({ error: 'Missing required fields: userId/authUserId or username' });
  }

  console.log('Creating user in post-service with:', { actualUserId, username });
  
  try {
    const user = await createUserService({
      authUserId: actualUserId,
      username: username,
    });
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user in post-service:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'User already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
};
