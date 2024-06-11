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
    console.log(jobPostDoc);
    res.json(jobPostDoc);
  } catch (e) {
    console.error("Error creating document:", e.message);
    res.status(400).json({ message: "failed", error: e.message });
  }
});
module.exports = router;
