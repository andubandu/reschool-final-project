const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');


const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express Blog API',
      version: '0.0.1',
      description: 'Blog api I made',
      contact: {
        name: 'API Support',
        email: process.env.EMAIL_USER
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: "dev server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            username: { type: 'string', example: 'johndoe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            profilePhoto: { type: 'string', example: 'https://example.com/photo.jpg' },
            role: { type: 'string', enum: ['viewer', 'author', 'admin'], example: 'author' },
            isVerified: { type: 'boolean', example: true },
            lastLogin: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Blog: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            title: { type: 'string', example: 'My Amazing Blog Post' },
            content: { type: 'string', example: 'This is the content of my blog post...' },
            attachment: { type: 'string', example: 'https://example.com/image.jpg' },
            author: { $ref: '#/components/schemas/User' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
            tags: { type: 'array', items: { type: 'string' }, example: ['technology', 'programming'] },
            readTime: { type: 'number', example: 5 },
            views: { type: 'number', example: 150 },
            likeCount: { type: 'number', example: 25 },
            commentCount: { type: 'number', example: 10 },
            bookmarkCount: { type: 'number', example: 5 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            user: { $ref: '#/components/schemas/User' },
            content: { type: 'string', example: 'Great article!' },
            createdAt: { type: 'string', format: 'date-time' },
            isEdited: { type: 'boolean', example: false }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            errors: { type: 'array', items: { type: 'string' } }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './index.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};