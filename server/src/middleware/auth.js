const jwt = require('jsonwebtoken');

// Simple in-memory blacklist for logged-out tokens (demo only; not persistent)
const tokenBlacklist = new Set();

const requireAuth = (req, res, next) => {
  const auth = req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token provided' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ message: 'Token is revoked' });

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.id };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const revokeToken = (token) => {
  if (!token) return;
  tokenBlacklist.add(token);
};

module.exports = { requireAuth, revokeToken };
