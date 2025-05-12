-- Add images column to events table
ALTER TABLE events ADD COLUMN images TEXT AFTER image;
