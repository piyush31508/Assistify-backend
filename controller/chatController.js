// controller/chatController.js
import axios from "axios";
import { Chat } from "../model/Chat.js";
import { Conversation } from "../model/Conversation.js";
import mongoose from "mongoose";

/* ---------------- SANITIZER ---------------- */

function sanitizeAnswer(text) {
  if (!text || typeof text !== "string") return text || "";

  let cleaned = text;

  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`([^`]*)`/g, "$1");
  cleaned = cleaned.replace(/^\s{0,3}#{1,6}\s*/gm, "");
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");
  cleaned = cleaned.replace(/\*+/g, "");
  cleaned = cleaned.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1");
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");
  cleaned = cleaned.replace(/[ \t]+$/gm, "");
  cleaned = cleaned.replace(/^[ \t]+/gm, "");
  cleaned = cleaned.replace(/\n{2,}/g, "\n\n");

  return cleaned.trim();
}

/* ---------------- CREATE CHAT ---------------- */

export const createChat = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const chat = await Chat.create({ user: userId });
    return res.status(201).json({ chat });
  } catch (error) {
    console.error("createChat error:", error);
    return res.status(500).json({ message: "Failed to create chat" });
  }
};

/* ---------------- GET ALL CHATS ---------------- */

export const getAllChats = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const chats = await Chat.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(chats);
  } catch (error) {
    console.error("getAllChats error:", error);
    return res.status(500).json({ message: "Failed to fetch chats" });
  }
};

/* ---------------- ADD CONVERSATION ---------------- */

export const addConversation = async (req, res) => {
  let session = null;

  try {
    const chatId = req.params.id;
    const { question, answer: clientAnswer, systemPrompt } = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!question?.trim())
      return res.status(400).json({ message: "question is required" });
    if (!mongoose.Types.ObjectId.isValid(chatId))
      return res.status(400).json({ message: "Invalid chat ID" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "No chat found" });
    if (chat.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    let finalAnswer = clientAnswer;

    /* ----------- AI CALL ----------- */

    if (!finalAnswer) {
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      const URL = "https://openrouter.ai/api/v1/chat/completions";

      if (!OPENROUTER_API_KEY)
        return res.status(500).json({ message: "OpenRouter key missing" });

      const models = [
        "meta-llama/llama-3.3-70b-instruct:free", 
        "deepseek/deepseek-r1t2-chimera", 
      ];

      let aiText = null;
      let lastErr = null;

      for (const model of models) {
        try {
          const response = await axios.post(
            URL,
            {
              model,
              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt ||
                    "Respond in plain text only. No markdown or bullets.",
                },
                { role: "user", content: question },
              ],
              temperature: 0.2,
              max_tokens: 1200,
            },
            {
              headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
              },
              timeout: 30000,
            }
          );

          aiText = response.data?.choices?.[0]?.message?.content;

          if (aiText) {
            console.log("✅ Model used:", model);
            break;
          }
        } catch (err) {
          console.log(
  "❌ Model failed:",
  model,
  err.response?.status,
  err.response?.data || err.message
);

          lastErr = err;
        }
      }

      if (!aiText) {
        const status = lastErr?.response?.status;

        if (status === 429)
          return res
            .status(429)
            .json({ message: "AI busy. Try again shortly." });

        return res
          .status(503)
          .json({ message: "All AI models failed." });
      }

      finalAnswer = aiText;
    }

    /* ----------- SAVE TO DB ----------- */

    finalAnswer = sanitizeAnswer(finalAnswer);

    session = await mongoose.startSession();
    session.startTransaction();

    const [conversation] = await Conversation.create(
      [{ chat: chat._id, question, answer: finalAnswer }],
      { session }
    );

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { latestMessage: question, updatedAt: new Date() },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Conversation added",
      conversation,
      updatedChat,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }

    console.error("addConversation error:", error);
    return res.status(500).json({ message: "Failed to add conversation" });
  }
};

/* ---------------- GET CONVERSATIONS ---------------- */

export const getConversation = async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(chatId))
      return res.status(400).json({ message: "Invalid chat ID" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    if (chat.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    const conversations = await Conversation.find({ chat: chat._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json(conversations);
  } catch (error) {
    console.error("getConversation error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ---------------- DELETE CHAT ---------------- */

export const deleteChat = async (req, res) => {
  let session = null;

  try {
    const chatId = req.params.id;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "No chat found" });
    if (chat.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    session = await mongoose.startSession();
    session.startTransaction();

    await Conversation.deleteMany({ chat: chat._id }, { session });
    await chat.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: "Chat deleted" });
  } catch (error) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }

    console.error("deleteChat error:", error);
    return res.status(500).json({ message: "Delete failed" });
  }
};
