require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const CLIENT_REDIRECT = process.env.CLIENT_URL || process.env.VITE_CLIENT_URL || 'http://localhost:5173';

// Helper: find or create a user from provider profile
async function findOrCreateUser({ provider, profile, email, name }) {
  // prefer email to match users
  const userEmail = email || (profile && profile.emails && profile.emails[0] && profile.emails[0].value) || null;
  const displayName = name || (profile && (profile.displayName || (profile.username || '')));

  if (userEmail) {
    let user = await User.findOne({ email: userEmail });
    if (user) return user;
    user = await User.create({ name: displayName || provider, email: userEmail, password: '' });
    return user;
  }

  // fallback: find by provider id stored in a special field (not present in our schema). Instead create a user with synthetic email
  const syntheticEmail = `${provider}_${profile.id}@example.com`;
  let user = await User.findOne({ email: syntheticEmail });
  if (user) return user;
  user = await User.create({ name: displayName || provider, email: syntheticEmail, password: '' });
  return user;
}

// Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      const user = await findOrCreateUser({ provider: 'google', profile, email, name: profile.displayName });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// GitHub
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
    scope: [ 'user:email' ]
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // try to get email
      let email = null;
      if (profile.emails && profile.emails.length) email = profile.emails[0].value;
      const user = await findOrCreateUser({ provider: 'github', profile, email, name: profile.displayName || profile.username });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// Facebook
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      const user = await findOrCreateUser({ provider: 'facebook', profile, email, name: profile.displayName });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

module.exports = passport;
