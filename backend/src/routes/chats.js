const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', chatController.getChats);
router.post('/direct', chatController.createDirectChat);
router.get('/:chatId', chatController.getChatById);
router.put('/:chatId/archive', chatController.archiveChat);
router.put('/:chatId/mute', chatController.muteChat);
router.post('/:chatId/pin/:messageId', chatController.pinMessage);
router.delete('/:chatId/clear', chatController.clearChat);

module.exports = router;
