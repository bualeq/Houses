-- ============================================================
--  CREATIVE HOUSES — SQL DE INSTALAÇÃO
--  Execute este arquivo no seu banco MySQL antes de iniciar
-- ============================================================

CREATE TABLE IF NOT EXISTS `creative_houses` (
    `id`               INT           NOT NULL AUTO_INCREMENT,
    `name`             VARCHAR(100)  NOT NULL,
    `address`          VARCHAR(200)  NOT NULL,
    `price`            FLOAT         NOT NULL DEFAULT 0,
    `tax_value`        FLOAT         NOT NULL DEFAULT 0,
    `tax_due_date`     VARCHAR(20)   NOT NULL DEFAULT '',
    `status`           VARCHAR(20)   NOT NULL DEFAULT 'available',
    `is_locked`        TINYINT(1)    NOT NULL DEFAULT 0,
    `entry_coord`      LONGTEXT      NOT NULL,
    `polyzone`         LONGTEXT      NOT NULL,
    `members`          LONGTEXT      NOT NULL DEFAULT '[]',
    `owner_id`         INT                    DEFAULT NULL,
    `owner_name`       VARCHAR(100)           DEFAULT NULL,
    `owner_citizen_id` VARCHAR(50)            DEFAULT NULL,
    `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  EXEMPLOS (opcional — remova se não quiser)
-- ============================================================

INSERT INTO `creative_houses`
    (`name`, `address`, `price`, `tax_value`, `tax_due_date`,
     `status`, `is_locked`, `entry_coord`, `polyzone`, `members`)
VALUES
(
    'Casa Sunrise',
    'Rua Vinewood Hills, 112',
    350000, 5000, '2025-12-31', 'available', 0,
    '{"x":1239.5,"y":-2350.6,"z":45.2,"heading":180.0}',
    '[{"x":1234.5,"y":-2345.6,"z":45.2},{"x":1244.5,"y":-2345.6,"z":45.2},{"x":1244.5,"y":-2355.6,"z":45.2},{"x":1234.5,"y":-2355.6,"z":45.2}]',
    '[]'
),
(
    'Villa Rockford',
    'Rockford Hills Ave, 78',
    850000, 12000, '2025-12-31', 'available', 0,
    '{"x":455.1,"y":-1008.3,"z":30.5,"heading":270.0}',
    '[{"x":445.1,"y":-998.3,"z":30.5},{"x":465.1,"y":-998.3,"z":30.5},{"x":465.1,"y":-1018.3,"z":30.5},{"x":445.1,"y":-1018.3,"z":30.5}]',
    '[]'
),
(
    'Chale Del Perro',
    'Del Perro Beach, 34',
    220000, 3500, '2025-12-31', 'available', 0,
    '{"x":-1246.4,"y":-1519.8,"z":3.3,"heading":90.0}',
    '[{"x":-1256.4,"y":-1509.8,"z":3.3},{"x":-1236.4,"y":-1509.8,"z":3.3},{"x":-1236.4,"y":-1529.8,"z":3.3},{"x":-1256.4,"y":-1529.8,"z":3.3}]',
    '[]'
);
