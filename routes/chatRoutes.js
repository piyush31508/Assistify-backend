// routes/chatRoutes.js
import express from 'express';
import mongoose from 'mongoose';
import { isAuth } from '../middleware/isAuth.js';
import {
  createChat,
  getAllChats,
  addConversation,
  getConversation,
  deleteChat
} from '../controller/chatController.js';

const router = express.Router();


function validateObjectId(req, res, next) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Missing id parameter' });
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid id format' });
  }
  return next();
}


function validateAddConversation(req, res, next) {
  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ message: 'question is required and must be a non-empty string' });
  }
  return next();
}

/**
 * Routes
 *
 * POST   /new       -> create a new chat
 * GET    /all       -> list all chats for authenticated user
 * POST   /:id       -> add conversation to chat with id (requires body.question)
 * GET    /:id       -> get conversations for chat with id
 * DELETE /:id       -> delete chat with id
 *
 * Note: isAuth runs first to ensure req.user is set.
 */

// create chat
router.post('/new', isAuth, createChat);

// get all chats
router.get('/all', isAuth, getAllChats);

// add conversation -> auth, validate id and body
router.post('/:id', isAuth, validateObjectId, validateAddConversation, addConversation);

// get conversations -> auth, validate id
router.get('/:id', isAuth, validateObjectId, getConversation);

// delete chat -> auth, validate id
router.delete('/:id', isAuth, validateObjectId, deleteChat);

export default router;