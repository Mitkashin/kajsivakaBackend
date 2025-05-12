const express = require("express");
const venueController = require("../controllers/venueController");
const router = express.Router();

// Get all venues with optional search
router.get("/", venueController.getAllVenues);

// Get premium venues
router.get("/premium", venueController.getPremiumVenues);

// Get non-premium venues
router.get("/non-premium", venueController.getNonPremiumVenues);

// Get venues by user ID
router.get("/user/:userId", venueController.getUserVenues);

// Create a new venue
router.post("/", venueController.createVenue);

// Get venue by ID
router.get("/:id", venueController.getVenueById);

// Update venue by ID
router.put("/:id", venueController.updateVenue);

// Delete venue by ID
router.delete("/:id", venueController.deleteVenue);

module.exports = router;
