-- Buyer-selected date and gift message become part of the public certificate projection.
ALTER TABLE certificates ADD COLUMN gift_date TEXT;
ALTER TABLE certificates ADD COLUMN greeting_text TEXT;
ALTER TABLE certificates ADD COLUMN sender_signature TEXT;

-- A conditional issuance claim prevents duplicate certificates from repeated buyer requests.
ALTER TABLE gift_orders ADD COLUMN issuance_status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (issuance_status IN ('not_started', 'issuing', 'issued'));
