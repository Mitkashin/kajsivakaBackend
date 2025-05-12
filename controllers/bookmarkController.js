const db = require("../config/db");

// Toggle bookmark status for a venue
exports.toggleVenueBookmark = async (req, res) => {
  try {
    const { venue_id, user_id } = req.body;

    // Validate required fields
    if (!venue_id || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Venue ID and User ID are required"
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

    // Check if the venue is already bookmarked by the user
    const [bookmarkRows] = await db.execute(
      "SELECT * FROM venue_bookmarks WHERE venue_id = ? AND user_id = ?",
      [venue_id, user_id]
    );

    let isBookmarked = false;

    if (bookmarkRows.length > 0) {
      // Venue is already bookmarked, so remove the bookmark
      await db.execute(
        "DELETE FROM venue_bookmarks WHERE venue_id = ? AND user_id = ?",
        [venue_id, user_id]
      );
    } else {
      // Venue is not bookmarked yet, so add the bookmark
      await db.execute(
        "INSERT INTO venue_bookmarks (venue_id, user_id) VALUES (?, ?)",
        [venue_id, user_id]
      );

      isBookmarked = true;
    }

    res.status(200).json({
      success: true,
      message: isBookmarked ? "Venue bookmarked successfully" : "Venue bookmark removed successfully",
      isBookmarked: isBookmarked
    });
  } catch (error) {
    console.error("Error toggling venue bookmark:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle venue bookmark",
      error: error.message
    });
  }
};

// Get all bookmarked venues for a user
exports.getUserBookmarks = async (req, res) => {
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

    // Get all bookmarked venues for the user with venue details
    const [bookmarks] = await db.execute(
      `SELECT v.*, vb.created_at as bookmarked_at
       FROM venues v
       JOIN venue_bookmarks vb ON v.id = vb.venue_id
       WHERE vb.user_id = ?
       ORDER BY vb.created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      bookmarks: bookmarks
    });
  } catch (error) {
    console.error("Error getting user bookmarks:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get user bookmarks",
      error: error.message
    });
  }
};

// Check if a venue is bookmarked by a user
exports.getVenueBookmarkStatus = async (req, res) => {
  try {
    const venueId = req.params.venueId;
    const userId = req.query.user_id;

    // Validate required fields
    if (!venueId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Venue ID and User ID are required"
      });
    }

    // Check if the venue exists
    const [venueRows] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);
    if (venueRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Check if the user exists
    const [userRows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if the venue is bookmarked by the user
    const [bookmarkRows] = await db.execute(
      "SELECT * FROM venue_bookmarks WHERE venue_id = ? AND user_id = ?",
      [venueId, userId]
    );

    const isBookmarked = bookmarkRows.length > 0;

    res.status(200).json({
      success: true,
      isBookmarked: isBookmarked
    });
  } catch (error) {
    console.error("Error getting venue bookmark status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get venue bookmark status",
      error: error.message
    });
  }
};
