const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(protect);
router.get('/search', userController.searchUsers);
router.get('/contacts', userController.getContacts);
router.get('/online', userController.getOnlineUsers);
router.post('/contacts/:userId', userController.addContact);
router.post('/block/:userId', userController.blockUser);
router.put('/profile', upload.single('avatar'), userController.updateProfile);
router.put('/privacy', userController.updatePrivacy);
router.put('/notifications', userController.updateNotificationPreferences);
router.get('/:userId', userController.getUserProfile);

module.exports = router;
