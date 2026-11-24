export const SENDER_AVATAR_SQL =
  "COALESCE(to_jsonb(u)->>'avatar_url', cp.avatar_url, wp.avatar_url) as avatar_url";
