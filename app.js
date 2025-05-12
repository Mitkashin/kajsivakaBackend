const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/authRoutes");
const venueRoutes = require("./routes/venueRoutes");
const eventRoutes = require("./routes/eventRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const bookmarkRoutes = require("./routes/bookmarkRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const friendRoutes = require("./routes/friendRoutes");
const chatRoutes = require("./routes/chatRoutes");
const sharingRoutes = require("./routes/sharingRoutes");
const groupChatRoutes = require("./routes/groupChatRoutes");
const fcmRoutes = require("./routes/fcmRoutes");

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Root endpoint for basic connectivity testing
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "KajSiVaka API server is running",
    timestamp: new Date().toISOString(),
    endpoints: ["/api/auth", "/api/venues", "/api/events", "/api/ratings", "/api/bookmarks", "/api/bookings", "/api/friends", "/api/chat", "/api/sharing", "/api/groups"]
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/sharing", sharingRoutes);
app.use("/api/groups", groupChatRoutes);
app.use("/api/users", fcmRoutes);

module.exports = app;
