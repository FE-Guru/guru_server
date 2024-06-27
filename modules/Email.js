require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { User } = require("./User");
const nodemailer = require("nodemailer");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

router.post("/findacct/pw", async (req, res) => {
  const { emailID } = req.body;
  try {
    const user = await User.findOne({ email: emailID });
    if (!user) {
      return res.status(404).json({ message: "없는 유저입니다." });
    }

    // 비번 재설정 토큰 생성
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = bcrypt.hashSync(resetToken, bcrypt.genSaltSync(10));
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 비번을 찾는 시간이 1시간으로 제한됨
    await user.save();

    const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}&email=${emailID}`;

    // 비번 재설정 링크 전송
    await transporter.sendMail({
      to: emailID,
      subject: "[GURU] 비밀번호 재전송 링크입니다.",
      text: `안녕하세요. GURU 입니다. 

      회원님의 비밀번호 재설정을 위해 링크를 눌러주세요. 
      비밀번호 재설정 링크 : ${resetLink}
      링크는 1시간 뒤에 만료됩니다.

      만약 비밀번호 재설정을 요청한 적이 없다면 이 이메일을 무시해주세요.
      감사합니다.
      [GURU]`,
    });
    res.status(200).json({ message: "재설정 링크 전송" });
  } catch (error) {
    res.status(500).json({ message: "서버 에러" });
  }
});

router.post("/resetpassword", async (req, res) => {
  const { token, email, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 토큰 유효성 확인
    const isTokenValid = bcrypt.compareSync(token, user.resetPasswordToken);
    if (!isTokenValid || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "정확하지 않거나 만료된 토큰" });
    }

    // 새로운 비번 업데이트
    user.password = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
    user.resetPwToken = undefined;
    user.resetPwExpires = undefined;
    await user.save();

    res.status(200).json({ message: "비밀번호가 재설정되었습니다." });
  } catch (error) {
    res.status(500).json({ message: "서버에러" });
  }
});

//test
module.exports = router;
