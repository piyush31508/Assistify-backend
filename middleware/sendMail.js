// middleware/sendMail.js
import axios from "axios";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || "piyushwork2003@gmail.com";

if (!BREVO_API_KEY) {
  console.warn("Warning: BREVO_API_KEY is not set. Email sending will fail.");
}

const sendMail = async (email, subject, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
      <h1 style="color: red;">OTP Verification</h1>
      <p>Hello ${email}, your One-Time Password for verification is:</p>
      <p style="font-size: 32px; font-weight: bold; color: #7b68ee;">${otp}</p>
    </div>
  `;

  try {
    const resp = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: SENDER_EMAIL },
        to: [{ email }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 15000,
      }
    );
    return resp.data;
  } catch (err) {
    console.error("Brevo Email Error:", err.response?.data || err.message);
    throw new Error("Failed to send OTP email");
  }
};

export default sendMail;
