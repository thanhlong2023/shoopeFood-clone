SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS grabfood_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE grabfood_db;

DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS order_status_logs;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_statuses;
DROP TABLE IF EXISTS restaurant_change_requests;
DROP TABLE IF EXISTS food_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS driver_locations;
DROP TABLE IF EXISTS merchant_details;
DROP TABLE IF EXISTS driver_details;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL DEFAULT NULL
);

CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE driver_details (
    user_id INT PRIMARY KEY,
    license_plate VARCHAR(20),
    vehicle_type VARCHAR(50),
    is_online TINYINT(1) DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE merchant_details (
    user_id INT PRIMARY KEY,
    business_license VARCHAR(100),
    tax_code VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE driver_locations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    driver_id INT NOT NULL,
    order_id BIGINT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    heading DOUBLE NOT NULL DEFAULT 0,
    speed_kmh DOUBLE NOT NULL DEFAULT 24,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_driver_locations_driver_id (driver_id),
    INDEX idx_driver_locations_order_id (order_id),
    INDEX idx_driver_locations_created_at (created_at)
);

CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(50) UNIQUE NOT NULL,
    config_value JSON NOT NULL,
    description TEXT
);

CREATE TABLE vouchers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2) DEFAULT 0,
    expiry_date DATETIME,
    is_active TINYINT(1) DEFAULT 1
);

CREATE TABLE restaurants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DOUBLE NOT NULL DEFAULT 0,
    longitude DOUBLE NOT NULL DEFAULT 0,
    opening_time TIME DEFAULT '07:00:00',
    closing_time TIME DEFAULT '22:00:00',
    is_open TINYINT(1) DEFAULT 1,
    is_open_today TINYINT(1) NOT NULL DEFAULT 1,
    temporary_closed_reason TEXT NULL,
    temporary_closed_until DATETIME NULL,
    image_url VARCHAR(255),
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    approval_status VARCHAR(20) DEFAULT 'APPROVED',
    approved_by INT NULL,
    approved_at DATETIME NULL,
    reject_reason TEXT NULL,
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE restaurant_change_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    requested_by INT NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    reject_reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    INDEX idx_categories_restaurant (restaurant_id)
);

CREATE TABLE food_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_available TINYINT(1) DEFAULT 1,
    default_quantity INT NOT NULL DEFAULT 0,
    current_quantity INT NOT NULL DEFAULT 0,
    quantity_reset_date DATE NULL,
    deleted_at DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CHECK (default_quantity >= 0),
    CHECK (current_quantity >= 0),
    INDEX idx_food_items_category (category_id),
    INDEX idx_food_items_quantity_reset_date (quantity_reset_date)
);

CREATE TABLE order_statuses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100),
    description TEXT,
    sort_order INT DEFAULT 0
);

CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_code VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    customer_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    driver_id INT NULL,
    voucher_id INT NULL,
    receiver_address TEXT,
    receiver_lat DOUBLE,
    receiver_lng DOUBLE,
    distance_km DOUBLE,
    subtotal_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_fee DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2),
    status_id INT NOT NULL,
    version INT NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (status_id) REFERENCES order_statuses(id),
    INDEX idx_orders_customer_id (customer_id),
    INDEX idx_orders_driver_id (driver_id),
    INDEX idx_orders_restaurant_id (restaurant_id),
    INDEX idx_orders_status_id (status_id),
    INDEX idx_orders_order_code (order_code),
    INDEX idx_orders_idempotency_key (idempotency_key),
    INDEX idx_orders_created_at (created_at)
);

CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    food_id INT NOT NULL,
    food_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price_at_order DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES food_items(id),
    CHECK (quantity > 0),
    INDEX idx_order_items_order_id (order_id),
    INDEX idx_order_items_food_id (food_id)
);

CREATE TABLE payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    payment_method ENUM('CASH','E_WALLET','CREDIT_CARD') NOT NULL,
    status ENUM('PENDING','PROCESSING','SUCCESS','FAILED') DEFAULT 'PENDING',
    amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE payment_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    payment_id BIGINT NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    status ENUM('PENDING','PROCESSING','SUCCESS','FAILED','RETRYING') DEFAULT 'PENDING',
    transaction_ref VARCHAR(100),
    gateway_response JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    INDEX idx_payment_transactions_payment_id (payment_id)
);

CREATE TABLE order_status_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id),
    INDEX idx_order_status_logs_order_id (order_id)
);

CREATE TABLE reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    customer_id INT NOT NULL,
    target_type ENUM('RESTAURANT','DRIVER') NOT NULL,
    target_id INT NOT NULL,
    rating TINYINT,
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    CHECK (rating BETWEEN 1 AND 5),
    UNIQUE KEY unique_order_target (order_id, target_type)
);

INSERT INTO roles (name) VALUES
('CUSTOMER'),
('DRIVER'),
('MERCHANT'),
('ADMIN');

INSERT INTO users (phone, password, full_name, rating_avg) VALUES
('0900000001', '123456', 'Nguyen Van A', 4.80),
('0900000002', '123456', 'Tran Thi B', 4.95),
('0900000003', '123456', 'Le Van C', 4.70),
('0900000004', '123456', 'Pham Thi D', 4.88),
('0900000005', '123456', 'Admin User', 5.00);

INSERT INTO user_roles (user_id, role_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 1),
(4, 2),
(5, 4);

INSERT INTO driver_details (user_id, license_plate, vehicle_type, is_online) VALUES
(2, '59A1-12345', 'Motorbike', 1),
(4, '51B2-67890', 'Motorbike', 0);

INSERT INTO merchant_details (user_id, business_license, tax_code) VALUES
(3, 'GPKD-123456789', 'MST-987654321');

INSERT INTO system_settings (config_key, config_value, description) VALUES
('shipping_config', '{"base_fee":15000,"base_km":2,"extra_per_km":5000}', 'Shipping fee config'),
('tax_config', '{"vat_rate":0.08}', 'VAT config');

INSERT INTO vouchers (code, discount_amount, min_order_value, expiry_date) VALUES
('FREESHIP', 15000.00, 50000.00, '2026-12-31 23:59:59');

INSERT INTO restaurants (
    owner_id, name, address, latitude, longitude,
    opening_time, closing_time, is_open, is_open_today,
    image_url, rating_avg, approval_status, approved_by, approved_at
) VALUES
(3, 'Hanh Dung - Am Thuc Chay Man', '111-113 Au Co, P.14, Q.11', 10.771, 106.649, '07:00:00', '22:00:00', 1, 1, NULL, 4.80, 'APPROVED', 5, NOW()),
(3, 'Quan Chay Thanh Ai', '264 Ba Hat, P.9, Q.10', 10.765, 106.671, '07:00:00', '22:00:00', 1, 1, NULL, 4.70, 'APPROVED', 5, NOW());

INSERT INTO categories (restaurant_id, name) VALUES
(1, 'Mon chinh'),
(1, 'Nuoc uong'),
(2, 'Diem tam');

INSERT INTO food_items (
    category_id, name, price, is_available,
    default_quantity, current_quantity, quantity_reset_date
) VALUES
(1, 'Com Tam Chay', 45000, 1, 40, 40, CURRENT_DATE),
(1, 'Tra Da', 5000, 1, 120, 120, CURRENT_DATE),
(3, 'Hu Tieu Nam Vang', 55000, 1, 35, 35, CURRENT_DATE);

INSERT INTO order_statuses (code, label, sort_order) VALUES
('PENDING', 'Cho xac nhan', 1),
('DRIVER_ACCEPTED', 'Tai xe da nhan', 2),
('DRIVER_REJECTED', 'Tai xe tu choi', 3),
('CONFIRMED', 'Da xac nhan', 4),
('PICKING_UP', 'Dang lay hang', 5),
('DELIVERING', 'Dang giao hang', 6),
('COMPLETED', 'Hoan thanh', 7),
('CANCELLED', 'Da huy', 8),
('TIMEOUT', 'Qua thoi gian', 9);

INSERT INTO orders (
    order_code, idempotency_key, customer_id, restaurant_id, driver_id, voucher_id,
    receiver_address, receiver_lat, receiver_lng, distance_km,
    subtotal_amount, tax_amount, shipping_fee, discount_amount, total_amount,
    status_id, version, created_at
) VALUES
(
    'ORD-20260324-001',
    'IDEM-CLIENT-20260324-UUID-001',
    1, 1, 2, 1,
    '12 Nguyen Hue, Quan 1', 10.7769, 106.7009, 3.2,
    95000, 7600, 21000, 15000, 108600,
    7, 1, '2026-03-24 10:00:00'
);

INSERT INTO order_items (order_id, food_id, food_name, quantity, price_at_order) VALUES
(1, 1, 'Com Tam Chay', 2, 45000),
(1, 2, 'Tra Da', 1, 5000);

INSERT INTO payments (order_id, idempotency_key, payment_method, status, amount) VALUES
(1, 'PAY-IDEM-20260324-001', 'E_WALLET', 'SUCCESS', 108600);

INSERT INTO payment_transactions (payment_id, attempt_number, status, transaction_ref, gateway_response) VALUES
(1, 1, 'SUCCESS', 'MOMO-9988776655', '{"code":"0","message":"Thanh cong"}');

INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, reason) VALUES
(1, 'DELIVERING', 'COMPLETED', 2, 'Giao hang thanh cong');

INSERT INTO driver_locations (driver_id, order_id, latitude, longitude, heading, speed_kmh) VALUES
(2, 1, 10.771, 106.649, 90, 24);

INSERT INTO reviews (order_id, customer_id, target_type, target_id, rating, comment) VALUES
(1, 1, 'RESTAURANT', 1, 5, 'Com tam rat ngon'),
(1, 1, 'DRIVER', 2, 5, 'Tai xe giao nhanh');

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;
