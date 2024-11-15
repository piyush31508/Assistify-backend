import { User } from '../model/User.js';
import jwt from "jsonwebtoken";
import sendMail from '../middleware/sendMail.js';

export const logInUser = async (req, res) => {
    try{
        const { email } = req.body;

        let user =  await User.findOne({ email });

        if(!user) {
            user = await User.create({
                email,
            });
        }
        const otp = Math.floor(Math.random() * 1000000);
        const verifyToken = jwt.sign({user, otp}, process.env.SECRET, {
            expiresIn: '10m',
        });

        await sendMail(email, "OTP Req", otp);
        res.status(200).json({message: "Verification email sent", verifyToken});
    }
    catch(error){
        console.error(error);
        res.status(500).json({error: error.message});
    }
}

export const verifyUser = async (req, res) => {
    try{
        const { verifyToken, otp } = req.body;

        const verify = jwt.verify(verifyToken, process.env.SECRET);

        if(!verify) {
            return res.status(400).json({message: "OTP EXPIRED"});
        }

        if(verify.otp!== parseInt(otp)) {
            return res.status(400).json({message: "Invalid OTP"});
        }
        const token = jwt.sign(
            { _id: verify.user._id }, 
            process.env.Jwt_Secret,     
            { expiresIn: '5d' }         
          );
       
          res.json({
            message: "Logged In Successfully",
            token,
            user: verify.user,
          })
    }
    catch(error){
        console.error(error);
        res.status(500).json({error: error.message});
    }
};

export const myProfile = async (req, res) => {
    try{
        const user = await User.findById(req.user._id);
        
        res.json({user});
    }
    catch(error){
        console.error(error);
        res.status(500).json({error: error.message});
    }
}