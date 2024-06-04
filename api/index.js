const express = require("express");
const app = express();
const port = 8000;

const cors = require("cors");
app.use(cors({ origin: "http://localhost:3000" })); //cors issue
app.use(express.json());

//mongodb+srv://guru:guru@cluster0.gio7a74.mongodb.net/guru?retryWrites=true&w=majority&appName=Cluster0
const mongoose = require("mongoose");
const connectUri =
  "mongodb+srv://guru:guru@cluster0.gio7a74.mongodb.net/guru?retryWrites=true&w=majority&appName=Cluster0";
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

//회원가입
app.post("/signup", async (req, res) => {
  const { emailID, password } = req.body;
  console.log("id,pw---", emailID, password);
  try {
    const userDoc = await User.create({
      emailID,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    /* unique true, 이미 존재하는 아이디일 경우 에러 발생  */
    res.status(400).json({ message: "failed", error: e.message });
  }
});

//로그인
app.post("/login", async (req, res) => {
  const { emailID, password } = req.body;
  const userDoc = await User.findOne({ emailID });

  if (!userDoc) {
    res.json({ message: "no user" });
    return;
  }

  const pass = bcrypt.compareSync(password, userDoc.password);
  if (pass) {
    jwt.sign({ emailID, id: userDoc._id }, jwtSecret, {}, (err, token) => {
      if (err) throw err;
      console.log("token : ", token);
      res.cookie("token", token).json({
        id: userDoc._id,
        emailID,
      });
    });
  } else {
    res.json({ message: "failed" });
  }
});

app.listen(port, () => {
  console.log("서버 실행되는중!");
});
