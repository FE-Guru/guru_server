const mongoose = require('mongoose');

const satisfiedSchema = new mongoose.Schema(
  {
    Post_id: { type: String, required: true },
    respondentID: { type: String, required: true }, // 조사 쓴 사람 이메일
    respondentNick: { type: String, required: true },
    recipientID: { type: String, required: true },
    matchedID: { type: String, required: true },
    writerID: { type: String, required: true },
    starRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    kind: { type: Number, required: true, default: 0 },
    onTime: { type: Number, required: true, default: 0 },
    highQuality: { type: Number, required: true, default: 0 },
    unkind: { type: Number, required: true, default: 0 },
    notOnTime: { type: Number, required: true, default: 0 },
    lowQuality: { type: Number, required: true, default: 0 },
    etc: { type: Number, required: true, default: 0 },
    etcDescription: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Satisfied', satisfiedSchema);
