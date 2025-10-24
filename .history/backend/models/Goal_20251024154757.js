const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const goalSchema = new Schema({
  id: { type: String, required: true, unique: true },
  student_id: { type: String, required: true },
  subject: { type: String, required: true },
  targetMinutes: { type: Number, required: true },
  period: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Goal', goalSchema);