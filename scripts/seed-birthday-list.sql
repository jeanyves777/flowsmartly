-- Seed Birthday List for Laikos Albany (cmlr8p99j0008z7ofd0xj8azl)
-- Creates a "Birthday List" contact list and 81 contacts with birthdays

BEGIN;

-- 1. Create the contact list
INSERT INTO "ContactList" (id, "userId", name, "totalCount", "activeCount", "createdAt", "updatedAt")
VALUES (
  'bday_laikos_001',
  'cmlr8p99j0008z7ofd0xj8azl',
  'Birthday List',
  81,
  81,
  NOW(),
  NOW()
);

-- 2. Create all contacts with birthdays (MM-DD format)
-- JANUARY
INSERT INTO "Contact" (id, "userId", "firstName", birthday, status, "createdAt", "updatedAt") VALUES
('bday_c_001', 'cmlr8p99j0008z7ofd0xj8azl', 'Nasiru', '01-12', 'ACTIVE', NOW(), NOW()),
('bday_c_002', 'cmlr8p99j0008z7ofd0xj8azl', 'David D', '01-14', 'ACTIVE', NOW(), NOW()),
('bday_c_003', 'cmlr8p99j0008z7ofd0xj8azl', 'Queen', '01-25', 'ACTIVE', NOW(), NOW()),

-- FEBRUARY
('bday_c_004', 'cmlr8p99j0008z7ofd0xj8azl', 'Kathrine', '02-05', 'ACTIVE', NOW(), NOW()),
('bday_c_005', 'cmlr8p99j0008z7ofd0xj8azl', 'Nigel', '02-10', 'ACTIVE', NOW(), NOW()),
('bday_c_006', 'cmlr8p99j0008z7ofd0xj8azl', 'Rachael', '02-12', 'ACTIVE', NOW(), NOW()),
('bday_c_007', 'cmlr8p99j0008z7ofd0xj8azl', 'Freddy', '02-16', 'ACTIVE', NOW(), NOW()),
('bday_c_008', 'cmlr8p99j0008z7ofd0xj8azl', 'Kelvin', '02-17', 'ACTIVE', NOW(), NOW()),
('bday_c_009', 'cmlr8p99j0008z7ofd0xj8azl', 'Rev. Patrick', '02-21', 'ACTIVE', NOW(), NOW()),

-- MARCH
('bday_c_010', 'cmlr8p99j0008z7ofd0xj8azl', 'Elyse', '03-03', 'ACTIVE', NOW(), NOW()),
('bday_c_011', 'cmlr8p99j0008z7ofd0xj8azl', 'Gabby', '03-03', 'ACTIVE', NOW(), NOW()),
('bday_c_012', 'cmlr8p99j0008z7ofd0xj8azl', 'Gloria', '03-07', 'ACTIVE', NOW(), NOW()),
('bday_c_013', 'cmlr8p99j0008z7ofd0xj8azl', 'Elijah', '03-07', 'ACTIVE', NOW(), NOW()),
('bday_c_014', 'cmlr8p99j0008z7ofd0xj8azl', 'Michael Sackey', '03-08', 'ACTIVE', NOW(), NOW()),
('bday_c_015', 'cmlr8p99j0008z7ofd0xj8azl', 'Paulette', '03-10', 'ACTIVE', NOW(), NOW()),
('bday_c_016', 'cmlr8p99j0008z7ofd0xj8azl', 'Junior', '03-13', 'ACTIVE', NOW(), NOW()),
('bday_c_017', 'cmlr8p99j0008z7ofd0xj8azl', 'Robert', '03-14', 'ACTIVE', NOW(), NOW()),

-- APRIL
('bday_c_018', 'cmlr8p99j0008z7ofd0xj8azl', 'Stephen O', '04-08', 'ACTIVE', NOW(), NOW()),
('bday_c_019', 'cmlr8p99j0008z7ofd0xj8azl', 'Kianna', '04-11', 'ACTIVE', NOW(), NOW()),
('bday_c_020', 'cmlr8p99j0008z7ofd0xj8azl', 'Priscilla', '04-14', 'ACTIVE', NOW(), NOW()),
('bday_c_021', 'cmlr8p99j0008z7ofd0xj8azl', 'Adriana', '04-16', 'ACTIVE', NOW(), NOW()),
('bday_c_022', 'cmlr8p99j0008z7ofd0xj8azl', 'Avalon', '04-18', 'ACTIVE', NOW(), NOW()),
('bday_c_023', 'cmlr8p99j0008z7ofd0xj8azl', 'MS Michael', '04-20', 'ACTIVE', NOW(), NOW()),
('bday_c_024', 'cmlr8p99j0008z7ofd0xj8azl', 'Brother George', '04-24', 'ACTIVE', NOW(), NOW()),

-- MAY
('bday_c_025', 'cmlr8p99j0008z7ofd0xj8azl', 'Philippe', '05-05', 'ACTIVE', NOW(), NOW()),
('bday_c_026', 'cmlr8p99j0008z7ofd0xj8azl', 'Auntie Salome', '05-07', 'ACTIVE', NOW(), NOW()),
('bday_c_027', 'cmlr8p99j0008z7ofd0xj8azl', 'Lokko Sheba', '05-07', 'ACTIVE', NOW(), NOW()),
('bday_c_028', 'cmlr8p99j0008z7ofd0xj8azl', 'Kenny', '05-08', 'ACTIVE', NOW(), NOW()),
('bday_c_029', 'cmlr8p99j0008z7ofd0xj8azl', 'Eden', '05-11', 'ACTIVE', NOW(), NOW()),
('bday_c_030', 'cmlr8p99j0008z7ofd0xj8azl', 'Bishop Dag', '05-14', 'ACTIVE', NOW(), NOW()),
('bday_c_031', 'cmlr8p99j0008z7ofd0xj8azl', 'David T', '05-15', 'ACTIVE', NOW(), NOW()),
('bday_c_032', 'cmlr8p99j0008z7ofd0xj8azl', 'Joy', '05-23', 'ACTIVE', NOW(), NOW()),
('bday_c_033', 'cmlr8p99j0008z7ofd0xj8azl', 'Mr. Lokko', '05-24', 'ACTIVE', NOW(), NOW()),
('bday_c_034', 'cmlr8p99j0008z7ofd0xj8azl', 'Daniel T', '05-28', 'ACTIVE', NOW(), NOW()),
('bday_c_035', 'cmlr8p99j0008z7ofd0xj8azl', 'Nana Yaa', '05-31', 'ACTIVE', NOW(), NOW()),

-- JUNE
('bday_c_036', 'cmlr8p99j0008z7ofd0xj8azl', 'Bishop Ogoe', '06-01', 'ACTIVE', NOW(), NOW()),
('bday_c_037', 'cmlr8p99j0008z7ofd0xj8azl', 'Marlene', '06-05', 'ACTIVE', NOW(), NOW()),
('bday_c_038', 'cmlr8p99j0008z7ofd0xj8azl', 'Auntie Christina', '06-15', 'ACTIVE', NOW(), NOW()),
('bday_c_039', 'cmlr8p99j0008z7ofd0xj8azl', 'Joe', '06-17', 'ACTIVE', NOW(), NOW()),
('bday_c_040', 'cmlr8p99j0008z7ofd0xj8azl', 'Chris', '06-17', 'ACTIVE', NOW(), NOW()),
('bday_c_041', 'cmlr8p99j0008z7ofd0xj8azl', 'John Chris', '06-18', 'ACTIVE', NOW(), NOW()),
('bday_c_042', 'cmlr8p99j0008z7ofd0xj8azl', 'Janelle', '06-18', 'ACTIVE', NOW(), NOW()),
('bday_c_043', 'cmlr8p99j0008z7ofd0xj8azl', 'Uncle Dan', '06-23', 'ACTIVE', NOW(), NOW()),
('bday_c_044', 'cmlr8p99j0008z7ofd0xj8azl', 'Michaela', '06-23', 'ACTIVE', NOW(), NOW()),

-- JULY
('bday_c_045', 'cmlr8p99j0008z7ofd0xj8azl', 'Pascalynn', '07-04', 'ACTIVE', NOW(), NOW()),
('bday_c_046', 'cmlr8p99j0008z7ofd0xj8azl', 'Rabi', '07-21', 'ACTIVE', NOW(), NOW()),
('bday_c_047', 'cmlr8p99j0008z7ofd0xj8azl', 'Michael Sai', '07-24', 'ACTIVE', NOW(), NOW()),
('bday_c_048', 'cmlr8p99j0008z7ofd0xj8azl', 'Alexia', '07-31', 'ACTIVE', NOW(), NOW()),

-- AUGUST
('bday_c_049', 'cmlr8p99j0008z7ofd0xj8azl', 'Daniel D', '08-04', 'ACTIVE', NOW(), NOW()),
('bday_c_050', 'cmlr8p99j0008z7ofd0xj8azl', 'Auntie Janet', '08-11', 'ACTIVE', NOW(), NOW()),
('bday_c_051', 'cmlr8p99j0008z7ofd0xj8azl', 'Annakay', '08-15', 'ACTIVE', NOW(), NOW()),
('bday_c_052', 'cmlr8p99j0008z7ofd0xj8azl', 'Desi', '08-15', 'ACTIVE', NOW(), NOW()),
('bday_c_053', 'cmlr8p99j0008z7ofd0xj8azl', 'Auntie Margaret', '08-17', 'ACTIVE', NOW(), NOW()),
('bday_c_054', 'cmlr8p99j0008z7ofd0xj8azl', 'Victoria', '08-18', 'ACTIVE', NOW(), NOW()),
('bday_c_055', 'cmlr8p99j0008z7ofd0xj8azl', 'Sister Theodora', '08-20', 'ACTIVE', NOW(), NOW()),
('bday_c_056', 'cmlr8p99j0008z7ofd0xj8azl', 'Serwa', '08-28', 'ACTIVE', NOW(), NOW()),

-- SEPTEMBER
('bday_c_057', 'cmlr8p99j0008z7ofd0xj8azl', 'Kierra', '09-02', 'ACTIVE', NOW(), NOW()),
('bday_c_058', 'cmlr8p99j0008z7ofd0xj8azl', 'Sister Dzifa', '09-11', 'ACTIVE', NOW(), NOW()),
('bday_c_059', 'cmlr8p99j0008z7ofd0xj8azl', 'Catherine', '09-14', 'ACTIVE', NOW(), NOW()),
('bday_c_060', 'cmlr8p99j0008z7ofd0xj8azl', 'Joshua', '09-15', 'ACTIVE', NOW(), NOW()),
('bday_c_061', 'cmlr8p99j0008z7ofd0xj8azl', 'Dominic', '09-17', 'ACTIVE', NOW(), NOW()),
('bday_c_062', 'cmlr8p99j0008z7ofd0xj8azl', 'Sister Leslie', '09-25', 'ACTIVE', NOW(), NOW()),

-- OCTOBER
('bday_c_063', 'cmlr8p99j0008z7ofd0xj8azl', 'Maya', '10-04', 'ACTIVE', NOW(), NOW()),
('bday_c_064', 'cmlr8p99j0008z7ofd0xj8azl', 'Tommy', '10-09', 'ACTIVE', NOW(), NOW()),
('bday_c_065', 'cmlr8p99j0008z7ofd0xj8azl', 'Charlotte', '10-19', 'ACTIVE', NOW(), NOW()),
('bday_c_066', 'cmlr8p99j0008z7ofd0xj8azl', 'Christel', '10-20', 'ACTIVE', NOW(), NOW()),
('bday_c_067', 'cmlr8p99j0008z7ofd0xj8azl', 'Jean', '10-24', 'ACTIVE', NOW(), NOW()),
('bday_c_068', 'cmlr8p99j0008z7ofd0xj8azl', 'Divine', '10-27', 'ACTIVE', NOW(), NOW()),

-- NOVEMBER
('bday_c_069', 'cmlr8p99j0008z7ofd0xj8azl', 'Lily', '11-04', 'ACTIVE', NOW(), NOW()),
('bday_c_070', 'cmlr8p99j0008z7ofd0xj8azl', 'Shelly-Ann', '11-16', 'ACTIVE', NOW(), NOW()),

-- DECEMBER
('bday_c_071', 'cmlr8p99j0008z7ofd0xj8azl', 'Emma', '12-01', 'ACTIVE', NOW(), NOW()),
('bday_c_072', 'cmlr8p99j0008z7ofd0xj8azl', 'Brother Joshua', '12-06', 'ACTIVE', NOW(), NOW()),
('bday_c_073', 'cmlr8p99j0008z7ofd0xj8azl', 'Monique', '12-06', 'ACTIVE', NOW(), NOW()),
('bday_c_074', 'cmlr8p99j0008z7ofd0xj8azl', 'Dorothy', '12-07', 'ACTIVE', NOW(), NOW()),
('bday_c_075', 'cmlr8p99j0008z7ofd0xj8azl', 'Michelle Koffi', '12-18', 'ACTIVE', NOW(), NOW()),
('bday_c_076', 'cmlr8p99j0008z7ofd0xj8azl', 'Eunice Koffi', '12-19', 'ACTIVE', NOW(), NOW()),
('bday_c_077', 'cmlr8p99j0008z7ofd0xj8azl', 'Sister Tina', '12-19', 'ACTIVE', NOW(), NOW()),
('bday_c_078', 'cmlr8p99j0008z7ofd0xj8azl', 'Eunice', '12-22', 'ACTIVE', NOW(), NOW()),
('bday_c_079', 'cmlr8p99j0008z7ofd0xj8azl', 'Keith', '12-26', 'ACTIVE', NOW(), NOW()),
('bday_c_080', 'cmlr8p99j0008z7ofd0xj8azl', 'Emmanuel', '12-27', 'ACTIVE', NOW(), NOW()),
('bday_c_081', 'cmlr8p99j0008z7ofd0xj8azl', 'Stephanie', '12-31', 'ACTIVE', NOW(), NOW());

-- 3. Add all contacts to the Birthday List
INSERT INTO "ContactListMember" (id, "contactListId", "contactId", "addedAt")
SELECT
  'bday_m_' || LPAD(ROW_NUMBER() OVER (ORDER BY id)::TEXT, 3, '0'),
  'bday_laikos_001',
  id,
  NOW()
FROM "Contact"
WHERE id LIKE 'bday_c_%'
AND "userId" = 'cmlr8p99j0008z7ofd0xj8azl';

COMMIT;
