const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// 스키마 정의
const JobPostSchema = new Schema({
  emailID: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  nickName: String,
  date: { type: Date, default: Date.now },
  endDate: Date,
  workDate: Date,
  location: String,
  pay: String,
  desc: String,
  status: { type: [String] },
  category: { type: [String], required: true },
});

const JobPostModel = model("JobPost", JobPostSchema, "job_post");
module.exports = JobPostModel;
