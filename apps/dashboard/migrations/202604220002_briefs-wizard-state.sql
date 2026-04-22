-- Store the full wizard working state so users can Edit a saved brief and
-- resume Content Studio work (variants, blocks, copy, images) exactly where
-- they left off. JSON shape matches the React state in CampaignCreationV2Page.
ALTER TABLE campaign_briefs
  ADD COLUMN IF NOT EXISTS wizard_state JSONB;
