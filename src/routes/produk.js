const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search     = req.query.search      || '';
    const kategoriId = req.query.kategori_id || '';
    let where = 'WHERE 1=1';
    const params = [];
    if (search)     { where += ' AND (p.nama LIKE ? OR p.kode_sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (kategoriId) { where += ' AND p.kategori_id = ?'; params.push(Number(kategoriId)); }
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM produk p ${where}`, params);
    const [rows] = await db.execute(
      `SELECT p.*, k.nama AS nama_kategori
       FROM produk p JOIN kategori k ON p.kategori_id = k.id
       ${where} ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    return R.ok(res, rows, 'Data produk berhasil diambil', { total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (e) { return R.serverError(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, k.nama AS nama_kategori FROM produk p
       JOIN kategori k ON p.kategori_id = k.id WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Produk tidak ditemukan');
    return R.ok(res, rows[0]);
  } catch (e) { return R.serverError(res, e); }
});

router.post('/', async (req, res) => {
  const { kategori_id, nama, harga, stok, satuan, kode_sku } = req.body;
  if (!kategori_id) return R.badRequest(res, 'Field "kategori_id" wajib diisi');
  if (!nama || !nama.trim()) return R.badRequest(res, 'Field "nama" wajib diisi');
  if (harga === undefined || harga === null || isNaN(Number(harga)) || Number(harga) < 0)
    return R.badRequest(res, 'Field "harga" wajib diisi dan harus >= 0');
  try {
    const [katCek] = await db.execute('SELECT id FROM kategori WHERE id = ?', [kategori_id]);
    if (!katCek.length) return R.notFound(res, 'Kategori tidak ditemukan');
    const [result] = await db.execute(
      'INSERT INTO produk (kategori_id, nama, harga, stok, satuan, kode_sku) VALUES (?,?,?,?,?,?)',
      [Number(kategori_id), nama.trim(), Number(harga), Number(stok)||0, satuan||'pcs', kode_sku||null]);
    const [rows] = await db.execute(
      `SELECT p.*, k.nama AS nama_kategori FROM produk p
       JOIN kategori k ON p.kategori_id = k.id WHERE p.id = ?`, [result.insertId]);
    return R.created(res, rows[0], 'Produk berhasil dibuat');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Kode SKU sudah digunakan');
    return R.serverError(res, e);
  }
});

router.put('/:id', async (req, res) => {
  const { kategori_id, nama, harga, stok, satuan, kode_sku } = req.body;
  if (!kategori_id) return R.badRequest(res, 'Field "kategori_id" wajib diisi');
  if (!nama || !nama.trim()) return R.badRequest(res, 'Field "nama" wajib diisi');
  if (harga === undefined || harga === null || isNaN(Number(harga)) || Number(harga) < 0)
    return R.badRequest(res, 'Field "harga" wajib diisi dan harus >= 0');
  try {
    const [cek] = await db.execute('SELECT id FROM produk WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Produk tidak ditemukan');
    await db.execute(
      'UPDATE produk SET kategori_id=?,nama=?,harga=?,stok=?,satuan=?,kode_sku=? WHERE id=?',
      [Number(kategori_id), nama.trim(), Number(harga), Number(stok)>=0?Number(stok):0, satuan||'pcs', kode_sku||null, req.params.id]);
    const [rows] = await db.execute(
      `SELECT p.*, k.nama AS nama_kategori FROM produk p
       JOIN kategori k ON p.kategori_id = k.id WHERE p.id = ?`, [req.params.id]);
    return R.ok(res, rows[0], 'Produk berhasil diperbarui');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Kode SKU sudah digunakan');
    return R.serverError(res, e);
  }
});

router.patch('/:id/stok', async (req, res) => {
  const { stok } = req.body;
  if (stok === undefined || stok === null || isNaN(Number(stok)) || Number(stok) < 0)
    return R.badRequest(res, 'Field "stok" wajib diisi dan harus >= 0');
  try {
    const [cek] = await db.execute('SELECT id FROM produk WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Produk tidak ditemukan');
    await db.execute('UPDATE produk SET stok = ? WHERE id = ?', [Number(stok), req.params.id]);
    const [rows] = await db.execute('SELECT id, nama, stok, satuan FROM produk WHERE id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Stok berhasil diperbarui');
  } catch (e) { return R.serverError(res, e); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM produk WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Produk tidak ditemukan');
    await db.execute('DELETE FROM produk WHERE id = ?', [req.params.id]);
    return R.ok(res, null, 'Produk berhasil dihapus');
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2')
      return R.badRequest(res, 'Produk tidak bisa dihapus karena sudah ada di detail pesanan');
    return R.serverError(res, e);
  }
});

module.exports = router;
