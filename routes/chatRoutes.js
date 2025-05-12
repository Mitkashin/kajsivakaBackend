const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  getChatHistory,
  getConversations,
  sendMessage,
  getUnreadCount,
  markAsRead
} = require("../controllers/chatController");

// All routes require authentication
router.use(verifyToken);

// Get all conversations
router.get("/conversations", getConversations);

// Get chat history with a specific user
router.get("/:friendId", getChatHistory);

// Send a message
router.post("/", sendMessage);

// Get unread message count
router.get("/unread/count", getUnreadCount);

// Mark messages as read
router.put("/:friendId/read", markAsRead);

module.exports = router;
