-- Seed data for Praetor

-- Default users (password is 'password' for all, hashed with bcrypt cost 10)
-- To generate: require('bcrypt').hashSync('password', 10)
INSERT INTO users (id, name, username, password_hash, role, avatar_initials) VALUES
    ('u1', 'Admin User', 'admin', '$2a$12$z5H7VrzTpLImYWSH3xufKufCiGB0n9CSlNMOrRBRIxq.6mvuVS7uy', 'admin', 'AD'),
    ('u2', 'Manager User', 'manager', '$2a$12$z5H7VrzTpLImYWSH3xufKufCiGB0n9CSlNMOrRBRIxq.6mvuVS7uy', 'manager', 'MG'),
    ('u3', 'Standard User', 'user', '$2a$12$z5H7VrzTpLImYWSH3xufKufCiGB0n9CSlNMOrRBRIxq.6mvuVS7uy', 'user', 'US')
ON CONFLICT (id) DO NOTHING;

-- Default clients with fake info
INSERT INTO clients (id, name, type, contact_name, client_code, email, phone, address, vat_number, tax_code, billing_code, payment_terms) VALUES
    ('c1', 'Acme Corp S.r.l.', 'company', 'Marco Bianchi (Ufficio Acquisti)', 'CL-001', 'info@acmecorp.example.com', '+39 012 345 6789', 'Via delle Industrie 42, 00100 Roma (RM)', 'IT01234567890', '01234567890', 'KRRH6B9', '30 gg D.F.F.M.'),
    ('c2', 'Mario Rossi', 'individual', 'Mario Rossi', 'CL-002', 'mario.rossi@example.it', '+39 333 123 4567', 'Via Roma 123, 20100 Milano (MI)', NULL, 'RSSMRA80A01H501U', '0000000', 'Rimessa Diretta')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    contact_name = EXCLUDED.contact_name,
    client_code = EXCLUDED.client_code,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    vat_number = EXCLUDED.vat_number,
    tax_code = EXCLUDED.tax_code,
    billing_code = EXCLUDED.billing_code,
    payment_terms = EXCLUDED.payment_terms;

-- Default projects
INSERT INTO projects (id, name, client_id, color, description) VALUES
    ('p1', 'Website Redesign', 'c1', '#3b82f6', 'Complete overhaul of the main marketing site.'),
    ('p2', 'Mobile App', 'c1', '#10b981', 'Native iOS and Android application development.'),
    ('p3', 'Internal Research', 'c2', '#8b5cf6', 'Ongoing research into new market trends.')
ON CONFLICT (id) DO NOTHING;

-- Default tasks
INSERT INTO tasks (id, name, project_id, description) VALUES
    ('t1', 'Initial Design', 'p1', 'Lo-fi wireframes and moodboards.'),
    ('t2', 'Frontend Dev', 'p1', 'React component implementation.'),
    ('t3', 'API Integration', 'p2', 'Connecting the app to the backend services.'),
    ('t4', 'General Support', 'p3', 'Misc administrative tasks and support.')
ON CONFLICT (id) DO NOTHING;

-- Default settings for each user
INSERT INTO settings (user_id, full_name, email) VALUES
    ('u1', 'Admin User', 'admin@example.com'),
    ('u2', 'Manager User', 'manager@example.com'),
    ('u3', 'Standard User', 'user@example.com')
ON CONFLICT (user_id) DO NOTHING;
