const express = require("express");
const app = express();
const port = 8000;

const cors = require("cors");

//cors issue
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

//mongodb+srv://guru:guru@cluster0.gio7a74.mongodb.net/guru?retryWrites=true&w=majority&appName=Cluster0
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

app.get("/", (req, res) => {
  res.send("get request~!~!~");
});

//Job부분 개발 예정
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
    /* unique true, 이미 존재하는 아이디일 경우 에러 발생  */
    res.status(400).json({ message: "failed", error: e.message });
  }
});

//로그인
app.post("/login", async (req, res) => {
  const { emailID, password, nickName } = req.body;
  const userDoc = await User.findOne({ emailID });

  if (!userDoc) {
    res.json({ message: "no user" });
    return;
  }

  const pass = bcrypt.compareSync(password, userDoc.password);
  if (pass) {
    jwt.sign(
      { emailID, id: userDoc._id, nickName },
      jwtSecret,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.cookie("token", token).json({
          id: userDoc._id,
          emailID,
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
  // const { token } = req.cookies(); cookies is not function error
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
        nickName: user.nickName,
      };
      res.json(userInfo);
    } catch (error) {
      console.error("User error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json();
});

app.listen(port, () => {
  console.log("서버 실행되는중!");
});
