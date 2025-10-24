const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String },
  teacher_id: { type: String, required: true },
  room_code: { type: String, unique: true },
  is_active: { type: Boolean, default: true },
  allowed_students: [{ type: String }],
  students_count: { type: Number, default: 0 },
  pdf_file: {
    name: String,
    filename: String,
    path: String,
    size: Number,
    uploaded_at: Date,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', roomSchema);