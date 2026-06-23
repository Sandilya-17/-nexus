const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const { getIO, getSocketId } = require('../socket');
const { uploadToCloudinary } = require('../middleware/upload');
const { v4: uuidv4 } = require('uuid');

// Helper to check if user is admin in group
const isAdmin = (chat, userId) => {
  const member = chat.members.find(m => m.user.toString() === userId.toString());
  return member && ['admin', 'owner'].includes(member.role);
};

// @POST /api/groups
exports.createGroup = async (req, res) => {
  const { name, description, memberIds } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'Group name required.' });

  const members = [
    { user: req.user._id, role: 'owner', addedBy: req.user._id },
    ...(memberIds || []).filter(id => id !== req.user._id.toString()).map(id => ({
      user: id,
      role: 'member',
      addedBy: req.user._id,
    })),
  ];

  const group = await Chat.create({
    type: 'group',
    name: name.trim(),
    description: description?.trim(),
    members,
    createdBy: req.user._id,
  });

  await group.populate('members.user', 'name avatar username isOnline');

  // System message
  await Message.create({
    chat: group._id,
    sender: req.user._id,
    type: 'system',
    content: `${req.user.name} created the group`,
    systemData: { action: 'group_created' },
  });

  // Notify all members
  members.forEach(m => {
    const socketId = getSocketId(m.user.toString());
    if (socketId && m.user.toString() !== req.user._id.toString()) {
      getIO().to(socketId).emit('chat:new', { chat: group });
    }
  });

  res.status(201).json({ success: true, group });
};

// @POST /api/groups/:groupId/members
exports.addMembers = async (req, res) => {
  const { groupId } = req.params;
  const { memberIds } = req.body;

  const group = await Chat.findById(groupId);
  if (!group || group.type !== 'group') return res.status(404).json({ success: false, message: 'Group not found.' });

  if (!isAdmin(group, req.user._id)) {
    if (group.settings.onlyAdminsCanAddMembers) {
      return res.status(403).json({ success: false, message: 'Only admins can add members.' });
    }
  }

  const existingIds = group.members.map(m => m.user.toString());
  const newMembers = memberIds.filter(id => !existingIds.includes(id));

  if (newMembers.length === 0) {
    return res.status(400).json({ success: false, message: 'All users are already members.' });
  }

  const addedMembers = newMembers.map(id => ({ user: id, role: 'member', addedBy: req.user._id }));
  group.members.push(...addedMembers);
  await group.save();

  const users = await User.find({ _id: { $in: newMembers } }).select('name');
  const names = users.map(u => u.name).join(', ');

  await Message.create({
    chat: group._id,
    sender: req.user._id,
    type: 'system',
    content: `${req.user.name} added ${names}`,
    systemData: { action: 'members_added', data: { memberIds: newMembers } },
  });

  await group.populate('members.user', 'name avatar username isOnline');

  newMembers.forEach(id => {
    const socketId = getSocketId(id);
    if (socketId) getIO().to(socketId).emit('chat:new', { chat: group });
  });

  getIO().to(groupId).emit('group:members-updated', { groupId, members: group.members });

  res.json({ success: true, members: group.members });
};

// @DELETE /api/groups/:groupId/members/:userId
exports.removeMember = async (req, res) => {
  const { groupId, userId } = req.params;

  const group = await Chat.findById(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

  const isSelf = userId === req.user._id.toString();
  if (!isSelf && !isAdmin(group, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only admins can remove members.' });
  }

  const removedMember = group.members.find(m => m.user.toString() === userId);
  if (!removedMember) return res.status(404).json({ success: false, message: 'User not in group.' });

  // Can't remove owner unless they're leaving themselves
  if (removedMember.role === 'owner' && !isSelf) {
    return res.status(403).json({ success: false, message: 'Cannot remove the group owner.' });
  }

  group.members = group.members.filter(m => m.user.toString() !== userId);
  await group.save();

  const removedUser = await User.findById(userId).select('name');
  const systemMsg = isSelf ? `${removedUser.name} left the group` : `${req.user.name} removed ${removedUser.name}`;

  await Message.create({
    chat: group._id,
    sender: req.user._id,
    type: 'system',
    content: systemMsg,
    systemData: { action: isSelf ? 'member_left' : 'member_removed', targetUser: userId },
  });

  const socketId = getSocketId(userId);
  if (socketId) getIO().to(socketId).emit('group:removed', { groupId });

  getIO().to(groupId).emit('group:members-updated', { groupId, members: group.members });

  res.json({ success: true, message: systemMsg });
};

// @PUT /api/groups/:groupId/members/:userId/role
exports.updateMemberRole = async (req, res) => {
  const { groupId, userId } = req.params;
  const { role } = req.body;

  if (!['member', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be member or admin.' });
  }

  const group = await Chat.findById(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

  if (!isAdmin(group, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only admins can change roles.' });
  }

  const member = group.members.find(m => m.user.toString() === userId);
  if (!member) return res.status(404).json({ success: false, message: 'User not in group.' });
  if (member.role === 'owner') return res.status(400).json({ success: false, message: 'Cannot change owner role.' });

  member.role = role;
  await group.save();

  getIO().to(groupId).emit('group:member-role-updated', { groupId, userId, role });

  res.json({ success: true, message: `Role updated to ${role}.` });
};

// @PUT /api/groups/:groupId
exports.updateGroup = async (req, res) => {
  const { groupId } = req.params;
  const { name, description } = req.body;

  const group = await Chat.findById(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

  if (group.settings.onlyAdminsCanEditInfo && !isAdmin(group, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only admins can edit group info.' });
  }

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'nexus/groups');
    group.avatar = result.secure_url;
    group.avatarPublicId = result.public_id;
  }

  if (name) group.name = name.trim();
  if (description !== undefined) group.description = description.trim();
  await group.save();

  await Message.create({
    chat: group._id,
    sender: req.user._id,
    type: 'system',
    content: `${req.user.name} updated the group info`,
    systemData: { action: 'group_updated' },
  });

  getIO().to(groupId).emit('group:updated', { groupId, name: group.name, description: group.description, avatar: group.avatar });

  res.json({ success: true, group });
};

// @PUT /api/groups/:groupId/settings
exports.updateSettings = async (req, res) => {
  const { groupId } = req.params;
  const group = await Chat.findById(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

  if (!isAdmin(group, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only admins can change settings.' });
  }

  const allowedSettings = ['onlyAdminsCanSend', 'onlyAdminsCanAddMembers', 'onlyAdminsCanEditInfo', 'disappearingMessages'];
  allowedSettings.forEach(key => {
    if (req.body[key] !== undefined) group.settings[key] = req.body[key];
  });

  await group.save();
  getIO().to(groupId).emit('group:settings-updated', { groupId, settings: group.settings });

  res.json({ success: true, settings: group.settings });
};

// @POST /api/groups/:groupId/invite-link
exports.generateInviteLink = async (req, res) => {
  const { groupId } = req.params;
  const group = await Chat.findById(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });

  if (!isAdmin(group, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only admins can manage invite links.' });
  }

  group.settings.joinLink = uuidv4();
  group.settings.joinLinkEnabled = true;
  await group.save();

  const link = `${process.env.CLIENT_URL}/join/${group.settings.joinLink}`;
  res.json({ success: true, link });
};

// @POST /api/groups/join/:linkCode
exports.joinViaLink = async (req, res) => {
  const { linkCode } = req.params;
  const group = await Chat.findOne({ 'settings.joinLink': linkCode, 'settings.joinLinkEnabled': true });

  if (!group) return res.status(404).json({ success: false, message: 'Invalid or expired invite link.' });

  const alreadyMember = group.members.some(m => m.user.toString() === req.user._id.toString());
  if (alreadyMember) return res.json({ success: true, group, alreadyMember: true });

  group.members.push({ user: req.user._id, role: 'member', addedBy: req.user._id });
  await group.save();

  await Message.create({
    chat: group._id,
    sender: req.user._id,
    type: 'system',
    content: `${req.user.name} joined via invite link`,
    systemData: { action: 'joined_via_link' },
  });

  getIO().to(group._id.toString()).emit('group:members-updated', { groupId: group._id, members: group.members });

  res.json({ success: true, group });
};
