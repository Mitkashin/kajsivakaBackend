const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  sendFriendRequest,
  respondToFriendRequest,
  getFriends,
  getFriendRequests,
  removeFriend,
  searchUsers
} = require("../controllers/friendController");

// All routes require authentication
router.use(verifyToken);

// Get all friends
router.get("/", getFriends);

// Get all friend requests (incoming and outgoing)
router.get("/requests", getFriendRequests);

// Send a friend request
router.post("/request", sendFriendRequest);

// Respond to a friend request (accept or reject)
router.put("/request/respond", respondToFriendRequest);

// Remove a friend
router.delete("/:friendId", removeFriend);

// Search for users to add as friends
router.get("/search", searchUsers);

module.exports = router;
