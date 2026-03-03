-- Migration to enhance prescriptions table
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS custom_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'General';

-- Update existing records if any
UPDATE prescriptions SET category = 'General' WHERE category IS NULL;
UPDATE prescriptions SET medications = '[]' WHERE medications IS NULL;
