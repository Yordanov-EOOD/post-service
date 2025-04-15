import jwt from 'jsonwebtoken';
import 'dotenv/config';

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = user;
    console.log('User verified:', user);
    // Optionally, you can log the user ID or other details 
    console.log('User ID:', user.userId);
    next();
  });
};

export default verifyJWT;