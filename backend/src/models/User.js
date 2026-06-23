const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 50 },
  username: {
    type: String, required: [true, 'Username is required'],
    unique: true, lowercase: true, trim: true,
    minlength: 3, maxlength: 30,
    match: [/^[a-z0-9_]+$/, 'Username: letters, numbers, _ only'],
  },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, minlength: 8, select: false },
  avatar: { type: String, default: null },
  avatarPublicId: String,
  about: { type: String, default: 'Hey there! I am using Nexus.', maxlength: 200 },
  phone: { type: String, trim: true },
  department: String,
  jobTitle: String,
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: String,
  isVerified: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  pushTokens: [{
    token: String,
    platform: { type: String, enum: ['web', 'ios', 'android'] },
    createdAt: { type: Date, default: Date.now },
  }],
  notificationPreferences: {
    messages: { type: Boolean, default: true },
    calls: { type: Boolean, default: true },
    statusUpdates: { type: Boolean, default: true },
    sound: { type: Boolean, default: true },
    desktop: { type: Boolean, default: true },
  },
  privacySettings: {
    lastSeenVisibility: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    profilePhotoVisibility: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    aboutVisibility: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    readReceipts: { type: Boolean, default: true },
  },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  refreshToken: { type: String, select: false },
}, { timestamps: true });

userSchema.index({ username: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ name: 'text', username: 'text' });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id, name: this.name, username: this.username,
    email: this.email, avatar: this.avatar, about: this.about,
    phone: this.phone, department: this.department, jobTitle: this.jobTitle,
    role: this.role, isOnline: this.isOnline, lastSeen: this.lastSeen,
    isVerified: this.isVerified, createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
