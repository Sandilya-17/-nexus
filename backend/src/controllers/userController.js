const User = require('../models/User');
const { uploadToCloudinary } = require('../middleware/upload');

// @GET /api/users/search
exports.searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Query too short.' });

  const users = await User.find({
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
    ],
    _id: { $ne: req.user._id },
    isActive: true,
  })
    .select('name username avatar isOnline lastSeen department jobTitle')
    .limit(20)
    .lean();

  res.json({ success: true, users });
};

// @GET /api/users/:userId
exports.getUserProfile = async (req, res) => {
  const user = await User.findById(req.params.userId).select('-password -refreshToken -twoFactorSecret');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  res.json({ success: true, user: user.toPublicProfile() });
};

// @PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  const { name, about, username, phone, department, jobTitle } = req.body;

  const updateData = {};
  if (name) updateData.name = name.trim();
  if (about !== undefined) updateData.about = about.trim();
  if (phone !== undefined) updateData.phone = phone.trim();
  if (department !== undefined) updateData.department = department.trim();
  if (jobTitle !== undefined) updateData.jobTitle = jobTitle.trim();

  if (username) {
    const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.user._id } });
    if (existing) return res.status(400).json({ success: false, message: 'Username taken.' });
    updateData.username = username.toLowerCase().trim();
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'nexus/avatars');
    updateData.avatar = result.secure_url;
    updateData.avatarPublicId = result.public_id;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
  res.json({ success: true, user: user.toPublicProfile() });
};

// @PUT /api/users/privacy
exports.updatePrivacy = async (req, res) => {
  const { lastSeenVisibility, profilePhotoVisibility, aboutVisibility, readReceipts } = req.body;
  const updates = {};

  if (lastSeenVisibility) updates['privacySettings.lastSeenVisibility'] = lastSeenVisibility;
  if (profilePhotoVisibility) updates['privacySettings.profilePhotoVisibility'] = profilePhotoVisibility;
  if (aboutVisibility) updates['privacySettings.aboutVisibility'] = aboutVisibility;
  if (readReceipts !== undefined) updates['privacySettings.readReceipts'] = readReceipts;

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ success: true, privacySettings: user.privacySettings });
};

// @PUT /api/users/notifications
exports.updateNotificationPreferences = async (req, res) => {
  const prefs = req.body;
  const allowed = ['messages', 'calls', 'statusUpdates', 'groupMentions', 'sound', 'desktop'];
  const updates = {};
  allowed.forEach(key => {
    if (prefs[key] !== undefined) updates[`notificationPreferences.${key}`] = prefs[key];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ success: true, notificationPreferences: user.notificationPreferences });
};

// @POST /api/users/block/:userId
exports.blockUser = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(req.user._id);

  const isBlocked = user.blockedUsers.includes(userId);
  if (isBlocked) {
    user.blockedUsers.pull(userId);
  } else {
    user.blockedUsers.push(userId);
  }
  await user.save();

  res.json({ success: true, blocked: !isBlocked });
};

// @GET /api/users/contacts
exports.getContacts = async (req, res) => {
  const user = await User.findById(req.user._id).populate('contacts', 'name avatar username isOnline lastSeen department jobTitle');
  res.json({ success: true, contacts: user.contacts });
};

// @POST /api/users/contacts/:userId
exports.addContact = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(req.user._id);

  if (user.contacts.includes(userId)) {
    return res.status(400).json({ success: false, message: 'Already a contact.' });
  }

  user.contacts.push(userId);
  await user.save();

  const contact = await User.findById(userId).select('name avatar username isOnline');
  res.json({ success: true, contact });
};

// @GET /api/users/online
exports.getOnlineUsers = async (req, res) => {
  const user = await User.findById(req.user._id);
  const contactIds = user.contacts || [];

  const onlineUsers = await User.find({
    _id: { $in: contactIds },
    isOnline: true,
  }).select('name avatar username isOnline').lean();

  res.json({ success: true, users: onlineUsers });
};
