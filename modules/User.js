const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  emailID: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userName: { type: String, required: true },
  nickName: { type: String },
  phone: { type: String, required: true },
  account: { type: String, required: true },
});

const UserModel = model("User", UserSchema);
module.exports = UserModel;
