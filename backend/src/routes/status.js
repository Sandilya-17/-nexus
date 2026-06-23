const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(protect);
router.get('/', statusController.getStatuses);
router.get('/my', statusController.getMyStatuses);
router.post('/', upload.single('media'), statusController.createStatus);
router.post('/:statusId/view', statusController.viewStatus);
router.post('/:statusId/react', statusController.reactToStatus);
router.post('/:statusId/reply', statusController.replyToStatus);
router.delete('/:statusId', statusController.deleteStatus);

module.exports = router;
