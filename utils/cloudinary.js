const cloudinary = require('cloudinary').v2;


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const defaultOptions = {
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto'
    };

    const uploadOptions = { ...defaultOptions, ...options };
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const generateOptimizedUrl = (publicId, options = {}) => {
  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto'
  };

  const transformations = { ...defaultTransformations, ...options };
  
  return cloudinary.url(publicId, transformations);
};

const uploadProfileImage = async (filePath) => {
  return uploadToCloudinary(filePath, {
    folder: 'profile_images',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  });
};

const uploadBlogAttachment = async (filePath) => {
  return uploadToCloudinary(filePath, {
    folder: 'blog_attachments',
    transformation: [
      { width: 1200, height: 630, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  generateOptimizedUrl,
  uploadProfileImage,
  uploadBlogAttachment
};