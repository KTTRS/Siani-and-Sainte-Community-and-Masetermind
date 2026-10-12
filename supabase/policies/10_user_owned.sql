-- User-owned tables: only the row owner (matched via users.auth_user_id =
-- auth.uid()) may select / insert / update / delete their rows.

-- Helper macro pattern: every policy joins through users on auth_user_id.

DROP POLICY IF EXISTS users_self_read   ON users;
DROP POLICY IF EXISTS users_self_write  ON users;
CREATE POLICY users_self_read  ON users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY users_self_write ON users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Generic owner-by-user_id pattern --------------------------------------------------
DO $$
DECLARE
  t TEXT;
  owned TEXT[] := ARRAY[
    'user_locations','conversations','emotional_states','signals',
    'goals','moves','check_ins','xp_transactions','cred_transactions',
    'streak_freezes','streak_recovery_quests','siani_memories',
    'siani_nudges','user_badges','notifications','referrals','vault_reactions'
  ];
BEGIN
  FOREACH t IN ARRAY owned LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_all ON %I', t, t);
    EXECUTE format($p$
      CREATE POLICY %I_owner_all ON %I
        FOR ALL TO authenticated
        USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
        WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
    $p$, t, t);
  END LOOP;
END $$;

-- messages live under a conversation owned by the member
DROP POLICY IF EXISTS messages_owner_all ON messages;
CREATE POLICY messages_owner_all ON messages
  FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );
