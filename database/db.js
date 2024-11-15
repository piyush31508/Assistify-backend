import mongoose from "mongoose";

const connectDb = async () => {
    try{
        await mongoose.connect(process.env.MONGODB_URI,{
            dbName: "Assistify",
        });
        console.log("DB Connected");
    } 
    catch(error){
        console.error("Error connecting to MongoDB:", error.message);
    }
}

export default connectDb;