const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

function configurePassport(db) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.collection('users').findOne({ id });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await db.collection('users').findOne({ email });

        if (user) {
          await db.collection('users').updateOne(
            { id: user.id },
            { $set: { googleId: profile.id, avatar: profile.photos[0]?.value, lastLogin: new Date() }}
          );
          return done(null, user);
        }

        const newUser = {
          id: uuidv4(),
          googleId: profile.id,
          email: email,
          name: profile.displayName,
          role: 'student',
          avatar: profile.photos[0]?.value,
          created_at: new Date(),
          lastLogin: new Date()
        };

        await db.collection('users').insertOne(newUser);
        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }));
    console.log('✓ Google OAuth configured');
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8000/api/auth/github/callback',
      scope: ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0]?.value;
        if (!email) return done(new Error('No email from GitHub'), null);

        let user = await db.collection('users').findOne({ email });

        if (user) {
          await db.collection('users').updateOne(
            { id: user.id },
            { $set: { githubId: profile.id, avatar: profile.photos[0]?.value, lastLogin: new Date() }}
          );
          return done(null, user);
        }

        const newUser = {
          id: uuidv4(),
          githubId: profile.id,
          email: email,
          name: profile.displayName || profile.username,
          role: 'student',
          avatar: profile.photos[0]?.value,
          created_at: new Date(),
          lastLogin: new Date()
        };

        await db.collection('users').insertOne(newUser);
        done(null, newUser);
      } catch (error) {
        done(error, null);
  }
}));
    console.log('✓ GitHub OAuth configured');
  }
}

module.exports = { configurePassport };