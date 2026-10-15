-- Demo-only seed and compatibility additions for the existing UUID-based
-- Neon schema (users/drivers/vehicles/warehouses/routes/route_stops/orders).
-- Safe to rerun for these fixed demo IDs. Do not use this data in production.

BEGIN;

ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS demo_otp char(4);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS locality text;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS landmark text;

CREATE TABLE IF NOT EXISTS driver_events (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN (
    'driver.shift.started',
    'stop.arrived',
    'package.scanned',
    'delivery.completed',
    'delivery.failed',
    'driver.location.updated'
  )),
  occurred_at timestamptz NOT NULL,
  driver_user_id uuid NOT NULL REFERENCES drivers(user_id),
  route_id uuid NOT NULL REFERENCES routes(id),
  route_stop_id uuid REFERENCES route_stops(id),
  order_id uuid REFERENCES orders(id),
  latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_events_route_time_idx
  ON driver_events (route_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS driver_events_driver_time_idx
  ON driver_events (driver_user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id uuid NOT NULL REFERENCES drivers(user_id),
  route_stop_id uuid NOT NULL UNIQUE REFERENCES route_stops(id),
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  earned_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_earnings_driver_earned
  ON earnings (driver_id, earned_at DESC);

INSERT INTO users (id, email, phone, password_hash, full_name)
VALUES (
  '10400000-0000-4000-8000-000000000001',
  'driver.demo@raipur.example.test',
  '+919876543210',
  '!DEMO_LOGIN_DISABLED!',
  'Arjun Sahu'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_active = true,
  updated_at = now();

INSERT INTO user_roles (user_id, role)
VALUES ('10400000-0000-4000-8000-000000000001', 'driver')
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (
  id, type, registration_number, max_weight_kg, max_volume_m3, is_active
)
VALUES (
  '10400000-0000-4000-8000-000000000002',
  'two_wheeler',
  'CG 04 AB 1040',
  40,
  0.5,
  true
)
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  registration_number = EXCLUDED.registration_number,
  max_weight_kg = EXCLUDED.max_weight_kg,
  max_volume_m3 = EXCLUDED.max_volume_m3,
  is_active = true,
  updated_at = now();

INSERT INTO drivers (user_id, vehicle_id, status)
VALUES (
  '10400000-0000-4000-8000-000000000001',
  '10400000-0000-4000-8000-000000000002',
  'offline'
)
ON CONFLICT (user_id) DO UPDATE SET
  vehicle_id = EXCLUDED.vehicle_id,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO warehouses (id, code, name, address, location, is_active)
VALUES (
  '10400000-0000-4000-8000-000000000003',
  'WH-RAIPUR',
  'Raipur Central Hub',
  'Central Distribution Hub, Great Eastern Road, Pandri, Raipur, Chhattisgarh',
  ST_SetSRID(ST_MakePoint(81.6406, 21.2578), 4326)::geography,
  true
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  location = EXCLUDED.location,
  is_active = true,
  updated_at = now();

INSERT INTO merchants (id, name, contact_email, contact_phone, is_active)
VALUES (
  '10400000-0000-4000-8000-000000000004',
  'Raipur Demo Merchant',
  'merchant.demo@raipur.example.test',
  '+919000000104',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  is_active = true,
  updated_at = now();

INSERT INTO orders (
  id, merchant_id, merchant_order_ref, warehouse_id, status,
  recipient_name, recipient_phone, delivery_address, delivery_location,
  window_earliest, window_latest, weight_kg, volume_m3, tracking_token
)
VALUES
  (
    '10400000-0000-4000-8000-000000000101',
    '10400000-0000-4000-8000-000000000004',
    'ORD-7890',
    '10400000-0000-4000-8000-000000000003',
    'pending', 'Ananya Sharma', '+919000007890',
    'Flat 302, Shreeji Residency, Shankar Nagar Main Road, Raipur, Chhattisgarh 492007',
    ST_SetSRID(ST_MakePoint(81.6631, 21.2582), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 09:00:00+05:30',
    TIMESTAMPTZ '2026-10-05 09:30:00+05:30',
    2.40, 0.02, 'demo-track-7890'
  ),
  (
    '10400000-0000-4000-8000-000000000102',
    '10400000-0000-4000-8000-000000000004',
    'ORD-7891',
    '10400000-0000-4000-8000-000000000003',
    'pending', 'Rohit Verma', '+919000007891',
    'House 18, Sector 2, Telibandha, beside Marine Drive, Raipur, Chhattisgarh 492001',
    ST_SetSRID(ST_MakePoint(81.6672, 21.2416), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 10:00:00+05:30',
    TIMESTAMPTZ '2026-10-05 10:30:00+05:30',
    1.80, 0.02, 'demo-track-7891'
  ),
  (
    '10400000-0000-4000-8000-000000000103',
    '10400000-0000-4000-8000-000000000004',
    'ORD-7892',
    '10400000-0000-4000-8000-000000000003',
    'pending', 'Meera Agrawal', '+919000007892',
    'B-14, Shyam Plaza Lane, near City Centre Mall, Pandri, Raipur, Chhattisgarh 492004',
    ST_SetSRID(ST_MakePoint(81.6384, 21.2619), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 11:00:00+05:30',
    TIMESTAMPTZ '2026-10-05 11:30:00+05:30',
    3.10, 0.03, 'demo-track-7892'
  ),
  (
    '10400000-0000-4000-8000-000000000104',
    '10400000-0000-4000-8000-000000000004',
    'ORD-7893',
    '10400000-0000-4000-8000-000000000003',
    'pending', 'Dev Patel', '+919000007893',
    'House 6, Katora Talab Road, near Collectorate Garden, Civil Lines, Raipur, Chhattisgarh 492001',
    ST_SetSRID(ST_MakePoint(81.6509, 21.2478), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 12:00:00+05:30',
    TIMESTAMPTZ '2026-10-05 13:00:00+05:30',
    2.70, 0.03, 'demo-track-7893'
  )
ON CONFLICT (id) DO UPDATE SET
  merchant_id = EXCLUDED.merchant_id,
  merchant_order_ref = EXCLUDED.merchant_order_ref,
  warehouse_id = EXCLUDED.warehouse_id,
  status = EXCLUDED.status,
  recipient_name = EXCLUDED.recipient_name,
  recipient_phone = EXCLUDED.recipient_phone,
  delivery_address = EXCLUDED.delivery_address,
  delivery_location = EXCLUDED.delivery_location,
  window_earliest = EXCLUDED.window_earliest,
  window_latest = EXCLUDED.window_latest,
  weight_kg = EXCLUDED.weight_kg,
  volume_m3 = EXCLUDED.volume_m3,
  tracking_token = EXCLUDED.tracking_token,
  updated_at = now();

INSERT INTO routes (
  id, warehouse_id, driver_id, vehicle_id, status, version
)
VALUES (
  '10400000-0000-4000-8000-000000000005',
  '10400000-0000-4000-8000-000000000003',
  '10400000-0000-4000-8000-000000000001',
  '10400000-0000-4000-8000-000000000002',
  'planned',
  1
)
ON CONFLICT (id) DO UPDATE SET
  warehouse_id = EXCLUDED.warehouse_id,
  driver_id = EXCLUDED.driver_id,
  vehicle_id = EXCLUDED.vehicle_id,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO route_stops (
  id, route_id, order_id, sequence, status, planned_location,
  planned_arrival_at, instructions, demo_otp, locality, landmark
)
VALUES
  (
    '10400000-0000-4000-8000-000000000201',
    '10400000-0000-4000-8000-000000000005',
    '10400000-0000-4000-8000-000000000101',
    1, 'pending', ST_SetSRID(ST_MakePoint(81.6631, 21.2582), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 09:00:00+05:30',
    'Call on arrival - Leave at security gate', '2468', 'Shankar Nagar', 'Near City Centre Mall'
  ),
  (
    '10400000-0000-4000-8000-000000000202',
    '10400000-0000-4000-8000-000000000005',
    '10400000-0000-4000-8000-000000000102',
    2, 'pending', ST_SetSRID(ST_MakePoint(81.6672, 21.2416), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 10:00:00+05:30',
    'Call on arrival - Ring bell twice', '1357', 'Telibandha', 'Near Marine Drive'
  ),
  (
    '10400000-0000-4000-8000-000000000203',
    '10400000-0000-4000-8000-000000000005',
    '10400000-0000-4000-8000-000000000103',
    3, 'pending', ST_SetSRID(ST_MakePoint(81.6384, 21.2619), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 11:00:00+05:30',
    'Hand over to recipient only', '8642', 'Pandri', 'Behind City Centre Mall'
  ),
  (
    '10400000-0000-4000-8000-000000000204',
    '10400000-0000-4000-8000-000000000005',
    '10400000-0000-4000-8000-000000000104',
    4, 'pending', ST_SetSRID(ST_MakePoint(81.6509, 21.2478), 4326)::geography,
    TIMESTAMPTZ '2026-10-05 12:00:00+05:30',
    'Please call before entering the building', '5791', 'Civil Lines', 'Near Collectorate Garden'
  )
ON CONFLICT (id) DO UPDATE SET
  route_id = EXCLUDED.route_id,
  order_id = EXCLUDED.order_id,
  sequence = EXCLUDED.sequence,
  status = EXCLUDED.status,
  failure_reason = NULL,
  planned_location = EXCLUDED.planned_location,
  planned_arrival_at = EXCLUDED.planned_arrival_at,
  arrived_at = NULL,
  completed_at = NULL,
  instructions = EXCLUDED.instructions,
  demo_otp = EXCLUDED.demo_otp,
  locality = EXCLUDED.locality,
  landmark = EXCLUDED.landmark,
  updated_at = now();

COMMIT;

-- Configure the local server using these IDs after running the seed:
-- NEON_DRIVER_USER_ID=10400000-0000-4000-8000-000000000001
-- NEON_ROUTE_ID=10400000-0000-4000-8000-000000000005
