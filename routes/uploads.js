const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfileImage, uploadBlogAttachment } = require('../utils/cloudinary');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = os.tmpdir();
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024, 
    files: 1
  },
  fileFilter: fileFilter
});

const cleanupTempFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temp file:', error);
  }
};

/**
 * @swagger
 * /uploads/profile:
 *   post:
 *     summary: Upload profile image
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file (max 10MB, jpg/png/gif/webp)
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: Cloudinary URL of uploaded image
 *                     publicId:
 *                       type: string
 *                     width:
 *                       type: integer
 *                     height:
 *                       type: integer
 *       400:
 *         description: Invalid file or upload error
 *       413:
 *         description: File too large
 */
router.post('/profile', authenticateToken, (req, res) => {
  upload.single('profileImage')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB}MB.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a profile image.'
      });
    }

    try {
      const result = await uploadProfileImage(req.file.path);

      cleanupTempFile(req.file.path);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload image to cloud storage',
          error: result.error
        });
      }

      req.user.profilePhoto = result.url;
      await req.user.save();

      res.json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format
        }
      });
    } catch (error) {
      cleanupTempFile(req.file.path);
      
      console.error('Profile upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload profile image'
      });
    }
  });
});

/**
 * @swagger
 * /uploads/blog-attachment:
 *   post:
 *     summary: Upload blog attachment/cover image
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               blogAttachment:
 *                 type: string
 *                 format: binary
 *                 description: Blog cover image file (max 10MB, jpg/png/gif/webp)
 *     responses:
 *       200:
 *         description: Blog attachment uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: Cloudinary URL of uploaded image
 *                     publicId:
 *                       type: string
 *                     width:
 *                       type: integer
 *                     height:
 *                       type: integer
 *       400:
 *         description: Invalid file or upload error
 */
router.post('/blog-attachment', authenticateToken, (req, res) => {
  upload.single('blogAttachment')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB}MB.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a blog attachment.'
      });
    }

    try {
      const result = await uploadBlogAttachment(req.file.path);

      cleanupTempFile(req.file.path);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload image to cloud storage',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: 'Blog attachment uploaded successfully',
        data: {
          url: result.url,
          publicId: result.publicId,
          width: result.width,
          height: result.height,
          format: result.format
        }
      });
    } catch (error) {
      cleanupTempFile(req.file.path);
      
      console.error('Blog attachment upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload blog attachment'
      });
    }
  });
});

/**
 * @swagger
 * /uploads/multiple:
 *   post:
 *     summary: Upload multiple images (max 5)
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple image files (max 5 files, 10MB each)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploads:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                           width:
 *                             type: integer
 *                           height:
 *                             type: integer
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           filename:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid files or upload error
 */
router.post('/multiple', authenticateToken, (req, res) => {
  const maxFiles = parseInt(process.env.MAX_FILES_COUNT);
  const uploadMultiple = upload.array('images', maxFiles);
  
  uploadMultiple(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: `One or more files are too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB}MB per file.`
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum is ${maxFiles} files per upload.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please select at least one image.'
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await uploadBlogAttachment(file.path);
        cleanupTempFile(file.path);
        
        if (result.success) {
          return {
            success: true,
            filename: file.originalname,
            url: result.url,
            publicId: result.publicId,
            width: result.width,
            height: result.height,
            format: result.format
          };
        } else {
          return {
            success: false,
            filename: file.originalname,
            error: result.error
          };
        }
      } catch (error) {
        cleanupTempFile(file.path);
        return {
          success: false,
          filename: file.originalname,
          error: error.message
        };
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length === 0) {
        return res.status(500).json({
          success: false,
          message: 'All uploads failed',
          data: { failed }
        });
      }

      res.json({
        success: true,
        message: `${successful.length} image(s) uploaded successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
        data: {
          uploads: successful.map(({ success, ...rest }) => rest),
          failed: failed.map(({ success, ...rest }) => rest)
        }
      });
    } catch (error) {
      req.files.forEach(file => cleanupTempFile(file.path));
      
      console.error('Multiple upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process uploads'
      });
    }
  });
});

module.exports = router;