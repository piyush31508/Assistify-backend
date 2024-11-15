import { Chat } from '../model/Chat.js';
import { Conversation } from '../model/Conversation.js';
import mongoose from 'mongoose';

export const createChat = async (req, res) => {
    try {
        const userId = req.user._id;

        const chat = await Chat.create({
            user: userId
        })

        res.status(201).json({ chat })
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}

export const getAllChats = async (req, res) => {
    try {
        const chats = await Chat.find({ user: req.user._id }).sort({
            createdAt: -1
        });

        res.json(chats);
    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}
export const addConversation = async (req, res) => {
    try {

        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({
                message: 'No chat found by this user'
            });
        }

        const conversation = await Conversation.create({
            chat: chat._id,
            question: req.body.question,
            answer: req.body.answer
        });


        const updatedChat = await Chat.findByIdAndUpdate(
            req.params.id,
            { latestMessage: req.body.question },
            { new: true }
        );


        res.json({
            message: 'Conversation added successfully',
            conversation,
            updatedChat
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};


// export const getConversation = async (req, res) => {
//     try {
//         const chatId = mongoose.Types.ObjectId(req.params.id);
//         if (!mongoose.Types.ObjectId.isValid(chatId)) {
//             return res.status(400).json({ message: 'Invalid chat ID format' });
//         }
//         const conversation = await Conversation.find({ chat: chatId });
//         if (!conversation.length) {
//             return res.status(404).json({
//                 message: 'No conversation found'
//             });
//         }
//         res.json(conversation);
//     } catch (error) {
//         res.status(500).json({
//             message: error.message
//         })
//     }
// }

export const getConversation = async (req, res) => {
    try {
        const chatId = req.params.id;

        console.log("Requested Chat ID:", chatId);
        console.log("Searching for conversation linked to chat:", chatId);

        // Check if chatId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ message: 'Invalid chat ID format' });
        }

        // Convert chatId to an ObjectId
        const conversation = await Conversation.find({ chat: new mongoose.Types.ObjectId(chatId) });

        console.log("Conversation Result:", conversation);

        if (!conversation.length) {
            return res.status(404).json({
                message: 'No conversation found'
            });
        }

        res.json(conversation);
    } catch (error) {
        console.error("Error fetching conversation:", error);
        res.status(500).json({
            message: 'Server error occurred'
        });
    }
};


export const deleteChat = async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({
                message: 'No chat found by this user'
            });
        }

        if (chat.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: 'You are not authorized to delete this chat'
            });
        }

        await chat.deleteOne();
        res.json({
            message: 'Chat deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        })
    }
}