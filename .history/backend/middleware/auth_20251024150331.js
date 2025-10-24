const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Auth attempt:', { authHeader, token: token ? 'Present' : 'Missing' });
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ detail: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    console.log('Token decoded:', decoded);
    const user = await req.db.collection('users').findOne({ id: decoded.sub });
    if (!user) {
      console.log('User not found for ID:', decoded.sub);
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    console.log('User authenticated:', user.id, user.role);
    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ detail: 'Invalid token' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    console.log('Checking role:', { userRole: req.user.role, requiredRole: role });
    if (req.user.role !== role) {
      return res.status(403).json({ detail: `Only ${role}s can access this endpoint` });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };