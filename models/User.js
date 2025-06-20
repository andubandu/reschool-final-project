const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// const requiredEnvVars = [
//   'MAX_LOGIN_ATTEMPTS',
//   'LOCK_TIME_HOURS',
//   'VERIFICATION_CODE_EXPIRY'
// ];

// requiredEnvVars.forEach(envVar => {
//   if (!process.env[envVar]) {
//     throw new Error(`Missing required environment variable: ${envVar}`);
//   }
// });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId
    },
    minlength: [6, 'Password must be at least 6 characters long']
  },
  profilePhoto: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['viewer', 'author', 'admin'],
    default: 'viewer'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: null
  },
  verificationCodeExpiry: {
    type: Date,
    default: null
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  refreshToken: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationCode;
      delete ret.refreshToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ googleId: 1 });

userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incLoginAttempts = function() {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS);
  const lockTimeMs = parseInt(process.env.LOCK_TIME_HOURS) * 60 * 60 * 1000;
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    return this.updateOne({
      $set: {
        lockUntil: Date.now() + lockTimeMs,
        loginAttempts: this.loginAttempts + 1
      }
    });
  }
  
  return this.updateOne({
    $inc: { loginAttempts: 1 }
  });
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.generateVerificationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationCode = code;
  const expiryMinutes = parseInt(process.env.VERIFICATION_CODE_EXPIRY);
  this.verificationCodeExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return code;
};

userSchema.methods.verifyCode = function(code) {
  if (!this.verificationCode || !this.verificationCodeExpiry) {
    return false;
  }
  
  if (this.verificationCodeExpiry < new Date()) {
    return false;
  }
  
  return this.verificationCode === code;
};

module.exports = mongoose.model('User', userSchema);