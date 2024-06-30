const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  emailID: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPwToken: String,
  resetPwExpires: Date,
  newPw: String,
  userName: { type: String, required: true },
  nickName: String,
  phone: { type: String, required: true },
  auth: String,
  account: String,
  image: String,
  career: String,
  certi: String,
  skill: String,
  time: String,
  introduce: String,
  certified: { type: Boolean, default: false },
});

const User = model("User", UserSchema);
module.exports = User;
