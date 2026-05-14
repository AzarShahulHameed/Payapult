-- ============================================================
--  PAYAPULT — Complete PostgreSQL Schema v2
--  Run: psql -U postgres -d payapult_db -f schema.sql
-- ============================================================

-- Drop everything cleanly first
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('super_admin','admin','hr_manager','accountant','employee');
CREATE TYPE emp_status AS ENUM ('active','on_leave','terminated','probation');
CREATE TYPE gender AS ENUM ('male','female','other','prefer_not_to_say');
CREATE TYPE pay_frequency AS ENUM ('weekly','biweekly','monthly','semi_monthly');
CREATE TYPE payrun_status AS ENUM ('draft','processing','approved','paid','cancelled');
CREATE TYPE leave_type AS ENUM ('annual','sick','maternity','paternity','unpaid','emergency','study');
CREATE TYPE leave_status AS ENUM ('pending','approved','rejected','cancelled');
CREATE TYPE loan_status AS ENUM ('pending','active','closed','defaulted');
CREATE TYPE advance_status AS ENUM ('pending','approved','rejected','recovered');
CREATE TYPE doc_category AS ENUM ('contract','payslip','tax','identity','other');
CREATE TYPE currency_code AS ENUM ('AED','USD','GBP','EUR','INR','SAR','QAR','KWD','PKR','EGP','NGN','CNY','KRW');
CREATE TYPE component_type AS ENUM ('earning','deduction','benefit');

-- ─── ORGANIZATIONS ──────────────────────────────────────────
CREATE TABLE organizations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(200) NOT NULL,
    legal_name       VARCHAR(200),
    registration_no  VARCHAR(100),
    trade_license    VARCHAR(100),
    industry         VARCHAR(100),
    logo_url         TEXT,
    website          VARCHAR(255),
    phone            VARCHAR(50),
    email            VARCHAR(255),
    address          JSONB DEFAULT '{}',
    base_currency    currency_code NOT NULL DEFAULT 'AED',
    pay_frequency    pay_frequency NOT NULL DEFAULT 'monthly',
    pay_day          SMALLINT DEFAULT 28 CHECK (pay_day BETWEEN 1 AND 31),
    fiscal_year_start SMALLINT DEFAULT 1,
    timezone         VARCHAR(100) DEFAULT 'Asia/Dubai',
    country_code     CHAR(2) DEFAULT 'AE',
    payslip_footer   TEXT,
    settings         JSONB DEFAULT '{}',
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS ──────────────────────────────────────────────────
CREATE TABLE users (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email                  VARCHAR(255) NOT NULL UNIQUE,
    password_hash          TEXT NOT NULL,
    first_name             VARCHAR(100) NOT NULL,
    last_name              VARCHAR(100) NOT NULL,
    role                   user_role NOT NULL DEFAULT 'employee',
    avatar_url             TEXT,
    phone                  VARCHAR(50),
    is_active              BOOLEAN DEFAULT TRUE,
    is_verified            BOOLEAN DEFAULT TRUE,
    last_login             TIMESTAMPTZ,
    password_reset_token   TEXT,
    password_reset_expires TIMESTAMPTZ,
    refresh_token          TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── DEPARTMENTS ─────────────────────────────────────────────
CREATE TABLE departments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    code         VARCHAR(20),
    parent_id    UUID REFERENCES departments(id),
    head_user_id UUID REFERENCES users(id),
    description  TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DESIGNATIONS ────────────────────────────────────────────
CREATE TABLE designations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    level         SMALLINT DEFAULT 1,
    department_id UUID REFERENCES departments(id),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WORK LOCATIONS ──────────────────────────────────────────
CREATE TABLE work_locations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'AE',
    timezone     VARCHAR(100) NOT NULL DEFAULT 'Asia/Dubai',
    address      JSONB DEFAULT '{}',
    currency     currency_code NOT NULL DEFAULT 'AED',
    is_primary   BOOLEAN DEFAULT FALSE,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEES ───────────────────────────────────────────────
CREATE TABLE employees (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES users(id),
    employee_code     VARCHAR(50) UNIQUE,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    middle_name       VARCHAR(100),
    date_of_birth     DATE,
    gender            gender,
    nationality       VARCHAR(100),
    national_id       VARCHAR(100),
    passport_no       VARCHAR(100),
    email             VARCHAR(255) NOT NULL,
    personal_email    VARCHAR(255),
    phone             VARCHAR(50),
    emergency_contact JSONB DEFAULT '{}',
    photo_url         TEXT,
    department_id     UUID REFERENCES departments(id),
    designation_id    UUID REFERENCES designations(id),
    work_location_id  UUID REFERENCES work_locations(id),
    manager_id        UUID REFERENCES employees(id),
    join_date         DATE NOT NULL,
    probation_end_date DATE,
    confirmation_date  DATE,
    termination_date   DATE,
    status            emp_status DEFAULT 'active',
    employment_type   VARCHAR(50) DEFAULT 'full_time',
    base_salary       NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency          currency_code NOT NULL DEFAULT 'AED',
    pay_frequency     pay_frequency DEFAULT 'monthly',
    bank_name         VARCHAR(150),
    bank_account_no   VARCHAR(100),
    bank_iban         VARCHAR(100),
    bank_swift        VARCHAR(50),
    tax_id            VARCHAR(100),
    social_security_no VARCHAR(100),
    address           JSONB DEFAULT '{}',
    custom_fields     JSONB DEFAULT '{}',
    is_active         BOOLEAN DEFAULT TRUE,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_emp_org ON employees(org_id);
CREATE INDEX idx_emp_dept ON employees(department_id);
CREATE INDEX idx_emp_status ON employees(status);

-- ─── SALARY COMPONENTS ───────────────────────────────────────
CREATE TABLE salary_components (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    code          VARCHAR(50) NOT NULL,
    type          component_type NOT NULL,
    calculation   VARCHAR(50) DEFAULT 'fixed',
    default_value NUMERIC(15,2) DEFAULT 0,
    percentage    NUMERIC(5,2) DEFAULT 0,
    formula       TEXT,
    is_taxable    BOOLEAN DEFAULT FALSE,
    is_statutory  BOOLEAN DEFAULT FALSE,
    is_active     BOOLEAN DEFAULT TRUE,
    display_order SMALLINT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE SALARY STRUCTURE ───────────────────────────────
CREATE TABLE employee_salary_structures (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    component_id   UUID NOT NULL REFERENCES salary_components(id),
    amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
    percentage     NUMERIC(5,2),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to   DATE,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAY RUNS ────────────────────────────────────────────────
CREATE TABLE pay_runs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    pay_date         DATE NOT NULL,
    currency         currency_code NOT NULL DEFAULT 'AED',
    total_gross      NUMERIC(15,2) DEFAULT 0,
    total_deductions NUMERIC(15,2) DEFAULT 0,
    total_net        NUMERIC(15,2) DEFAULT 0,
    employee_count   INTEGER DEFAULT 0,
    status           payrun_status DEFAULT 'draft',
    notes            TEXT,
    approved_by      UUID REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    paid_by          UUID REFERENCES users(id),
    paid_at          TIMESTAMPTZ,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAY RUN ITEMS ───────────────────────────────────────────
CREATE TABLE pay_run_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pay_run_id        UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id       UUID NOT NULL REFERENCES employees(id),
    gross_salary      NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_earnings    NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_deductions  NUMERIC(15,2) NOT NULL DEFAULT 0,
    loan_deduction    NUMERIC(15,2) DEFAULT 0,
    advance_deduction NUMERIC(15,2) DEFAULT 0,
    net_salary        NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency          currency_code NOT NULL DEFAULT 'AED',
    working_days      SMALLINT,
    paid_days         SMALLINT,
    leave_days        SMALLINT DEFAULT 0,
    components        JSONB DEFAULT '[]',
    notes             TEXT,
    is_processed      BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payitem_payrun ON pay_run_items(pay_run_id);
CREATE INDEX idx_payitem_emp ON pay_run_items(employee_id);

-- ─── PAYSLIPS ────────────────────────────────────────────────
CREATE TABLE payslips (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pay_run_item_id UUID NOT NULL REFERENCES pay_run_items(id),
    employee_id     UUID NOT NULL REFERENCES employees(id),
    pdf_url         TEXT,
    is_sent         BOOLEAN DEFAULT FALSE,
    sent_at         TIMESTAMPTZ,
    viewed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEAVE POLICIES ──────────────────────────────────────────
CREATE TABLE leave_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    leave_type      leave_type NOT NULL,
    days_allowed    NUMERIC(5,1) NOT NULL,
    carry_forward   BOOLEAN DEFAULT FALSE,
    max_carry_days  NUMERIC(5,1) DEFAULT 0,
    is_paid         BOOLEAN DEFAULT TRUE,
    gender_specific gender,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEAVE BALANCES ──────────────────────────────────────────
CREATE TABLE leave_balances (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    policy_id     UUID NOT NULL REFERENCES leave_policies(id),
    year          SMALLINT NOT NULL,
    entitled_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    used_days     NUMERIC(5,1) NOT NULL DEFAULT 0,
    pending_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
    carried_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
    UNIQUE(employee_id, policy_id, year)
);

-- ─── LEAVE REQUESTS ──────────────────────────────────────────
CREATE TABLE leave_requests (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    policy_id        UUID NOT NULL REFERENCES leave_policies(id),
    from_date        DATE NOT NULL,
    to_date          DATE NOT NULL,
    days             NUMERIC(5,1) NOT NULL,
    reason           TEXT,
    status           leave_status DEFAULT 'pending',
    approved_by      UUID REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOANS ───────────────────────────────────────────────────
CREATE TABLE loans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_number     VARCHAR(50) UNIQUE,
    amount          NUMERIC(15,2) NOT NULL,
    currency        currency_code NOT NULL DEFAULT 'AED',
    interest_rate   NUMERIC(5,2) DEFAULT 0,
    tenure_months   SMALLINT NOT NULL,
    emi_amount      NUMERIC(15,2) NOT NULL,
    disbursed_date  DATE,
    first_emi_date  DATE,
    reason          TEXT,
    status          loan_status DEFAULT 'pending',
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LOAN REPAYMENTS ─────────────────────────────────────────
CREATE TABLE loan_repayments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id         UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    pay_run_item_id UUID REFERENCES pay_run_items(id),
    installment_no  SMALLINT NOT NULL,
    due_date        DATE NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    paid_amount     NUMERIC(15,2) DEFAULT 0,
    paid_date       DATE,
    is_paid         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SALARY ADVANCES ─────────────────────────────────────────
CREATE TABLE salary_advances (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    advance_number   VARCHAR(50) UNIQUE,
    amount           NUMERIC(15,2) NOT NULL,
    currency         currency_code NOT NULL DEFAULT 'AED',
    reason           TEXT,
    request_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    status           advance_status DEFAULT 'pending',
    approved_by      UUID REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    recovery_months  SMALLINT DEFAULT 1,
    recovered_amount NUMERIC(15,2) DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOCUMENTS ───────────────────────────────────────────────
CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    category    doc_category NOT NULL DEFAULT 'other',
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    file_url    TEXT,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    expiry_date DATE,
    tags        TEXT[],
    is_private  BOOLEAN DEFAULT FALSE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    type       VARCHAR(50) DEFAULT 'info',
    link       TEXT,
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXCHANGE RATES ──────────────────────────────────────────
CREATE TABLE exchange_rates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency   currency_code NOT NULL,
    target_currency currency_code NOT NULL,
    rate            NUMERIC(18,8) NOT NULL,
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_currency, target_currency)
);

-- ─── TRIGGERS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations','users','employees','pay_runs',
    'leave_requests','loans','salary_advances','departments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─── DOCUMENT TEMPLATES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    doc_category NOT NULL DEFAULT 'other',
    file_url    TEXT,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    fields      JSONB DEFAULT '[]',
    is_active   BOOLEAN DEFAULT TRUE,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE CERTIFICATES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_certificates (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    cert_type    VARCHAR(100) NOT NULL,
    cert_number  VARCHAR(200),
    issued_by    VARCHAR(200),
    issue_date   DATE,
    expiry_date  DATE,
    file_url     TEXT,
    file_size    INTEGER,
    mime_type    VARCHAR(100),
    notes        TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    uploaded_by  UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cert_emp ON employee_certificates(employee_id);
