-- P2-6: Recalculate user_points projection from user_scores ledger
-- Run this script whenever user_points gets out of sync with user_scores.
-- user_scores is the immutable ledger (source of truth).
-- user_points is the mutable projection (summary/cache).
--
-- Usage: psql $DATABASE_URL -f scripts/recalculate-user-points-from-ledger.sql
--
-- This is idempotent: safe to run multiple times.

BEGIN;

INSERT INTO "user_points" (
  "id",
  "audienceId",
  "total_points",
  "total_scans",
  "total_requests",
  "total_tips",
  "total_social_shares",
  "current_level",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()                                                    AS "id",
  s."user_id"                                                          AS "audienceId",
  COALESCE(SUM(s."points"), 0)                                         AS "total_points",
  COALESCE(SUM(CASE WHEN s."score_type" = 'qr_scan'      THEN 1 ELSE 0 END), 0) AS "total_scans",
  COALESCE(SUM(CASE WHEN s."score_type" = 'music_request' THEN 1 ELSE 0 END), 0) AS "total_requests",
  0                                                                    AS "total_tips",
  COALESCE(SUM(CASE WHEN s."score_type" = 'social_share'  THEN 1 ELSE 0 END), 0) AS "total_social_shares",
  GREATEST(1, FLOOR(COALESCE(SUM(s."points"), 0) / 100) + 1)::INT    AS "current_level",
  TRUE                                                                  AS "is_active",
  NOW()                                                                AS "created_at",
  NOW()                                                                AS "updated_at"
FROM "user_scores" s
GROUP BY s."user_id"
ON CONFLICT ("audienceId") DO UPDATE
  SET
    "total_points"        = EXCLUDED."total_points",
    "total_scans"         = EXCLUDED."total_scans",
    "total_requests"      = EXCLUDED."total_requests",
    "total_social_shares" = EXCLUDED."total_social_shares",
    "current_level"       = EXCLUDED."current_level",
    "updated_at"          = NOW();

-- Note: total_tips is not recalculated here because the monetary sum
-- lives in the tips table (not user_scores). Recalculate separately if needed:
--   UPDATE "user_points" up
--   SET "total_tips" = (
--     SELECT COALESCE(SUM(t."amount"), 0)
--     FROM "tips" t
--     WHERE t."audienceId" = up."audienceId"
--       AND t."status" = 'completed'
--   );

COMMIT;
