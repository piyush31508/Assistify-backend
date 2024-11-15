import express from 'express';
import { logInUser,myProfile, verifyUser } from '../controller/userController.js';
import { isAuth } from '../middleware/isAuth.js';

const router = express.Router();

router
.post('/login', logInUser)
.post('/verify', verifyUser)
.get("/me", isAuth, myProfile);

export default router;