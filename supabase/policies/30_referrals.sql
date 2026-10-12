-- Referrals are user-owned (covered by 10_user_owned.sql) but resources
-- and badges are global, read-only for end users.

ALTER TABLE IF EXISTS resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS badges    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resources_read ON resources;
CREATE POLICY resources_read ON resources
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS badges_read ON badges;
CREATE POLICY badges_read ON badges
  FOR SELECT TO authenticated, anon USING (true);
