const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  googleId: { type: String, sparse: true },
  githubId: { type: String, sparse: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, default: 'Unknown' },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  avatar: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);