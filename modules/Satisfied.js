const mongoose = require('mongoose');

const satisfactionSchema = new mongoose.Schema({
  Post_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  repondentID: { type: String, required: true },
  repondentNick: { type: String, required: true },
  recipientID: { type: String, required: true },
  matchedID: { type: String, required: true },
  writerID: { type: String, required: true },
  starRating: { type: Number, required: true },
  kind: { type: Number, required: true },
  onTime: { type: Number, required: true },
  highQuality: { type: Number, required: true },
  unkind: { type: Number, required: true },
  notOnTime: { type: Number, required: true },
  lowQuality: { type: Number, required: true },
  etc: { type: Number, required: true },
  etcDescription: { type: String },
});

const Satisfied = mongoose.model('Satisfied', satisfactionSchema);

module.exports = Satisfied;
