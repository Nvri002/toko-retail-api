const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

router.get('/ringkasan', async (req, res) => {
  try {
    const [[stats]] = await db.execute(`
      SELECT
        (SELECT COUNT(*)   FROM pesanan)                                             AS total_pesanan,
        (SELECT COUNT(*)   FROM pesanan WHERE status = 'selesai')                   AS pesanan_selesai,
        (SELECT COUNT(*)   FROM pesanan WHERE status = 'pending')                   AS pesanan_pending,
        (SELECT COUNT(*)   FROM pesanan WHERE status = 'diproses')                  AS pesanan_diproses,
        (SELECT COUNT(*)   FROM pesanan WHERE status = 'dikirim')                   AS pesanan_dikirim,
        (SELECT COUNT(*)   FROM pesanan WHERE status = 'dibatalkan')                AS pesanan_dibatalkan,
        (SELECT COALESCE(SUM(total_harga),0)
           FROM pesanan WHERE status != 'dibatalkan')                               AS total_pendapatan,
        (SELECT COALESCE(AVG(total_harga),0)
           FROM pesanan WHERE status != 'dibatalkan')                               AS rata_rata_transaksi,
        (SELECT COALESCE(MAX(total_harga),0)
           FROM pesanan WHERE status != 'dibatalkan')                               AS transaksi_tertinggi,
        (SELECT COUNT(*)   FROM produk)                                             AS total_produk,
        (SELECT COUNT(*)   FROM produk WHERE stok  = 0)                             AS produk_stok_habis,
        (SELECT COUNT(*)   FROM produk WHERE stok  > 0 AND stok <= 20)              AS produk_stok_menipis,
        (SELECT COUNT(*)   FROM pelanggan)                                          AS total_pelanggan,
        (SELECT COUNT(*)   FROM kategori)                                           AS total_kategori
    `);
    return R.ok(res, stats, 'Ringkasan statistik berhasil diambil');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/penjualan-harian', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT DATE(tanggal_pesan) AS tanggal,
             COUNT(*)            AS jumlah_pesanan,
             SUM(total_harga)    AS total_pendapatan
      FROM pesanan
      WHERE status != 'dibatalkan'
        AND tanggal_pesan >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(tanggal_pesan)
      ORDER BY tanggal ASC
    `);
    return R.ok(res, rows, 'Penjualan harian 30 hari terakhir');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/penjualan-bulanan', async (req, res) => {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const [rows] = await db.execute(`
      SELECT DATE_FORMAT(tanggal_pesan,'%Y-%m') AS bulan,
             DATE_FORMAT(tanggal_pesan,'%M %Y') AS label,
             COUNT(*)                           AS jumlah_pesanan,
             SUM(total_harga)                   AS total_pendapatan,
             AVG(total_harga)                   AS rata_rata
      FROM pesanan
      WHERE status != 'dibatalkan'
        AND YEAR(tanggal_pesan) = ?
      GROUP BY DATE_FORMAT(tanggal_pesan,'%Y-%m')
      ORDER BY bulan ASC
    `, [tahun]);
    return R.ok(res, rows, `Data penjualan bulanan tahun ${tahun}`);
  } catch (e) { return R.serverError(res, e); }
});

router.get('/produk-terlaris', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const [rows] = await db.execute(`
      SELECT pr.id, pr.nama, pr.kode_sku, pr.harga, pr.stok,
             k.nama                        AS kategori,
             COALESCE(SUM(dp.jumlah),  0)  AS total_terjual,
             COALESCE(SUM(dp.subtotal),0)  AS total_pendapatan
      FROM produk pr
      JOIN kategori k ON pr.kategori_id = k.id
      LEFT JOIN detail_pesanan dp ON pr.id = dp.produk_id
      LEFT JOIN pesanan ps ON dp.pesanan_id = ps.id AND ps.status != 'dibatalkan'
      GROUP BY pr.id
      ORDER BY total_terjual DESC
      LIMIT ${limit}
    `);
    return R.ok(res, rows, `Top ${limit} produk terlaris`);
  } catch (e) { return R.serverError(res, e); }
});

router.get('/pelanggan-terbaik', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const [rows] = await db.execute(`
      SELECT pl.id, pl.nama, pl.email, pl.kota, pl.level,
             COUNT(ps.id)                    AS total_pesanan,
             COALESCE(SUM(ps.total_harga),0) AS total_belanja,
             COALESCE(AVG(ps.total_harga),0) AS rata_rata_belanja,
             MAX(ps.tanggal_pesan)           AS transaksi_terakhir
      FROM pelanggan pl
      LEFT JOIN pesanan ps ON pl.id = ps.pelanggan_id AND ps.status != 'dibatalkan'
      GROUP BY pl.id
      ORDER BY total_belanja DESC
      LIMIT ${limit}
    `);
    return R.ok(res, rows, `Top ${limit} pelanggan terbaik`);
  } catch (e) { return R.serverError(res, e); }
});

router.get('/penjualan-per-kategori', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.id, k.nama AS kategori,
             COUNT(DISTINCT pr.id)        AS jumlah_produk,
             COALESCE(SUM(dp.jumlah),  0) AS total_unit_terjual,
             COALESCE(SUM(dp.subtotal),0) AS total_pendapatan
      FROM kategori k
      LEFT JOIN produk pr ON k.id = pr.kategori_id
      LEFT JOIN detail_pesanan dp ON pr.id = dp.produk_id
      LEFT JOIN pesanan ps ON dp.pesanan_id = ps.id AND ps.status != 'dibatalkan'
      GROUP BY k.id
      ORDER BY total_pendapatan DESC
    `);
    return R.ok(res, rows, 'Penjualan per kategori');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/status-pesanan', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT status, COUNT(*) AS jumlah, SUM(total_harga) AS total_nilai
      FROM pesanan
      GROUP BY status
      ORDER BY FIELD(status,'pending','diproses','dikirim','selesai','dibatalkan')
    `);
    const totalPesanan = rows.reduce((s, r) => s + Number(r.jumlah), 0);
    const data = rows.map(r => ({
      ...r,
      persentase: totalPesanan > 0
        ? ((Number(r.jumlah) / totalPesanan) * 100).toFixed(2)
        : '0.00',
    }));
    return R.ok(res, data, 'Distribusi status pesanan');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/metode-pembayaran', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT metode_bayar,
             COUNT(*)         AS jumlah_transaksi,
             SUM(total_harga) AS total_nilai
      FROM pesanan
      WHERE status != 'dibatalkan'
      GROUP BY metode_bayar
      ORDER BY jumlah_transaksi DESC
    `);
    return R.ok(res, rows, 'Statistik metode pembayaran');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/stok-produk', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT pr.id, pr.nama, pr.kode_sku, pr.stok, pr.satuan,
             k.nama AS kategori,
             CASE
               WHEN pr.stok  = 0    THEN 'habis'
               WHEN pr.stok <= 20   THEN 'menipis'
               ELSE                      'aman'
             END AS kondisi_stok
      FROM produk pr
      JOIN kategori k ON pr.kategori_id = k.id
      ORDER BY pr.stok ASC
    `);
    const ringkasan = {
      habis:   rows.filter(r => r.kondisi_stok === 'habis').length,
      menipis: rows.filter(r => r.kondisi_stok === 'menipis').length,
      aman:    rows.filter(r => r.kondisi_stok === 'aman').length,
    };
    return R.ok(res, { ringkasan, produk: rows }, 'Kondisi stok produk');
  } catch (e) { return R.serverError(res, e); }
});

module.exports = router;
