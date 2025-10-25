// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || 'study-guardian-secret-key-2024';
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY || 'study-guardian-refresh-secret-2024';
const ACCESS_TOKEN_EXPIRE_MINUTES = 30; // 30 minutes
const REFRESH_TOKEN_EXPIRE_DAYS = 7; // 7 days

// Password helpers
const hashPassword = (password) => bcrypt.hashSync(password, 10);
const verifyPassword = (password, hash) => bcrypt.compareSync(password, hash);

// JWT helpers
const createAccessToken = (userId) => {
  return jwt.sign({ sub: userId }, SECRET_KEY, { expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m` });
};

const createRefreshToken = (userId) => {
  return jwt.sign({ sub: userId }, REFRESH_SECRET_KEY, { expiresIn: `${REFRESH_TOKEN_EXPIRE_DAYS}d` });
};

// Helper to set refresh token cookie
const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, // Prevents JavaScript access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  });
};

// ----------------- REGISTER -----------------
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

    await req.db.collection('users').insertOne({ ...user, password: hashedPassword });

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);
    
    // Store refresh token in database
    await req.db.collection('refresh_tokens').insertOne({
      userId: user.id,
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
    });

    setRefreshTokenCookie(res, refreshToken);
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

// ----------------- LOGIN -----------------
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
    const refreshToken = createRefreshToken(user.id);
    
    // Store refresh token in database
    await req.db.collection('refresh_tokens').insertOne({
      userId: user.id,
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
    });

    const { password: _, ...userWithoutPassword } = user;

    // Update last login
    await req.db.collection('users').updateOne(
      { id: user.id },
      { $set: { lastLogin: new Date() } }
    );

    setRefreshTokenCookie(res, refreshToken);

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

// ----------------- REFRESH TOKEN -----------------
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ detail: 'Refresh token not found' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
    } catch (err) {
      // If refresh token is expired, remove it from DB
      await req.db.collection('refresh_tokens').deleteOne({ token: refreshToken });
      res.clearCookie('refresh_token');
      return res.status(401).json({ detail: 'Refresh token expired' });
    }

    // Check if refresh token exists in database
    const storedToken = await req.db.collection('refresh_tokens').findOne({ 
      token: refreshToken,
      userId: decoded.sub 
    });

    if (!storedToken) {
      return res.status(401).json({ detail: 'Invalid refresh token' });
    }

    // Get user
    const user = await req.db.collection('users').findOne({ id: decoded.sub });
    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }

    // Create new access token
    const newAccessToken = createAccessToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    console.log('✓ Token refreshed for user:', user.email);
    
    res.json({
      access_token: newAccessToken,
      token_type: 'bearer',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ----------------- GOOGLE OAUTH -----------------
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
  }),
  async (req, res) => {
    const accessToken = createAccessToken(req.user.id);
    const refreshToken = createRefreshToken(req.user.id);
    
    // Store refresh token
    await req.db.collection('refresh_tokens').insertOne({
      userId: req.user.id,
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
    });

    setRefreshTokenCookie(res, refreshToken);
    
    const { password, _id, ...userWithoutSensitive } = req.user;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&user=${encodeURIComponent(
        JSON.stringify(userWithoutSensitive)
      )}`
    );
  }
);

// ----------------- GITHUB OAUTH -----------------
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_failed`,
  }),
  async (req, res) => {
    const accessToken = createAccessToken(req.user.id);
    const refreshToken = createRefreshToken(req.user.id);
    
    // Store refresh token
    await req.db.collection('refresh_tokens').insertOne({
      userId: req.user.id,
      token: refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
    });

    setRefreshTokenCookie(res, refreshToken);
    
    const { password, _id, ...userWithoutSensitive } = req.user;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&user=${encodeURIComponent(
        JSON.stringify(userWithoutSensitive)
      )}`
    );
  }
);

// ----------------- LOGOUT -----------------
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    // Remove refresh token from database
    if (refreshToken) {
      await req.db.collection('refresh_tokens').deleteOne({ token: refreshToken });
    }
    
    // Clear cookie
    res.clearCookie('refresh_token');
    
    console.log('✓ User logged out');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ detail: 'Logout failed' });
  }
});

module.exports = router;