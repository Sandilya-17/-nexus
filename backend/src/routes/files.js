const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../middleware/upload');

router.use(protect);

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file provided.' });
  const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'nexus/files');
  res.json({
    success: true,
    url: result.secure_url,
    publicId: result.public_id,
    name: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

module.exports = router;
