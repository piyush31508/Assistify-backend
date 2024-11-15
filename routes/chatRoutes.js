import express from 'express';
import { isAuth } from '../middleware/isAuth.js';
import { createChat, getAllChats, addConversation, getConversation, deleteChat } from '../controller/chatController.js';

const router = express.Router();

router
.post('/new', isAuth, createChat)
.get('/all', isAuth, getAllChats)
.post('/:id', isAuth, addConversation)
.get('/:id', isAuth, getConversation)
.delete('/:id', isAuth, deleteChat);

export default router;