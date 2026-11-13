import { Router } from 'express';
import {
  listConversations,
  getConversationMessages,
  sendAgentReply,
  toggleBotState,
  getCommentsFeed,
  deleteConversation,
} from '../controllers/inbox.controller.js';

const router = Router();

router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', getConversationMessages);
router.delete('/conversations/:id', deleteConversation);
router.post('/messages/send', sendAgentReply);
router.post('/bot-toggle', toggleBotState);
router.get('/instagram/comments', getCommentsFeed);

export default router;

