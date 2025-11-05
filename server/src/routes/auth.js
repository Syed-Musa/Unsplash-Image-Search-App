require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, revokeToken } = require('../middleware/auth');

const router = express.Router();
const passport = require('../config/passport');

/**
 * POST /api/auth/signup
 * Registers a new user
 */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic field validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Ensure JWT secret exists
    if (!process.env.JWT_SECRET) {
      console.error('❌ Missing JWT_SECRET in .env');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }
    // if user was created via OAuth there may be no local password
    if (!user.password) {
      return res.status(400).json({ message: 'This account uses social login. Please sign in with the provider.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Revokes token (optional if you implement blacklist)
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    revokeToken(req.token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ------------------------------------------------------------------
// OAuth routes (Google / GitHub / Facebook)
// The callback will create/find a user, issue JWT and redirect to client
// ------------------------------------------------------------------

function sendTokenRedirect(res, user) {
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'Server misconfigured' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const client = process.env.CLIENT_URL || process.env.VITE_CLIENT_URL || 'http://localhost:5173';
  // redirect with token in query (client should handle it)
  const url = new URL(client);
  url.searchParams.set('token', token);
  // optionally include user info
  url.searchParams.set('name', user.name || '');
  res.redirect(url.toString());
}

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), async (req, res) => {
  try {
    // req.user is the user created/found in passport strategy
    sendTokenRedirect(res, req.user);
  } catch (err) {
    console.error('Google callback error', err);
    res.redirect('/');
  }
});

// GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/' }), async (req, res) => {
  try {
    sendTokenRedirect(res, req.user);
  } catch (err) {
    console.error('GitHub callback error', err);
    res.redirect('/');
  }
});

// Facebook
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: '/' }), async (req, res) => {
  try {
    sendTokenRedirect(res, req.user);
  } catch (err) {
    console.error('Facebook callback error', err);
    res.redirect('/');
  }
});

module.exports = router;

