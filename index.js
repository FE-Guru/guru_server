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

const multer = require("multer"); // multer 모듈 임포트
const upload = multer({ dest: "uploads/" }); // 파일 업로드를 위한 multer 설정

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
  const { emailID, password, userName, nickName } = req.body;
  const userDoc = await User.findOne({ emailID });

  if (!userDoc) {
    res.json({ message: "no user" });
    return;
  }

  const pass = bcrypt.compareSync(password, userDoc.password);
  if (pass) {
    jwt.sign(
      { emailID, id: userDoc._id, userName, nickName },
      jwtSecret,
      { },
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
        userName: user.userName,
        nickName: user.nickName,
      };
      res.json(userInfo);
    } catch (error) {
      console.error("User error: ", error);
      res.status(500).json({ message: "서버 오류" });
    }
  });
});
app.put("/profileWrite", upload.single("files"), async (req, res) => {
  const { career, certi, skill, time, introduce } = req.body;
  const file = req.file;
  console.log("File:", file); // 업로드된 파일 정보 출력
  console.log("Body:", req.body); // 요청 본문 데이터 출력
  const token = req.cookies.token;

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
    user.career = career|| user.career;
    user.certi = certi || user.certi;
    user.skill = skill || user.skill;
    user.time = time || user.time;
    user.introduce = introduce || user.introduce;
    if (file) {
      user.image = file.path;
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


app.post("/logout", (req, res) => {
  res.cookie("token", "").json();
});

app.listen(port, () => {
  console.log("서버 실행되는중!");
});
