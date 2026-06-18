const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

// GET /api/produk
router.get('/', async (req, res) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page)  || 1);
    const limit      = Math.min(100, parseInt(req.query.limit) || 10);
    const offset     = (page - 1) * limit;
    const search     = req.query.search     || '';
    const kategoriId = req.query.kategori_id || '';

    let where = 'WHERE 1=1';
    const params = [];
    if (search)     { where += ' AND (pr.nama LIKE ? OR pr.kode_sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (kategoriId) { where += ' AND pr.kategori_id = ?'; params.push(Number(kategoriId)); }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM produk pr ${where}`, params
    );
    const [rows] = await db.execute(
      `SELECT pr.*, k.nama AS nama_kategori
       FROM produk pr
       LEFT JOIN kategori k ON pr.kategori_id = k.id
       ${where}
       ORDER BY pr.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return R.ok(res, rows, 'Data produk berhasil diambil', {
      total, page, limit, total_pages: Math.ceil(total / limit),
    });
  } catch (e) { return R.serverError(res, e); }
});

// GET /api/produk/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pr.*, k.nama AS nama_kategori
       FROM produk pr LEFT JOIN kategori k ON pr.kategori_id = k.id
       WHERE pr.id = ?`, [req.params.id]
    );
    if (!rows.length) return R.notFound(res, 'Produk tidak ditemukan');
    return R.ok(res, rows[0]);
  } catch (e) { return R.serverError(res, e); }
});

// POST /api/produk
router.post('/', async (req, res) => {
  try {
    const { nama, kode_sku, kategori_id, harga, stok, satuan } = req.body;
    if (!nama)        return R.badRequest(res, 'Field "nama" wajib diisi');
    if (!harga)       return R.badRequest(res, 'Field "harga" wajib diisi');
    if (!kategori_id) return R.badRequest(res, 'Field "kategori_id" wajib diisi');

    const [result] = await db.execute(
      `INSERT INTO produk (nama, kode_sku, kategori_id, harga, stok, satuan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nama, kode_sku || null, Number(kategori_id), Number(harga), Number(stok) || 0, satuan || 'pcs']
    );
    const [[produk]] = await db.execute(
      `SELECT pr.*, k.nama AS nama_kategori FROM produk pr
       LEFT JOIN kategori k ON pr.kategori_id = k.id WHERE pr.id = ?`, [result.insertId]
    );
    return R.created(res, produk, 'Produk berhasil ditambahkan');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Kode SKU sudah digunakan');
    return R.serverError(res, e);
  }
});

// PUT /api/produk/:id
router.put('/:id', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM produk WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Produk tidak ditemukan');

    const { nama, kode_sku, kategori_id, harga, stok, satuan } = req.body;
    await db.execute(
      `UPDATE produk SET nama=?, kode_sku=?, kategori_id=?, harga=?, stok=?, satuan=? WHERE id=?`,
      [nama, kode_sku || null, Number(kategori_id), Number(harga), Number(stok) || 0, satuan || 'pcs', req.params.id]
    );
    const [[produk]] = await db.execute(
      `SELECT pr.*, k.nama AS nama_kategori FROM produk pr
       LEFT JOIN kategori k ON pr.kategori_id = k.id WHERE pr.id = ?`, [req.params.id]
    );
    return R.ok(res, produk, 'Produk berhasil diperbarui');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Kode SKU sudah digunakan');
    return R.serverError(res, e);
  }
});

// PATCH /api/produk/:id/stok
router.patch('/:id/stok', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM produk WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Produk tidak ditemukan');
    const { stok } = req.body;
    if (stok === undefined || stok === null) return R.badRequest(res, 'Field "stok" wajib diisi');
    await db.execute('UPDATE produk SET stok = ? WHERE id = ?', [Number(stok), req.params.id]);
    const [[produk]] = await db.execute('SELECT * FROM produk WHERE id = ?', [req.params.id]);
    return R.ok(res, produk, 'Stok berhasil diperbarui');
  } catch (e) { return R.serverError(res, e); }
});

// DELETE /api/produk/:id
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[produk]] = await conn.execute('SELECT id, nama FROM produk WHERE id = ?', [req.params.id]);
    if (!produk) {
      await conn.rollback(); conn.release();
      return R.notFound(res, 'Produk tidak ditemukan');
    }

    // Cek apakah produk ini ada di pesanan yang statusnya BUKAN dibatalkan
    const [[{ aktif }]] = await conn.execute(
      `SELECT COUNT(*) AS aktif
       FROM detail_pesanan dp
       JOIN pesanan ps ON dp.pesanan_id = ps.id
       WHERE dp.produk_id = ? AND ps.status != 'dibatalkan'`,
      [req.params.id]
    );

    if (aktif > 0) {
      await conn.rollback(); conn.release();
      return R.badRequest(res,
        `Produk "${produk.nama}" tidak bisa dihapus karena masih ada di ${aktif} pesanan aktif. Batalkan pesanan tersebut terlebih dahulu.`
      );
    }

    // Hapus detail_pesanan dari pesanan yang sudah dibatalkan dulu
    // supaya foreign key constraint tidak blocking DELETE produk
    await conn.execute(
      `DELETE dp FROM detail_pesanan dp
       JOIN pesanan ps ON dp.pesanan_id = ps.id
       WHERE dp.produk_id = ? AND ps.status = 'dibatalkan'`,
      [req.params.id]
    );

    // Baru hapus produk
    await conn.execute('DELETE FROM produk WHERE id = ?', [req.params.id]);
    await conn.commit();
    conn.release();

    return R.ok(res, null, `Produk "${produk.nama}" berhasil dihapus`);
  } catch (e) {
    await conn.rollback(); conn.release();
    return R.serverError(res, e);
  }
});

module.exports = router;
