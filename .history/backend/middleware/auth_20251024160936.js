const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ detail: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await req.db.collection('users').findOne({ id: decoded.sub });
    if (!user) return res.status(401).json({ detail: 'Invalid credentials' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ detail: 'Not authenticated' });
    if (req.user.role !== role)
      return res.status(403).json({ detail: `Only ${role}s can access this endpoint` });
    next();
  };
};

module.exports = { authenticateToken, requireRole };
