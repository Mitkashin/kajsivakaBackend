const express = require("express");
const ratingController = require("../controllers/ratingController");
const router = express.Router();

// Submit a rating for a venue
router.post("/", ratingController.submitRating);

// Get all ratings for a venue
router.get("/venue/:venueId", ratingController.getVenueRatings);

// Get user's rating for a specific venue
router.get("/user/venue/:venueId", ratingController.getUserVenueRating);

module.exports = router;
