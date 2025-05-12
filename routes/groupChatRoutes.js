const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  createGroup,
  getGroups,
  getGroupDetails,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  updateGroup,
  deleteGroup,
  getGroupMessages,
  sendGroupMessage,
  markGroupMessagesAsRead
} = require("../controllers/groupChatController");

// All routes require authentication
router.use(verifyToken);

// Group management
router.post("/", createGroup);
router.get("/", getGroups);
router.get("/:groupId", getGroupDetails);
router.put("/:groupId", updateGroup);
router.delete("/:groupId", deleteGroup);

// Group members
router.get("/:groupId/members", getGroupMembers);
router.post("/:groupId/members", addGroupMember);
router.delete("/:groupId/members/:userId", removeGroupMember);
router.delete("/:groupId/leave", leaveGroup);

// Group messages
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/messages", sendGroupMessage);
router.put("/:groupId/messages/read", markGroupMessagesAsRead);

module.exports = router;
