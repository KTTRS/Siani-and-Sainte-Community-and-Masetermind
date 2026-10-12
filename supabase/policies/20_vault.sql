-- Vault confessions: every authenticated member can read non-flagged rows.
-- Writes are restricted to the row owner; anonymous rows (user_id IS NULL)
-- are immutable from client traffic.

DROP POLICY IF EXISTS vault_read_active   ON vault_confessions;
DROP POLICY IF EXISTS vault_insert_self   ON vault_confessions;
DROP POLICY IF EXISTS vault_update_self   ON vault_confessions;
DROP POLICY IF EXISTS vault_delete_self   ON vault_confessions;

CREATE POLICY vault_read_active ON vault_confessions
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY vault_insert_self ON vault_confessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NULL  -- anonymous confessions
    OR user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY vault_update_self ON vault_confessions
  FOR UPDATE TO authenticated
  USING (user_id IS NOT NULL AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IS NOT NULL AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY vault_delete_self ON vault_confessions
  FOR DELETE TO authenticated
  USING (user_id IS NOT NULL AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Spotlights are read-only for clients; only service role mutates them.
DROP POLICY IF EXISTS vault_spotlights_read ON vault_spotlights;
CREATE POLICY vault_spotlights_read ON vault_spotlights
  FOR SELECT TO authenticated USING (true);
