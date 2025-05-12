-- Create FCM tokens table
CREATE TABLE IF NOT EXISTS `user_fcm_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `fcm_token` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_id_UNIQUE` (`user_id` ASC),
  CONSTRAINT `fk_user_fcm_tokens_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS `idx_user_fcm_tokens_token` ON `user_fcm_tokens` (`fcm_token`);
