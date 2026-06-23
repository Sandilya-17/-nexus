const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(protect);
router.post('/', groupController.createGroup);
router.put('/:groupId', upload.single('avatar'), groupController.updateGroup);
router.put('/:groupId/settings', groupController.updateSettings);
router.post('/:groupId/members', groupController.addMembers);
router.delete('/:groupId/members/:userId', groupController.removeMember);
router.put('/:groupId/members/:userId/role', groupController.updateMemberRole);
router.post('/:groupId/invite-link', groupController.generateInviteLink);
router.post('/join/:linkCode', groupController.joinViaLink);

module.exports = router;
