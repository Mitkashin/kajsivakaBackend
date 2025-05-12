const db = require('../config/db');
const notificationService = require('../services/notificationService');

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { venue_id, user_id, booking_date, booking_time, guest_count, note, status } = req.body;

    // Validate required fields
    if (!venue_id || !user_id || !booking_date || !booking_time || !guest_count) {
      return res.status(400).json({
        success: false,
        message: "Venue ID, User ID, booking date, booking time, and guest count are required"
      });
    }

    // Check if the venue exists
    const [venueRows] = await db.execute("SELECT * FROM venues WHERE id = ?", [venue_id]);
    if (venueRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Check if the user exists
    const [userRows] = await db.execute("SELECT * FROM users WHERE id = ?", [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Insert the booking into the database
    const [result] = await db.execute(
      `INSERT INTO venue_bookings
      (venue_id, user_id, booking_date, booking_time, guest_count, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [venue_id, user_id, booking_date, booking_time, guest_count, note || null, status || 'pending']
    );

    // Get the newly created booking
    const [bookings] = await db.execute(
      "SELECT * FROM venue_bookings WHERE id = ?",
      [result.insertId]
    );

    // Send notification to venue owner about the new booking (asynchronously)
    try {
      notificationService.sendNewBookingNotification(result.insertId)
        .then(notificationResult => {
          if (notificationResult) {
            console.log(`New booking notification sent successfully for booking ${result.insertId}`);
          } else {
            console.log(`Failed to send new booking notification for booking ${result.insertId}`);
          }
        })
        .catch(err => {
          console.error(`Error sending new booking notification for booking ${result.insertId}:`, err);
        });
    } catch (notificationError) {
      console.error("Error sending new booking notification:", notificationError);
      // Continue with the response even if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: bookings[0]
    });
  } catch (error) {
    console.error("Error creating booking:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message
    });
  }
};

// Get all bookings for a user
exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Check if the user exists
    const [userRows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all bookings for the user with venue details
    const [bookings] = await db.execute(
      `SELECT vb.*, v.name as venue_name, v.image as venue_image, v.location as venue_location
       FROM venue_bookings vb
       JOIN venues v ON vb.venue_id = v.id
       WHERE vb.user_id = ?
       ORDER BY vb.booking_date DESC, vb.booking_time DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      bookings: bookings
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
};

// Get all bookings for a venue
exports.getVenueBookings = async (req, res) => {
  try {
    const venueId = req.params.venueId;

    // Check if the venue exists
    const [venueRows] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);
    if (venueRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Get all bookings for the venue with user details
    const [bookings] = await db.execute(
      `SELECT vb.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone
       FROM venue_bookings vb
       JOIN users u ON vb.user_id = u.id
       WHERE vb.venue_id = ?
       ORDER BY vb.booking_date ASC, vb.booking_time ASC`,
      [venueId]
    );

    res.status(200).json({
      success: true,
      bookings: bookings
    });
  } catch (error) {
    console.error("Error fetching venue bookings:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message
    });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate required fields
    if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (pending, confirmed, cancelled) is required"
      });
    }

    // Check if the booking exists
    const [bookingRows] = await db.execute("SELECT * FROM venue_bookings WHERE id = ?", [id]);
    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Get the current status to check if it's actually changing
    const currentStatus = bookingRows[0].status;

    // Update the booking status
    await db.execute(
      "UPDATE venue_bookings SET status = ? WHERE id = ?",
      [status, id]
    );

    // Get the updated booking
    const [updatedBooking] = await db.execute(
      "SELECT * FROM venue_bookings WHERE id = ?",
      [id]
    );

    // Send notification if status is changing to confirmed or cancelled
    if (currentStatus !== status && (status === 'confirmed' || status === 'cancelled')) {
      try {
        // Send notification asynchronously (don't await)
        notificationService.sendBookingStatusNotification(id, status)
          .then(result => {
            if (result) {
              console.log(`Booking notification sent successfully for booking ${id}`);
            } else {
              console.log(`Failed to send booking notification for booking ${id}`);
            }
          })
          .catch(err => {
            console.error(`Error sending booking notification for booking ${id}:`, err);
          });
      } catch (notificationError) {
        console.error("Error sending booking notification:", notificationError);
        // Continue with the response even if notification fails
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: updatedBooking[0]
    });
  } catch (error) {
    console.error("Error updating booking status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message
    });
  }
};

// Delete a booking
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the booking exists
    const [bookingRows] = await db.execute("SELECT * FROM venue_bookings WHERE id = ?", [id]);
    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Delete the booking
    await db.execute("DELETE FROM venue_bookings WHERE id = ?", [id]);

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting booking:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message
    });
  }
};
