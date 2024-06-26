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
const connectUri = `mongodb+srv://guru:guru@cluster0.gio7a74.mongodb.net/guru?retryWrites=true&w=majority&appName=Cluster0`;
mongoose.connect(connectUri);

// user model
const User = require("./modules/User");

//비번암호화
const bcrypt = require("bcryptjs");
const salt = bcrypt.genSaltSync(10);

//토큰
const jwt = require("jsonwebtoken");
const jwtSecret = "hjetydghnmjklghrtwijoerjkufgshjbkl";

//쿠키
const cookieParser = require("cookie-parser");
app.use(cookieParser());

//멀터 및 이미지 업로드
const fs = require("fs");
const multer = require("multer"); // multer 모듈 임포트
const upload = multer({ dest: "uploads/" }); // 파일 업로드를 위한 multer 설정
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//mail
const mailRoutes = require("./modules/Email");
app.use("/gurumail", mailRoutes);

//회원가입 폰인증
const twilio = require("./twilio");
app.use("/sendsms", twilio);

app.get("/", (req, res) => {
  res.send("get request~!~!~");
});

//job
const jobRouter = require("./job");
app.use("/job", jobRouter);

//회원가입
app.post("/signup", async (req, res) => {
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

//header 에서
app.get("/profile", (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "토큰이 없습니다" });
  }
  console.log("token : ", token);

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

  const { originalname, path } = req.file;
  const part = originalname.split(".");
  const ext = part[part.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  console.log("file:", path, newPath);
  console.log("Body:", req.body);
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
    if (newPath) {
      user.image = newPath;
    } else {
      user.image = null;
    }
    await user.save();

    const userInfo = {
      emailID: user.emailID,
      nickName: user.nickName,
    };

    res.json({ message: "Profile updated successfully", userInfo });
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
    const user = await User.findOne({ emailID });

    if (user) {
      user.password = password || user.password;
      user.nickName = nickName || user.nickName;
      user.phone = phone || user.phone;
      user.account = account || user.account;

      await user.save();
      res.status(200).send("유저 정보 수정 성공");
    } else {
      res.status(404).send("없는 유저입니다.");
    }
  } catch (error) {
    console.error("유저정보 수정중 에러발생:", error);
    res.status(500).send("서버에러");
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
app.post("/findacct/pw", async (req, res) => {
  const { emailID } = req.body;

  try {
    const user = await User.findOne({ emailID });
    if (user) {
      res.status(200).json({ password: user.password });
    } else {
      res.status(404).json({ message: "해당 유저가 없습니다" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json();
});

//만족도 조사
const Satisfied = require("./modules/Satisfied");

app.post("/satisfied", async (req, res) => {
  const {
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

  try {
    const savedSatisfaction = await newSatisfaction.save();
    res.json(savedSatisfaction);
  } catch (error) {
    res.status(400).json({ error: "Unable to save data" });
  }
});

app.listen(port, () => {
  console.log("서버 실행되는중!");
});
