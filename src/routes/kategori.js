const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.id, k.nama, k.deskripsi, k.created_at,
             COUNT(p.id) AS jumlah_produk
      FROM kategori k
      LEFT JOIN produk p ON k.id = p.kategori_id
      GROUP BY k.id ORDER BY k.nama ASC
    `);
    return R.ok(res, rows, 'Data kategori berhasil diambil');
  } catch (e) { return R.serverError(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT k.*, COUNT(p.id) AS jumlah_produk
      FROM kategori k
      LEFT JOIN produk p ON k.id = p.kategori_id
      WHERE k.id = ? GROUP BY k.id
    `, [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Kategori tidak ditemukan');
    return R.ok(res, rows[0]);
  } catch (e) { return R.serverError(res, e); }
});

router.post('/', async (req, res) => {
  const { nama, deskripsi } = req.body;
  if (!nama || !nama.trim()) return R.badRequest(res, 'Field "nama" wajib diisi');
  try {
    const [result] = await db.execute(
      'INSERT INTO kategori (nama, deskripsi) VALUES (?, ?)',
      [nama.trim(), deskripsi || null]
    );
    const [rows] = await db.execute('SELECT * FROM kategori WHERE id = ?', [result.insertId]);
    return R.created(res, rows[0], 'Kategori berhasil dibuat');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Nama kategori sudah digunakan');
    return R.serverError(res, e);
  }
});

router.put('/:id', async (req, res) => {
  const { nama, deskripsi } = req.body;
  if (!nama || !nama.trim()) return R.badRequest(res, 'Field "nama" wajib diisi');
  try {
    const [cek] = await db.execute('SELECT id FROM kategori WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Kategori tidak ditemukan');
    await db.execute('UPDATE kategori SET nama = ?, deskripsi = ? WHERE id = ?',
      [nama.trim(), deskripsi || null, req.params.id]);
    const [rows] = await db.execute('SELECT * FROM kategori WHERE id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Kategori berhasil diperbarui');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Nama kategori sudah digunakan');
    return R.serverError(res, e);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM kategori WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Kategori tidak ditemukan');
    await db.execute('DELETE FROM kategori WHERE id = ?', [req.params.id]);
    return R.ok(res, null, 'Kategori berhasil dihapus');
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2')
      return R.badRequest(res, 'Kategori tidak bisa dihapus karena masih memiliki produk');
    return R.serverError(res, e);
  }
});

module.exports = router;
