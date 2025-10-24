const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const metricSchema = new Schema({
  session_id: { type: String, required: true },
  attention_score: { type: Number },
  fatigue_level: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Metric', metricSchema);