const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CommentSchema = new Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    authorID: { type: String, required: true },
    authorNickName: { type: String, required: true },
    authorImg: { type: String },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Comment = model("Comment", CommentSchema, "comments");
module.exports = Comment;
