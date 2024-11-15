import jwt from 'jsonwebtoken';
import { User } from '../model/User.js';

export const isAuth = async (req, res, next) => {
    try {
        const token = req.headers.token;

        if (!token) {
            return res.status(401).json({
                message: "You are not authorized to access this resource."
            });
        }

        const decode = jwt.verify(token, process.env.Jwt_Secret);

        req.user = await User.findById(decode._id);

        next();
    } catch (error) {
        res.status(500).json({
            message:"Login First"
        })
    }
}