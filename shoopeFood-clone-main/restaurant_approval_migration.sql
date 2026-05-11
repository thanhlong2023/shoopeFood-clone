USE grabfood_db;

ALTER TABLE restaurants
  ADD COLUMN is_open_today TINYINT(1) DEFAULT 1,
  ADD COLUMN temporary_closed_reason TEXT,
  ADD COLUMN temporary_closed_until DATETIME NULL,
  ADD COLUMN approval_status VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN approved_by INT NULL,
  ADD COLUMN approved_at DATETIME NULL,
  ADD COLUMN reject_reason TEXT;

UPDATE restaurants
SET approval_status = 'APPROVED',
    approved_by = 1,
    approved_at = NOW(),
    is_open_today = IFNULL(is_open_today, 1)
WHERE approval_status IS NULL OR approval_status = 'PENDING';

CREATE TABLE IF NOT EXISTS restaurant_change_requests (
    id            INT          PRIMARY KEY AUTO_INCREMENT,
    restaurant_id INT          NOT NULL,
    requested_by  INT          NOT NULL,
    payload       JSON         NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reviewed_by   INT          NULL,
    reviewed_at   DATETIME     NULL,
    reject_reason TEXT,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
