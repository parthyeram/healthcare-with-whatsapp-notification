-- ═══════════════════════════════════════════════════════
--  Healthcare+  ·  WhatsApp Medicine Reminders Schema
--  Run AFTER main schema.sql:
--  mysql -u root -p healthcare_plus < db/schema_reminders.sql
-- ═══════════════════════════════════════════════════════

USE healthcare_plus;

-- Patient WhatsApp numbers + OTP verification
CREATE TABLE IF NOT EXISTS patient_whatsapp (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  phone         VARCHAR(15)  NOT NULL COMMENT '+91XXXXXXXXXX format',
  whatsapp_no   VARCHAR(25)  NOT NULL COMMENT 'whatsapp:+91XXXXXXXXXX',
  is_verified   BOOLEAN      DEFAULT FALSE,
  otp_code      VARCHAR(6),
  otp_expires   DATETIME,
  opted_in      BOOLEAN      DEFAULT TRUE  COMMENT 'user consent for messages',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reminder schedules per medicine
CREATE TABLE IF NOT EXISTS medicine_reminders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id   INT NOT NULL,
  user_id       INT NOT NULL,
  reminder_time TIME NOT NULL    COMMENT 'e.g. 08:00:00',
  days_of_week  VARCHAR(20)      COMMENT 'all / 1,2,3,4,5 (Mon-Fri) / 1,7 (Mon,Sun)',
  message_tpl   VARCHAR(50)      DEFAULT 'default' COMMENT 'template name',
  is_active     BOOLEAN          DEFAULT TRUE,
  last_sent_at  DATETIME,
  created_at    TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE
);

-- Log every message sent
CREATE TABLE IF NOT EXISTS reminder_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT,
  medicine_id   INT,
  reminder_id   INT,
  phone         VARCHAR(25),
  message_body  TEXT,
  twilio_sid    VARCHAR(60) COMMENT 'Twilio message SID',
  status        ENUM('queued','sent','delivered','failed','undelivered') DEFAULT 'queued',
  error_msg     TEXT,
  sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (reminder_id) REFERENCES medicine_reminders(id)
);

-- Indexes for scheduler performance
CREATE INDEX idx_rem_time   ON medicine_reminders(reminder_time, is_active);
CREATE INDEX idx_rem_user   ON medicine_reminders(user_id);
CREATE INDEX idx_log_user   ON reminder_logs(user_id, sent_at);
CREATE INDEX idx_wa_user    ON patient_whatsapp(user_id);
