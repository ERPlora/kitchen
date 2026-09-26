-- kitchen#99: the rush notice jobId needs a value that moves with every transition TO rush and
-- that every screen (KDS and POS) reads identically; the existing rows start at 0, which never
-- collides with the legacy unsuffixed job id.
ALTER TABLE kitchen_order ADD COLUMN IF NOT EXISTS rush_count INTEGER NOT NULL DEFAULT 0;
