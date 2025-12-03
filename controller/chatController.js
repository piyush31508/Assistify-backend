// controller/chatController.js
import axios from "axios";
import { Chat } from '../model/Chat.js';
import { Conversation } from '../model/Conversation.js';
import mongoose from 'mongoose';

/**
 * Sanitize model/client answer:
 * - remove code fences/backticks
 * - remove markdown headings (##, ### ...)
 * - remove unordered list markers (-, *, +) at line starts
 * - remove ordered list numbers like "1. "
 * - remove stray asterisks anywhere
 * - convert markdown links [text](url) -> text
 * - remove simple HTML tags
 * - collapse multiple blank lines
 * - trim
 */
function sanitizeAnswer(text) {
  if (!text || typeof text !== 'string') return text || '';

  let cleaned = text;

  // 1) Remove fenced code blocks ```...```
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');

  // 2) Remove inline code `code`
  cleaned = cleaned.replace(/`([^`]*)`/g, '$1');

  // 3) Remove markdown headings at line starts (e.g., ### Heading)
  cleaned = cleaned.replace(/^\s{0,3}#{1,6}\s*/gm, '');

  // 4) Remove unordered list markers at line starts: -, *, +
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');

  // 5) Remove ordered list numbers like "1. " at line starts
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // 6) Remove stray asterisks used for emphasis
  cleaned = cleaned.replace(/\*+/g, '');

  // 7) Convert markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');

  // 8) Remove simple HTML tags (e.g., <p>, <br>, <div>, <strong>, etc.)
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');

  // 9) Trim trailing/leading spaces per line
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  cleaned = cleaned.replace(/^[ \t]+/gm, '');

  // 10) Collapse multiple blank lines into single blank line
  cleaned = cleaned.replace(/\n{2,}/g, '\n\n');

  // 11) Trim overall
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Create a new chat for the authenticated user
 */
export const createChat = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const chat = await Chat.create({ user: userId });
    return res.status(201).json({ chat });
  } catch (error) {
    console.error("createChat error:", error);
    return res.status(500).json({ message: 'Failed to create chat', error: error.message });
  }
};

/**
 * Get all chats for the authenticated user
 */
export const getAllChats = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const chats = await Chat.find({ user: userId }).sort({ createdAt: -1 }).lean();
    return res.json(chats);
  } catch (error) {
    console.error("getAllChats error:", error);
    return res.status(500).json({ message: 'Failed to fetch chats', error: error.message });
  }
};

/**
 * Add a conversation to a chat.
 * If client doesn't provide answer, call OpenRouter server-side.
 * Transactionally create Conversation and update Chat.latestMessage.
 */
export const addConversation = async (req, res) => {
  let session = null;
  try {
    const chatId = req.params.id;
    const { question, answer: clientAnswer, systemPrompt: clientSystemPrompt } = req.body;
    const userId = req.user && req.user._id;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ message: 'question is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'No chat found' });

    if (chat.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to add conversation to this chat' });
    }

    // Use client-supplied answer if present. Otherwise call OpenRouter server-side
    let finalAnswer = clientAnswer;

    if (!finalAnswer) {
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      // default to the meta-llama model as requested; allow override via env
      const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
      const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ message: 'OpenRouter API key not configured on server' });
      }

      const systemPrompt = (clientSystemPrompt && typeof clientSystemPrompt === 'string')
        ? clientSystemPrompt
        : "Respond in plain text only. Do NOT use bullet points, '*', '-', '+', Markdown, or formatting. Use plain sentences only.";

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ];

      const body = {
        model: OPENROUTER_MODEL,
        messages,
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.2'),
        max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '1200', 10)
      };

      try {
        const orRes = await axios.post(
          OPENROUTER_URL,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            },
            timeout: 30_000
          }
        );

        // Defensive extraction of the model's reply
        const choices = orRes.data?.choices;
        if (Array.isArray(choices) && choices.length > 0) {
          const first = choices[0];
          finalAnswer = first?.message?.content || first?.text || (first?.delta && first.delta?.content) || JSON.stringify(first);
        } else if (orRes.data?.output) {
          finalAnswer = Array.isArray(orRes.data.output) ? orRes.data.output.join('\n') : String(orRes.data.output);
        } else {
          finalAnswer = 'Sorry, I could not generate an answer at this time.';
        }
      } catch (apiErr) {
        // Log only remote error body (never print API key)
        console.error('OpenRouter API error (remote body):', apiErr.response?.data || apiErr.message);

        if (apiErr.response?.status === 401 || apiErr.response?.data?.error?.code === 401) {
          return res.status(502).json({
            message: 'Failed to generate answer from OpenRouter - authentication failed (401). Verify OPENROUTER_API_KEY and model permissions on server.',
            error: apiErr.response?.data || apiErr.message,
          });
        }

        return res.status(502).json({
          message: 'Failed to generate answer from OpenRouter',
          error: apiErr.response?.data || apiErr.message
        });
      }
    }

    // sanitize the final answer (removes bullets, markdown, backticks, lists, html, etc.)
    finalAnswer = sanitizeAnswer(finalAnswer);

    // Persist conversation + update chat.latestMessage in a transaction
    session = await mongoose.startSession();
    session.startTransaction();

    const conversationDocs = await Conversation.create([{
      chat: chat._id,
      question,
      answer: finalAnswer
    }], { session });

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { latestMessage: question, updatedAt: new Date() },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: 'Conversation added successfully',
      conversation: conversationDocs[0],
      updatedChat
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }
    console.error("addConversation error:", error);
    return res.status(500).json({ message: 'Failed to add conversation', error: error.message });
  }
};

/**
 * Get conversations for a chat (only if the chat belongs to the authenticated user)
 * Optional query params: ?limit=50&skip=0
 */
export const getConversation = async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    if (chat.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to view this chat' });
    }

    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const skip = Math.max(parseInt(req.query.skip || '0', 10), 0);

    const conversations = await Conversation.find({ chat: chat._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!conversations.length) {
      return res.status(404).json({ message: 'No conversation found' });
    }

    return res.json(conversations);
  } catch (error) {
    console.error("getConversation error:", error);
    return res.status(500).json({ message: 'Server error occurred', error: error.message });
  }
};

/**
 * Delete a chat (only owner can delete). Also remove associated conversations.
 */
export const deleteChat = async (req, res) => {
  let session = null;
  try {
    const chatId = req.params.id;
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'No chat found' });

    if (chat.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You are not authorized to delete this chat' });
    }

    // Transactionally delete chat and its conversations
    session = await mongoose.startSession();
    session.startTransaction();

    await Conversation.deleteMany({ chat: chat._id }, { session });
    await chat.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: 'Chat and its conversations deleted successfully' });
  } catch (error) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }
    console.error("deleteChat error:", error);
    return res.status(500).json({ message: 'Failed to delete chat', error: error.message });
  }
};
