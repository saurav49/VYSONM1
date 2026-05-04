ALTER TABLE measurements
ADD COLUMN total_inches INT;

UPDATE TABLE measurements
SET total_inches = (feet * 12) + inches;

ALTER TABLE measurements
DROP COLUMN foot, DROP COLUMN inches