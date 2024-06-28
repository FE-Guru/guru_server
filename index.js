require("dotenv").config();
const express = require("express");
const app = express();
const port = 8000;

const cors = require("cors");

//cors issue
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
  })
);
app.use(express.json());

const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI);

// models
const User = require("./modules/User");
const Satisfied = require("./modules/Satisfied");
const JobPost = require("./modules/JobPost");

//비번암호화
const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(10);

//토큰
const jwt = require("jsonwebtoken");
const jwtSecret = process.env.SECRET_KEY;

//쿠키
const cookieParser = require("cookie-parser");
app.use(cookieParser());

//멀터 및 이미지 업로드
const fs = require("fs");
const multer = require("multer"); // multer 모듈 임포트
const upload = multer({ dest: "uploads/" }); // 파일 업로드를 위한 multer 설정
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//회원가입 폰인증
const twilio = require("./twilio");
app.use("/sendsms", twilio);

app.get("/", (req, res) => {
  res.send("get request~!~!~");
});

//job
const jobRouter = require("./job");
const { log } = require("console");
app.use("/job", jobRouter);

//회원가입
app.post("/signup", async (req, res) => {
  const { emailID, password, userName, nickName, phone, account } = req.body;
  try {
    // 이메일아이디 중복 체크
    const existUser = await User.findOne({ emailID });
    if (existUser) {
      return res
        .status(409)
        .json({ message: "이미 존재하는 이메일아이디 입니다." });
    }
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

//로그인
app.post("/login", async (req, res) => {
  const { emailID, password, userName, nickName, phone, account } = req.body;
  const userDoc = await User.findOne({ emailID });

  if (!userDoc) {
    res.json({ message: "no user" });
    return;
  }

  const pass = bcrypt.compareSync(password, userDoc.password);
  if (pass) {
    jwt.sign(
      { emailID, id: userDoc._id, userName, nickName, phone, account },
      jwtSecret,
      {},
      (err, token) => {
        if (err) throw err;
        res.cookie("token", token).json({
          token,
          id: userDoc._id,
          emailID,
          userName,
          nickName,
        });
      }
    );
  } else {
    res.json({ message: "failed" });
  }
});

app.get("/profile", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }
  // console.log("token : ", token);

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
  const token = req.cookies.token;
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
    console.log("file:", path, newPath);
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
    // const pickToken = jwt.verify(token, jwtSecret);

    const userEmail = pickToken.emailID;
    console.log("pickToken", pickToken);
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
    if (
      user.nickName !== nickName ||
      user.phone !== phone ||
      user.account !== account
    ) {
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

//비번찾기
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const transporter = nodemailer.createTransport({
  service: "naver",
  host: "smtp.naver.com",
  port: 465,
  auth: {
    user: process.env.NAVER_EMAIL,
    pass: process.env.NAVER_PASSWORD,
  },
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

    const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}&email=${emailID}`;

    const mailOptions = {
      from: process.env.NAVER_EMAIL,
      to: emailID,
      subject: "[GURU] 비밀번호 재전송 링크입니다.",
      html: `<div style="color: #121212;">
        <p>안녕하세요. GURU 입니다.</p>
            <p>회원님의 비밀번호 재설정을 위해 아래 버튼을 눌러주세요.</p>
            <a href="${resetLink}" style="display: inline-block; font-size: 13px;">
        비밀번호 재설정</a>
            <p>링크는 1시간 뒤에 만료됩니다.</p>
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

app.post("/logout", (req, res) => {
  res.cookie("token", "").json();
});

//만족도 조사
app.post("/satisfied", async (req, res) => {

  const {
    Post_id,
    emailID,
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
    emailID,
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
    console.log("찾은 JobPost ---", jobPost);

    if (!jobPost) {
      return res.status(404).json({ error: "Job post not found" });
    }

    //상태 변경 조건 [2 - 예약중 // 3,4 - 완료대기 // 5 - 완료]
    if (jobPost.status === 2) {
      if (writerID === jobPost.emailID) {
        jobPost.status = 4;
      } else {
        jobPost.status = 3;
      }
    }    
    // 만약 jobPost 상태가 3 또는 4라면 5로 업데이트
    if (jobPost.status === 3 || jobPost.status === 4) {
      jobPost.status = 5;
    }

    await jobPost.save();
    res.json(savedSatisfaction);
  } catch (error) {
    res
      .status(400)
      .json({ error: "Unable to save data or update job post status" });
  }
});


app.listen(port, () => {
  console.log("서버 실행되는중!");
});
