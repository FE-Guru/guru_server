const mongoose = require('mongoose');

const satisfiedSchema = new mongoose.Schema({
  emailID: { type: String, required: true },
  writerID: { type: String, required: true },
  starRating: { type: Number, required: true },
  kind: { type: Boolean, required: true },
  onTime: { type: Boolean, required: true },
  highQuality: { type: Boolean, required: true },
  unkind: { type: Boolean, required: true },
  notOnTime: { type: Boolean, required: true },
  lowQuality: { type: Boolean, required: true },
  etc: { type: Boolean, required: true },
  etcDescription: { type: String, default: '' }
});

module.exports = mongoose.model('Satisfied', satisfiedSchema);
