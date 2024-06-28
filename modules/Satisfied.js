const mongoose = require('mongoose');

const satisfiedSchema = new mongoose.Schema({
  Post_id: { type: String, required: true },
  emailID: { type: String, required: true },
  writerID: { type: String, required: true },
  starRating: { type: Number, required: true },
  kind: { type: Number, required: true },
  onTime: { type: Number, required: true },
  highQuality: { type: Number, required: true },
  unkind: { type: Number, required: true },
  notOnTime: { type: Number, required: true },
  lowQuality: { type: Number, required: true },
  etc: { type: Number, required: true },
  etcDescription: { type: String, default: '' }
},
{ timestamps: true }
);

module.exports = mongoose.model('Satisfied', satisfiedSchema);
