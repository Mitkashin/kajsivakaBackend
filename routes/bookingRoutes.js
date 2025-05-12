const express = require("express");
const bookingController = require("../controllers/bookingController");
const router = express.Router();

// Create a new booking
router.post("/", bookingController.createBooking);

// Get all bookings for a user
router.get("/user/:userId", bookingController.getUserBookings);

// Get all bookings for a venue
router.get("/venue/:venueId", bookingController.getVenueBookings);

// Update booking status
router.patch("/:id", bookingController.updateBookingStatus);

// Delete a booking
router.delete("/:id", bookingController.deleteBooking);

module.exports = router;
