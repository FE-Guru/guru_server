require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { User } = require("./User");
const nodemailer = require("nodemailer");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "Gmail",
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
    user.resetPasswordExpires = Date.now() + 3600000; // 1시간
    await user.save();

    const resetLink = `https://your-domain.com/reset-password?token=${resetToken}&email=${emailID}`;

    // 비번 재설정 링크 전송
    await transporter.sendMail({
      to: emailID,
      subject: "[GURU] 비밀번호 재전송 링크입니다.",
      text: `비밀번호 재설정을 위해 링크를 눌러주세요. ${resetLink}`,
    });
    res.status(200).json({ message: "재설정 링크 전송" });
  } catch (error) {
    res.status(500).json({ message: "서버 에러" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, email, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 토큰 유효성 확인
    const isTokenValid = bcrypt.compareSync(token, user.resetPasswordToken);
    if (!isTokenValid || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
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
//sourcetree test commit
module.exports = router;
