-- =====================================================
--  Healthcare+  ·  MySQL Schema + Seed Data
--  Run:  mysql -u root -p < backend/db/schema.sql
-- =====================================================

CREATE DATABASE IF NOT EXISTS healthcare_plus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthcare_plus;

-- ── Users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  phone         VARCHAR(15),
  password_hash VARCHAR(255)  NOT NULL,
  date_of_birth DATE,
  gender        ENUM('male','female','other'),
  blood_group   VARCHAR(5),
  address       TEXT,
  profile_image VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Specializations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS specializations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  keywords    TEXT COMMENT 'comma-separated keywords for AI matching',
  icon        VARCHAR(10),
  description TEXT
);

-- ── Hospitals ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospitals (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  address          TEXT,
  city             VARCHAR(100),
  phone            VARCHAR(15),
  email            VARCHAR(150),
  website          VARCHAR(200),
  rating           DECIMAL(2,1) DEFAULT 0,
  beds             INT,
  established_year INT,
  image            VARCHAR(255),
  tie_up_date      DATE,
  status           ENUM('active','inactive') DEFAULT 'active',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Doctors ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100)  NOT NULL,
  specialization_id  INT,
  hospital_id        INT,
  qualification      VARCHAR(200),
  experience_years   INT,
  consultation_fee   DECIMAL(8,2),
  phone              VARCHAR(15),
  email              VARCHAR(150),
  bio                TEXT,
  profile_image      VARCHAR(255),
  available_days     VARCHAR(100)  COMMENT 'e.g. Mon,Tue,Wed,Thu,Fri',
  available_from     TIME,
  available_to       TIME,
  rating             DECIMAL(2,1)  DEFAULT 0,
  total_reviews      INT           DEFAULT 0,
  status             ENUM('active','inactive','on_leave') DEFAULT 'active',
  created_at         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (specialization_id) REFERENCES specializations(id),
  FOREIGN KEY (hospital_id)       REFERENCES hospitals(id)
);

-- ── Appointments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT  NOT NULL,
  doctor_id        INT  NOT NULL,
  hospital_id      INT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason           TEXT,
  status           ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id)  REFERENCES users(id),
  FOREIGN KEY (doctor_id)   REFERENCES doctors(id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

-- ── Health Records ────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  record_type   ENUM('prescription','lab_report','xray','mri','scan','vaccination','other') NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  doctor_name   VARCHAR(100),
  hospital_name VARCHAR(150),
  record_date   DATE,
  image_path    VARCHAR(255),
  file_path     VARCHAR(255),
  tags          VARCHAR(200),
  is_shared     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Medicines ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicines (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  name             VARCHAR(150) NOT NULL,
  dosage           VARCHAR(100),
  frequency        VARCHAR(100),
  timing           VARCHAR(100),
  start_date       DATE,
  end_date         DATE,
  prescribed_by    VARCHAR(100),
  notes            TEXT,
  stock_count      INT DEFAULT 0,
  low_stock_alert  INT DEFAULT 5,
  image            VARCHAR(255),
  status           ENUM('active','completed','paused') DEFAULT 'active',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Medicine Reminders ───────────────────────────────
CREATE TABLE IF NOT EXISTS medicine_reminders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id   INT NOT NULL,
  reminder_time TIME NOT NULL,
  days_of_week  VARCHAR(50),
  is_active     BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
);

-- ── Doctor Reviews ────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id  INT NOT NULL,
  user_id    INT NOT NULL,
  rating     INT CHECK(rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (user_id)   REFERENCES users(id)
);

-- ── Chat History ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100),
  user_id    INT,
  role       ENUM('user','assistant') NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ════════════════════════════════════════════════════
--  SEED DATA
-- ════════════════════════════════════════════════════

-- Specializations
INSERT INTO specializations (name, keywords, icon, description) VALUES
('Cardiologist',       'heart,chest pain,cardiac,heartbeat,cardiovascular,bp,blood pressure,artery,palpitation', '❤️',  'Heart and cardiovascular specialist'),
('Orthopedic',         'bone,joint,knee,spine,fracture,back pain,shoulder,hip,wrist,ankle,skeleton,orthopedic',  '🦴',  'Bone and joint specialist'),
('Neurologist',        'brain,nerve,headache,migraine,epilepsy,stroke,alzheimer,parkinson,dizzy',                '🧠',  'Brain and nervous system specialist'),
('Dermatologist',      'skin,acne,rash,hair,nail,eczema,psoriasis,allergy,itching,dermatology',                  '🔬',  'Skin and hair specialist'),
('Pediatrician',       'child,baby,infant,fever,vaccination,growth,kid,pediatric',                               '👶',  'Children health specialist'),
('Gynecologist',       'pregnancy,women,uterus,ovary,menstrual,fertility,gynec',                                 '🏥',  'Women health specialist'),
('Ophthalmologist',    'eye,vision,blurry,cataract,glaucoma,retina,spectacle,glasses',                           '👁️', 'Eye specialist'),
('ENT Specialist',     'ear,nose,throat,hearing,sinusitis,tonsil,smell,voice,ent',                               '👂',  'Ear, nose and throat specialist'),
('Pulmonologist',      'lung,breathing,asthma,cough,respiratory,bronchitis,pneumonia',                           '🫁',  'Lung and breathing specialist'),
('Gastroenterologist', 'stomach,liver,intestine,digestion,acidity,ulcer,constipation,diarrhea,gastric',          '🍽️', 'Digestive system specialist'),
('Endocrinologist',    'diabetes,thyroid,hormone,sugar,insulin,pancreas,metabolism,endocrine',                   '🩺',  'Hormone and gland specialist'),
('Psychiatrist',       'mental health,anxiety,depression,stress,insomnia,psychology,mood',                       '🧘',  'Mental health specialist'),
('Urologist',          'kidney,bladder,urine,prostate,urinary tract,uti',                                        '💧',  'Urinary system specialist'),
('Oncologist',         'cancer,tumor,chemotherapy,radiation,biopsy,oncology',                                    '🔬',  'Cancer specialist'),
('General Physician',  'fever,cold,flu,general,body pain,weakness,fatigue,checkup,routine',                      '👨‍⚕️','General health checkup');

-- Hospitals
INSERT INTO hospitals (name, address, city, phone, email, rating, beds, established_year, tie_up_date, status) VALUES
('Apollo Hospitals',             '21 Greams Lane, Greams Road',          'Chennai',   '044-28293333',   'info@apollohospitals.com',  4.8, 500, 1983, '2020-01-15', 'active'),
('Fortis Healthcare',            'Sector 62, Phase VIII, Industrial Area','Mohali',    '0172-4692222',   'info@fortis.com',           4.6, 350, 1996, '2020-03-20', 'active'),
('Max Super Speciality',         'Press Enclave Road, Saket',             'New Delhi', '011-26515050',   'info@maxhealthcare.in',     4.7, 450, 2000, '2021-06-10', 'active'),
('Kokilaben Dhirubhai Ambani',   'Rao Saheb Achutrao Patwardhan Marg',   'Mumbai',    '022-30999999',   'info@kokilabenhospital.com',4.9, 750, 2009, '2021-09-01', 'active'),
('Narayana Health',              '258/A Bommasandra Industrial Area',     'Bengaluru', '080-71222222',   'info@narayanahealth.org',   4.7, 600, 2000, '2022-01-15', 'active');

-- Doctors
INSERT INTO doctors (name, specialization_id, hospital_id, qualification, experience_years, consultation_fee, phone, email, bio, available_days, available_from, available_to, rating, total_reviews) VALUES
('Dr. Rajesh Kumar',  1,  1, 'MBBS, MD Cardiology, DM',      15, 800, '9876543210', 'rajesh.k@apollo.com',    'Senior cardiologist with 15 years of experience in interventional cardiology.',              'Mon,Tue,Wed,Thu,Fri',  '09:00:00', '17:00:00', 4.8, 342),
('Dr. Priya Sharma',  2,  2, 'MBBS, MS Orthopedics',         12, 700, '9876543211', 'priya.s@fortis.com',     'Expert in joint replacement and sports injuries.',                                       'Mon,Wed,Fri',          '10:00:00', '16:00:00', 4.7, 218),
('Dr. Anand Mehta',   3,  3, 'MBBS, DM Neurology',           18, 900, '9876543212', 'anand.m@max.com',        'Specialist in stroke management and epilepsy treatment.',                                'Tue,Thu,Sat',          '09:00:00', '15:00:00', 4.9, 456),
('Dr. Sunita Patel',  4,  4, 'MBBS, MD Dermatology',         10, 600, '9876543213', 'sunita.p@kokilaben.com', 'Expert in cosmetic dermatology and skin disorders.',                                     'Mon,Tue,Thu,Fri',      '11:00:00', '18:00:00', 4.6, 189),
('Dr. Vikram Singh',  5,  5, 'MBBS, MD Pediatrics',           8, 500, '9876543214', 'vikram.s@narayana.com',  'Compassionate pediatrician specialising in child development.',                          'Mon,Tue,Wed,Thu,Fri',  '09:00:00', '17:00:00', 4.8, 312),
('Dr. Meera Nair',    6,  1, 'MBBS, MS Gynecology',          14, 750, '9876543215', 'meera.n@apollo.com',     'Expert in high-risk pregnancy and fertility treatments.',                                'Mon,Wed,Fri',          '10:00:00', '16:00:00', 4.7, 278),
('Dr. Suresh Reddy',  10, 2, 'MBBS, DM Gastroenterology',    11, 700, '9876543216', 'suresh.r@fortis.com',    'Specialist in endoscopy and liver diseases.',                                            'Tue,Thu',              '09:00:00', '15:00:00', 4.5, 156),
('Dr. Kavita Joshi',  11, 3, 'MBBS, DM Endocrinology',        9, 650, '9876543217', 'kavita.j@max.com',       'Expert in diabetes management and thyroid disorders.',                                   'Mon,Wed,Fri',          '10:00:00', '17:00:00', 4.6, 201),
('Dr. Amit Gupta',    12, 4, 'MBBS, MD Psychiatry',           13, 800, '9876543218', 'amit.g@kokilaben.com',   'Specialist in anxiety, depression and cognitive behavioural therapy.',                   'Tue,Thu,Sat',          '11:00:00', '17:00:00', 4.9, 334),
('Dr. Pooja Iyer',    7,  5, 'MBBS, MS Ophthalmology',         7, 550, '9876543219', 'pooja.i@narayana.com',   'Expert in cataract surgery and retinal diseases.',                                       'Mon,Tue,Wed,Thu,Fri',  '09:00:00', '16:00:00', 4.7, 145),
('Dr. Rahul Verma',   15, 1, 'MBBS, MD General Medicine',      6, 400, '9876543220', 'rahul.v@apollo.com',     'General physician available for routine checkups and acute illnesses.',                  'Mon,Tue,Wed,Thu,Fri,Sat','08:00:00','20:00:00', 4.5, 567),
('Dr. Nisha Kapoor',  9,  2, 'MBBS, DM Pulmonology',          10, 700, '9876543221', 'nisha.k@fortis.com',     'Expert in asthma, COPD and sleep disorders.',                                           'Mon,Wed,Thu,Fri',      '10:00:00', '16:00:00', 4.6, 189);
