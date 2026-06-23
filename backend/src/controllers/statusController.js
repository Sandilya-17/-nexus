const Status = require('../models/Status');
const User = require('../models/User');
const { uploadToCloudinary } = require('../middleware/upload');
const { getIO, getSocketId } = require('../socket');

// @POST /api/status
exports.createStatus = async (req, res) => {
  const { type, content, backgroundColor, visibility, selectedUsers } = req.body;

  const statusData = {
    user: req.user._id,
    type,
    content,
    backgroundColor,
    visibility: visibility || 'contacts',
    selectedUsers: selectedUsers ? JSON.parse(selectedUsers) : [],
  };

  if (req.file) {
    const folder = type === 'video' ? 'nexus/status/video' : 'nexus/status/images';
    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, folder);
    statusData.mediaUrl = result.secure_url;
    statusData.mediaPublicId = result.public_id;
    statusData.mediaDuration = result.duration;
    if (type === 'video') {
      statusData.mediaThumbnail = result.secure_url.replace('/upload/', '/upload/so_0/');
    }
  }

  const status = await Status.create(statusData);
  await status.populate('user', 'name avatar username');

  // Notify contacts
  const user = await User.findById(req.user._id).populate('contacts', '_id');
  user.contacts.forEach(contact => {
    const socketId = getSocketId(contact._id.toString());
    if (socketId) {
      getIO().to(socketId).emit('status:new', { status });
    }
  });

  res.status(201).json({ success: true, status });
};

// @GET /api/status
exports.getStatuses = async (req, res) => {
  // Get user's contacts
  const user = await User.findById(req.user._id);
  const contactIds = user.contacts || [];

  // Fetch statuses from contacts + self
  const viewableIds = [...contactIds, req.user._id];

  const statuses = await Status.find({
    user: { $in: viewableIds },
    expiresAt: { $gt: new Date() },
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name avatar username')
    .lean();

  // Group by user
  const grouped = {};
  statuses.forEach(s => {
    const uid = s.user._id.toString();
    if (!grouped[uid]) grouped[uid] = { user: s.user, statuses: [] };
    grouped[uid].statuses.push({
      ...s,
      viewedByMe: s.views.some(v => v.user.toString() === req.user._id.toString()),
    });
  });

  const result = Object.values(grouped);

  // Sort: unviewed first, then by latest
  result.sort((a, b) => {
    const aViewed = a.statuses.every(s => s.viewedByMe);
    const bViewed = b.statuses.every(s => s.viewedByMe);
    if (aViewed !== bViewed) return aViewed ? 1 : -1;
    return b.statuses[0].createdAt - a.statuses[0].createdAt;
  });

  res.json({ success: true, statuses: result });
};

// @POST /api/status/:statusId/view
exports.viewStatus = async (req, res) => {
  const { statusId } = req.params;

  const status = await Status.findById(statusId);
  if (!status) return res.status(404).json({ success: false, message: 'Status not found.' });

  const alreadyViewed = status.views.some(v => v.user.toString() === req.user._id.toString());
  if (!alreadyViewed) {
    status.views.push({ user: req.user._id, viewedAt: new Date() });
    await status.save();

    // Notify status owner
    const ownerSocketId = getSocketId(status.user.toString());
    if (ownerSocketId) {
      getIO().to(ownerSocketId).emit('status:viewed', {
        statusId,
        viewedBy: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      });
    }
  }

  res.json({ success: true });
};

// @POST /api/status/:statusId/react
exports.reactToStatus = async (req, res) => {
  const { statusId } = req.params;
  const { emoji } = req.body;

  const status = await Status.findById(statusId);
  if (!status) return res.status(404).json({ success: false, message: 'Status not found.' });

  const existing = status.views.find(v => v.user.toString() === req.user._id.toString());
  if (existing) {
    existing.reaction = emoji;
  } else {
    status.views.push({ user: req.user._id, reaction: emoji, viewedAt: new Date() });
  }

  await status.save();

  // Notify owner
  const ownerSocketId = getSocketId(status.user.toString());
  if (ownerSocketId) {
    getIO().to(ownerSocketId).emit('status:reacted', {
      statusId,
      from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      emoji,
    });
  }

  res.json({ success: true });
};

// @POST /api/status/:statusId/reply
exports.replyToStatus = async (req, res) => {
  const { statusId } = req.params;
  const { message } = req.body;

  const status = await Status.findById(statusId);
  if (!status) return res.status(404).json({ success: false, message: 'Status not found.' });

  status.replies.push({ user: req.user._id, message, repliedAt: new Date() });
  await status.save();

  // Notify owner
  const ownerSocketId = getSocketId(status.user.toString());
  if (ownerSocketId) {
    getIO().to(ownerSocketId).emit('status:replied', {
      statusId,
      from: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
      message,
    });
  }

  res.json({ success: true });
};

// @DELETE /api/status/:statusId
exports.deleteStatus = async (req, res) => {
  const { statusId } = req.params;
  const status = await Status.findById(statusId);

  if (!status) return res.status(404).json({ success: false, message: 'Status not found.' });
  if (status.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Cannot delete others\' status.' });
  }

  await Status.findByIdAndDelete(statusId);
  res.json({ success: true, message: 'Status deleted.' });
};

// @GET /api/status/my
exports.getMyStatuses = async (req, res) => {
  const statuses = await Status.find({
    user: req.user._id,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate('views.user', 'name avatar')
    .lean();

  res.json({ success: true, statuses });
};
