import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    latestMessage:{
        type: String,
        default:"New Conversation"
    },
   
    
},
{
    timestamps: true
});

export const Chat = mongoose.model("Chat", chatSchema)