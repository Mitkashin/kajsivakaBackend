const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  shareItem,
  getSharedItems,
  markSharedItemAsRead,
  getUnreadSharedItemsCount
} = require("../controllers/sharingController");

// All routes require authentication
router.use(verifyToken);

// Share a venue or event with a friend
router.post("/", shareItem);

// Get all shared items for the current user
router.get("/", getSharedItems);

// Mark a shared item as read
router.put("/:itemId/read", markSharedItemAsRead);

// Get unread shared items count
router.get("/unread/count", getUnreadSharedItemsCount);

module.exports = router;
