const db = require("../config/db");
const notificationService = require("../services/notificationService");

// Get all events with optional search and pagination
exports.getAllEvents = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Check if the events table has a custom_location column
    let hasCustomLocationColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM events LIKE 'custom_location'");
      hasCustomLocationColumn = columns.length > 0;
      // Events table has custom_location column check
    } catch (error) {
      console.error('Error checking for custom_location column:', error.message);
    }

    let sql, countSql;
    let params = [], countParams = [];

    if (searchQuery.trim() === '') {
      // If no search query, return paginated events ordered by date
      if (hasCustomLocationColumn) {
        // Use LEFT JOIN to get venue location when venue_id is not null
        sql = `
          SELECT e.*, v.location as venue_location
          FROM events e
          LEFT JOIN venues v ON e.venue_id = v.id
          ORDER BY e.event_date ASC
          LIMIT ? OFFSET ?
        `;
        countSql = `
          SELECT COUNT(*) as total
          FROM events e
        `;
      } else {
        sql = "SELECT * FROM events ORDER BY event_date ASC LIMIT ? OFFSET ?";
        countSql = "SELECT COUNT(*) as total FROM events";
      }

      params = [limit, offset];

      // Get total count of events
      const [countResult] = await db.execute(countSql);
      const totalCount = countResult[0].total;

      // Get paginated events - use template literals for LIMIT and OFFSET to avoid MySQL prepared statement issues
      if (sql.includes('LIMIT ? OFFSET ?')) {
        sql = sql.replace('LIMIT ? OFFSET ?', `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`);
        params = params.slice(0, -2); // Remove limit and offset from params
      }
      const [events] = await db.execute(sql, params);

      // Process events to set the correct location
      const processedEvents = events.map(event => {
        if (hasCustomLocationColumn) {
          // If venue_id is not null, use venue_location, otherwise use custom_location
          if (event.venue_id && event.venue_location) {
            event.display_location = event.venue_location;
          } else if (event.custom_location) {
            event.display_location = event.custom_location;
          } else {
            event.display_location = event.venue; // Fallback to venue field
          }
        } else {
          event.display_location = event.venue; // Fallback to venue field
        }

        // Make sure interested_count is included
        if (event.interested_count === undefined) {
          event.interested_count = 0;
        }

        return event;
      });

      return res.status(200).json({
        success: true,
        events: processedEvents,
        totalCount: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    }

    // Search in name, venue, and custom_location if available with pagination
    if (hasCustomLocationColumn) {
      sql = `
        SELECT e.*, v.location as venue_location
        FROM events e
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.name LIKE ? OR e.venue LIKE ? OR e.custom_location LIKE ?
        ORDER BY e.event_date ASC
        LIMIT ? OFFSET ?
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM events e
        WHERE e.name LIKE ? OR e.venue LIKE ? OR e.custom_location LIKE ?
      `;
      const searchParam = `%${searchQuery}%`;
      params = [searchParam, searchParam, searchParam, limit, offset];
      countParams = [searchParam, searchParam, searchParam];
    } else {
      sql = "SELECT * FROM events WHERE name LIKE ? OR venue LIKE ? ORDER BY event_date ASC LIMIT ? OFFSET ?";
      countSql = "SELECT COUNT(*) as total FROM events WHERE name LIKE ? OR venue LIKE ?";
      const searchParam = `%${searchQuery}%`;
      params = [searchParam, searchParam, limit, offset];
      countParams = [searchParam, searchParam];
    }

    // Get total count of matching events
    const [countResult] = await db.execute(countSql, countParams);
    const totalCount = countResult[0].total;

    // Get paginated events - use template literals for LIMIT and OFFSET to avoid MySQL prepared statement issues
    if (sql.includes('LIMIT ? OFFSET ?')) {
      sql = sql.replace('LIMIT ? OFFSET ?', `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`);
      params = params.slice(0, -2); // Remove limit and offset from params
    }
    const [events] = await db.execute(sql, params);

    // Process events to set the correct location
    const processedEvents = events.map(event => {
      if (hasCustomLocationColumn) {
        // If venue_id is not null, use venue_location, otherwise use custom_location
        if (event.venue_id && event.venue_location) {
          event.display_location = event.venue_location;
        } else if (event.custom_location) {
          event.display_location = event.custom_location;
        } else {
          event.display_location = event.venue; // Fallback to venue field
        }
      } else {
        event.display_location = event.venue; // Fallback to venue field
      }

      // Make sure interested_count is included
      if (event.interested_count === undefined) {
        event.interested_count = 0;
      }

      return event;
    });

    res.status(200).json({
      success: true,
      events: processedEvents,
      totalCount: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error("Error fetching events:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: error.message
    });
  }
};

// Create a new event
exports.createEvent = async (req, res) => {
  try {
    console.log('Received event creation request with body:', JSON.stringify(req.body, null, 2));
    const { name, description, event_date, venue_id, venue, latitude, longitude, image, images, price, starting_time } = req.body;

    console.log('Extracted images value:', images);
    console.log('Images type:', typeof images);

    // Validate required fields
    if (!name || !description || !event_date) {
      return res.status(400).json({
        success: false,
        message: "Name, description, and date are required"
      });
    }

    // Check if we have either venue_id or custom location (venue + coordinates)
    if (!venue_id && (!venue || !latitude || !longitude)) {
      return res.status(400).json({
        success: false,
        message: "Either venue_id or custom location (venue name + coordinates) is required"
      });
    }

    // Check if the events table has a name column
    let hasNameColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM events LIKE 'name'");
      hasNameColumn = columns.length > 0;
      // Events table has name column check
    } catch (error) {
      console.error('Error checking for name column:', error.message);
    }

    // Check if the events table has a custom_location column
    let hasCustomLocationColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM events LIKE 'custom_location'");
      hasCustomLocationColumn = columns.length > 0;
      // Events table has custom_location column check
    } catch (error) {
      console.error('Error checking for custom_location column:', error.message);
    }

    // Check if the events table has an images column
    let hasImagesColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM events LIKE 'images'");
      hasImagesColumn = columns.length > 0;
      console.log('Events table has images column:', hasImagesColumn);
    } catch (error) {
      console.error('Error checking for images column:', error.message);
    }

    let sql;
    let params;

    // Handle two cases: venue_id provided or custom location provided
    if (venue_id) {
      // Case 1: Using an existing venue
      // Check if venue exists
      const [venueRows] = await db.execute("SELECT * FROM venues WHERE id = ?", [venue_id]);
      if (venueRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Venue not found"
        });
      }

      // Get venue name and location for the event
      const venueName = venueRows[0].name;
      const venueLocation = venueRows[0].location || null;
      // Found venue for event

      // Use venue's coordinates
      const venueLatitude = venueRows[0].latitude || null;
      const venueLongitude = venueRows[0].longitude || null;

      if (hasNameColumn) {
        if (hasCustomLocationColumn) {
          if (hasImagesColumn) {
            sql = `INSERT INTO events
              (name, venue, venue_id, description, event_date, starting_time, price, image, images, latitude, longitude, custom_location)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venueName,      // Use the venue name for the 'venue' field
              venue_id,       // Store the venue ID reference
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              images || null, // Store all images as JSON string
              venueLatitude,
              venueLongitude,
              venueLocation   // Use venue's location as the location for the event
            ];
          } else {
            sql = `INSERT INTO events
              (name, venue, venue_id, description, event_date, starting_time, price, image, latitude, longitude, custom_location)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venueName,      // Use the venue name for the 'venue' field
              venue_id,       // Store the venue ID reference
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              venueLatitude,
              venueLongitude,
              venueLocation   // Use venue's location as the location for the event
            ];
          }
        } else {
          if (hasImagesColumn) {
            sql = `INSERT INTO events
              (name, venue, venue_id, description, event_date, starting_time, price, image, images, latitude, longitude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venueName,      // Use the venue name for the 'venue' field
              venue_id,       // Store the venue ID reference
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              images || null, // Store all images as JSON string
              venueLatitude,
              venueLongitude
            ];
          } else {
            sql = `INSERT INTO events
              (name, venue, venue_id, description, event_date, starting_time, price, image, latitude, longitude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venueName,      // Use the venue name for the 'venue' field
              venue_id,       // Store the venue ID reference
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              venueLatitude,
              venueLongitude
            ];
          }
        }
      } else {
        // Fallback if name column doesn't exist
        if (hasCustomLocationColumn) {
          sql = `INSERT INTO events
            (venue, venue_id, description, event_date, starting_time, price, image, latitude, longitude, custom_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          params = [
            venueName,      // Use the venue name for the 'venue' field
            venue_id,       // Store the venue ID reference
            description,
            event_date,
            starting_time || null,
            price || null,
            image || null,
            venueLatitude,
            venueLongitude,
            venueLocation   // Use venue's location as the location for the event
          ];
        } else {
          sql = `INSERT INTO events
            (venue, venue_id, description, event_date, starting_time, price, image, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          params = [
            venueName,      // Use the venue name for the 'venue' field
            venue_id,       // Store the venue ID reference
            description,
            event_date,
            starting_time || null,
            price || null,
            image || null,
            venueLatitude,
            venueLongitude
          ];
        }
      }
    } else {
      // Case 2: Using a custom location
      // Using custom location for event

      if (hasNameColumn) {
        if (hasCustomLocationColumn) {
          if (hasImagesColumn) {
            sql = `INSERT INTO events
              (name, venue, description, event_date, starting_time, price, image, images, latitude, longitude, custom_location)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venue,          // Custom location name for the 'venue' field
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              images || null, // Store all images as JSON string
              latitude,
              longitude,
              venue           // Store the custom location name in custom_location field
            ];
          } else {
            sql = `INSERT INTO events
              (name, venue, description, event_date, starting_time, price, image, latitude, longitude, custom_location)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venue,          // Custom location name for the 'venue' field
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              latitude,
              longitude,
              venue           // Store the custom location name in custom_location field
            ];
          }
        } else {
          if (hasImagesColumn) {
            sql = `INSERT INTO events
              (name, venue, description, event_date, starting_time, price, image, images, latitude, longitude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venue,          // Custom location name
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              images || null, // Store all images as JSON string
              latitude,
              longitude
            ];
          } else {
            sql = `INSERT INTO events
              (name, venue, description, event_date, starting_time, price, image, latitude, longitude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            params = [
              name,           // Event name
              venue,          // Custom location name
              description,
              event_date,
              starting_time || null,
              price || null,
              image || null,
              latitude,
              longitude
            ];
          }
        }
      } else {
        // Fallback if name column doesn't exist
        if (hasCustomLocationColumn) {
          sql = `INSERT INTO events
            (venue, description, event_date, starting_time, price, image, latitude, longitude, custom_location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          params = [
            venue,          // Custom location name
            description,
            event_date,
            starting_time || null,
            price || null,
            image || null,
            latitude,
            longitude,
            venue           // Store the custom location name in custom_location field
          ];
        } else {
          sql = `INSERT INTO events
            (venue, description, event_date, starting_time, price, image, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

          params = [
            venue,          // Custom location name
            description,
            event_date,
            starting_time || null,
            price || null,
            image || null,
            latitude,
            longitude
          ];
        }
      }
    }

    // Executing SQL for event creation
    // Event creation parameters prepared
    console.log('Creating event with SQL:', sql);
    console.log('Event parameters:', params);

    const [result] = await db.execute(sql, params);

    // Get the newly created event
    const eventId = result.insertId;
    const [events] = await db.execute("SELECT * FROM events WHERE id = ?", [eventId]);

    // Send notification about the new event (asynchronously)
    notificationService.sendNewEventNotification(eventId)
      .then(notificationResult => {
        if (notificationResult) {
          console.log(`New event notification sent successfully for event ${eventId}`);
        } else {
          console.log(`Failed to send new event notification for event ${eventId}`);
        }
      })
      .catch(err => {
        console.error(`Error sending new event notification for event ${eventId}:`, err);
      });

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      event: events[0]
    });
  } catch (error) {
    console.error("Error creating event:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: error.message
    });
  }
};

// Get event by ID
exports.getEventById = async (req, res) => {
  try {
    const eventId = req.params.id;

    // Check if the events table has a custom_location column
    let hasCustomLocationColumn = false;
    try {
      const [columns] = await db.execute("SHOW COLUMNS FROM events LIKE 'custom_location'");
      hasCustomLocationColumn = columns.length > 0;
      // Events table has custom_location column check
    } catch (error) {
      console.error('Error checking for custom_location column:', error.message);
    }

    let sql;
    if (hasCustomLocationColumn) {
      // Use LEFT JOIN to get venue location when venue_id is not null
      sql = `
        SELECT e.*, v.location as venue_location
        FROM events e
        LEFT JOIN venues v ON e.venue_id = v.id
        WHERE e.id = ?
      `;
    } else {
      sql = "SELECT * FROM events WHERE id = ?";
    }

    // Make sure interested_count is included in the response
    // If the column doesn't exist yet, we'll add it to the query result later

    const [events] = await db.execute(sql, [eventId]);

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const event = events[0];

    // Set the display_location field
    if (hasCustomLocationColumn) {
      // If venue_id is not null, use venue_location, otherwise use custom_location
      if (event.venue_id && event.venue_location) {
        event.display_location = event.venue_location;
      } else if (event.custom_location) {
        event.display_location = event.custom_location;
      } else {
        event.display_location = event.venue; // Fallback to venue field
      }
    } else {
      event.display_location = event.venue; // Fallback to venue field
    }

    // Make sure interested_count is included
    if (event.interested_count === undefined) {
      event.interested_count = 0;
    }

    res.status(200).json({
      success: true,
      event: event
    });
  } catch (error) {
    console.error("Error fetching event details:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch event details",
      error: error.message
    });
  }
};

// Toggle event interest
exports.toggleEventInterest = async (req, res) => {
  try {
    const { event_id, user_id } = req.body;

    // Validate required fields
    if (!event_id || !user_id) {
      return res.status(400).json({
        success: false,
        message: "Event ID and User ID are required"
      });
    }

    // Check if the event exists
    const [eventRows] = await db.execute("SELECT * FROM events WHERE id = ?", [event_id]);
    if (eventRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
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

    // Check if the user is already interested in this event
    const [interestRows] = await db.execute(
      "SELECT * FROM event_interests WHERE event_id = ? AND user_id = ?",
      [event_id, user_id]
    );

    let isInterested = false;

    if (interestRows.length > 0) {
      // User is already interested, so remove the interest
      await db.execute(
        "DELETE FROM event_interests WHERE event_id = ? AND user_id = ?",
        [event_id, user_id]
      );

      // Decrease the interested_count in the events table
      await db.execute(
        "UPDATE events SET interested_count = GREATEST(interested_count - 1, 0) WHERE id = ?",
        [event_id]
      );
    } else {
      // User is not interested yet, so add the interest
      await db.execute(
        "INSERT INTO event_interests (event_id, user_id) VALUES (?, ?)",
        [event_id, user_id]
      );

      // Increase the interested_count in the events table
      await db.execute(
        "UPDATE events SET interested_count = interested_count + 1 WHERE id = ?",
        [event_id]
      );

      isInterested = true;
    }

    // Get the updated interested count
    const [updatedEventRows] = await db.execute(
      "SELECT interested_count FROM events WHERE id = ?",
      [event_id]
    );
    const interestedCount = updatedEventRows[0].interested_count;

    res.status(200).json({
      success: true,
      message: isInterested ? "Interest added successfully" : "Interest removed successfully",
      interested: isInterested,
      interested_count: interestedCount
    });
  } catch (error) {
    console.error("Error toggling event interest:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to toggle event interest",
      error: error.message
    });
  }
};

// Get event interest status
exports.getEventInterestStatus = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.query.user_id;

    // Validate required fields
    if (!eventId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Event ID and User ID are required"
      });
    }

    // Check if the event exists
    const [eventRows] = await db.execute("SELECT * FROM events WHERE id = ?", [eventId]);
    if (eventRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
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

    // Check if the user is interested in this event
    const [interestRows] = await db.execute(
      "SELECT * FROM event_interests WHERE event_id = ? AND user_id = ?",
      [eventId, userId]
    );

    const isInterested = interestRows.length > 0;

    // Get the total interested count
    const [eventData] = await db.execute(
      "SELECT interested_count FROM events WHERE id = ?",
      [eventId]
    );
    const interestedCount = eventData[0].interested_count;

    res.status(200).json({
      success: true,
      interested: isInterested,
      interested_count: interestedCount
    });
  } catch (error) {
    console.error("Error getting event interest status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get event interest status",
      error: error.message
    });
  }
};