const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/initiate', callController.initiateCall);
router.post('/:callId/answer', callController.answerCall);
router.post('/:callId/end', callController.endCall);
router.post('/:callId/signal', callController.signal);
router.get('/history', callController.getCallHistory);
router.get('/ice-config', callController.getIceConfig);

module.exports = router;
