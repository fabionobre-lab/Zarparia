INSERT INTO users (id, email, name, provider, provider_user_id, status) VALUES
 ('u1','alice@example.com','Alice','google','g1','approved'),
 ('u2','bob@example.com','Bob','google','g2','approved');
INSERT INTO trips (id, owner_id, doc, title, status, start_date, end_date) VALUES
 ('trip1','u1','{"placeholder":true}','UK Spring','upcoming','2026-04-01','2026-04-10'),
 ('trip2','u2','{"placeholder":true}','Another Trip','upcoming','2026-05-01','2026-05-05');
INSERT INTO trip_shares (trip_id, user_id, permission) VALUES ('trip1','u2','viewer');
INSERT INTO feedback (id, user_id, type, message, created_at, updated_at) VALUES
 ('f1','u1','idea','more llamas', 1752600000000, 1752600000000);
INSERT INTO rate_limits (key, window_start, count) VALUES ('ip:1.2.3.4:test', 1752600000, 3);
