import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import connectDb from "./database/db.js";
import UserRoutes from "./routes/userRoutes.js"
import ChatRoutes from "./routes/chatRoutes.js"

const app = express();

//Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
dotenv.config();

//routes
app.use('/user', UserRoutes);
app.use('/chat', ChatRoutes);

const port = process.env.PORT || 8000;

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
    connectDb();
})