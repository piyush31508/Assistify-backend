// controllers/userController.js
import { User } from '../model/User.js';
import jwt from "jsonwebtoken";
import sendMail from '../middleware/sendMail.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.Jwt_Secret || process.env.SECRET;

export const logInUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit string
    const verifyToken = jwt.sign({ user, otp }, JWT_SECRET, { expiresIn: '10m' });

    await sendMail(email, "OTP Req", otp);

    return res.status(200).json({ message: "Verification email sent", verifyToken });
  } catch (error) {
    console.error("logInUser error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const verifyUser = async (req, res) => {
  try {
    const { verifyToken, otp } = req.body;
    if (!verifyToken || !otp) return res.status(400).json({ message: 'verifyToken and otp are required' });

    let payload;
    try {
      payload = jwt.verify(verifyToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "OTP EXPIRED or INVALID" });
    }

    if (!payload || payload.otp !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const token = jwt.sign({ _id: payload.user._id }, JWT_SECRET, { expiresIn: '5d' });

    return res.json({ message: "Logged In Successfully", token, user: payload.user });
  } catch (error) {
    console.error("verifyUser error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const myProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.json({ user });
  } catch (error) {
    console.error("myProfile error:", error);
    return res.status(500).json({ error: error.message });
  }
};
