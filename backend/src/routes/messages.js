const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(protect);
router.get('/search', messageController.searchMessages);
router.get('/:chatId', messageController.getMessages);
router.post('/:chatId', upload.single('file'), messageController.sendMessage);
router.put('/:messageId/edit', messageController.editMessage);
router.delete('/:messageId', messageController.deleteMessage);
router.post('/:messageId/react', messageController.reactToMessage);
router.post('/:messageId/star', messageController.starMessage);
router.get('/:chatId/starred', messageController.getStarredMessages);
router.post('/:messageId/poll-vote', messageController.votePoll);

module.exports = router;
