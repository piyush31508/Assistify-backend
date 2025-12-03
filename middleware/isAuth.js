// middleware/isAuth.js
import jwt from 'jsonwebtoken';
import { User } from '../model/User.js';

export const isAuth = async (req, res, next) => {
  try {
    const token = req.headers.token;
    if (!token) return res.status(401).json({ message: "You are not authorized to access this resource." });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.Jwt_Secret || process.env.SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded._id);
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    console.error("isAuth error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
