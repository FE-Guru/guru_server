const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CategorySchema = new Schema(
  {
    jobType: { type: String, required: true },
    time: { type: Number, required: true },
    talent: { type: String, required: true },
    field: { type: String, required: true },
  },
  { _id: false }
);
const locationSchema = new Schema(
  {
    zonecode: { type: String },
    address: { type: String },
    detailedAddress: { type: String },
    mapX: { type: String },
    mapY: { type: String },
  },
  { _id: false }
);

// 스키마 정의
const JobPostSchema = new Schema(
  {
    emailID: { type: String, required: true },
    title: { type: String, required: true },
    nickName: String,
    endDate: Date,
    workStartDate: Date,
    workEndDate: Date,
    location: { type: locationSchema },
    pay: Number,
    desc: String,
    status: Number,
    category: { type: CategorySchema, required: true },
  },
  { timestamps: true }
);

const JobPost = model("JobPost", JobPostSchema, "job_post");
module.exports = JobPost;
