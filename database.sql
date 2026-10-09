-- PostgreSQL schema and demo data for Neon.
-- Run this file in the Neon SQL Editor. All route, address, OTP, and driver
-- credentials below are demo fixtures; do not use them for a production service.

CREATE TABLE IF NOT EXISTS drivers (
  driver_id text PRIMARY KEY,
  full_name text NOT NULL,
  phone char(10) NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{10}$'),
  vehicle_registration text NOT NULL,
  demo_passcode char(4) NOT NULL CHECK (demo_passcode ~ '^[0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_routes (
  route_id text PRIMARY KEY,
  route_name text NOT NULL,
  route_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_stops (
  stop_id text PRIMARY KEY,
  route_id text NOT NULL REFERENCES delivery_routes(route_id) ON DELETE CASCADE,
  sequence_number smallint NOT NULL CHECK (sequence_number >= 0),
  stop_type text NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
  order_id text UNIQUE,
  recipient_name text,
  locality text NOT NULL,
  landmark text,
  address text NOT NULL,
  window_start time NOT NULL,
  window_end time NOT NULL,
  weight_kg numeric(6, 2) NOT NULL CHECK (weight_kg >= 0),
  latitude numeric(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  instructions text,
  demo_otp char(4) CHECK (demo_otp IS NULL OR demo_otp ~ '^[0-9]{4}$'),
  UNIQUE (route_id, sequence_number),
  CHECK (
    (stop_type = 'pickup' AND order_id IS NULL AND recipient_name IS NULL AND demo_otp IS NULL)
    OR
    (stop_type = 'delivery' AND order_id IS NOT NULL AND recipient_name IS NOT NULL AND demo_otp IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS delivery_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  driver_id text NOT NULL REFERENCES drivers(driver_id),
  route_id text NOT NULL REFERENCES delivery_routes(route_id),
  stop_id text REFERENCES route_stops(stop_id),
  order_id text,
  latitude numeric(9, 6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric(9, 6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('PENDING', 'SYNCED'))
);

CREATE INDEX IF NOT EXISTS delivery_events_route_time_idx
  ON delivery_events (route_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS delivery_events_driver_time_idx
  ON delivery_events (driver_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS delivery_events_stop_time_idx
  ON delivery_events (stop_id, occurred_at DESC);

INSERT INTO drivers (driver_id, full_name, phone, vehicle_registration, demo_passcode)
VALUES ('DRV-104', 'Arjun Sahu', '9876543210', 'CG 04 AB 1040', '1042')
ON CONFLICT (driver_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  vehicle_registration = EXCLUDED.vehicle_registration,
  demo_passcode = EXCLUDED.demo_passcode,
  updated_at = now();

INSERT INTO delivery_routes (route_id, route_name, route_date)
VALUES ('RT-RAIPUR-104', 'Raipur city loop', DATE '2026-10-05')
ON CONFLICT (route_id) DO UPDATE SET
  route_name = EXCLUDED.route_name,
  route_date = EXCLUDED.route_date;

INSERT INTO route_stops (
  stop_id, route_id, sequence_number, stop_type, order_id, recipient_name,
  locality, landmark, address, window_start, window_end, weight_kg,
  latitude, longitude, instructions, demo_otp
)
VALUES
  (
    'STP-00', 'RT-RAIPUR-104', 0, 'pickup', NULL, NULL,
    'Pandri', 'Near Great Eastern Road',
    'Central Distribution Hub, Great Eastern Road, Pandri, Raipur, Chhattisgarh',
    TIME '08:00', TIME '08:30', 9.90, 21.257800, 81.640600,
    'Scan all parcels before leaving the hub.', NULL
  ),
  (
    'STP-01', 'RT-RAIPUR-104', 1, 'delivery', 'ORD-7890', 'Ananya Sharma',
    'Shankar Nagar', 'Near City Centre Mall',
    'Flat 302, Shreeji Residency, Shankar Nagar Main Road, Raipur, Chhattisgarh 492007',
    TIME '09:00', TIME '09:30', 2.40, 21.258200, 81.663100,
    'Call on arrival · Leave at security gate', '2468'
  ),
  (
    'STP-02', 'RT-RAIPUR-104', 2, 'delivery', 'ORD-7891', 'Rohit Verma',
    'Telibandha', 'Near Marine Drive',
    'House 18, Sector 2, Telibandha, beside Marine Drive, Raipur, Chhattisgarh 492001',
    TIME '10:00', TIME '10:30', 1.80, 21.241600, 81.667200,
    'Call on arrival · Ring bell twice', '1357'
  ),
  (
    'STP-03', 'RT-RAIPUR-104', 3, 'delivery', 'ORD-7892', 'Meera Agrawal',
    'Pandri', 'Behind City Centre Mall',
    'B-14, Shyam Plaza Lane, near City Centre Mall, Pandri, Raipur, Chhattisgarh 492004',
    TIME '11:00', TIME '11:30', 3.10, 21.261900, 81.638400,
    'Hand over to recipient only', '8642'
  ),
  (
    'STP-04', 'RT-RAIPUR-104', 4, 'delivery', 'ORD-7893', 'Dev Patel',
    'Civil Lines', 'Near Collectorate Garden',
    'House 6, Katora Talab Road, near Collectorate Garden, Civil Lines, Raipur, Chhattisgarh 492001',
    TIME '12:00', TIME '13:00', 2.70, 21.247800, 81.650900,
    'Please call before entering the building', '5791'
  )
ON CONFLICT (stop_id) DO UPDATE SET
  route_id = EXCLUDED.route_id,
  sequence_number = EXCLUDED.sequence_number,
  stop_type = EXCLUDED.stop_type,
  order_id = EXCLUDED.order_id,
  recipient_name = EXCLUDED.recipient_name,
  locality = EXCLUDED.locality,
  landmark = EXCLUDED.landmark,
  address = EXCLUDED.address,
  window_start = EXCLUDED.window_start,
  window_end = EXCLUDED.window_end,
  weight_kg = EXCLUDED.weight_kg,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  instructions = EXCLUDED.instructions,
  demo_otp = EXCLUDED.demo_otp;

-- Fetch a driver profile by driver ID or normalized 10-digit phone number.
SELECT driver_id, full_name, phone, vehicle_registration
FROM drivers
WHERE driver_id = 'DRV-104'
   OR phone = '9876543210';

-- Fetch the ordered route manifest and status derived from recorded events.
SELECT
  s.stop_id,
  s.sequence_number,
  s.stop_type,
  s.order_id,
  s.recipient_name,
  s.locality,
  s.landmark,
  s.address,
  s.window_start,
  s.window_end,
  s.weight_kg,
  s.latitude,
  s.longitude,
  s.instructions,
  CASE
    WHEN s.stop_type = 'pickup' AND EXISTS (
      SELECT 1 FROM delivery_events e
      WHERE e.stop_id = s.stop_id AND e.event_type = 'package.scanned'
    ) THEN 'Completed'
    WHEN s.stop_type = 'pickup' THEN 'Pickup'
    ELSE COALESCE((
      SELECT CASE e.event_type
        WHEN 'delivery.completed' THEN 'Completed'
        WHEN 'delivery.failed' THEN 'Failed'
        ELSE 'Pending'
      END
      FROM delivery_events e
      WHERE e.stop_id = s.stop_id
        AND e.event_type IN ('delivery.completed', 'delivery.failed')
      ORDER BY e.occurred_at DESC
      LIMIT 1
    ), 'Pending')
  END AS status
FROM route_stops s
WHERE s.route_id = 'RT-RAIPUR-104'
ORDER BY s.sequence_number;

-- Fetch recent Inbox activity for this driver.
SELECT
  event_id, event_type, occurred_at, route_id, stop_id, order_id,
  latitude, longitude, metadata, sync_status
FROM delivery_events
WHERE driver_id = 'DRV-104'
ORDER BY occurred_at DESC
LIMIT 100;

-- Fetch completed orders and the demo earnings estimate (₹45 per delivery).
SELECT
  e.order_id,
  s.locality,
  s.recipient_name,
  e.occurred_at AS completed_at,
  45::integer AS demo_pay_inr
FROM delivery_events e
JOIN route_stops s ON s.stop_id = e.stop_id
WHERE e.driver_id = 'DRV-104'
  AND e.route_id = 'RT-RAIPUR-104'
  AND e.event_type = 'delivery.completed'
ORDER BY e.occurred_at DESC;

-- Aggregate demo earnings for the route.
SELECT
  count(DISTINCT order_id) AS completed_deliveries,
  count(DISTINCT order_id) * 45 AS estimated_pay_inr
FROM delivery_events
WHERE driver_id = 'DRV-104'
  AND route_id = 'RT-RAIPUR-104'
  AND event_type = 'delivery.completed';
