const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
require('dotenv').config();
// const { swaggerUi, specs } = require('./config/swagger');
const path = require('path');
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'SESSION_SECRET',
  'NODE_ENV',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'SESSION_MAX_AGE_HOURS'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blogs');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');

const { swaggerUi, specs } = require('./config/swagger');

require('./config/passport');

const app = express();
const PORT = process.env.PORT;

app.set('trust proxy', 1);


const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const maxBodySize = `${process.env.MAX_FILE_SIZE_MB}mb`;
app.use(express.json({ limit: maxBodySize }));
app.use(express.urlencoded({ extended: true, limit: maxBodySize }));

const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE_HOURS) * 60 * 60 * 1000;
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: sessionMaxAge
  }
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: `express api documentation`
}));


app.get('/docs', (req, res) => {
  const apiInfo = {
    title: 'Express Blog API',
    version: '0.0.1',
    description: 'Blog api I made',
    contact: {
      name: 'API Support',
      email: process.env.EMAIL_USER
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ]
  };

  const schemas = {
    User: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'Unique identifier' },
        username: { type: 'string', example: 'johndoe', description: 'User\'s username' },
        email: { type: 'string', format: 'email', example: 'john@example.com', description: 'User\'s email address' },
        profilePhoto: { type: 'string', example: 'https://example.com/photo.jpg', description: 'Profile photo URL' },
        role: { type: 'string', enum: ['viewer', 'author', 'admin'], example: 'author', description: 'User role' },
        isVerified: { type: 'boolean', example: true, description: 'Account verification status' },
        lastLogin: { type: 'string', format: 'date-time', description: 'Last login timestamp' },
        createdAt: { type: 'string', format: 'date-time', description: 'Account creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      }
    },
    Blog: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'Unique identifier' },
        title: { type: 'string', example: 'My Amazing Blog Post', description: 'Blog post title' },
        content: { type: 'string', example: 'This is the content of my blog post...', description: 'Blog post content' },
        attachment: { type: 'string', example: 'https://example.com/image.jpg', description: 'Attachment URL' },
        author: { ref: 'User', description: 'Blog post author' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published', description: 'Publication status' },
        tags: { type: 'array', items: 'string', example: ['technology', 'programming'], description: 'Blog post tags' },
        readTime: { type: 'number', example: 5, description: 'Estimated read time in minutes' },
        views: { type: 'number', example: 150, description: 'View count' },
        likeCount: { type: 'number', example: 25, description: 'Like count' },
        commentCount: { type: 'number', example: 10, description: 'Comment count' },
        bookmarkCount: { type: 'number', example: 5, description: 'Bookmark count' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
      }
    },
    Comment: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'Unique identifier' },
        user: { ref: 'User', description: 'Comment author' },
        content: { type: 'string', example: 'Great article!', description: 'Comment content' },
        createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
        isEdited: { type: 'boolean', example: false, description: 'Edit status' }
      }
    },
    Error: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false, description: 'Success status' },
        message: { type: 'string', example: 'Error message', description: 'Error description' },
        errors: { type: 'array', items: 'string', description: 'Array of error details' }
      }
    },
    Success: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true, description: 'Success status' },
        message: { type: 'string', example: 'Operation successful', description: 'Success message' },
        data: { type: 'object', description: 'Response data' }
      }
    }
  };

  const endpointGroups = {
    Authentication: [
      {
        method: 'POST',
        path: '/auth/register',
        description: 'Register a new user',
        auth: false,
        requestBody: {
          schema: 'User',
          required: ['username', 'email', 'password'],
          example: {
            username: 'string',
            email: 'user@example.com',
            password: 'string'
          }
        },
        responses: {
          201: { schema: 'Success', description: 'User registered successfully' },
          400: { schema: 'Error', description: 'Validation error or user already exists' }
        }
      },
      {
        method: 'POST',
        path: '/auth/verify-email',
        description: 'Verify user email with code',
        auth: false,
        requestBody: {
          required: ['email', 'code'],
          example: {
            email: 'user@example.com',
            code: 'string'
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Email verified successfully' },
          400: { schema: 'Error', description: 'Invalid or expired code' }
        }
      },
      {
        method: 'POST',
        path: '/auth/login',
        description: 'Login user',
        auth: false,
        requestBody: {
          required: ['email', 'password'],
          example: {
            email: 'user@example.com',
            password: 'string'
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Login successful', data: 'User object with tokens' },
          401: { schema: 'Error', description: 'Invalid credentials' }
        }
      },
      {
        method: 'POST',
        path: '/auth/refresh',
        description: 'Refresh access token',
        auth: false,
        requestBody: {
          required: ['refreshToken'],
          example: {
            refreshToken: 'string'
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Token refreshed successfully' },
          401: { schema: 'Error', description: 'Invalid refresh token' }
        }
      },
      {
        method: 'GET',
        path: '/auth/google',
        description: 'Initiate Google OAuth login',
        auth: false,
        responses: {
          302: { description: 'Redirect to Google OAuth' }
        }
      },
      {
        method: 'GET',
        path: '/auth/google/callback',
        description: 'Google OAuth callback',
        auth: false,
        responses: {
          302: { description: 'Redirect after authentication' }
        }
      },
      {
        method: 'POST',
        path: '/auth/logout',
        description: 'Logout user',
        auth: true,
        responses: {
          200: { schema: 'Success', description: 'Logout successful' }
        }
      },
      {
        method: 'POST',
        path: '/auth/resend-verification',
        description: 'Resend verification code',
        auth: false,
        requestBody: {
          required: ['email'],
          example: {
            email: 'user@example.com'
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Verification code sent' },
          400: { schema: 'Error', description: 'Email already verified or user not found' }
        }
      },
      {
        method: 'GET',
        path: '/auth/me',
        description: 'Get current user profile',
        auth: true,
        responses: {
          200: { schema: 'Success', description: 'User profile retrieved successfully', data: 'User object' }
        }
      }
    ],
    Blogs: [
      {
        method: 'GET',
        path: '/blogs',
        description: 'Get all published blogs with pagination and filtering',
        auth: false,
        query: [
          { name: 'page', type: 'number', description: 'Page number', default: 1 },
          { name: 'limit', type: 'number', description: 'Number of blogs per page', default: 10 },
          { name: 'search', type: 'string', description: 'Search in title and content' },
          { name: 'author', type: 'string', description: 'Filter by author ID' },
          { name: 'tags', type: 'string', description: 'Comma-separated tags to filter by' },
          { name: 'sortBy', type: 'string', description: 'Sort field', enum: ['createdAt', 'views', 'likeCount', 'title'], default: 'createdAt' },
          { name: 'sortOrder', type: 'string', description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' }
        ],
        responses: {
          200: { schema: 'Success', description: 'Blogs retrieved successfully', data: 'Array of Blog objects with pagination' }
        }
      },
      {
        method: 'POST',
        path: '/blogs',
        description: 'Create a new blog post',
        auth: true,
        requestBody: {
          schema: 'Blog',
          required: ['title', 'content'],
          example: {
            title: 'string',
            content: 'string (min 50 characters)',
            attachment: 'string',
            status: 'draft',
            tags: ['string']
          }
        },
        responses: {
          201: { schema: 'Success', description: 'Blog created successfully', data: 'Created Blog object' },
          400: { schema: 'Error', description: 'Validation error' },
          401: { schema: 'Error', description: 'Authentication required' }
        }
      },
      {
        method: 'GET',
        path: '/blogs/:id',
        description: 'Get a specific blog by ID',
        auth: false,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        responses: {
          200: { schema: 'Success', description: 'Blog retrieved successfully', data: 'Blog object' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      },
      {
        method: 'PUT',
        path: '/blogs/:id',
        description: 'Update a blog post',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        requestBody: {
          schema: 'Blog',
          example: {
            title: 'string',
            content: 'string (min 50 characters)',
            attachment: 'string',
            status: 'draft',
            tags: ['string']
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Blog updated successfully' },
          403: { schema: 'Error', description: 'Access denied' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      },
      {
        method: 'DELETE',
        path: '/blogs/:id',
        description: 'Delete a blog post',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        responses: {
          200: { schema: 'Success', description: 'Blog deleted successfully' },
          403: { schema: 'Error', description: 'Access denied' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      },
      {
        method: 'POST',
        path: '/blogs/:id/like',
        description: 'Like or unlike a blog post',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        responses: {
          200: { schema: 'Success', description: 'Blog like status updated' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      },
      {
        method: 'POST',
        path: '/blogs/:id/bookmark',
        description: 'Bookmark or unbookmark a blog post',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        responses: {
          200: { schema: 'Success', description: 'Blog bookmark status updated' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      },
      {
        method: 'POST',
        path: '/blogs/:id/comments',
        description: 'Add a comment to a blog post',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'Blog ID', required: true }
        ],
        requestBody: {
          required: ['content'],
          example: {
            content: 'string'
          }
        },
        responses: {
          201: { schema: 'Success', description: 'Comment added successfully' },
          404: { schema: 'Error', description: 'Blog not found' }
        }
      }
    ],
    Uploads: [
      {
        method: 'POST',
        path: '/uploads/profile',
        description: 'Upload profile image',
        auth: true,
        requestBody: {
          contentType: 'multipart/form-data',
          fields: [
            { name: 'profileImage', type: 'file', description: 'Profile image file (max 10MB, jpg/png/gif/webp)' }
          ]
        },
        responses: {
          200: { schema: 'Success', description: 'Profile image uploaded successfully', data: 'Upload result with URL' },
          400: { schema: 'Error', description: 'Invalid file or upload error' },
          413: { schema: 'Error', description: 'File too large' }
        }
      },
      {
        method: 'POST',
        path: '/uploads/blog-attachment',
        description: 'Upload blog attachment/cover image',
        auth: true,
        requestBody: {
          contentType: 'multipart/form-data',
          fields: [
            { name: 'blogAttachment', type: 'file', description: 'Blog cover image file (max 10MB, jpg/png/gif/webp)' }
          ]
        },
        responses: {
          200: { schema: 'Success', description: 'Blog attachment uploaded successfully', data: 'Upload result with URL' },
          400: { schema: 'Error', description: 'Invalid file or upload error' }
        }
      },
      {
        method: 'POST',
        path: '/uploads/multiple',
        description: 'Upload multiple images (max 5)',
        auth: true,
        requestBody: {
          contentType: 'multipart/form-data',
          fields: [
            { name: 'images', type: 'file[]', description: 'Multiple image files (max 5 files, 10MB each)' }
          ]
        },
        responses: {
          200: { schema: 'Success', description: 'Images uploaded successfully', data: 'Array of upload results' },
          400: { schema: 'Error', description: 'Invalid files or upload error' }
        }
      }
    ],
    Users: [
      {
        method: 'GET',
        path: '/users',
        description: 'Get all users (Admin only)',
        auth: true,
        query: [
          { name: 'page', type: 'number', description: 'Page number', default: 1 },
          { name: 'limit', type: 'number', description: 'Number of users per page', default: 10 },
          { name: 'role', type: 'string', description: 'Filter by user role', enum: ['viewer', 'author', 'admin'] },
          { name: 'search', type: 'string', description: 'Search by username or email' }
        ],
        responses: {
          200: { schema: 'Success', description: 'Users retrieved successfully', data: 'Array of User objects' },
          403: { schema: 'Error', description: 'Access denied - Admin role required' }
        }
      },
      {
        method: 'GET',
        path: '/users/:id',
        description: 'Get user profile by ID',
        auth: false,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'User ID', required: true }
        ],
        responses: {
          200: { schema: 'Success', description: 'User profile retrieved successfully', data: 'User object with stats' },
          404: { schema: 'Error', description: 'User not found' }
        }
      },
      {
        method: 'GET',
        path: '/users/:id/blogs',
        description: 'Get user\'s published blogs',
        auth: false,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'User ID', required: true }
        ],
        query: [
          { name: 'page', type: 'number', description: 'Page number', default: 1 },
          { name: 'limit', type: 'number', description: 'Number of blogs per page', default: 10 }
        ],
        responses: {
          200: { schema: 'Success', description: 'User\'s blogs retrieved successfully' },
          404: { schema: 'Error', description: 'User not found' }
        }
      },
      {
        method: 'PUT',
        path: '/users/profile',
        description: 'Update current user\'s profile',
        auth: true,
        requestBody: {
          example: {
            username: 'string',
            profilePhoto: 'string'
          }
        },
        responses: {
          200: { schema: 'Success', description: 'Profile updated successfully' },
          400: { schema: 'Error', description: 'Validation error or username taken' }
        }
      },
      {
        method: 'DELETE',
        path: '/users/profile',
        description: 'Delete current user\'s account (You can delete anybody\'s account if you are admin)',
        auth: true,
        responses: {
          200: { schema: 'Success', description: 'Account deleted successfully' },
          403: { schema: 'Error', description: 'Access denied - Admin role required' }
        }
      },
      {
        method: 'PATCH',
        path: '/users/:id/role',
        description: 'Update user role (Admin only)',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', location: 'path', description: 'User ID', required: true }
        ],
        requestBody: {
          required: ['role'],
          example: {
            role: 'viewer' // author / admin / viewer
          }
        },
        responses: {
          200: { schema: 'Success', description: 'User role updated successfully' },
          403: { schema: 'Error', description: 'Access denied - Admin role required' },
          404: { schema: 'Error', description: 'User not found' }
        }
      },
  
    ]
  };

  res.render('docs', { 
    apiInfo, 
    schemas, 
    endpointGroups,
    title: 'API Documentation'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Express Blog API',
    documentation: 'Visit /docs for API documentation (/api-docs for Swagger UI, does not work in production)',
    apiVersion: '0.0.1'
  });
});



app.use('/auth', authRoutes);
app.use('/blogs', blogRoutes);
app.use('/users', userRoutes);
app.use('/uploads', uploadRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
  console.log(`API Documentation available at http://localhost:3000/api-docs`);
});

module.exports = app;