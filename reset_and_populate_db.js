/**
 * Database Reset and Population Script
 *
 * This script will:
 * 1. Drop all existing tables
 * 2. Create new tables with the correct schema
 * 3. Insert sample data (20 premium venues, 20 normal venues, 20 events)
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('./config/config');

async function resetAndPopulateDatabase() {
  console.log('Starting database reset and population...');

  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      multipleStatements: true // Enable multiple statements for batch operations
    });

    console.log('Connected to database successfully');

    // Drop existing tables if they exist
    console.log('Dropping existing tables...');
    await connection.query(`
      DROP TABLE IF EXISTS chat_group_message_reads;
      DROP TABLE IF EXISTS chat_group_messages;
      DROP TABLE IF EXISTS chat_group_members;
      DROP TABLE IF EXISTS chat_groups;
      DROP TABLE IF EXISTS shared_items;
      DROP TABLE IF EXISTS chat_messages;
      DROP TABLE IF EXISTS friend_requests;
      DROP TABLE IF EXISTS friends;
      DROP TABLE IF EXISTS venue_bookmarks;
      DROP TABLE IF EXISTS venue_bookings;
      DROP TABLE IF EXISTS event_interests;
      DROP TABLE IF EXISTS ratings;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS venues;
      DROP TABLE IF EXISTS users;
    `);
    console.log('Existing tables dropped successfully');

    // Create tables
    console.log('Creating new tables...');

    // Create users table
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone VARCHAR(20),
        is_business BOOLEAN DEFAULT 0,
        avatar VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created successfully');

    // Create venues table
    await connection.query(`
      CREATE TABLE venues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        location VARCHAR(255),
        description TEXT,
        rating DECIMAL(3,1) DEFAULT 0,
        rating_count INT DEFAULT 0,
        rating_total DECIMAL(10,1) DEFAULT 0,
        price_range VARCHAR(10),
        features TEXT,
        opening_hours VARCHAR(255),
        image VARCHAR(255),
        images TEXT,
        premium BOOLEAN DEFAULT 0,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('Venues table created successfully');

    // Create events table
    await connection.query(`
      CREATE TABLE events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        venue VARCHAR(255),
        venue_id INT,
        description TEXT,
        event_date DATETIME,
        starting_time TIME,
        price VARCHAR(50),
        custom_location VARCHAR(255),
        image VARCHAR(255),
        images TEXT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        interested_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
      )
    `);
    console.log('Events table created successfully');

    // Create ratings table
    await connection.query(`
      CREATE TABLE ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        venue_id INT NOT NULL,
        user_id INT,
        rating DECIMAL(3,1) NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_venue (user_id, venue_id)
      )
    `);
    console.log('Ratings table created successfully');

    // Create event_interests table
    await connection.query(`
      CREATE TABLE event_interests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_event_user (event_id, user_id),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Event interests table created successfully');

    // Create venue_bookmarks table
    await connection.query(`
      CREATE TABLE venue_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        venue_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_venue_user (venue_id, user_id),
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Venue bookmarks table created successfully');

    // Create venue_bookings table
    await connection.query(`
      CREATE TABLE venue_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        venue_id INT NOT NULL,
        user_id INT NOT NULL,
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        guest_count INT NOT NULL DEFAULT 1,
        note TEXT,
        status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Venue bookings table created successfully');

    // Create friends table
    await connection.query(`
      CREATE TABLE friends (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_friendship (user_id, friend_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Friends table created successfully');

    // Create friend_requests table
    await connection.query(`
      CREATE TABLE friend_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_request (sender_id, receiver_id),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Friend requests table created successfully');

    // Create chat_messages table
    await connection.query(`
      CREATE TABLE chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Chat messages table created successfully');

    // Create shared_items table
    await connection.query(`
      CREATE TABLE shared_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        item_type ENUM('venue', 'event') NOT NULL,
        item_id INT NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Shared items table created successfully');

    // Create group chat tables
    console.log('Creating group chat tables...');

    // Create chat_groups table
    await connection.query(`
      CREATE TABLE chat_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar VARCHAR(255),
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('chat_groups table created successfully');

    // Create chat_group_members table
    await connection.query(`
      CREATE TABLE chat_group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_group_member (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('chat_group_members table created successfully');

    // Create chat_group_messages table
    await connection.query(`
      CREATE TABLE chat_group_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        sender_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('chat_group_messages table created successfully');

    // Create chat_group_message_reads table to track read status for each user
    await connection.query(`
      CREATE TABLE chat_group_message_reads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_message_user (message_id, user_id),
        FOREIGN KEY (message_id) REFERENCES chat_group_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('chat_group_message_reads table created successfully');
    console.log('All group chat tables created successfully');

    // Insert sample users
    console.log('Inserting sample users...');

    // Hash passwords
    const regularPassword = await bcrypt.hash('password123', 10);
    const businessPassword = await bcrypt.hash('business123', 10);

    await connection.query(`
      INSERT INTO users (username, email, password, full_name, phone, is_business) VALUES
      ('regular_user', 'user@example.com', ?, 'Regular User', '123-456-7890', 0),
      ('business_user', 'business@example.com', ?, 'Business User', '987-654-3210', 1)
    `, [regularPassword, businessPassword]);

    // Get the inserted user IDs
    const [users] = await connection.query('SELECT id, is_business FROM users');
    const regularUserId = users.find(user => user.is_business === 0).id;
    const businessUserId = users.find(user => user.is_business === 1).id;

    console.log(`Sample users inserted successfully. Regular user ID: ${regularUserId}, Business user ID: ${businessUserId}`);

    // Insert premium venues
    console.log('Inserting premium venues...');

    const premiumVenues = [
      {
        name: 'Luxury Lounge',
        type: 'bar',
        location: 'Downtown, 123 Main Street',
        description: 'An upscale lounge with premium cocktails and a sophisticated atmosphere',
        price_range: '$$$',
        features: 'Live music, VIP sections, Craft cocktails',
        opening_hours: '5 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0060,
        longitude: 21.4100
      },
      {
        name: 'Gourmet Garden',
        type: 'restaurant',
        location: 'City Center, 45 Park Avenue',
        description: 'Fine dining restaurant with a focus on local, organic ingredients',
        price_range: '$$$$',
        features: 'Outdoor seating, Wine pairing, Tasting menu',
        opening_hours: '12 PM - 11 PM',
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0055,
        longitude: 21.4080
      },
      {
        name: 'Elite Nightclub',
        type: 'club',
        location: 'Entertainment District, 78 Club Street',
        description: 'Exclusive nightclub with world-class DJs and premium bottle service',
        price_range: '$$$$',
        features: 'VIP tables, International DJs, Premium sound system',
        opening_hours: '10 PM - 5 AM',
        image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0070,
        longitude: 21.4110
      },
      {
        name: 'Artisan Café',
        type: 'cafe',
        location: 'Arts District, 15 Gallery Road',
        description: 'Specialty coffee shop featuring local art and homemade pastries',
        price_range: '$$',
        features: 'Art exhibitions, Specialty coffee, Homemade desserts',
        opening_hours: '7 AM - 8 PM',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0045,
        longitude: 21.4070
      },
      {
        name: 'Skyline Rooftop Bar',
        type: 'bar',
        location: 'Financial District, 100 Tower Street',
        description: 'Rooftop bar with panoramic city views and signature cocktails',
        price_range: '$$$',
        features: 'Panoramic views, Signature cocktails, Tapas menu',
        opening_hours: '4 PM - 1 AM',
        image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0080,
        longitude: 21.4120
      },
      {
        name: 'Fusion Bistro',
        type: 'restaurant',
        location: 'Cultural Quarter, 55 Fusion Street',
        description: 'Innovative restaurant blending Asian and Mediterranean cuisines',
        price_range: '$$$',
        features: 'Chef\'s table, Open kitchen, Seasonal menu',
        opening_hours: '11 AM - 10 PM',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0050,
        longitude: 21.4090
      },
      {
        name: 'Velvet Lounge',
        type: 'club',
        location: 'Nightlife District, 30 Velvet Avenue',
        description: 'Upscale nightclub with multiple dance floors and themed rooms',
        price_range: '$$$',
        features: 'Multiple dance floors, Celebrity guests, Premium spirits',
        opening_hours: '11 PM - 6 AM',
        image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0065,
        longitude: 21.4105
      },
      {
        name: 'Organic Harvest',
        type: 'cafe',
        location: 'Green District, 25 Organic Lane',
        description: 'Farm-to-table café with organic ingredients and sustainable practices',
        price_range: '$$',
        features: 'Organic produce, Vegan options, Zero waste',
        opening_hours: '8 AM - 6 PM',
        image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0040,
        longitude: 21.4060
      },
      {
        name: 'Whiskey & Cigar Lounge',
        type: 'bar',
        location: 'Old Town, 10 Heritage Street',
        description: 'Classic lounge specializing in rare whiskeys and premium cigars',
        price_range: '$$$$',
        features: 'Rare whiskeys, Premium cigars, Private rooms',
        opening_hours: '6 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0075,
        longitude: 21.4115
      },
      {
        name: 'Michelin Star',
        type: 'restaurant',
        location: 'Gourmet District, 5 Star Avenue',
        description: 'Award-winning restaurant with innovative molecular gastronomy',
        price_range: '$$$$',
        features: 'Tasting menu, Wine cellar, Celebrity chef',
        opening_hours: '6 PM - 11 PM',
        image: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0085,
        longitude: 21.4125
      },
      {
        name: 'Platinum Lounge',
        type: 'bar',
        location: 'Luxury District, 8 Diamond Street',
        description: 'Ultra-exclusive lounge with private booths and top-shelf spirits',
        price_range: '$$$$',
        features: 'Private booths, Celebrity guests, Bottle service',
        opening_hours: '8 PM - 4 AM',
        image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0090,
        longitude: 21.4130
      },
      {
        name: 'Sushi Deluxe',
        type: 'restaurant',
        location: 'Waterfront, 12 Ocean Drive',
        description: 'Premium sushi restaurant with fresh fish flown in daily from Japan',
        price_range: '$$$$',
        features: 'Omakase menu, Sake pairings, Ocean view',
        opening_hours: '5 PM - 11 PM',
        image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0095,
        longitude: 21.4135
      },
      {
        name: 'Vineyard Estate',
        type: 'bar',
        location: 'Wine Country, 25 Grape Road',
        description: 'Upscale wine bar featuring rare vintages and sommelier-guided tastings',
        price_range: '$$$',
        features: 'Wine cellar tours, Cheese pairings, Vineyard views',
        opening_hours: '3 PM - 12 AM',
        image: 'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0100,
        longitude: 21.4140
      },
      {
        name: 'Skyview Restaurant',
        type: 'restaurant',
        location: 'City Center, 100 Tower Building, 30th Floor',
        description: 'Fine dining with panoramic city views from the 30th floor',
        price_range: '$$$$',
        features: '360-degree views, Seasonal menu, Celebrity chef',
        opening_hours: '5 PM - 12 AM',
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0105,
        longitude: 21.4145
      },
      {
        name: 'Exclusive Speakeasy',
        type: 'bar',
        location: 'Historic District, Hidden entrance on 15 Vintage Street',
        description: 'Secret speakeasy with password entry and prohibition-era cocktails',
        price_range: '$$$',
        features: 'Hidden entrance, Vintage cocktails, Live jazz',
        opening_hours: '7 PM - 3 AM',
        image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0110,
        longitude: 21.4150
      },
      {
        name: 'Luxury Spa Retreat',
        type: 'spa',
        location: 'Wellness District, 20 Relaxation Avenue',
        description: 'Premium spa offering exclusive treatments and relaxation experiences',
        price_range: '$$$$',
        features: 'Private suites, Thermal pools, Signature treatments',
        opening_hours: '9 AM - 9 PM',
        image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0115,
        longitude: 21.4155
      },
      {
        name: 'Gourmet Steakhouse',
        type: 'restaurant',
        location: 'Financial District, 45 Prime Street',
        description: 'Upscale steakhouse serving premium aged beef and fine wines',
        price_range: '$$$$',
        features: 'Dry-aged steaks, Private dining, Sommelier service',
        opening_hours: '5 PM - 11 PM',
        image: 'https://images.unsplash.com/photo-1514516345957-556ca7c90a34?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0120,
        longitude: 21.4160
      },
      {
        name: 'Champagne & Caviar',
        type: 'bar',
        location: 'Luxury Row, 10 Opulence Street',
        description: 'Exclusive champagne bar with caviar service and luxury small plates',
        price_range: '$$$$',
        features: 'Rare champagnes, Caviar service, Oyster bar',
        opening_hours: '4 PM - 1 AM',
        image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0125,
        longitude: 21.4165
      },
      {
        name: 'Cigar Lounge',
        type: 'bar',
        location: 'Business District, 30 Leather Avenue',
        description: 'Sophisticated cigar lounge with premium spirits and private membership options',
        price_range: '$$$',
        features: 'Walk-in humidor, Leather armchairs, Whiskey selection',
        opening_hours: '2 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1511497584788-876760111969?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0130,
        longitude: 21.4170
      },
      {
        name: 'Rooftop Infinity Pool',
        type: 'bar',
        location: 'Skyline District, 100 View Terrace, Penthouse',
        description: 'Exclusive rooftop venue with infinity pool, cocktail service, and panoramic views',
        price_range: '$$$$',
        features: 'Infinity pool, Cabanas, Sunset cocktails',
        opening_hours: '11 AM - 11 PM',
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 1,
        latitude: 42.0135,
        longitude: 21.4175
      }
    ];

    for (const venue of premiumVenues) {
      await connection.query(`
        INSERT INTO venues (name, type, location, description, price_range, features, opening_hours, image, premium, latitude, longitude, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        venue.name, venue.type, venue.location, venue.description, venue.price_range,
        venue.features, venue.opening_hours, venue.image, venue.premium,
        venue.latitude, venue.longitude, businessUserId
      ]);
    }

    console.log('Premium venues inserted successfully');

    // Insert regular venues
    console.log('Inserting regular venues...');

    const regularVenues = [
      {
        name: 'Neighborhood Pub',
        type: 'bar',
        location: 'Residential Area, 50 Local Street',
        description: 'Friendly neighborhood pub with a great selection of beers and casual atmosphere',
        price_range: '$$',
        features: 'Sports TV, Pub quiz, Craft beers',
        opening_hours: '12 PM - 12 AM',
        image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0030,
        longitude: 21.4050
      },
      {
        name: 'Family Diner',
        type: 'restaurant',
        location: 'Suburbs, 20 Family Road',
        description: 'Classic diner serving homestyle meals for the whole family',
        price_range: '$$',
        features: 'Kids menu, All-day breakfast, Comfort food',
        opening_hours: '7 AM - 9 PM',
        image: 'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0025,
        longitude: 21.4045
      },
      {
        name: 'Student Bar',
        type: 'bar',
        location: 'University District, 15 Campus Road',
        description: 'Popular bar with student-friendly prices and lively atmosphere',
        price_range: '$',
        features: 'Happy hour, Student discounts, Pool tables',
        opening_hours: '4 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0020,
        longitude: 21.4040
      },
      {
        name: 'Corner Café',
        type: 'cafe',
        location: 'Shopping District, 5 Corner Street',
        description: 'Cozy café perfect for a quick coffee or light lunch',
        price_range: '$',
        features: 'Free WiFi, Pastries, Sandwiches',
        opening_hours: '6 AM - 7 PM',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0015,
        longitude: 21.4035
      },
      {
        name: 'Local Pizzeria',
        type: 'restaurant',
        location: 'Main Street, 30 Pizza Lane',
        description: 'Family-owned pizzeria serving authentic Italian recipes',
        price_range: '$$',
        features: 'Wood-fired oven, Delivery, Family recipes',
        opening_hours: '11 AM - 10 PM',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0010,
        longitude: 21.4030
      },
      {
        name: 'Dance Club',
        type: 'club',
        location: 'Downtown, 25 Dance Street',
        description: 'Energetic dance club with popular music and affordable drinks',
        price_range: '$$',
        features: 'Dance floor, DJ nights, Theme parties',
        opening_hours: '10 PM - 4 AM',
        image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0005,
        longitude: 21.4025
      },
      {
        name: 'Breakfast Spot',
        type: 'cafe',
        location: 'Residential Area, 10 Morning Avenue',
        description: 'Popular breakfast and brunch spot with homemade specialties',
        price_range: '$$',
        features: 'Breakfast all day, Fresh juices, Homemade bread',
        opening_hours: '6 AM - 3 PM',
        image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 42.0000,
        longitude: 21.4020
      },
      {
        name: 'Sports Bar',
        type: 'bar',
        location: 'Stadium District, 5 Sports Road',
        description: 'The perfect place to watch the game with friends and enjoy good food',
        price_range: '$$',
        features: 'Multiple TVs, Game day specials, Wings',
        opening_hours: '12 PM - 1 AM',
        image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9995,
        longitude: 21.4015
      },
      {
        name: 'Taco Joint',
        type: 'restaurant',
        location: 'Food District, 15 Taco Street',
        description: 'Casual Mexican eatery with authentic tacos and margaritas',
        price_range: '$',
        features: 'Authentic recipes, Salsa bar, Margaritas',
        opening_hours: '11 AM - 10 PM',
        image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9990,
        longitude: 21.4010
      },
      {
        name: 'Karaoke Bar',
        type: 'bar',
        location: 'Entertainment District, 20 Sing Street',
        description: 'Fun karaoke bar with private rooms and a lively atmosphere',
        price_range: '$$',
        features: 'Private rooms, Extensive song list, Drink specials',
        opening_hours: '7 PM - 3 AM',
        image: 'https://images.unsplash.com/photo-1559070169-a3077159ee16?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9985,
        longitude: 21.4005
      },
      {
        name: 'Burger Joint',
        type: 'restaurant',
        location: 'Food Court, 25 Burger Avenue',
        description: 'Casual burger restaurant with handcrafted patties and local ingredients',
        price_range: '$$',
        features: 'Craft burgers, Local beef, Vegetarian options',
        opening_hours: '11 AM - 10 PM',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9980,
        longitude: 21.4000
      },
      {
        name: 'Coffee House',
        type: 'cafe',
        location: 'Book District, 10 Reader Street',
        description: 'Cozy coffee shop with book exchange and comfortable seating',
        price_range: '$',
        features: 'Book exchange, Specialty coffee, Homemade pastries',
        opening_hours: '7 AM - 8 PM',
        image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9975,
        longitude: 21.3995
      },
      {
        name: 'Craft Beer Pub',
        type: 'bar',
        location: 'Brewery District, 30 Hops Street',
        description: 'Neighborhood pub specializing in local craft beers and pub food',
        price_range: '$$',
        features: 'Craft beer selection, Beer flights, Pub food',
        opening_hours: '3 PM - 1 AM',
        image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9970,
        longitude: 21.3990
      },
      {
        name: 'Noodle House',
        type: 'restaurant',
        location: 'Asian Quarter, 15 Noodle Street',
        description: 'Authentic Asian noodle shop with handmade noodles and broths',
        price_range: '$',
        features: 'Handmade noodles, Authentic recipes, Quick service',
        opening_hours: '11 AM - 9 PM',
        image: 'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9965,
        longitude: 21.3985
      },
      {
        name: 'Student Cafe',
        type: 'cafe',
        location: 'University Area, 5 Campus Drive',
        description: 'Budget-friendly cafe with study spaces and free WiFi',
        price_range: '$',
        features: 'Study spaces, Free WiFi, Student discounts',
        opening_hours: '7 AM - 11 PM',
        image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9960,
        longitude: 21.3980
      },
      {
        name: 'Retro Arcade Bar',
        type: 'bar',
        location: 'Entertainment District, 40 Pixel Street',
        description: 'Nostalgic bar featuring classic arcade games and themed cocktails',
        price_range: '$$',
        features: 'Vintage arcade games, Pinball machines, Gaming tournaments',
        opening_hours: '4 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1511882150382-421056c89033?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9955,
        longitude: 21.3975
      },
      {
        name: 'Vegan Bistro',
        type: 'restaurant',
        location: 'Green District, 15 Plant Street',
        description: 'Plant-based restaurant with creative vegan dishes and organic ingredients',
        price_range: '$$',
        features: 'Organic ingredients, Gluten-free options, Sustainable practices',
        opening_hours: '11 AM - 9 PM',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9950,
        longitude: 21.3970
      },
      {
        name: 'Board Game Cafe',
        type: 'cafe',
        location: 'Community District, 25 Game Street',
        description: 'Friendly cafe with hundreds of board games and casual food',
        price_range: '$',
        features: 'Board game library, Game nights, Casual menu',
        opening_hours: '10 AM - 12 AM',
        image: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9945,
        longitude: 21.3965
      },
      {
        name: 'Ice Cream Parlor',
        type: 'cafe',
        location: 'Shopping District, 10 Sweet Street',
        description: 'Artisanal ice cream shop with homemade flavors and toppings',
        price_range: '$',
        features: 'Homemade ice cream, Seasonal flavors, Vegan options',
        opening_hours: '12 PM - 10 PM',
        image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9940,
        longitude: 21.3960
      },
      {
        name: 'Live Music Venue',
        type: 'club',
        location: 'Arts District, 30 Music Avenue',
        description: 'Intimate venue showcasing local bands and musicians',
        price_range: '$$',
        features: 'Live performances, Local talent, Intimate setting',
        opening_hours: '7 PM - 2 AM',
        image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        premium: 0,
        latitude: 41.9935,
        longitude: 21.3955
      }
    ];

    for (const venue of regularVenues) {
      await connection.query(`
        INSERT INTO venues (name, type, location, description, price_range, features, opening_hours, image, premium, latitude, longitude, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        venue.name, venue.type, venue.location, venue.description, venue.price_range,
        venue.features, venue.opening_hours, venue.image, venue.premium,
        venue.latitude, venue.longitude, businessUserId
      ]);
    }

    console.log('Regular venues inserted successfully');

    // Get all venues for creating events
    const [venues] = await connection.query('SELECT id, name, latitude, longitude FROM venues');

    // Insert events
    console.log('Inserting events...');

    // Create dates for events (starting from tomorrow, one event every 3 days)
    const eventDates = [];
    const today = new Date();
    for (let i = 0; i < 20; i++) {
      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + 1 + (i * 3)); // Start from tomorrow, then every 3 days
      eventDates.push(eventDate.toISOString().slice(0, 19).replace('T', ' '));
    }

    const events = [
      {
        name: 'Live Jazz Night',
        description: 'Enjoy an evening of live jazz music with local and guest musicians',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 0, // Will be replaced with actual venue
        price: '$20 - $50',
        startingTime: '19:30:00'
      },
      {
        name: 'Wine Tasting Experience',
        description: 'Sample a selection of fine wines paired with gourmet appetizers',
        image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 1,
        price: '$35',
        startingTime: '18:00:00'
      },
      {
        name: 'DJ Weekend Party',
        description: 'Dance the night away with our resident DJ playing the latest hits',
        image: 'https://images.unsplash.com/photo-1571266028243-1e4b0c13fa26?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 2,
        price: '$15 - $25',
        startingTime: '22:00:00'
      },
      {
        name: 'Poetry Reading',
        description: 'Local poets share their work in an intimate setting',
        image: 'https://images.unsplash.com/photo-1526715646981-b6e93b2e9f9f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 3,
        price: 'Free',
        startingTime: '17:30:00'
      },
      {
        name: 'Cocktail Masterclass',
        description: 'Learn to make signature cocktails with our expert mixologists',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 4,
        price: '$45',
        startingTime: '19:00:00'
      },
      {
        name: 'Chef\'s Special Dinner',
        description: 'A unique five-course tasting menu prepared by our award-winning chef',
        image: 'https://images.unsplash.com/photo-1555244162-803834f70033?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 5,
        price: '$75',
        startingTime: '20:00:00'
      },
      {
        name: 'Salsa Night',
        description: 'Learn and dance salsa with professional instructors',
        image: 'https://images.unsplash.com/photo-1545128485-c400e7702796?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 6,
        price: '$10',
        startingTime: '21:00:00'
      },
      {
        name: 'Farmers Market',
        description: 'Shop for fresh, local produce and artisanal products',
        image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 7,
        price: 'Free Entry',
        startingTime: '09:00:00'
      },
      {
        name: 'Whiskey Tasting',
        description: 'Sample rare and premium whiskeys with expert guidance',
        image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 8,
        price: '$55',
        startingTime: '18:30:00'
      },
      {
        name: 'Gourmet Food Festival',
        description: 'A celebration of local cuisine with tastings from top restaurants',
        image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 9,
        price: '$25 - $40',
        startingTime: '12:00:00'
      },
      {
        name: 'Craft Beer Festival',
        description: 'Sample over 50 craft beers from local and international breweries',
        image: 'https://images.unsplash.com/photo-1575367439058-6096bb9cf5e2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 10,
        price: '$30',
        startingTime: '14:00:00'
      },
      {
        name: 'Comedy Night',
        description: 'Laugh out loud with performances from top local comedians',
        image: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 11,
        price: '$15',
        startingTime: '20:00:00'
      },
      {
        name: 'Art Exhibition Opening',
        description: 'Opening night of a new contemporary art exhibition featuring local artists',
        image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 12,
        price: 'Free',
        startingTime: '18:00:00'
      },
      {
        name: 'Trivia Night',
        description: 'Test your knowledge with friends in this fun weekly trivia competition',
        image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 13,
        price: '$5 per team',
        startingTime: '19:00:00'
      },
      {
        name: 'Live Music Showcase',
        description: 'Featuring performances from up-and-coming local bands and musicians',
        image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 14,
        price: '$10',
        startingTime: '20:30:00'
      },
      {
        name: 'Yoga in the Park',
        description: 'Morning yoga session in the park for all skill levels',
        image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 15,
        price: '$8',
        startingTime: '08:00:00'
      },
      {
        name: 'Book Club Meeting',
        description: 'Monthly book club discussing this month\'s selected novel',
        image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 16,
        price: 'Free',
        startingTime: '18:30:00'
      },
      {
        name: 'Cooking Workshop',
        description: 'Learn to cook authentic Italian pasta dishes with our chef',
        image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 17,
        price: '$40',
        startingTime: '17:00:00'
      },
      {
        name: 'Open Mic Night',
        description: 'Share your talent at our weekly open mic night',
        image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 18,
        price: 'Free',
        startingTime: '19:30:00'
      },
      {
        name: 'Film Screening',
        description: 'Special screening of award-winning independent films',
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        venueIndex: 19,
        price: '$12',
        startingTime: '20:00:00'
      }
    ];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const venue = venues[event.venueIndex];

      await connection.query(`
        INSERT INTO events (name, venue, venue_id, description, event_date, starting_time, price, custom_location, image, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        event.name,
        venue.name,
        venue.id,
        event.description,
        eventDates[i],
        event.startingTime,
        event.price,
        venue.location, // Use venue location as custom_location
        event.image,
        venue.latitude,
        venue.longitude
      ]);
    }

    console.log('Events inserted successfully');

    // Insert sample event interests
    console.log('Inserting sample event interests...');

    // Add interests to the first 5 events from the regular user
    for (let eventIndex = 0; eventIndex < 5; eventIndex++) {
      const [eventResult] = await connection.query('SELECT id FROM events LIMIT ?, 1', [eventIndex]);
      const eventId = eventResult[0].id;

      await connection.query(`
        INSERT INTO event_interests (event_id, user_id)
        VALUES (?, ?)
      `, [eventId, regularUserId]);

      // Update event interested_count
      await connection.query(`
        UPDATE events
        SET interested_count = interested_count + 1
        WHERE id = ?
      `, [eventId]);
    }

    // Add interests to events 3, 4, 5 from the business user
    for (let eventIndex = 2; eventIndex < 5; eventIndex++) {
      const [eventResult] = await connection.query('SELECT id FROM events LIMIT ?, 1', [eventIndex]);
      const eventId = eventResult[0].id;

      await connection.query(`
        INSERT INTO event_interests (event_id, user_id)
        VALUES (?, ?)
      `, [eventId, businessUserId]);

      // Update event interested_count
      await connection.query(`
        UPDATE events
        SET interested_count = interested_count + 1
        WHERE id = ?
      `, [eventId]);
    }

    console.log('Sample event interests inserted successfully');

    // Insert sample venue bookmarks
    console.log('Inserting sample venue bookmarks...');

    // Add bookmarks to the first 5 venues from the regular user
    for (let venueIndex = 0; venueIndex < 5; venueIndex++) {
      const [venueResult] = await connection.query('SELECT id FROM venues LIMIT ?, 1', [venueIndex]);
      const venueId = venueResult[0].id;

      await connection.query(`
        INSERT INTO venue_bookmarks (venue_id, user_id)
        VALUES (?, ?)
      `, [venueId, regularUserId]);
    }

    // Add bookmarks to venues 3, 4, 5 from the business user
    for (let venueIndex = 2; venueIndex < 5; venueIndex++) {
      const [venueResult] = await connection.query('SELECT id FROM venues LIMIT ?, 1', [venueIndex]);
      const venueId = venueResult[0].id;

      await connection.query(`
        INSERT INTO venue_bookmarks (venue_id, user_id)
        VALUES (?, ?)
      `, [venueId, businessUserId]);
    }

    console.log('Sample venue bookmarks inserted successfully');

    // Insert some ratings
    console.log('Inserting sample ratings...');

    // Create ratings for the first 10 venues (one rating per venue)
    for (let venueIndex = 0; venueIndex < 10; venueIndex++) {
      const venue = venues[venueIndex];

      // Generate a random rating between 3.0 and 5.0
      const rating = (3 + Math.random() * 2).toFixed(1);
      const comment = `This is a sample rating for ${venue.name}. The venue is great!`;

      // Insert rating from regular user
      await connection.query(`
        INSERT INTO ratings (venue_id, user_id, rating, comment)
        VALUES (?, ?, ?, ?)
      `, [venue.id, regularUserId, rating, comment]);

      // Update venue rating
      await connection.query(`
        UPDATE venues
        SET rating_count = 1,
            rating_total = ?,
            rating = ?
        WHERE id = ?
      `, [rating, rating, venue.id]);
    }

    console.log('Sample ratings inserted successfully');

    // Insert a sample group chat
    console.log('Creating a sample group chat...');

    // Create a group
    const [groupResult] = await connection.query(`
      INSERT INTO chat_groups (name, description, created_by)
      VALUES (?, ?, ?)
    `, ['Sample Group Chat', 'This is a sample group chat for testing', regularUserId]);

    const groupId = groupResult.insertId;
    console.log(`Created group with ID: ${groupId}`);

    // Add both users as members (regular user as admin)
    await connection.query(`
      INSERT INTO chat_group_members (group_id, user_id, is_admin)
      VALUES (?, ?, 1)
    `, [groupId, regularUserId]);
    console.log('Added regular user as admin');

    await connection.query(`
      INSERT INTO chat_group_members (group_id, user_id, is_admin)
      VALUES (?, ?, 0)
    `, [groupId, businessUserId]);
    console.log('Added business user as member');

    // Add some sample messages
    const messages = [
      { sender: regularUserId, message: 'Hello! Welcome to the group chat!' },
      { sender: businessUserId, message: 'Thanks for adding me to this group!' },
      { sender: regularUserId, message: 'Let\'s discuss the upcoming events.' },
      { sender: businessUserId, message: 'I have some great venue suggestions.' },
      { sender: regularUserId, message: 'Perfect! Please share them with us.' }
    ];

    for (const msg of messages) {
      await connection.query(`
        INSERT INTO chat_group_messages (group_id, sender_id, message)
        VALUES (?, ?, ?)
      `, [groupId, msg.sender, msg.message]);
    }
    console.log('Added sample messages to the group');

    // Mark all messages as read by both users
    const [groupMessages] = await connection.query('SELECT id FROM chat_group_messages WHERE group_id = ?', [groupId]);

    for (const message of groupMessages) {
      await connection.query(`
        INSERT INTO chat_group_message_reads (message_id, user_id)
        VALUES (?, ?)
      `, [message.id, regularUserId]);

      await connection.query(`
        INSERT INTO chat_group_message_reads (message_id, user_id)
        VALUES (?, ?)
      `, [message.id, businessUserId]);
    }
    console.log('Marked all messages as read by both users');

    console.log('Sample group chat created successfully');

    console.log('Database reset and population completed successfully!');

    // Print login credentials
    console.log('\n===== LOGIN CREDENTIALS =====');
    console.log('Regular User:');
    console.log('Email: user@example.com');
    console.log('Password: password123');
    console.log('\nBusiness User:');
    console.log('Email: business@example.com');
    console.log('Password: business123');
    console.log('============================\n');

  } catch (error) {
    console.error('Error resetting and populating database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the script
resetAndPopulateDatabase();
