const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;

const hashPassword = (password) => bcrypt.hashSync(password, 10);
const verifyPassword = (password, hash) => bcrypt.compareSync(password, hash);
const createAccessToken = (userId) => {
  return jwt.sign({ sub: userId }, SECRET_KEY, { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` });
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'student' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ detail: 'Email, password, and name are required' });
    }

    const validRoles = ['student', 'teacher'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ detail: 'Invalid role' });
    }

    const existingUser = await req.db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ detail: 'Email already registered' });
    }

    const hashedPassword = hashPassword(password);
    const user = {
      id: uuidv4(),
      email,
      name,
      role,
      created_at: new Date(),
      lastLogin: new Date(),
    };

    await req.db.collection('users').insertOne({
      ...user,
      password: hashedPassword,
    });

    const accessToken = createAccessToken(user.id);
    delete user.password;

    console.log(`✓ User registered: ${email} (${role})`);
    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password are required' });
    }

    const user = await req.db.collection('users').findOne({ email });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const accessToken = createAccessToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    await req.db.collection('users').updateOne(
      { id: user.id },
      { $set: { lastLogin: new Date() } }
    );

    console.log('✓ Login successful for:', email);
    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
  (req, res) => {
    const accessToken = createAccessToken(req.user.id);
    const { password, _id, ...userWithoutSensitive } = req.user;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&user=${encodeURIComponent(
        JSON.stringify(userWithoutSensitive)
      )}`
    );
  }
);

router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_failed` }),
  (req, res) => {
    const accessToken = createAccessToken(req.user.id);
    const { password, _id, ...userWithoutSensitive } = req.user;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&user=${encodeURIComponent(
        JSON.stringify(userWithoutSensitive)
      )}`
    );
  }
);

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ detail: 'Logout failed' });
    }
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  });
});

module.exports = router;