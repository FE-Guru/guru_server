const express = require("express");
const router = express.Router();
const JobPost = require("./modules/JobPost");
const User = require("./modules/User");
const jwt = require("jsonwebtoken");
const jwtSecret = "hjetydghnmjklghrtwijoerjkufgshjbkl";

router.post("/jobWrit", async (req, res) => {
  const { title, endDate, workStartDate, workEndDate, location, pay, desc, category } = req.body;
  const token = req.cookies.token;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const user = await User.findById(info.id);
      if (!user) {
        return res.status(404).json({ message: "없는 유저입니다" });
      }
      const jobPostDoc = await JobPost.create({
        emailID: user.emailID,
        nickName: user.nickName,
        title,
        endDate,
        location,
        workStartDate,
        workEndDate,
        pay,
        desc,
        status: 1,
        category,
      });
      res.json(jobPostDoc);
    } catch (error) {
      console.error("error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

router.get("/jobEdit/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const jobPostDoc = await JobPost.findById(id);
    res.json(jobPostDoc);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

router.put("/jobEdit/:id", async (req, res) => {
  const { id } = req.params;
  const { title, endDate, workStartDate, workEndDate, location, pay, desc, category } = req.body;
  const token = req.cookies.token;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const user = await User.findById(info.id);
      if (!user) {
        return res.status(404).json({ message: "없는 유저입니다" });
      }
      const jobPostDoc = await JobPost.findByIdAndUpdate(id, {
        emailID: user.emailID,
        nickName: user.nickName,
        title,
        endDate,
        location,
        workStartDate,
        workEndDate,
        pay,
        desc,
        status: 1,
        category,
      });
      res.json(jobPostDoc);
    } catch (error) {
      console.error("error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

router.delete("/deleteJob/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await JobPost.findByIdAndDelete(id);
    res.json({ message: "ok" });
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

router.get("/jobOffer", async (req, res) => {
  try {
    const jobList = await JobPost.find().sort({ createdAt: -1 }).limit(6);
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});
router.get("/findonLine", async (req, res) => {
  try {
    const jobList = await JobPost.find({ "category.jobType": "onLine" }).sort({ createdAt: -1 }).limit(8);
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});
router.get("/findoffLine", async (req, res) => {
  try {
    const jobList = await JobPost.find({ "category.jobType": "offLine" }).sort({ createdAt: -1 }).limit(8);
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});
router.get("/JobDetail/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const jobPostDoc = await JobPost.findById(id);
    res.json(jobPostDoc);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

module.exports = router;
