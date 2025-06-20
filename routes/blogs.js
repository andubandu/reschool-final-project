const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Blog = require('../models/Blog');
const User = require('../models/User');
const { authenticateToken, requireVerification, requireOwnershipOrAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /blogs:
 *   get:
 *     summary: Get all published blogs with pagination and filtering
 *     tags: [Blogs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of blogs per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and content
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filter by author ID
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags to filter by
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, views, likeCount, title]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Blogs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     blogs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Blog'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalBlogs:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 */
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search query too long'),
  query('sortBy').optional().isIn(['createdAt', 'views', 'likeCount', 'title']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
      });
    }

    const {
      page = 1,
      limit = 10,
      search,
      author,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { status: 'published' };

    if (search) {
      query.$text = { $search: search };
    }

    if (author) {
      query.author = author;
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    const sort = {};
    if (sortBy === 'likeCount') {
      sort['likes'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find(query)
        .populate('author', 'username profilePhoto')
        .populate('comments.user', 'username profilePhoto')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Blog.countDocuments(query)
    ]);
    const blogsWithUserData = blogs.map(blog => {
      const blogData = {
        ...blog,
        likeCount: blog.likes ? blog.likes.length : 0,
        commentCount: blog.comments ? blog.comments.length : 0,
        bookmarkCount: blog.bookmarks ? blog.bookmarks.length : 0
      };

      if (req.user) {
        blogData.isLiked = blog.likes ? blog.likes.some(like => like.user.toString() === req.user._id.toString()) : false;
        blogData.isBookmarked = blog.bookmarks ? blog.bookmarks.some(bookmark => bookmark.user.toString() === req.user._id.toString()) : false;
      }

      return blogData;
    });

    const totalPages = Math.ceil(totalBlogs / limitNum);

    res.json({
      success: true,
      data: {
        blogs: blogsWithUserData,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalBlogs,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blogs'
    });
  }
});

/**
 * @swagger
 * /blogs:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 50
 *               attachment:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published]
 *                 default: draft
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Blog created successfully
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
 *                   $ref: '#/components/schemas/Blog'
 */
router.post('/', authenticateToken, requireVerification, [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .trim()
    .isLength({ min: 50 })
    .withMessage('Content must be at least 50 characters long'),
  body('attachment')
    .optional()
    .isURL()
    .withMessage('Attachment must be a valid URL'),
  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be either draft or published'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag must be at most 30 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
      });
    }

    const { title, content, attachment, status = 'draft', tags = [] } = req.body;

    const blog = new Blog({
      title,
      content,
      attachment,
      author: req.user._id,
      status,
      tags: tags.filter(tag => tag.trim().length > 0)
    });

    await blog.save();
    await blog.populate('author', 'username profilePhoto');

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: blog
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}:
 *   get:
 *     summary: Get a specific blog by ID
 *     tags: [Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       404:
 *         description: Blog not found
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author', 'username profilePhoto role')
      .populate('comments.user', 'username profilePhoto');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (blog.status !== 'published' && (!req.user || blog.author._id.toString() !== req.user._id.toString())) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (blog.status === 'published') {
      await blog.incrementViews();
    }

    const blogData = blog.toObject();
    if (req.user) {
      blogData.isLiked = blog.isLikedBy(req.user._id);
      blogData.isBookmarked = blog.isBookmarkedBy(req.user._id);
    }

    res.json({
      success: true,
      data: blogData
    });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blog'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}:
 *   put:
 *     summary: Update a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 50
 *               attachment:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Blog updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Blog not found
 */
router.put('/:id', authenticateToken, requireVerification, requireOwnershipOrAdmin(Blog), [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 50 })
    .withMessage('Content must be at least 50 characters long'),
  body('attachment')
    .optional()
    .isURL()
    .withMessage('Attachment must be a valid URL'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
      });
    }

    const updateData = req.body;
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (updateData.tags) {
      updateData.tags = updateData.tags.filter(tag => tag.trim().length > 0);
    }

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('author', 'username profilePhoto');

    res.json({
      success: true,
      message: 'Blog updated successfully',
      data: blog
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Blog not found
 */
router.delete('/:id', authenticateToken, requireOwnershipOrAdmin(Blog), async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}/like:
 *   post:
 *     summary: Like or unlike a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog like status updated
 *       404:
 *         description: Blog not found
 */
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    const isLiked = blog.isLikedBy(req.user._id);
    
    if (isLiked) {
      blog.removeLike(req.user._id);
    } else {
      blog.addLike(req.user._id);
    }

    await blog.save();

    res.json({
      success: true,
      message: isLiked ? 'Blog unliked successfully' : 'Blog liked successfully',
      data: {
        isLiked: !isLiked,
        likeCount: blog.likes.length
      }
    });
  } catch (error) {
    console.error('Like blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update like status'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}/bookmark:
 *   post:
 *     summary: Bookmark or unbookmark a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     responses:
 *       200:
 *         description: Blog bookmark status updated
 *       404:
 *         description: Blog not found
 */
router.post('/:id/bookmark', authenticateToken, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    const isBookmarked = blog.isBookmarkedBy(req.user._id);
    
    if (isBookmarked) {
      blog.removeBookmark(req.user._id);
    } else {
      blog.addBookmark(req.user._id);
    }

    await blog.save();

    res.json({
      success: true,
      message: isBookmarked ? 'Blog unbookmarked successfully' : 'Blog bookmarked successfully',
      data: {
        isBookmarked: !isBookmarked,
        bookmarkCount: blog.bookmarks.length
      }
    });
  } catch (error) {
    console.error('Bookmark blog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bookmark status'
    });
  }
});

/**
 * @swagger
 * /blogs/{id}/comments:
 *   post:
 *     summary: Add a comment to a blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       404:
 *         description: Blog not found
 */
router.post('/:id/comments', authenticateToken, [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
      });
    }

    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (blog.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot comment on unpublished blogs'
      });
    }

    blog.addComment(req.user._id, req.body.content);
    await blog.save();

    const updatedBlog = await Blog.findById(req.params.id)
      .populate('comments.user', 'username profilePhoto');
    
    const newComment = updatedBlog.comments[updatedBlog.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

module.exports = router;