const express = require("express");
const bookmarkController = require("../controllers/bookmarkController");
const router = express.Router();

// Toggle bookmark status for a venue
router.post("/", bookmarkController.toggleVenueBookmark);

// Get all bookmarked venues for a user
router.get("/user/:userId", bookmarkController.getUserBookmarks);

// Check if a venue is bookmarked by a user
router.get("/venue/:venueId", bookmarkController.getVenueBookmarkStatus);

module.exports = router;
