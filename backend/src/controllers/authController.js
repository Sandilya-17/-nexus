const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' });

const sendTokenResponse = async (user, statusCode, res) => {
  const token = signToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  res.status(statusCode).json({ success: true, token, refreshToken, user: user.toPublicProfile() });
};

// Generate a unique 8-char invite/join code
const generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

// POST /api/auth/register — username-only registration, no email/password
exports.register = async (req, res) => {
  const { name, username } = req.body;
  if (!name || !username) {
    return res.status(400).json({ success: false, message: 'Name and username are required.' });
  }
  const slug = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (slug.length < 3) {
    return res.status(400).json({ success: false, message: 'Username must be at least 3 characters (letters, numbers, _).' });
  }
  const exists = await User.findOne({ username: slug });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Username already taken.' });
  }
  const user = await User.create({
    name: name.trim(),
    username: slug,
    isVerified: true,
    isActive: true,
  });
  logger.info(`New user registered: @${user.username}`);
  await sendTokenResponse(user, 201, res);
};

// POST /api/auth/login — login by username only
exports.login = async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }
  const slug = username.toLowerCase().trim();
  const user = await User.findOne({ username: slug });
  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with that username.' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
  }
  logger.info(`User logged in: @${user.username}`);
  await sendTokenResponse(user, 200, res);
};

// POST /api/auth/refresh-token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required.' });
  let decoded;
  try { decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET); }
  catch (e) { return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' }); }
  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
  }
  await sendTokenResponse(user, 200, res);
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null, isOnline: false, lastSeen: new Date() });
  res.json({ success: true, message: 'Logged out.' });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user: user.toPublicProfile() });
};

// Keep old OTP routes as no-ops so existing Railway env doesn't break
exports.sendOtp = (req, res) => res.status(410).json({ success: false, message: 'OTP auth removed. Use username login.' });
exports.verifyOtp = (req, res) => res.status(410).json({ success: false, message: 'OTP auth removed. Use username login.' });
exports.changePassword = (req, res) => res.status(410).json({ success: false, message: 'Password auth removed.' });
