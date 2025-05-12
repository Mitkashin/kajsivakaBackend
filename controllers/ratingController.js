const db = require("../config/db");

// Submit a rating for a venue
exports.submitRating = async (req, res) => {
  try {
    const { venue_id, rating, comment } = req.body;
    const user_id = req.user ? req.user.id : req.body.user_id; // Get user ID from auth middleware or request body

    // Validate required fields
    if (!venue_id || !rating || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Venue ID, rating, and user ID are required"
      });
    }

    // Validate rating value (between 1 and 5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    // Check if venue exists
    const [venues] = await db.execute("SELECT * FROM venues WHERE id = ?", [venue_id]);
    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    try {
      // Check if user has already rated this venue
      const [existingRatings] = await db.execute(
        "SELECT * FROM ratings WHERE user_id = ? AND venue_id = ?",
        [user_id, venue_id]
      );

      let result;

      // Get a connection from the pool for transaction
      const connection = await db.getConnection();

      try {
        // Begin transaction
        await connection.beginTransaction();

        if (existingRatings.length > 0) {
          // Update existing rating
          const oldRating = existingRatings[0].rating;

          [result] = await connection.execute(
            "UPDATE ratings SET rating = ?, comment = ?, updated_at = NOW() WHERE user_id = ? AND venue_id = ?",
            [rating, comment || null, user_id, venue_id]
          );

          // Update venue's total rating and count
          await connection.execute(
            "UPDATE venues SET rating_total = rating_total - ? + ?, rating = rating_total / rating_count WHERE id = ?",
            [oldRating, rating, venue_id]
          );
        } else {
          // Insert new rating
          [result] = await connection.execute(
            "INSERT INTO ratings (venue_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
            [venue_id, user_id, rating, comment || null]
          );

          // Update venue's total rating and count
          await connection.execute(
            "UPDATE venues SET rating_count = rating_count + 1, rating_total = rating_total + ?, rating = rating_total / rating_count WHERE id = ?",
            [rating, venue_id]
          );
        }

        // Get updated venue data
        const [updatedVenues] = await connection.execute("SELECT * FROM venues WHERE id = ?", [venue_id]);

        // Commit transaction
        await connection.commit();

        // Release the connection back to the pool
        connection.release();

        res.status(200).json({
          success: true,
          message: existingRatings.length > 0 ? "Rating updated successfully" : "Rating submitted successfully",
          venue: updatedVenues[0]
        });
      } catch (error) {
        // Rollback transaction in case of error
        await connection.rollback();

        // Release the connection back to the pool
        connection.release();

        throw error;
      }
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error submitting rating:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
      error: error.message
    });
  }
};

// Get ratings for a venue
exports.getVenueRatings = async (req, res) => {
  try {
    const venueId = req.params.venueId;

    // Get venue details with rating information
    const [venues] = await db.execute(
      "SELECT id, name, rating, rating_count, rating_total FROM venues WHERE id = ?",
      [venueId]
    );

    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Get all ratings for the venue
    const [ratings] = await db.execute(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
              u.id as user_id, u.full_name as user_name, u.avatar as user_avatar, u.is_business
       FROM ratings r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.venue_id = ?
       ORDER BY r.created_at DESC`,
      [venueId]
    );

    res.status(200).json({
      success: true,
      venue: venues[0],
      ratings: ratings
    });
  } catch (error) {
    console.error("Error fetching venue ratings:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch venue ratings",
      error: error.message
    });
  }
};

// Get user's rating for a specific venue
exports.getUserVenueRating = async (req, res) => {
  try {
    const { venueId } = req.params;
    const userId = req.user ? req.user.id : req.query.user_id; // Get user ID from auth middleware or query param

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const [ratings] = await db.execute(
      "SELECT * FROM ratings WHERE user_id = ? AND venue_id = ?",
      [userId, venueId]
    );

    if (ratings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found"
      });
    }

    res.status(200).json({
      success: true,
      rating: ratings[0]
    });
  } catch (error) {
    console.error("Error fetching user's venue rating:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user's venue rating",
      error: error.message
    });
  }
};
