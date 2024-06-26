const express = require("express");
const router = express.Router();
const phoneVaild = require("phone");

const accountSid = process.env.SID;
const authToken = process.env.TOKEN;
const client = require("twilio")(accountSid, authToken);

router.post("/sendsms", async (req, res) => {
  const { phone } = req.body;
  let authNum = "";
  for (let i = 0; i < 4; i++) authNum += Math.floor(Math.random() * 10);

  // 번호를 국제번호 형식으로 변경
  const phoneValidation = phoneVaild(phone, { country: "KOR" });
  if (!phoneValidation.isValid) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid phone number format" });
  }

  await client.messages
    .create({
      from: process.env.TWILIO_FROM,
      body: `[GURU] 인증번호는 [${authNum}] 입니다. 정확히 입력해주세요.`,
      to: phoneValidation.phoneNumber,
    })
    .then((message) =>
      res.json({ success: true, sid: message.sid, auth: authNum })
    )
    .catch((error) => {
      console.error("Twilio error:", error);
      res.status(500).json({ success: false, error: error.message });
    });
});

module.exports = router;
