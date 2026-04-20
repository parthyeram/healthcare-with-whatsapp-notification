USE railway;

DROP TABLE IF EXISTS reminder_logs;
DROP TABLE IF EXISTS medicine_reminders;
DROP TABLE IF EXISTS patient_whatsapp;
USE railway;

CREATE TABLE patient_whatsapp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL,
  whatsapp_no VARCHAR(25) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expires DATETIME,
  opted_in BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE medicine_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT NOT NULL,
  user_id INT NOT NULL,
  reminder_time TIME NOT NULL,
  days_of_week VARCHAR(20),
  message_tpl VARCHAR(50) DEFAULT 'default',
  is_active BOOLEAN DEFAULT TRUE,
  last_sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reminder_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  medicine_id INT,
  reminder_id INT,
  phone VARCHAR(25),
  message_body TEXT,
  twilio_sid VARCHAR(60),
  status ENUM('queued','sent','delivered','failed','undelivered') DEFAULT 'queued',
  error_msg TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (reminder_id) REFERENCES medicine_reminders(id)
);

CREATE INDEX idx_rem_time ON medicine_reminders(reminder_time, is_active);
CREATE INDEX idx_rem_user ON medicine_reminders(user_id);
CREATE INDEX idx_log_user ON reminder_logs(user_id, sent_at);
CREATE INDEX idx_wa_user ON patient_whatsapp(user_id);
DESCRIBE medicine_reminders;
SHOW TABLES;
