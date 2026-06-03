-- =================================================================================
-- GRABFOOD_DB - SENIOR LEVEL SCHEMA v2.0
-- Fix list:
--   3.1  driver_locations → append-only history table (Redis = realtime, DB = history)
--   3.2  payments → thêm payment_transactions cho retry / webhook
--   3.3  order_status_logs → thêm index trên order_id
--   3.4  optimistic locking → thêm cột version INT trên orders
--   3.5  orders.status ENUM → tách ra bảng order_statuses
--   3.6  partitioning → RANGE PARTITION orders theo created_at (năm)
--   3.7  idempotency_key → thêm trên orders và payments
-- =================================================================================
SET SQL_SAFE_UPDATES  = 0;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS grabfood_db;
USE grabfood_db;

-- ---------------------------------------------------------------------------------
-- 1. CORE USERS & ROLES (RBAC)
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id   INT          PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50)  UNIQUE NOT NULL   -- CUSTOMER, DRIVER, MERCHANT, ADMIN
);

CREATE TABLE IF NOT EXISTS users (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    phone       VARCHAR(15)  UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    full_name   VARCHAR(100),
    rating_avg  DECIMAL(3,2) DEFAULT 5.0,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP    NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS driver_details (
    user_id      INT         PRIMARY KEY,
    license_plate VARCHAR(20),
    vehicle_type  VARCHAR(50),
    is_online     BOOLEAN     DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_details (
    user_id          INT          PRIMARY KEY,
    business_license VARCHAR(100),
    tax_code         VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------------
-- FIX 3.1 – driver_locations: append-only history (không dùng PK = driver_id nữa)
-- Realtime vẫn nằm ở Redis (TTL ngắn).
-- Bảng này = lịch sử track để phân tích / replay / audit.
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_locations (
    id         BIGINT  PRIMARY KEY AUTO_INCREMENT,
    driver_id  INT     NOT NULL,
    order_id   BIGINT  NULL,
    latitude   DOUBLE  NOT NULL,
    longitude  DOUBLE  NOT NULL,
    heading    DOUBLE  NOT NULL DEFAULT 0,
    speed_kmh  DOUBLE  NOT NULL DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- append-only, không UPDATE
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_driver_locations_driver_id  ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_order_id   ON driver_locations(order_id);
CREATE INDEX idx_driver_locations_created_at ON driver_locations(created_at);

-- ---------------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS & PROMOTIONS
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id           INT         PRIMARY KEY AUTO_INCREMENT,
    config_key   VARCHAR(50) UNIQUE NOT NULL,
    config_value JSON        NOT NULL,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS vouchers (
    id              INT            PRIMARY KEY AUTO_INCREMENT,
    code            VARCHAR(20)    UNIQUE NOT NULL,
    discount_amount DECIMAL(10,2)  NOT NULL,
    min_order_value DECIMAL(10,2)  DEFAULT 0,
    expiry_date     DATETIME,
    is_active       BOOLEAN        DEFAULT TRUE
);

-- ---------------------------------------------------------------------------------
-- 3. RESTAURANT & MENU
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id           INT            PRIMARY KEY AUTO_INCREMENT,
    owner_id     INT            NOT NULL,
    name         VARCHAR(255)   NOT NULL,
    address      TEXT,
    latitude     DOUBLE         NOT NULL,
    longitude    DOUBLE         NOT NULL,
    opening_time TIME           DEFAULT '07:00:00',
    closing_time TIME           DEFAULT '22:00:00',
    is_open      TINYINT(1)     DEFAULT 1,
    image_url    VARCHAR(255),
    rating_avg   DECIMAL(3,2)   DEFAULT 5.0,
    deleted_at   TIMESTAMP      NULL DEFAULT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id            INT          PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT,
    name          VARCHAR(100),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_items (
    id           INT            PRIMARY KEY AUTO_INCREMENT,
    category_id  INT,
    name         VARCHAR(255),
    price        DECIMAL(10,2),
    is_available BOOLEAN        DEFAULT TRUE,
    default_quantity INT         NOT NULL DEFAULT 0 CHECK (default_quantity >= 0),
    current_quantity INT         NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    quantity_reset_date DATE     NULL,
    deleted_at   TIMESTAMP      NULL DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------------
-- FIX 3.5 – order_statuses: thay thế ENUM trên orders.status
-- Dễ extend không cần ALTER TABLE, dễ i18n, dễ gắn metadata.
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_statuses (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    code        VARCHAR(50)  UNIQUE NOT NULL,  -- PENDING, CONFIRMED, DELIVERING …
    label       VARCHAR(100),                  -- hiển thị UI: "Đang giao hàng"
    description TEXT,
    sort_order  INT          DEFAULT 0
);

-- ---------------------------------------------------------------------------------
-- 4. ORDER MANAGEMENT
-- FIX 3.4 – version INT  → optimistic locking (tránh double-update / race condition)
-- FIX 3.5 – status_id FK → order_statuses thay vì ENUM
-- FIX 3.6 – PARTITION BY RANGE(YEAR(created_at))
-- FIX 3.7 – idempotency_key (client gửi kèm, server dùng để deduplicate retry)
-- ---------------------------------------------------------------------------------
-- ⚠️  MySQL Error 1506: Foreign keys are NOT supported on partitioned tables.
--     Production solution: drop FK constraints từ orders, enforce ở application layer.
--     Đây là trade-off bắt buộc khi dùng partitioning trên MySQL/InnoDB.
--     Các engine khác (PostgreSQL, TiDB, PlanetScale) không có giới hạn này.
CREATE TABLE IF NOT EXISTS orders (
    id               BIGINT         NOT NULL AUTO_INCREMENT,
    order_code       VARCHAR(50)    NOT NULL,
    idempotency_key  VARCHAR(100)   NOT NULL,          -- FIX 3.7
    customer_id      INT            NOT NULL,          -- no FK (partitioned table)
    restaurant_id    INT            NOT NULL,          -- no FK (partitioned table)
    driver_id        INT,                              -- no FK (partitioned table)
    voucher_id       INT,                              -- no FK (partitioned table)
    receiver_address TEXT,
    receiver_lat     DOUBLE,
    receiver_lng     DOUBLE,
    distance_km      DOUBLE,
    subtotal_amount  DECIMAL(10,2),
    tax_amount       DECIMAL(10,2)  DEFAULT 0,
    shipping_fee     DECIMAL(10,2),
    discount_amount  DECIMAL(10,2)  DEFAULT 0,
    total_amount     DECIMAL(10,2),
    status_id        INT            NOT NULL,           -- FIX 3.5 – FK thay ENUM (no FK constraint)
    version          INT            NOT NULL DEFAULT 0, -- FIX 3.4 – optimistic lock
    -- ⚠️  DATETIME thay vì TIMESTAMP:
    --     TIMESTAMP phụ thuộc timezone → MySQL Error 1486 khi dùng trong partition function
    --     DATETIME không timezone-dependent → safe cho RANGE partitioning
    created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at       DATETIME       NULL DEFAULT NULL,

    -- Partition key (created_at) BẮT BUỘC phải nằm trong PRIMARY KEY
    -- MySQL partition limitation: UNIQUE index phải chứa created_at.
    -- Vì vậy order_code/idempotency_key uniqueness được enforce ở application layer.
    PRIMARY KEY      (id, created_at)
)
-- FIX 3.6 – Dùng TO_DAYS() trên DATETIME (không timezone-dependent, tránh Error 1486)
-- Thêm partition năm mới: ALTER TABLE orders REORGANIZE PARTITION p_future INTO (...)
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p2024   VALUES LESS THAN (TO_DAYS('2025-01-01')),
    PARTITION p2025   VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p2026   VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE TABLE IF NOT EXISTS order_items (
    id             BIGINT         PRIMARY KEY AUTO_INCREMENT,
    order_id       BIGINT         NOT NULL,
    food_id        INT            NOT NULL,
    food_name      VARCHAR(255)   NOT NULL,
    quantity       INT            NOT NULL CHECK (quantity > 0),
    price_at_order DECIMAL(10,2)  NOT NULL,
    FOREIGN KEY (food_id) REFERENCES food_items(id)
    -- NOTE: FK lên orders(id) bỏ vì orders là partitioned table;
    --       referential integrity được enforce ở application layer.
);

-- ---------------------------------------------------------------------------------
-- 5. PAYMENTS (FIX 3.2 + FIX 3.7)
-- payments     = 1 record / order (master)
-- payment_transactions = nhiều record / attempt (retry, webhook, callback)
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id              BIGINT         PRIMARY KEY AUTO_INCREMENT,
    order_id        BIGINT         NOT NULL UNIQUE,  -- 1 order → 1 payment master
    idempotency_key VARCHAR(100)   NOT NULL UNIQUE,  -- FIX 3.7
    payment_method  ENUM('CASH','E_WALLET','CREDIT_CARD') NOT NULL,
    status          ENUM('PENDING','PROCESSING','SUCCESS','FAILED') DEFAULT 'PENDING',
    amount          DECIMAL(10,2)  NOT NULL,
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- FIX 3.2 – payment_transactions: mỗi lần retry / webhook = 1 row mới
CREATE TABLE IF NOT EXISTS payment_transactions (
    id              BIGINT         PRIMARY KEY AUTO_INCREMENT,
    payment_id      BIGINT         NOT NULL,
    attempt_number  INT            NOT NULL DEFAULT 1,
    status          ENUM('PENDING','PROCESSING','SUCCESS','FAILED','RETRYING') DEFAULT 'PENDING',
    transaction_ref VARCHAR(100),              -- ref từ MoMo / Stripe / VNPay
    gateway_response JSON,                    -- raw payload từ payment gateway
    created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions(payment_id);

-- ---------------------------------------------------------------------------------
-- FIX 3.3 – order_status_logs: thêm index trên order_id
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_logs (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    order_id        BIGINT      NOT NULL,
    previous_status VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    changed_by      INT,
    reason          TEXT,
    created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);
CREATE INDEX idx_order_status_logs_order_id ON order_status_logs(order_id);  -- FIX 3.3

-- ---------------------------------------------------------------------------------
-- 6. REVIEWS
-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id           BIGINT    PRIMARY KEY AUTO_INCREMENT,
    order_id     BIGINT    NOT NULL,
    customer_id  INT       NOT NULL,
    target_type  ENUM('RESTAURANT','DRIVER') NOT NULL,
    target_id    INT       NOT NULL,
    rating       TINYINT   CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    UNIQUE KEY unique_order_target (order_id, target_type)
);

-- ---------------------------------------------------------------------------------
-- 7. INDEXES (Performance)
-- ---------------------------------------------------------------------------------
CREATE INDEX idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX idx_orders_driver_id      ON orders(driver_id);
CREATE INDEX idx_orders_restaurant_id  ON orders(restaurant_id);
CREATE INDEX idx_orders_status_id      ON orders(status_id);
CREATE INDEX idx_orders_order_code     ON orders(order_code);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX idx_orders_created_at     ON orders(created_at);
CREATE INDEX idx_food_items_category   ON food_items(category_id);
CREATE INDEX idx_food_items_quantity_reset_date ON food_items(quantity_reset_date);
CREATE INDEX idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX idx_order_items_food_id   ON order_items(food_id);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- =================================================================================
-- 8. CLEANUP & SEED DATA
-- =================================================================================
DELETE FROM reviews;
DELETE FROM order_status_logs;
DELETE FROM payment_transactions;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM order_statuses;
DELETE FROM food_items;
DELETE FROM categories;
DELETE FROM restaurants;
DELETE FROM vouchers;
DELETE FROM system_settings;
DELETE FROM driver_locations;
DELETE FROM merchant_details;
DELETE FROM driver_details;
DELETE FROM user_roles;
DELETE FROM roles;
DELETE FROM users;

ALTER TABLE roles                 AUTO_INCREMENT = 1;
ALTER TABLE users                 AUTO_INCREMENT = 1;
ALTER TABLE restaurants           AUTO_INCREMENT = 1;
ALTER TABLE categories            AUTO_INCREMENT = 1;
ALTER TABLE food_items            AUTO_INCREMENT = 1;
ALTER TABLE vouchers              AUTO_INCREMENT = 1;
ALTER TABLE system_settings       AUTO_INCREMENT = 1;
ALTER TABLE order_statuses        AUTO_INCREMENT = 1;
ALTER TABLE order_items           AUTO_INCREMENT = 1;
ALTER TABLE payments              AUTO_INCREMENT = 1;
ALTER TABLE payment_transactions  AUTO_INCREMENT = 1;
ALTER TABLE order_status_logs     AUTO_INCREMENT = 1;
ALTER TABLE reviews               AUTO_INCREMENT = 1;
ALTER TABLE driver_locations      AUTO_INCREMENT = 1;

-- Roles
INSERT INTO roles (name) VALUES ('CUSTOMER'),('DRIVER'),('MERCHANT'),('ADMIN');

-- Users
INSERT INTO users (phone, password, full_name, rating_avg) VALUES
('0900000001','123456','Nguyen Van A',4.80),
('0900000002','123456','Tran Thi B', 4.95),
('0900000003','123456','Le Van C',   4.70),
('0900000004','123456','Pham Thi D', 4.88),
('0900000005','123456','Hoang Van E',5.00);

INSERT INTO user_roles (user_id, role_id) VALUES
(1,1),(2,2),(3,3),(4,2),(4,1),(5,4);

INSERT INTO driver_details (user_id, license_plate, vehicle_type, is_online) VALUES
(2,'59A1-12345','Motorbike',1),
(4,'51B2-67890','Motorbike',0);

INSERT INTO merchant_details (user_id, business_license, tax_code) VALUES
(3,'GPKD-123456789','MST-987654321');

INSERT INTO system_settings (config_key, config_value, description) VALUES
('shipping_config','{"base_fee":15000,"base_km":2,"extra_per_km":5000}','Cấu hình phí ship'),
('tax_config',     '{"vat_rate":0.08}',                                 'Cấu hình thuế VAT');

INSERT INTO vouchers (code, discount_amount, min_order_value, expiry_date) VALUES
('FREESHIP',15000.00,50000.00,'2026-12-31 23:59:59');

INSERT INTO restaurants (owner_id, name, address, latitude, longitude, is_open) VALUES
(3,'Hanh Dung - Am Thuc Chay Man','111-113 Au Co, P.14, Q.11',10.771,106.649,1),
(3,'Quan Chay Thanh Ai',          '264 Ba Hat, P.9, Q.10',    10.765,106.671,1);

INSERT INTO categories (restaurant_id, name) VALUES
(1,'Mon chinh'),(1,'Nuoc uong'),(2,'Diem tam');

INSERT INTO food_items (
    category_id, name, price, is_available,
    default_quantity, current_quantity, quantity_reset_date
) VALUES
(1,'Com Tam Chay', 45000,1, 40, 40, CURRENT_DATE),
(1,'Tra Da',        5000,1,120,120, CURRENT_DATE),
(3,'Hu Tieu Nam Vang',55000,1, 35, 35, CURRENT_DATE);

-- FIX 3.5 – seed order_statuses (thay ENUM)
INSERT INTO order_statuses (code, label, sort_order) VALUES
('PENDING',          'Chờ xác nhận',        1),
('DRIVER_ACCEPTED',  'Tài xế đã nhận',      2),
('DRIVER_REJECTED',  'Tài xế từ chối',      3),
('CONFIRMED',        'Đã xác nhận',         4),
('PICKING_UP',       'Đang lấy hàng',       5),
('DELIVERING',       'Đang giao hàng',      6),
('COMPLETED',        'Hoàn thành',          7),
('CANCELLED',        'Đã huỷ',              8),
('TIMEOUT',          'Quá thời gian',       9);

-- Order mẫu (status_id=7 = COMPLETED, version=1, idempotency_key để deduplicate ở app layer)
INSERT INTO orders (
    order_code, idempotency_key, customer_id, restaurant_id, driver_id, voucher_id,
    receiver_address, receiver_lat, receiver_lng, distance_km,
    subtotal_amount, tax_amount, shipping_fee, discount_amount, total_amount,
    status_id, version, created_at
) VALUES (
    'ORD-20260324-001',
    'IDEM-CLIENT-20260324-UUID-001',
    1, 1, 2, 1,
    '12 Nguyen Hue, Quan 1', 10.7769, 106.7009, 3.2,
    95000, 7600, 21000, 15000, 108600,
    7, 1, '2026-03-24 10:00:00'
);

INSERT INTO order_items (order_id, food_id, food_name, quantity, price_at_order) VALUES
(1, 1, 'Com Tam Chay', 2, 45000),
(1, 2, 'Tra Da', 1,  5000);

-- FIX 3.2 – payments + payment_transactions
INSERT INTO payments (order_id, idempotency_key, payment_method, status, amount) VALUES
(1, 'PAY-IDEM-20260324-001', 'E_WALLET', 'SUCCESS', 108600);

INSERT INTO payment_transactions (payment_id, attempt_number, status, transaction_ref, gateway_response) VALUES
(1, 1, 'SUCCESS', 'MOMO-9988776655', '{"code":"0","message":"Thanh cong"}');

-- FIX 3.3 – order_status_logs (index đã tạo ở trên)
INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, reason) VALUES
(1, 'DELIVERING', 'COMPLETED', 2, 'Giao hàng thành công');

-- FIX 3.1 – driver_locations (append-only, không overwrite)
INSERT INTO driver_locations (driver_id, order_id, latitude, longitude, heading, speed_kmh) VALUES
(2, 1, 10.771, 106.649, 90, 24);

INSERT INTO reviews (order_id, customer_id, target_type, target_id, rating, comment) VALUES
(1, 1, 'RESTAURANT', 1, 5, 'Com tam rat ngon!'),
(1, 1, 'DRIVER',     2, 5, 'Tai xe giao nhanh, nhiet tinh.');

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES   = 1;

-- =================================================================================
-- USAGE NOTES
-- =================================================================================
-- [3.1] Realtime driver position → đọc/ghi qua Redis (key: driver:{id}:location, TTL 60s)
--       Lịch sử → INSERT INTO driver_locations (append-only, không UPDATE)
--
-- [3.2] Khi tạo payment: INSERT payments (master)
--       Mỗi lần gọi gateway / webhook callback: INSERT payment_transactions
--       Retry logic: attempt_number tăng dần, gateway_response lưu raw JSON
--
-- [3.3] idx_order_status_logs_order_id đã có → query "WHERE order_id=?" chạy index scan
--
-- [3.4] Optimistic locking pattern (application layer):
--       UPDATE orders SET status_id=?, version=version+1
--       WHERE id=? AND version=?   -- nếu affected=0 → conflict → retry
--
-- [3.5] Thêm trạng thái mới: INSERT INTO order_statuses, không cần ALTER TABLE
--
-- [3.6] Thêm partition năm mới (chạy mỗi năm):
--       ALTER TABLE orders REORGANIZE PARTITION p_future INTO (
--           PARTITION p2027 VALUES LESS THAN (2028),
--           PARTITION p_future VALUES LESS THAN MAXVALUE
--       );
--
-- [3.7] Client sinh idempotency_key (UUID) → gửi kèm request
--       Với orders partitioned (MySQL), không thể giữ UNIQUE(idempotency_key) độc lập.
--       Server cần deduplicate ở application layer (transaction + lock/check) hoặc bảng riêng.
-- =================================================================================
