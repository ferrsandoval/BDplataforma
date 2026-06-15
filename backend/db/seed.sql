-- ProfilerMX — PostgreSQL seed data (Layer 5: Internal loan/payment database)

CREATE TABLE IF NOT EXISTS prestamos (
    id          SERIAL PRIMARY KEY,
    curp        VARCHAR(18),
    rfc         VARCHAR(13),
    monto       NUMERIC(12, 2) NOT NULL,
    fecha_apertura  DATE NOT NULL,
    fecha_cierre    DATE,
    estatus     VARCHAR(20) NOT NULL DEFAULT 'vigente',
    dias_vencidos   INT NOT NULL DEFAULT 0,
    tipo_credito    VARCHAR(40) NOT NULL DEFAULT 'personal'
);

CREATE TABLE IF NOT EXISTS scores_pago (
    id          SERIAL PRIMARY KEY,
    curp        VARCHAR(18),
    rfc         VARCHAR(13),
    score_pago  INT NOT NULL CHECK (score_pago BETWEEN 0 AND 100),
    calculado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referencias (
    id              SERIAL PRIMARY KEY,
    curp_solicitante VARCHAR(18),
    rfc_solicitante  VARCHAR(13),
    nombre          VARCHAR(120) NOT NULL,
    parentesco      VARCHAR(60) NOT NULL,
    telefono        VARCHAR(15) NOT NULL
);

-- ─── Sample data ─────────────────────────────────────────────────────────────

-- Subject 1: good payer, 2 loans
INSERT INTO prestamos (curp, rfc, monto, fecha_apertura, fecha_cierre, estatus, dias_vencidos, tipo_credito) VALUES
('GALO850312HDFRPS01', 'GALO850312HH5', 45000.00, '2021-03-15', '2023-03-15', 'liquidado', 0, 'personal'),
('GALO850312HDFRPS01', 'GALO850312HH5', 80000.00, '2023-05-01', NULL,           'vigente',  0, 'automotriz');

INSERT INTO scores_pago (curp, rfc, score_pago) VALUES
('GALO850312HDFRPS01', 'GALO850312HH5', 78);

INSERT INTO referencias (curp_solicitante, rfc_solicitante, nombre, parentesco, telefono) VALUES
('GALO850312HDFRPS01', 'GALO850312HH5', 'María López Torres', 'Cónyuge', '5512345678'),
('GALO850312HDFRPS01', 'GALO850312HH5', 'Roberto González', 'Hermano', '5598765432');

-- Subject 2: risky, overdue loans
INSERT INTO prestamos (curp, rfc, monto, fecha_apertura, fecha_cierre, estatus, dias_vencidos, tipo_credito) VALUES
('MARM780901MMCRNR07', 'MARM780901MM2', 20000.00, '2020-06-01', '2021-06-01', 'vencido', 180, 'personal'),
('MARM780901MMCRNR07', 'MARM780901MM2', 35000.00, '2022-01-10', NULL,          'vencido', 95,  'personal'),
('MARM780901MMCRNR07', 'MARM780901MM2', 60000.00, '2023-11-01', NULL,          'vigente', 0,   'hipotecario');

INSERT INTO scores_pago (curp, rfc, score_pago) VALUES
('MARM780901MMCRNR07', 'MARM780901MM2', 32);

INSERT INTO referencias (curp_solicitante, rfc_solicitante, nombre, parentesco, telefono) VALUES
('MARM780901MMCRNR07', 'MARM780901MM2', 'Carlos Martínez', 'Padre', '5511223344');

-- Subject 3: medium risk
INSERT INTO prestamos (curp, rfc, monto, fecha_apertura, fecha_cierre, estatus, dias_vencidos, tipo_credito) VALUES
('PERG920514HDFRRB09', 'PERG920514HDF', 15000.00, '2022-08-01', '2023-08-01', 'liquidado', 0,  'personal'),
('PERG920514HDFRRB09', 'PERG920514HDF', 50000.00, '2024-01-15', NULL,          'vigente',  30, 'automotriz');

INSERT INTO scores_pago (curp, rfc, score_pago) VALUES
('PERG920514HDFRRB09', 'PERG920514HDF', 55);

INSERT INTO referencias (curp_solicitante, rfc_solicitante, nombre, parentesco, telefono) VALUES
('PERG920514HDFRRB09', 'PERG920514HDF', 'Ana Pérez', 'Cónyuge', '5544332211'),
('PERG920514HDFRRB09', 'PERG920514HDF', 'Luis Reyes', 'Amigo', '5577889900');
