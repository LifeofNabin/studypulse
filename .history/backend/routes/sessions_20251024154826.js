const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  id: { type: String, required: true, unique: true },
  room_id: { type: String, required: true },
  student_id: { type: String, required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date },
  is_active: { type: Boolean, default: true },
  consent: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Session', sessionSchema);