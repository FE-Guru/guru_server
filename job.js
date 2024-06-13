const express = require("express");
const router = express.Router();
const JobPost = require("./modules/JobPost");

router.post("/jobWrit", async (req, res) => {
  const { emailID, nickName, title, endDate, workStartDate, workEndDate, location, pay, desc, category } = req.body;
  console.log(req.body);
  try {
    const jobPostDoc = await JobPost.create({
      emailID,
      nickName,
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
  } catch (e) {
    console.error("Error creating document:", e.message);
    res.status(400).json({ message: "failed", error: e.message });
  }
});

router.get("/jobOffer", async (req, res) => {
  try {
    const jobList = await JobPost.find().sort({ createdAt: -1 }).limit(8);
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

module.exports = router;
