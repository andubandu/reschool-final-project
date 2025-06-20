const jwt = require('jsonwebtoken');

// const requiredEnvVars = [
//   'JWT_SECRET',
//   'REFRESH_SECRET',
//   'ACCESS_TOKEN_EXPIRY',
//   'REFRESH_TOKEN_EXPIRY'
// ];

// requiredEnvVars.forEach(envVar => {
//   if (!process.env[envVar]) {
//     throw new Error(`Missing required environment variable: ${envVar}`);
//   }
// });

const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  const expiryString = process.env.ACCESS_TOKEN_EXPIRY;
  let expiresIn;
  
  if (expiryString.endsWith('m')) {
    expiresIn = parseInt(expiryString) * 60;
  } else if (expiryString.endsWith('h')) {
    expiresIn = parseInt(expiryString) * 60 * 60;
  } else if (expiryString.endsWith('d')) {
    expiresIn = parseInt(expiryString) * 24 * 60 * 60;
  } else {
    expiresIn = parseInt(expiryString);
  }
  
  return {
    accessToken,
    refreshToken,
    expiresIn
  };
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw error;
  }
};
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_SECRET);
  } catch (error) {
    throw error;
  }
};

const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken
};