const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

function configurePassport(db) {
  db.collection('users')
    .createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { googleId: 1 }, sparse: true },
      { key: { githubId: 1 }, sparse: true },
    ])
    .catch((err) => console.error('Failed to create indexes:', err));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.collection('users').findOne({ id });
      if (!user) return done(new Error('User not found'), null);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  const requiredEnv = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
  ];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    console.error(`Missing environment variables: ${missingEnv.join(', ')}`);
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'), null);

            let user = await db.collection('users').findOne({ email });

            if (user) {
              await db.collection('users').updateOne(
                { id: user.id },
                {
                  $set: {
                    googleId: profile.id,
                    avatar: profile.photos?.[0]?.value || null,
                    lastLogin: new Date(),
                  },
                }
              );
              return done(null, user);
            }

            const newUser = {
              id: uuidv4(),
              googleId: profile.id,
              email,
              name: profile.displayName || 'Unknown',
              role: 'student',
              avatar: profile.photos?.[0]?.value || null,
              created_at: new Date(),
              lastLogin: new Date(),
            };

            await db.collection('users').insertOne(newUser);
            done(null, newUser);
          } catch (error) {
            done(error, null);
          }
        }
      )
    );
    console.log('✓ Google OAuth configured');
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8000/api/auth/github/callback',
          scope: ['user:email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from GitHub'), null);

            let user = await db.collection('users').findOne({ email });

            if (user) {
              await db.collection('users').updateOne(
                { id: user.id },
                {
                  $set: {
                    githubId: profile.id,
                    avatar: profile.photos?.[0]?.value || null,
                    lastLogin: new Date(),
                  },
                }
              );
              return done(null, user);
            }

            const newUser = {
              id: uuidv4(),
              githubId: profile.id,
              email,
              name: profile.displayName || profile.username || 'Unknown',
              role: 'student',
              avatar: profile.photos?.[0]?.value || null,
              created_at: new Date(),
              lastLogin: new Date(),
            };

            await db.collection('users').insertOne(newUser);
            done(null, newUser);
          } catch (error) {
            done(error, null);
          }
        }
      )
    );
    console.log('✓ GitHub OAuth configured');
  }
}

module.exports = { configurePassport };