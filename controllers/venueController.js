const db = require("../config/db");
const notificationService = require("../services/notificationService");

// Get all venues with optional search
exports.getAllVenues = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';

    if (searchQuery.trim() === '') {
      // If no search query, return all venues
      const [venues] = await db.execute("SELECT * FROM venues");
      return res.status(200).json({
        success: true,
        venues: venues
      });
    }

    // Search in name, location, and features
    let sql = "SELECT * FROM venues WHERE name LIKE ? OR location LIKE ? OR features LIKE ?";
    const searchParam = `%${searchQuery}%`;

    const [venues] = await db.execute(sql, [searchParam, searchParam, searchParam]);

    res.status(200).json({
      success: true,
      venues: venues
    });
  } catch (error) {
    console.error("Error fetching venues:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch venues",
      error: error.message
    });
  }
};

// Get premium venues with pagination
exports.getPremiumVenues = async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count of premium venues
    const [countResult] = await db.execute("SELECT COUNT(*) as total FROM venues WHERE premium = 1");
    const totalCount = countResult[0].total;

    // Get paginated premium venues
    // Convert limit and offset to numbers to avoid MySQL prepared statement issues
    const sql = `SELECT * FROM venues WHERE premium = 1 LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    const [venues] = await db.execute(sql);

    res.status(200).json({
      success: true,
      venues: venues,
      totalCount: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error("Error fetching premium venues:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch premium venues",
      error: error.message
    });
  }
};

// Get non-premium venues with pagination
exports.getNonPremiumVenues = async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count of non-premium venues
    const [countResult] = await db.execute("SELECT COUNT(*) as total FROM venues WHERE premium = 0 OR premium IS NULL");
    const totalCount = countResult[0].total;

    // Get paginated non-premium venues
    // Convert limit and offset to numbers to avoid MySQL prepared statement issues
    const sql = `SELECT * FROM venues WHERE premium = 0 OR premium IS NULL LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    const [venues] = await db.execute(sql);

    res.status(200).json({
      success: true,
      venues: venues,
      totalCount: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error("Error fetching non-premium venues:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch non-premium venues",
      error: error.message
    });
  }
};

// Get venues by user ID
exports.getUserVenues = async (req, res) => {
  try {
    const userId = req.params.userId;
    const sql = "SELECT * FROM venues WHERE user_id = ?";
    const [venues] = await db.execute(sql, [userId]);

    res.status(200).json({
      success: true,
      venues: venues
    });
  } catch (error) {
    console.error("Error fetching user venues:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user venues",
      error: error.message
    });
  }
};

// Create a new venue
exports.createVenue = async (req, res) => {
  try {
    const { name, description, type, location, premium, latitude, longitude, image, images, user_id, opening_hours, features } = req.body;

    // Validate required fields
    if (!name || !description || !type || !location) {
      return res.status(400).json({
        success: false,
        message: "Name, description, type, and location are required"
      });
    }

    // Check if the images column exists in the venues table
    let hasImagesColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM venues LIKE 'images'");
      hasImagesColumn = columns.length > 0;
    } catch (error) {
      console.warn("Error checking for images column:", error.message);
    }

    let sql, params;

    if (hasImagesColumn) {
      // Insert the new venue into the database with images column
      sql = `INSERT INTO venues
        (name, description, type, location, premium, latitude, longitude, image, images, user_id, opening_hours, features)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      params = [
        name,
        description,
        type,
        location,
        premium ? 1 : 0,
        latitude || null,
        longitude || null,
        image || null,
        images || null,
        user_id || null,
        opening_hours || null,
        features || null
      ];
    } else {
      // Fallback to original query without images column
      sql = `INSERT INTO venues
        (name, description, type, location, premium, latitude, longitude, image, user_id, opening_hours, features)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      params = [
        name,
        description,
        type,
        location,
        premium ? 1 : 0,
        latitude || null,
        longitude || null,
        image || null,
        user_id || null,
        opening_hours || null,
        features || null
      ];
    }

    const [result] = await db.execute(sql, params);

    // Get the newly created venue
    const venueId = result.insertId;
    const [venues] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);

    // Send notification about the new venue (asynchronously)
    notificationService.sendNewVenueNotification(venueId)
      .then(notificationResult => {
        if (notificationResult) {
          console.log(`New venue notification sent successfully for venue ${venueId}`);
        } else {
          console.log(`Failed to send new venue notification for venue ${venueId}`);
        }
      })
      .catch(err => {
        console.error(`Error sending new venue notification for venue ${venueId}:`, err);
      });

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      venue: venues[0]
    });
  } catch (error) {
    console.error("Error creating venue:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create venue",
      error: error.message
    });
  }
};

// Get venue by ID
exports.getVenueById = async (req, res) => {
  try {
    const venueId = req.params.id;
    const sql = "SELECT * FROM venues WHERE id = ?";
    const [venues] = await db.execute(sql, [venueId]);

    if (venues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    res.status(200).json({
      success: true,
      venue: venues[0]
    });
  } catch (error) {
    console.error("Error fetching venue details:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch venue details",
      error: error.message
    });
  }
};

// Update a venue
exports.updateVenue = async (req, res) => {
  try {
    const venueId = req.params.id;

    // First, get the current venue data
    const [currentVenues] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);

    if (currentVenues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    const currentVenue = currentVenues[0];

    // Extract fields from request body, using current values as defaults
    const {
      name = currentVenue.name,
      description = currentVenue.description,
      type = currentVenue.type,
      location = currentVenue.location,
      premium = currentVenue.premium,
      latitude = currentVenue.latitude,
      longitude = currentVenue.longitude,
      image = currentVenue.image,
      images = currentVenue.images,
      user_id = currentVenue.user_id,
      opening_hours = currentVenue.opening_hours,
      features = currentVenue.features
    } = req.body;

    // Validate required fields
    if (!name || !description || !type || !location) {
      return res.status(400).json({
        success: false,
        message: "Name, description, type, and location are required"
      });
    }

    // Check if the images column exists in the venues table
    let hasImagesColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM venues LIKE 'images'");
      hasImagesColumn = columns.length > 0;
    } catch (error) {
      console.warn("Error checking for images column:", error.message);
    }

    let sql, params;

    if (hasImagesColumn) {
      // Update the venue in the database with images column
      sql = `UPDATE venues
        SET name = ?, description = ?, type = ?, location = ?, premium = ?,
        latitude = ?, longitude = ?, image = ?, images = ?, user_id = ?, opening_hours = ?, features = ?
        WHERE id = ?`;

      params = [
        name,
        description,
        type,
        location,
        premium ? 1 : 0,
        latitude || null,
        longitude || null,
        image || null,
        images || null,
        user_id || null,
        opening_hours || null,
        features || null,
        venueId
      ];
    } else {
      // Fallback to original query without images column
      sql = `UPDATE venues
        SET name = ?, description = ?, type = ?, location = ?, premium = ?,
        latitude = ?, longitude = ?, image = ?, user_id = ?, opening_hours = ?, features = ?
        WHERE id = ?`;

      params = [
        name,
        description,
        type,
        location,
        premium ? 1 : 0,
        latitude || null,
        longitude || null,
        image || null,
        user_id || null,
        opening_hours || null,
        features || null,
        venueId
      ];
    }

    const [result] = await db.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found or no changes made"
      });
    }

    // Get the updated venue
    const [venues] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      venue: venues[0]
    });
  } catch (error) {
    console.error("Error updating venue:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update venue",
      error: error.message
    });
  }
};

// Delete a venue
exports.deleteVenue = async (req, res) => {
  try {
    const venueId = req.params.id;

    // First, check if the venue exists
    const [venueRows] = await db.execute("SELECT * FROM venues WHERE id = ?", [venueId]);

    if (venueRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    // Check if there are any bookings for this venue
    const [bookingRows] = await db.execute("SELECT COUNT(*) as count FROM venue_bookings WHERE venue_id = ?", [venueId]);
    const bookingCount = bookingRows[0].count;

    // Delete the venue (this will cascade delete ratings and bookmarks due to foreign key constraints)
    await db.execute("DELETE FROM venues WHERE id = ?", [venueId]);

    res.status(200).json({
      success: true,
      message: "Venue deleted successfully",
      bookingsDeleted: bookingCount > 0 ? bookingCount : 0
    });
  } catch (error) {
    console.error("Error deleting venue:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete venue",
      error: error.message
    });
  }
};