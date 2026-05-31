SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

CREATE DATABASE IF NOT EXISTS `toko_retail`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `toko_retail`;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `nama`       VARCHAR(150)  NOT NULL,
  `username`   VARCHAR(100)  NOT NULL,
  `password`   VARCHAR(255)  NOT NULL  COMMENT 'bcrypt hash',
  `role`       ENUM('admin','staff')   NOT NULL DEFAULT 'staff',
  `is_active`  TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel autentikasi pengguna API';

INSERT INTO `users` (`nama`, `username`, `password`, `role`) VALUES
('Administrator', 'admin',  '$2a$10$fPeB1pVrylENv7mrp8t77e4iPtmOcS4gtxqzkvdIcsflsaDkAXtrS', 'admin'),
('Staff Gudang',  'staff1', '$2a$10$Mh3F4AOhHCmW9d/bsrCwxOTo.IYFvfsrlAX4SwkKryxUxTZ5oomte', 'staff'),
('Staff Kasir',   'staff2', '$2a$10$huN3JhbWLgpqh0VDzQSUwev3L.xQK4SxTJgvf7v3NrQxsypc3iloW', 'staff');

DROP TABLE IF EXISTS `kategori`;
CREATE TABLE `kategori` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `nama`       VARCHAR(100)  NOT NULL,
  `deskripsi`  TEXT          DEFAULT NULL,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kategori_nama` (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `pelanggan`;
CREATE TABLE `pelanggan` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `nama`       VARCHAR(150)  NOT NULL,
  `email`      VARCHAR(150)  NOT NULL,
  `telepon`    VARCHAR(20)   DEFAULT NULL,
  `alamat`     TEXT          DEFAULT NULL,
  `kota`       VARCHAR(100)  DEFAULT NULL,
  `level`      ENUM('regular','silver','gold','platinum') NOT NULL DEFAULT 'regular',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pelanggan_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `produk`;
CREATE TABLE `produk` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `kategori_id` INT            NOT NULL,
  `nama`        VARCHAR(200)   NOT NULL,
  `harga`       DECIMAL(12,2)  NOT NULL,
  `stok`        INT            NOT NULL DEFAULT 0,
  `satuan`      VARCHAR(30)    NOT NULL DEFAULT 'pcs',
  `kode_sku`    VARCHAR(50)    DEFAULT NULL,
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_produk_sku` (`kode_sku`),
  KEY `idx_produk_kategori` (`kategori_id`),
  CONSTRAINT `fk_produk_kategori`
    FOREIGN KEY (`kategori_id`) REFERENCES `kategori` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `pesanan`;
CREATE TABLE `pesanan` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `pelanggan_id`  INT            NOT NULL,
  `kode_pesanan`  VARCHAR(30)    NOT NULL,
  `tanggal_pesan` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_harga`   DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  `status`        ENUM('pending','diproses','dikirim','selesai','dibatalkan') NOT NULL DEFAULT 'pending',
  `metode_bayar`  ENUM('tunai','transfer','qris','kartu_kredit') NOT NULL DEFAULT 'tunai',
  `catatan`       TEXT           DEFAULT NULL,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kode_pesanan` (`kode_pesanan`),
  KEY `idx_pesanan_pelanggan` (`pelanggan_id`),
  KEY `idx_pesanan_status`    (`status`),
  CONSTRAINT `fk_pesanan_pelanggan`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `detail_pesanan`;
CREATE TABLE `detail_pesanan` (
  `id`           INT            NOT NULL AUTO_INCREMENT,
  `pesanan_id`   INT            NOT NULL,
  `produk_id`    INT            NOT NULL,
  `jumlah`       INT            NOT NULL,
  `harga_satuan` DECIMAL(12,2)  NOT NULL,
  `subtotal`     DECIMAL(14,2)  GENERATED ALWAYS AS (`jumlah` * `harga_satuan`) STORED,
  `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_detail_pesanan` (`pesanan_id`),
  KEY `idx_detail_produk`  (`produk_id`),
  CONSTRAINT `fk_detail_pesanan`
    FOREIGN KEY (`pesanan_id`) REFERENCES `pesanan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_detail_produk`
    FOREIGN KEY (`produk_id`) REFERENCES `produk` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `kategori` (`nama`, `deskripsi`) VALUES
('Elektronik',        'Perangkat elektronik dan aksesori teknologi'),
('Pakaian',           'Busana pria, wanita, dan anak-anak'),
('Makanan & Minuman', 'Produk pangan segar dan olahan'),
('Alat Tulis',        'Perlengkapan kantor dan alat tulis'),
('Kesehatan',         'Produk kesehatan dan perawatan tubuh'),
('Olahraga',          'Perlengkapan dan pakaian olahraga'),
('Furnitur',          'Perabot rumah tangga dan dekorasi interior'),
('Buku',              'Buku pelajaran, novel, dan referensi'),
('Otomotif',          'Aksesori dan suku cadang kendaraan'),
('Mainan',            'Mainan edukatif dan hiburan anak');

INSERT INTO `pelanggan` (`nama`, `email`, `telepon`, `alamat`, `kota`, `level`) VALUES
('Ahmad Fauzan',    'ahmad.fauzan@gmail.com',    '081234567890', 'Jl. Sudirman No. 12',       'Pekanbaru',  'gold'),
('Siti Rahayu',     'siti.rahayu@yahoo.com',     '082345678901', 'Jl. Ahmad Yani No. 45',     'Medan',      'silver'),
('Budi Santoso',    'budi.santoso@email.com',    '083456789012', 'Perum Griya Indah Blok C7', 'Jakarta',    'platinum'),
('Dewi Lestari',    'dewi.lestari@gmail.com',    '084567890123', 'Jl. Gatot Subroto No. 88',  'Bandung',    'gold'),
('Rizky Pratama',   'rizky.pratama@hotmail.com', '085678901234', 'Jl. Pahlawan No. 33',       'Surabaya',   'regular'),
('Nur Halimah',     'nur.halimah@gmail.com',     '086789012345', 'Jl. Diponegoro No. 21',     'Yogyakarta', 'silver'),
('Hendra Wijaya',   'hendra.wijaya@email.com',   '087890123456', 'Komplek Ruko Maju Jaya 5',  'Semarang',   'gold'),
('Fitri Anggraini', 'fitri.anggraini@gmail.com', '088901234567', 'Jl. Imam Bonjol No. 67',    'Makassar',   'regular'),
('Agus Setiawan',   'agus.setiawan@yahoo.com',   '089012345678', 'Jl. Merdeka No. 14',        'Palembang',  'silver'),
('Linda Kusuma',    'linda.kusuma@gmail.com',    '081122334455', 'Jl. Kartini No. 9',         'Balikpapan', 'platinum'),
('Muhammad Iqbal',  'miqbal@gmail.com',          '081233445566', 'Jl. Riau No. 55',           'Pekanbaru',  'regular'),
('Rina Wulandari',  'rina.wulan@email.com',      '082344556677', 'Jl. Hang Tuah No. 30',      'Pekanbaru',  'silver');

INSERT INTO `produk` (`kategori_id`, `nama`, `harga`, `stok`, `satuan`, `kode_sku`) VALUES
(1, 'Laptop ASUS VivoBook 14',      8500000.00,  15, 'unit',   'ELK-001'),
(1, 'Headphone Sony WH-1000XM5',    3750000.00,  30, 'pcs',    'ELK-002'),
(1, 'Keyboard Mechanical Logitech',  950000.00,  50, 'pcs',    'ELK-003'),
(1, 'Mouse Wireless Rexus',          320000.00,  75, 'pcs',    'ELK-004'),
(2, 'Kaos Polo Pria Premium',        185000.00, 200, 'pcs',    'PKN-001'),
(2, 'Celana Chino Slim Fit',         275000.00, 150, 'pcs',    'PKN-002'),
(2, 'Jaket Bomber Wanita',           450000.00,  80, 'pcs',    'PKN-003'),
(3, 'Minyak Goreng Tropical 2L',      32000.00, 300, 'botol',  'MKN-001'),
(3, 'Beras Premium 5kg',              78000.00, 250, 'karung', 'MKN-002'),
(3, 'Susu UHT Full Cream 1L',         18500.00, 400, 'kotak',  'MKN-003'),
(4, 'Pulpen Pilot G2 isi 12',         48000.00, 180, 'pak',    'ALT-001'),
(4, 'Buku Tulis Sidu 58 lembar',       7500.00, 500, 'pcs',    'ALT-002'),
(5, 'Vitamin C 1000mg 60 tab',        85000.00, 120, 'botol',  'KES-001'),
(5, 'Hand Sanitizer 500ml',           42000.00, 200, 'botol',  'KES-002'),
(6, 'Sepatu Lari Nike Air Max',     1250000.00,  60, 'pasang', 'OLR-001');

INSERT INTO `pesanan` (`pelanggan_id`, `kode_pesanan`, `tanggal_pesan`, `total_harga`, `status`, `metode_bayar`, `catatan`) VALUES
( 1, 'ORD-2024-0001', '2024-11-01 09:15:00',  9460000.00, 'selesai',    'transfer',     'Kirim ke kantor'),
( 2, 'ORD-2024-0002', '2024-11-03 11:30:00',   460000.00, 'selesai',    'qris',          NULL),
( 3, 'ORD-2024-0003', '2024-11-05 14:00:00',  4700000.00, 'selesai',    'kartu_kredit', 'Hadiah ulang tahun'),
( 4, 'ORD-2024-0004', '2024-11-08 10:20:00',   910000.00, 'dikirim',    'transfer',      NULL),
( 5, 'ORD-2024-0005', '2024-11-10 16:45:00',  1710000.00, 'diproses',   'tunai',        'Tolong dibungkus rapi'),
( 6, 'ORD-2024-0006', '2024-11-12 08:00:00',   188500.00, 'selesai',    'qris',          NULL),
( 7, 'ORD-2024-0007', '2024-11-15 13:10:00',  8500000.00, 'dikirim',    'transfer',     'Urgent, butuh segera'),
( 8, 'ORD-2024-0008', '2024-11-18 09:50:00',   207000.00, 'pending',    'tunai',         NULL),
( 9, 'ORD-2024-0009', '2024-11-20 15:30:00',  5000000.00, 'diproses',   'kartu_kredit',  NULL),
(10, 'ORD-2024-0010', '2024-11-22 11:00:00',  3750000.00, 'selesai',    'transfer',     'Gift wrap'),
( 1, 'ORD-2024-0011', '2024-11-25 10:05:00',   144500.00, 'selesai',    'qris',          NULL),
( 3, 'ORD-2024-0012', '2024-11-28 17:20:00',  1270000.00, 'dibatalkan', 'transfer',     'Stok habis'),
(11, 'ORD-2024-0013', '2024-12-01 09:00:00',   950000.00, 'selesai',    'qris',          NULL),
(12, 'ORD-2024-0014', '2024-12-03 14:30:00',  4700000.00, 'diproses',   'transfer',      NULL),
( 4, 'ORD-2024-0015', '2024-12-05 10:45:00',  1700000.00, 'dikirim',    'kartu_kredit', 'Alamat beda di catatan');

INSERT INTO `detail_pesanan` (`pesanan_id`, `produk_id`, `jumlah`, `harga_satuan`) VALUES
( 1,  1, 1, 8500000.00), ( 1,  4, 3,  320000.00),
( 2,  5, 1,  185000.00), ( 2,  6, 1,  275000.00),
( 3,  2, 1, 3750000.00), ( 3,  3, 1,  950000.00),
( 4,  7, 1,  450000.00), ( 4,  5, 1,  185000.00), ( 4,  6, 1, 275000.00),
( 5, 15, 1, 1250000.00), ( 5,  5, 2,  185000.00), ( 5,  6, 1, 275000.00),
( 6, 10, 2,   18500.00), ( 6, 12, 5,    7500.00), ( 6, 14, 1,  42000.00),
( 7,  1, 1, 8500000.00),
( 8,  8, 3,   32000.00), ( 8,  9, 1,   78000.00), ( 8, 10, 3,  18500.00),
( 9,  2, 1, 3750000.00), ( 9, 15, 1, 1250000.00),
(10,  2, 1, 3750000.00),
(11, 11, 1,   48000.00), (11, 12, 5,    7500.00), (11, 14, 1,  42000.00),
(12,  3, 1,  950000.00), (12,  4, 1,  320000.00),
(13,  3, 1,  950000.00),
(14,  2, 1, 3750000.00), (14,  3, 1,  950000.00),
(15, 15, 1, 1250000.00), (15,  7, 1,  450000.00);
