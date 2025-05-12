const express = require("express");
const eventController = require("../controllers/eventController");
const router = express.Router();

// Get all events
router.get("/", eventController.getAllEvents);

// Create a new event
router.post("/", eventController.createEvent);

// Get event by ID
router.get("/:id", eventController.getEventById);

// Toggle event interest
router.post("/interest", eventController.toggleEventInterest);

// Get event interest status
router.get("/:id/interest", eventController.getEventInterestStatus);

module.exports = router;
