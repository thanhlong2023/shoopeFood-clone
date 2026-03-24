-- Monolith seed for one database: grabfood_db
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS grabfood_db;
USE grabfood_db;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN') DEFAULT 'CUSTOMER',
    rating_avg DECIMAL(3, 2) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_details (
    user_id INT PRIMARY KEY,
    license_plate VARCHAR(20),
    vehicle_type VARCHAR(50),
    is_online BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS restaurants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    is_open BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(255),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT,
    name VARCHAR(100),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT,
    name VARCHAR(255),
    price DECIMAL(10, 2),
    is_available BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    customer_id INT NOT NULL,
    restaurant_id INT NOT NULL,
    driver_id INT,
    receiver_address TEXT,
    receiver_lat DOUBLE,
    receiver_lng DOUBLE,
    distance_km DOUBLE,
    total_amount DECIMAL(10, 2),
    shipping_fee DECIMAL(10, 2),
    status ENUM('PENDING', 'CONFIRMED', 'PICKING_UP', 'DELIVERING', 'COMPLETED', 'CANCELLED'),
    payment_method ENUM('CASH', 'E-WALLET') DEFAULT 'CASH',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50),
    food_id INT,
    quantity INT,
    price_at_order DECIMAL(10, 2),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (food_id) REFERENCES food_items(id)
);

DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM food_items;
DELETE FROM categories;
DELETE FROM restaurants;
DELETE FROM driver_details;
DELETE FROM users;

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE restaurants AUTO_INCREMENT = 1;
ALTER TABLE categories AUTO_INCREMENT = 1;
ALTER TABLE food_items AUTO_INCREMENT = 1;
ALTER TABLE order_items AUTO_INCREMENT = 1;

INSERT INTO users (phone, password, full_name, role, rating_avg) VALUES
('0900000001', '123456', 'Nguyen Van A', 'CUSTOMER', 4.80),
('0900000002', '123456', 'Tran Thi B', 'DRIVER', 4.95),
('0900000003', '123456', 'Le Van C', 'MERCHANT', 4.70),
('0900000004', '123456', 'Pham Thi D', 'DRIVER', 4.88),
('0900000005', '123456', 'Hoang Van E', 'ADMIN', 5.00);

INSERT INTO driver_details (user_id, license_plate, vehicle_type, is_online) VALUES
(2, '59A1-12345', 'Motorbike', 1),
(4, '51B2-67890', 'Motorbike', 0);

INSERT INTO restaurants (owner_id, name, address, latitude, longitude, is_open, image_url) VALUES
(3, 'Hanh Dung - Am Thuc Chay Man', '111 - 113 Au Co, P. 14, Q. 11', 10.771, 106.649, 1, 'https://picsum.photos/seed/res1/600/400'),
(3, 'Quan Chay Thanh Ai', '264 Ba Hat, P. 9, Q. 10', 10.765, 106.671, 1, 'https://picsum.photos/seed/res2/600/400'),
(3, 'Than Thieu Nhien - Vit Quay', '63C Pham Van Hai, P. 3, Tan Binh', 10.798, 106.662, 1, 'https://picsum.photos/seed/res3/600/400');

INSERT INTO categories (restaurant_id, name) VALUES
(1, 'Mon chinh'),
(1, 'Nuoc uong'),
(2, 'Diem tam');

INSERT INTO food_items (category_id, name, price, is_available) VALUES
(1, 'Com Tam Chay', 45000, 1),
(3, 'Hu Tieu Nam Vang', 55000, 1);

INSERT INTO orders (
    id,
    customer_id,
    restaurant_id,
    driver_id,
    receiver_address,
    receiver_lat,
    receiver_lng,
    distance_km,
    total_amount,
    shipping_fee,
    status,
    payment_method
) VALUES
('ORD-DEMO001', 1, 1, 2, '12 Nguyen Hue, Quan 1', 10.7769, 106.7009, 3.2, 105000, 15000, 'PENDING', 'CASH'),
('ORD-DEMO002', 1, 2, 4, '88 Cach Mang Thang 8, Quan 3', 10.7824, 106.6842, 4.1, 120000, 18000, 'DELIVERING', 'E-WALLET');

INSERT INTO order_items (order_id, food_id, quantity, price_at_order) VALUES
('ORD-DEMO001', 1, 2, 45000),
('ORD-DEMO002', 2, 1, 55000);

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;