require("dotenv").config();

const port = 8000;
const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(10);
const jwt = require("jsonwebtoken");
const jwtSecret = process.env.SECRET_KEY;
const cookieParser = require("cookie-parser");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const path = require("path");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const twilio = require("twilio");
const accountSid = process.env.SID;
const authToken = process.env.TOKEN;
const client = twilio(accountSid, authToken);
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const cron = require("node-cron");

const User = require("./modules/User");
const Satisfied = require("./modules/Satisfied");
const JobPost = require("./modules/JobPost");
const Comment = require("./modules/Comment");

const { log } = require("console");

//비번찾기 메일전송
const transporter = nodemailer.createTransport({
  service: "naver",
  host: "smtp.naver.com",
  port: 465,
  auth: {
    user: process.env.NAVER_EMAIL,
    pass: process.env.NAVER_PASSWORD,
  },
});
const verifiedCodes = {};

const allowedOrigins = ["http://localhost:3000", "https://hpe-guru.netlify.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
mongoose.connect(process.env.MONGO_URI);

app.get("/", (req, res) => {
  res.send("8000 server request");
});

//회원가입
app.post("/signup", async (req, res) => {
  const { emailID, password, userName, nickName, phone, auth, account } = req.body;

  try {
    // 이메일 아이디 중복 체크
    const existUser = await User.findOne({ emailID });
    if (existUser) {
      return res.status(409).json({ message: "이미 존재하는 이메일 아이디 입니다." });
    }

    // 전화번호로 기존 사용자 찾기
    const user = await User.findOne({ phone });
    if (user) {
      if (user.auth === auth) {
        // 사용자 정보 업데이트
        user.emailID = emailID;
        user.password = bcrypt.hashSync(password, salt);
        user.userName = userName;
        user.nickName = nickName;
        user.account = account;
        await user.save();
        return res.json(user);
      } else {
        return res.status(400).json({ message: "인증 실패 또는 사용자 없음" });
      }
    } else {
      // 새로운 사용자 생성
      const newUser = new User({
        emailID,
        password: bcrypt.hashSync(password, salt),
        userName,
        nickName,
        phone,
        auth,
        account,
      });
      await newUser.save();
      return res.json(newUser);
    }
  } catch (e) {
    res.status(400).json({ message: "failed", error: e.message });
  }
});

//회원가입시 폰인증
app.post("/sendsms", async (req, res) => {
  const { phone: phoneNumber } = req.body;

  const phoneParsed = parsePhoneNumberFromString(phoneNumber, "KR");
  if (!phoneParsed || !phoneParsed.isValid()) {
    return res.status(400).json({ success: false, error: "부정확한 연락처 형식" });
  }
  const formattedPhone = phoneParsed.number;

  let authNum = "";
  for (let i = 0; i < 4; i++) authNum += Math.floor(Math.random() * 10);

  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_FROM,
      body: `[GURU] 인증번호는 [${authNum}] 입니다. 정확히 입력해주세요.`,
      to: formattedPhone,
    });

    verifiedCodes[formattedPhone] = authNum;

    // console.log("문자 전송함:", message.sid);
    // console.log("저장된 인증번호:", verifiedCodes);

    res.json({ success: true, sid: message.sid, auth: authNum });
  } catch (error) {
    console.error("Twilio 에러:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function verifyCode(phone, code) {
  // console.log("검증 시도 - 저장된 인증번호:", verifiedCodes);
  const savedCode = verifiedCodes[phone];
  // console.log("입력된 전화번호:", phone);
  // console.log("저장된 인증번호:", savedCode);
  // console.log("입력된 인증번호:", code);
  if (savedCode && savedCode === code) {
    return true;
  }
  return false;
}

//인증번호랑 입력한거랑 비교
app.post("/verifycode", async (req, res) => {
  const { phone, code } = req.body;

  try {
    const phoneParsed = parsePhoneNumberFromString(phone, "KR");
    const formattedPhone = phoneParsed.number;

    const user = await User.findOne({ phone: formattedPhone });
    if (user) {
      if (user.auth === code) {
        return res.json({ success: true });
      } else {
        return res.status(400).json({ success: false, error: "부정확한 코드" });
      }
    }

    const isCodeValid = await verifyCode(formattedPhone, code);
    if (isCodeValid) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: "부정확한 코드" });
    }
  } catch (error) {
    console.error("서버 에러:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//회원가입 안내 페이지
app.post("/signupok", async (req, res) => {
  const { emailID, password, userName, nickName, phone, account } = req.body;
  try {
    const userDoc = await User.create({
      emailID,
      password: bcrypt.hashSync(password, salt),
      userName,
      nickName,
      phone,
      account,
    });
    res.json(userDoc);
  } catch (e) {
    res.status(400).json({ message: "failed", error: e.message });
  }
});

//토큰 유효성 검증
app.post("/verify-token", (req, res) => {
  const headerToken = req.headers.authorization;

  if (!headerToken) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }

  const token = headerToken.split(" ")[1];

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    res.status(200).json({ message: "토큰이 유효합니다" });
  });
});

//로그인
app.post("/login", async (req, res) => {
  const { emailID, password } = req.body;
  const userDoc = await User.findOne({ emailID });

  if (!userDoc) {
    return res.status(404).json({ message: "사용자가 없습니다" });
  }

  const pass = bcrypt.compareSync(password, userDoc.password);
  if (pass) {
    jwt.sign({ emailID, id: userDoc._id }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        token,
        id: userDoc._id,
        emailID,
        userName: userDoc.userName,
        nickName: userDoc.nickName,
      });
    });
  } else {
    res.status(401).json({ message: "비밀번호가 일치하지 않습니다" });
  }
});

app.get("/profile", (req, res) => {
  const headerToken = req.headers.authorization;

  if (!headerToken) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }
  // console.log("token : ", headerToken);
  const token = headerToken.split(" ")[1];

  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }

    try {
      const user = await User.findById(info.id);
      if (!user) {
        return res.status(404).json({ message: "없는 유저입니다" });
      }
      const userInfo = {
        emailID: user.emailID,
        userName: user.userName,
        nickName: user.nickName,
        phone: user.phone,
        account: user.account,
        certified: user.certified,
        image: user.image,
      };
      res.json(userInfo);
    } catch (error) {
      console.error("User error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

app.get("/findUser/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findOne({ emailID: id });
    res.json(user);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.put("/profileWrite", upload.single("files"), async (req, res) => {
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];
  const { career, certi, skill, time, introduce } = req.body;
  if (!token) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }
  let emailID, _id;
  try {
    const decoded = jwt.verify(token, jwtSecret);
    emailID = decoded.emailID;
    _id = decoded.id;
  } catch (err) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const part = originalname.split(".");
    const ext = part[part.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "없는 유저입니다" });
    }
    // 사용자 정보 업데이트
    user.career = career || user.career;
    user.certi = certi || user.certi;
    user.skill = skill || user.skill;
    user.time = time || user.time;
    user.introduce = introduce || user.introduce;
    user.certified = true;
    user.image = newPath ? newPath : user.image;
    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("User error: ", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

//회원탈퇴
app.delete("/mypage/acctdelete", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const pickToken = jwt.verify(token, jwtSecret);

    const userEmail = pickToken.emailID;
    // console.log("pickToken", pickToken);
    await User.findOneAndDelete({ emailID: userEmail });
    res.status(200).send({ message: "회원탈퇴 완료" });
  } catch (error) {
    res.status(500).send({ message: "회원탈퇴 에러", error });
  }
});

//회원정보 수정
app.post("/mypage/personaledit", async (req, res) => {
  const { emailID, password, nickName, phone, account } = req.body;

  try {
    let isPwChanged = false;
    let isUpdated = false;
    const user = await User.findOne({ emailID });

    if (!user) {
      return res.status(404).json({ message: "없는 유저입니다." });
    }

    if (password) {
      const isSamePw = await bcrypt.compare(password, user.password);
      if (!isSamePw) {
        user.password = await bcrypt.hash(password, 10);
        isPwChanged = true;
        isUpdated = true;
      }
    }
    if (user.nickName !== nickName || user.phone !== phone || user.account !== account) {
      user.nickName = nickName;
      user.phone = phone;
      user.account = account;
      isUpdated = true;
    }
    await user.save();

    const token = jwt.sign(
      {
        emailID: user.emailID,
        id: user._id,
        nickName: user.nickName,
        phone: user.phone,
        account: user.account,
      },
      jwtSecret,
      {}
    );

    res.status(200).json({
      message: "유저 정보 수정 성공",
      token: token,
      isPwChanged: isPwChanged,
      isUpdated: isUpdated,
      emailID: user.emailID,
    });
  } catch (error) {
    console.error("유저정보 수정중 에러발생:", error);
    res.status(500).json({ message: "서버에러" });
  }
});

//아이디찾기
app.post("/findacct/id", async (req, res) => {
  const { userName, phone } = req.body;

  try {
    const user = await User.findOne({ userName, phone });
    if (user) {
      res.status(200).json({ emailID: user.emailID });
    } else {
      res.status(404).json({ message: "해당 유저가 없습니다" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/findacct/pw", async (req, res) => {
  const { emailID } = req.body;

  try {
    const user = await User.findOne({ emailID });
    if (!user) {
      return res.status(404).json({ message: "없는 유저입니다." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = bcrypt.hashSync(resetToken, bcrypt.genSaltSync(10));
    user.resetPwToken = hashedToken;
    user.resetPwExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `https://hpe-guru.netlify.app/resetpassword?token=${resetToken}&email=${emailID}`;

    const mailOptions = {
      from: process.env.NAVER_EMAIL,
      to: emailID,
      subject: "[GURU] 비밀번호 재설정 링크입니다.",
      html: `<div style="color: #121212;">
        <p>안녕하세요. GURU 입니다.</p>
            <p>회원님의 비밀번호 재설정을 위해 아래 버튼을 눌러주세요.</p>
            <a href="${resetLink}" style="display: inline-block; font-size: 13px;">
        비밀번호 재설정</a>
            <p>링크는 비밀번호 재설정을 하거나 1시간이 지나면 만료됩니다.</p>
            <p>만약 비밀번호 재설정을 요청한 적이 없다면 이 이메일을 무시해주세요.</p>
            <p>감사합니다.</p>
            <p>GURU</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "이메일 전송 성공" });
  } catch (error) {
    console.error("이메일 전송 실패:", error);
    res.status(500).json({ message: "이메일 전송 실패", error });
  }
});

//비밀번호 재설정
app.post("/resetpassword", async (req, res) => {
  const { password, token, emailID } = req.body;

  try {
    const user = await User.findOne({ emailID });
    if (!user) {
      return res.status(400).json({ message: "유효하지 않은 사용자입니다." });
    }

    const isTokenValid = bcrypt.compareSync(token, user.resetPwToken);
    const isTokenExpired = user.resetPwExpires < Date.now();

    if (!isTokenValid || isTokenExpired) {
      return res.status(400).json({ message: "토큰이 유효하지 않거나 만료되었습니다." });
    }

    user.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    user.resetPwToken = undefined;
    user.resetPwExpires = undefined;
    await user.save();
    // console.log("비밀번호 재설정 성공");
    res.status(200).json({ message: "비밀번호 재설정 성공" });
  } catch (error) {
    console.error("비밀번호 재설정 실패:", error);
    res.status(500).json({ message: "비밀번호 재설정 실패", error });
  }
});

app.post("/logout", (req, res) => {
  res.json({ message: "로그아웃되었습니다." });
});

// 만족도 조사
app.post("/satisfied", async (req, res) => {
  const {
    Post_id,
    repondentID, // 조사 쓴 사람 이메일
    repondentNick, // 조사 쓴 사람 닉네임
    recipientID, // 평가 받은 사람
    matchedID,
    writerID,
    starRating,
    kind,
    onTime,
    highQuality,
    unkind,
    notOnTime,
    lowQuality,
    etc,
    etcDescription,
  } = req.body;

  const newSatisfaction = new Satisfied({
    Post_id,
    repondentID, // 조사 쓴 사람 이메일
    repondentNick, // 조사 쓴 사람 닉네임
    recipientID, // 평가 받은 사람
    matchedID,
    writerID,
    starRating,
    kind,
    onTime,
    highQuality,
    unkind,
    notOnTime,
    lowQuality,
    etc,
    etcDescription,
  });

  // 만족도 조사 몽고 DB에 저장
  try {
    const savedSatisfaction = await newSatisfaction.save();

    // jobPost._id 와 Post_id 가 같은 데이터를 찾아서 업데이트
    const jobPost = await JobPost.findOne({ _id: Post_id });

    if (!jobPost) {
      return res.status(404).json({ error: "Job post not found" });
    }

    // 상태 변경 조건
    if (repondentID === writerID) {
      if (jobPost.status === 3) {
        jobPost.status = 5;
      } else {
        jobPost.status = 4;
      }
    } else {
      if (jobPost.status === 4) {
        jobPost.status = 5;
      } else {
        jobPost.status = 3;
      }
    }
    await jobPost.save();

    res.json(savedSatisfaction);
  } catch (error) {
    console.error("Error saving satisfaction or updating job post status:", error);
    res.status(400).json({ error: "Unable to save data or update job post status" });
  }
});

// 특정 repondentID를 기준으로 만족도 조사 데이터 조회
app.get("/satisfied/:emailID", async (req, res) => {
  const { emailID } = req.params;
  // console.log("요청된 emailID:", emailID);
  try {
    // repondentID를 기준으로 만족도 조사 데이터 조회
    const satisfactionData = await Satisfied.find({ recipientID: emailID });

    // 만족도 조사 데이터가 없을 경우 빈 배열 반환
    if (satisfactionData.length === 0) {
      return res.json([]); // 빈 배열 반환
    }
    res.json(satisfactionData);
  } catch (error) {
    res.status(500).json({ message: "서버 오류", error: error.message });
  }
});


//***Job *//

// 조건에 맞는 JobPost 문서를 찾아 status를 -2로 업데이트하는 함수
const updateJobPostStatus = async (today) => {
  try {
    // 조건에 맞는 JobPost 문서 찾기
    const jobPosts = await JobPost.find({
      endDate: { $lt: today },
      "applicants.0": { $exists: false }, // applicants 배열이 빈 배열인 경우
    });
    // 조건에 맞는 문서의 status를 -2로 업데이트
    for (const jobPost of jobPosts) {
      jobPost.status = -2;
      await jobPost.save();
    }
    console.log(`Updated ${jobPosts.length} job posts.`);
  } catch (error) {
    console.error("Error running batch job:", error);
  }
};
cron.schedule("59 14 * * *", async () => {
  // 오늘 날짜의 14:59:00 설정
  const today = new Date();
  today.setHours(14, 59, 0, 0);
  await updateJobPostStatus(today);
});

app.post("/jobWrit", async (req, res) => {
  const { title, endDate, workStartDate, workEndDate, location, pay, desc, category } = req.body;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];
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
      let endDateObj = new Date(endDate);
      endDateObj.setHours(14, 59, 0, 0);
      const jobPostDoc = await JobPost.create({
        emailID: user.emailID,
        nickName: user.nickName,
        title,
        endDate: endDateObj,
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

app.get("/jobEdit/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const jobPostDoc = await JobPost.findById(id);
    res.json(jobPostDoc);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.put("/jobEdit/:id", async (req, res) => {
  const { id } = req.params;
  const { title, endDate, workStartDate, workEndDate, location, pay, desc, category } = req.body;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];

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
      let endDateObj = new Date(endDate);
      endDateObj.setHours(14, 59, 0, 0);
      const jobPostDoc = await JobPost.findByIdAndUpdate(id, {
        emailID: info.emailID,
        nickName: user.nickName,
        title,
        endDate: endDateObj,
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

app.delete("/deleteJob/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await JobPost.findByIdAndDelete(id);
    res.json({ message: "ok" });
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.get("/jobOffer", async (req, res) => {
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];
  const jobType = req.query.jobType || "all";
  const status = req.query.status || "all";
  const page = parseInt(req.query.page) || 1;
  const pageSize = 5;
  const skip = (page - 1) * pageSize;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      let query = {
        emailID: info.emailID,
      };

      if (jobType !== "all") {
        query["category.jobType"] = jobType;
      }
      if (status === 3 || status === 4) {
        query["status"] = { $in: [3, 4] };
      } else if (status !== "all") {
        query["status"] = parseInt(status);
      }
      const totalJobs = await JobPost.countDocuments(query);
      const jobList = await JobPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);
      res.append("X-Total-Count", totalJobs.toString());
      res.json(jobList);
    } catch (e) {
      res.status(500).json({ message: "server(500) error" });
    }
  });
});

app.get("/applied", async (req, res) => {
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];
  const page = parseInt(req.query.page) || 1;
  const jobType = req.query.jobType || "all";
  const status = req.query.status || "all";
  const pageSize = 5;
  const skip = (page - 1) * pageSize;
  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      let query = {
        "applicants.emailID": info.emailID,
        "applicants.status": { $ne: -1 },
      };
      if (jobType !== "all") {
        query["category.jobType"] = jobType;
      }
      if (status === 3 || status === 4) {
        query["status"] = { $in: [3, 4] };
      } else if (status !== "all") {
        query["status"] = parseInt(status);
      }

      const totalJobs = await JobPost.countDocuments(query);
      const jobList = await JobPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);
      res.append("X-Total-Count", totalJobs.toString());
      res.json(jobList);
    } catch (e) {
      console.error("Server error: ", e);
      res.status(500).json({ message: "server(500) error" });
    }
  });
});

app.get("/mainOnline", async (req, res) => {
  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    const jobList = await JobPost.find({
      "category.jobType": "onLine",
      status: 1,
      endDate: { $gte: endTime },
    })
      .sort({ createdAt: -1 })
      .limit(4);
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});
app.get("/mainOffline", async (req, res) => {
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    } else {
      const radlat1 = (Math.PI * lat1) / 180;
      const radlat2 = (Math.PI * lat2) / 180;
      const theta = lon1 - lon2;
      const radtheta = (Math.PI * theta) / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = (dist * 180) / Math.PI;
      dist = dist * 60 * 1.1515;
      dist = dist * 1.609344;
      return dist;
    }
  };
  const userLat = parseFloat(req.query.lat);
  const userLon = parseFloat(req.query.lon);
  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    let jobList = await JobPost.find({
      "category.jobType": "offLine",
      status: 1,
      endDate: { $gte: endTime },
    });

    if (!isNaN(userLat) && !isNaN(userLon)) {
      jobList = jobList
        .map((job) => ({
          ...job.toObject(),
          distance: getDistance(userLat, userLon, job.location.mapY, job.location.mapX),
        }))
        .sort((a, b) => a.distance - b.distance);
    }
    const pagingJobList = jobList.slice(0, 3);
    res.json(pagingJobList);
  } catch (e) {
    res.status(500).json({ message: "server(500) error" });
  }
});

app.get("/findonLine", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const talent = req.query.talent || "all";
  const field = req.query.field || "all";
  const startCateTime = req.query.startCateTime;
  const endCateTime = req.query.endCateTime;
  const pageSize = 5;
  const skip = (page - 1) * pageSize;
  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    let query = {
      "category.jobType": "onLine",
      status: 1,
      endDate: { $gte: endTime },
    };
    if (talent !== "all") {
      query["category.talent"] = talent;
    }
    if (field !== "all") {
      query["category.field"] = field;
    }
    if (!isNaN(startCateTime) && !isNaN(endCateTime)) {
      query["category.time"] = { $gte: startCateTime, $lte: endCateTime };
    }
    const totalJobs = await JobPost.countDocuments(query);
    const jobList = await JobPost.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);
    res.append("X-Total-Count", totalJobs.toString());
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.get("/allonLine", async (req, res) => {
  const titleText = req.query.titleText;
  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    const jobList = await JobPost.find({
      "category.jobType": "onLine",
      title: { $regex: titleText, $options: "i" },
      status: 1,
      endDate: { $gte: endTime },
    }).sort({ createdAt: -1 });
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.get("/findoffLine", async (req, res) => {
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    } else {
      const radlat1 = (Math.PI * lat1) / 180;
      const radlat2 = (Math.PI * lat2) / 180;
      const theta = lon1 - lon2;
      const radtheta = (Math.PI * theta) / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = (dist * 180) / Math.PI;
      dist = dist * 60 * 1.1515;
      dist = dist * 1.609344;
      return dist;
    }
  };
  const page = parseInt(req.query.page) || 1;
  const talent = req.query.talent || "all";
  const field = req.query.field || "all";
  const startCateTime = req.query.startCateTime;
  const endCateTime = req.query.endCateTime;
  const pageSize = 5;
  const skip = (page - 1) * pageSize;
  const userLat = parseFloat(req.query.lat);
  const userLon = parseFloat(req.query.lon);

  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    let query = {
      "category.jobType": "offLine",
      status: 1,
      endDate: { $gte: endTime },
    };
    if (talent !== "all") {
      query["category.talent"] = talent;
    }
    if (field !== "all") {
      query["category.field"] = field;
    }
    if (!isNaN(startCateTime) && !isNaN(endCateTime)) {
      query["category.time"] = { $gte: startCateTime, $lte: endCateTime };
    }

    const totalJobs = await JobPost.countDocuments(query);
    let jobList = await JobPost.find(query);
    if (!isNaN(userLat) && !isNaN(userLon)) {
      jobList = jobList
        .map((job) => ({
          ...job.toObject(),
          distance: getDistance(userLat, userLon, job.location.mapY, job.location.mapX),
        }))
        .sort((a, b) => a.distance - b.distance);
    }
    const pagingJobList = jobList.slice(skip, skip + pageSize);
    res.append("X-Total-Count", totalJobs.toString());
    res.json(pagingJobList);
  } catch (e) {
    res.status(500).json({ message: "server(500) error" });
  }
});

app.get("/alloffLine", async (req, res) => {
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    } else {
      const radlat1 = (Math.PI * lat1) / 180;
      const radlat2 = (Math.PI * lat2) / 180;
      const theta = lon1 - lon2;
      const radtheta = (Math.PI * theta) / 180;
      let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      if (dist > 1) {
        dist = 1;
      }
      dist = Math.acos(dist);
      dist = (dist * 180) / Math.PI;
      dist = dist * 60 * 1.1515;
      dist = dist * 1.609344;
      return dist;
    }
  };
  const titleText = req.query.titleText;
  const userLat = parseFloat(req.query.lat);
  const userLon = parseFloat(req.query.lon);
  try {
    const getTodayDateWithTime = (hours, minutes, seconds, milliseconds) => {
      const today = new Date();
      today.setHours(hours, minutes, seconds, milliseconds);
      return today;
    };
    const endTime = getTodayDateWithTime(14, 59, 0, 0);
    let jobList = await JobPost.find({
      "category.jobType": "offLine",
      title: { $regex: titleText, $options: "i" },
      status: 1,
      endDate: { $gte: endTime },
    });
    if (!isNaN(userLat) && !isNaN(userLon)) {
      jobList = jobList
        .map((job) => ({
          ...job.toObject(),
          distance: getDistance(userLat, userLon, job.location.mapY, job.location.mapX),
        }))
        .sort((a, b) => a.distance - b.distance);
    }
    res.json(jobList);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.post("/userList", async (req, res) => {
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

app.get("/findUserData/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findOne({ emailID: id });
    res.json(user);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

/* 매칭 */
app.put("/hiring", async (req, res) => {
  const { jobPostID, AppliUser } = req.body;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];
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

app.get("/JobDetail/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const jobPostDoc = await JobPost.findById(id);
    res.json(jobPostDoc);
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.put("/application/:id", (req, res) => {
  const { id } = req.params;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];

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

app.put("/appCancell/:id", (req, res) => {
  const { id } = req.params;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];

  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      console.error("Token error: ", err);
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const jobPost = await JobPost.findById(id);
      if (!jobPost) {
        return res.status(404).json({ message: "해당 공고를 찾을 수 없습니다" });
      }

      const applicant = jobPost.applicants.find((applicant) => applicant.emailID === info.emailID);
      if (applicant) {
        if (applicant.status === 1) {
          //매칭 전 취소
          applicant.status = -1;
          applicant.applicationDate = new Date();
        } else if (applicant.status === 2 && applicant.matched === true) {
          //매칭 이후 취소
          applicant.status = -1;
          jobPost.status = -1;
        } else {
          return res.status(400).json({ message: "이미 취소된 상태입니다." });
        }
      } else if (info.emailID === jobPost.emailID) {
        //구직자가 취소
        jobPost.status = -1;
      } else {
        return res.status(400).json({ message: "지원 기록이 없습니다." });
      }
      await jobPost.save();
      res.status(200).json({ message: "정상적으로 취소되었습니다.", jobPost });
    } catch (error) {
      console.error("error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

app.get("/comment/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const comments = await Comment.find({ postId }).sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

app.delete("/commentDel/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await Comment.findByIdAndDelete(id);
    res.json({ message: "ok" });
  } catch (e) {
    res.json({ message: "server(500) error" });
  }
});

app.post("/commentWrit/:postId", async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];

  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const user = await User.findById(info.id);
      if (!user) {
        return res.status(404).json({ message: "없는 유저입니다" });
      }
      const commentDoc = await Comment.create({
        postId,
        content,
        authorID: user.emailID,
        authorNickName: user.nickName,
        authorImg: user.image,
      });
      await JobPost.findByIdAndUpdate(postId, {
        $push: { comments: commentDoc._id },
      });
      return res.json(commentDoc);
    } catch (error) {
      console.error("Failed to add comment:", error);
      return res.status(500).json({ message: "Failed to add comment" });
    }
  });
});

app.put("/commentEdit/:id", async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const headerToken = req.headers.authorization;
  const token = headerToken.split(" ")[1];

  jwt.verify(token, jwtSecret, async (err, info) => {
    if (err) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }
    try {
      const user = await User.findById(info.id);
      if (!user) {
        return res.status(404).json({ message: "없는 유저입니다" });
      }
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({ message: "없는 댓글입니다" });
      }
      if (comment.authorID !== user.emailID) {
        return res.status(403).json({ message: "댓글 수정 권한이 없습니다" });
      }
      comment.content = content;
      await comment.save();
      return res.json({ message: "ok", comment });
    } catch (error) {
      console.error("Failed to edit comment:", error);
      return res.status(500).json({ message: "Failed to edit comment" });
    }
  });
});




/* 결제 */
// 포트원 액세스 토큰을 가져오는 함수
const getPortoneAccessToken = async () => {
  const url = 'https://api.iamport.kr/users/getToken';
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imp_key: process.env.PORTONE_API_KEY,
      imp_secret: process.env.PORTONE_API_SECRET
    })
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (data.code === 0) {
      return data.response.access_token;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Failed to get Portone access token', error);
    throw new Error('Failed to get Portone access token');
  }
};

// 송금 API 호출 함수
const transferToAccount = async (account, amount, accessToken) => {
  try {
    const response = await fetch('https://api.iamport.kr/escrow/logis/invoices', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        receiver: {
          bank: account.bank,
          account: account.account,
          name: account.name,
        },
        amount: amount,
      })
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(data.message);
    }

    return data;
  } catch (error) {
    throw new Error('Failed to transfer to account');
  }
};


// 결제 정보 확인 및 금액 분할 처리
app.post('/payout', async (req, res) => {
  const { imp_uid, merchant_uid, companyAccount, matchedUserAccount, totalAmount } = req.body;

  try {
    // console.log('Received payout request: ', req.body);

    // 포트원 액세스 토큰 가져오기
    const accessToken = await getPortoneAccessToken();
    // console.log('Access token: ', accessToken);

    // 결제 정보 가져오기
    const paymentResponse = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const paymentData = await paymentResponse.json();
    // console.log('Payment data: ', paymentData);

    if (paymentData.code !== 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment data' });
    }

    // 결제 수단 확인
    const payMethod = paymentData.response.pay_method;

    // 금액 분할 (예: 10%는 회사로, 90%는 매칭된 유저로)
    const companyShare = totalAmount * 0.1;
    const matchedUserShare = totalAmount * 0.9;

    // console.log('Company share: ', companyShare);
    // console.log('Matched user share: ', matchedUserShare);

    if (payMethod === 'trans' || payMethod === 'vbank') {
      // 실시간계좌이체 또는 가상계좌인 경우 에스크로 송금
      await transferToAccount(companyAccount, companyShare, accessToken);
      await transferToAccount(matchedUserAccount, matchedUserShare, accessToken);
    } else {
      // 카드 결제인 경우 수수료를 제외한 금액을 매칭된 유저에게 송금 (여기서는 수동으로 처리해야 함)
      console.log('Card payment detected. Please manually transfer the matched user share.');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Payout error:', error);
    return res.status(500).json({ success: false, message: 'Payout error', error: error.message });
  }
});

app.listen(port, () => {
  console.log("서버 실행되는중!");
});



