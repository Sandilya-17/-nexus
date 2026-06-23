const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Memory storage for all uploads (stream to cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-rar-compressed',
    'application/json',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Upload buffer to Cloudinary
const uploadToCloudinary = async (buffer, mimetype, folder = 'nexus') => {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype.startsWith('video/') ? 'video'
      : mimetype.startsWith('audio/') ? 'video'  // cloudinary uses 'video' for audio too
      : mimetype.startsWith('image/') ? 'image'
      : 'raw';

    cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        quality: 'auto',
        fetch_format: 'auto',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

// Generate thumbnail for video
const generateVideoThumbnail = async (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    transformation: [{ width: 400, height: 300, crop: 'fill' }, { format: 'jpg' }],
  });
};

module.exports = { upload, uploadToCloudinary, generateVideoThumbnail, cloudinary };
