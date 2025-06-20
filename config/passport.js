const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

// const requiredEnvVars = [
//   'GOOGLE_CLIENT_ID',
//   'GOOGLE_CLIENT_SECRET',
//   'JWT_SECRET'
// ];

// requiredEnvVars.forEach(envVar => {
//   if (!process.env[envVar]) {
//     throw new Error(`Missing required environment variable: ${envVar}`);
//   }
// });

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }
    
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      user.googleId = profile.id;
      user.isVerified = true; 
      user.lastLogin = new Date();
      
      if (!user.profilePhoto && profile.photos[0]) {
        user.profilePhoto = profile.photos[0].value;
      }
      
      await user.save();
      return done(null, user);
    }
    
    user = await User.create({
      googleId: profile.id,
      username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
      email: profile.emails[0].value,
      profilePhoto: profile.photos[0] ? profile.photos[0].value : null,
      isVerified: true, 
      role: 'author',
      lastLogin: new Date()
    });
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
}, async (payload, done) => {
  try {
    const user = await User.findById(payload.id);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;