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
        applicants: [],
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
        emailID: info.emailID,
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
        applicants: [],
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
  const token = req.cookies.token;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const jobList = await JobPost.find({ emailID: info.emailID }).sort({ createdAt: -1 }).limit(6);
      res.json(jobList);
    } catch (e) {
      res.json({ message: "server(500) error" });
    }
  });
});

router.post("/userList", async (req, res) => {
  const itemAppli = req.body.itemAppli;
  try {
    const emails = itemAppli.map((item) => item.emailID);
    const users = await User.find(
      { emailID: { $in: emails } },
      { password: 0 } // password 필드를 제외
    );
    res.json(users);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

router.get("/applied", async (req, res) => {
  const token = req.cookies.token;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const jobList = await JobPost.find({
        applicants: {
          $elemMatch: { emailID: info.emailID, status: { $in: [1, 2] } },
        },
      })
        .sort({ createdAt: -1 })
        .limit(6);
      res.json(jobList);
    } catch (e) {
      console.error("Server error: ", e);
      res.status(500).json({ message: "server(500) error" });
    }
  });
});

router.put("/hiring", async (req, res) => {
  const { jobPostID, AppliUser } = req.body;
  const token = req.cookies.token;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const jobPost = await JobPost.findById(jobPostID);
      if (!jobPost) {
        return res.status(404).json({ message: "해당 공고를 찾을 수 없습니다" });
      }
      if (info.emailID !== jobPost.emailID) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      if (jobPost.status === -1) {
        return res.status(404).json({ message: "지원을 취소한 사용자입니다." });
      }
      if (jobPost.status === 2) {
        return res.status(404).json({ message: "이미 채용된 공고입니다." });
      }

      const applicantIndex = jobPost.applicants.findIndex((applicant) => applicant.emailID === AppliUser);
      if (applicantIndex === -1) {
        return res.status(404).json({ message: "해당 지원자를 찾을 수 없습니다" });
      }

      jobPost.applicants[applicantIndex].matched = true;
      jobPost.applicants[applicantIndex].status = 2;
      jobPost.status = 2;
      await jobPost.save();

      res.status(200).json({ message: "지원자 매칭 및 공고 상태가 업데이트되었습니다" });
    } catch (e) {
      console.error("Server error: ", e);
      res.status(500).json({ message: "서버 에러가 발생했습니다" });
    }
  });
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

router.put("/application/:id", (req, res) => {
  const { id } = req.params;
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
      const jobPost = await JobPost.findById(id);
      if (!jobPost) {
        return res.status(404).json({ message: "해당 공고를 찾을 수 없습니다" });
      }

      const existingApplicant = jobPost.applicants.find((applicant) => applicant.emailID === user.emailID);
      if (existingApplicant) {
        if (existingApplicant.status === -1) {
          // 재지원 로직: 상태를 1로 업데이트
          existingApplicant.status = 1;
          existingApplicant.applicationDate = new Date();
        } else {
          // 다른 상태일 경우 오류 반환
          return res.status(400).json({ message: "이미 지원한 상태입니다." });
        }
      } else {
        // 새로운 지원자 추가
        const newApplicant = {
          name: user.userName,
          emailID: user.emailID,
          nickName: user.nickName,
          matched: false,
          status: 1,
          applicationDate: new Date(),
        };
        jobPost.applicants.push(newApplicant);
      }

      await jobPost.save();
      res.json(jobPost);
    } catch (error) {
      console.error("error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

router.put("/appCancell/:id", (req, res) => {
  const { id } = req.params;
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
      const jobPost = await JobPost.findById(id);
      if (!jobPost) {
        return res.status(404).json({ message: "해당 공고를 찾을 수 없습니다" });
      }
      const existingApplicant = jobPost.applicants.find((applicant) => applicant.email === user.emailID);
      if (existingApplicant) {
        if (existingApplicant.status === 1) {
          existingApplicant.status = -1;
          existingApplicant.applicationDate = new Date();
        } else {
          // 다른 상태일 경우 오류 반환
          return res.status(400).json({ message: "이미 취소된 상태입니다." });
        }
      } else {
        // 지원 기록이 없는 경우 오류 반환
        return res.status(400).json({ message: "지원 기록이 없습니다." });
      }
      await jobPost.save();
      res.json(jobPost);
    } catch (error) {
      console.error("error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

module.exports = router;
