const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

const VALID_LEVEL = ['regular','silver','gold','platinum'];

router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const level  = req.query.level  || '';
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (p.nama LIKE ? OR p.email LIKE ? OR p.telepon LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    if (level)  {
      if (!VALID_LEVEL.includes(level)) return R.badRequest(res, `Level tidak valid. Pilihan: ${VALID_LEVEL.join(', ')}`);
      where += ' AND p.level = ?'; params.push(level);
    }
    const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM pelanggan p ${where}`, params);
    const [rows] = await db.execute(
      `SELECT p.*, COUNT(ps.id) AS total_pesanan, COALESCE(SUM(ps.total_harga),0) AS total_belanja
       FROM pelanggan p
       LEFT JOIN pesanan ps ON p.id = ps.pelanggan_id AND ps.status != 'dibatalkan'
       ${where} GROUP BY p.id ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    return R.ok(res, rows, 'Data pelanggan berhasil diambil', { total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (e) { return R.serverError(res, e); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM pelanggan WHERE id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Pelanggan tidak ditemukan');
    return R.ok(res, rows[0]);
  } catch (e) { return R.serverError(res, e); }
});

router.get('/:id/pesanan', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM pelanggan WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Pelanggan tidak ditemukan');
    const [rows] = await db.execute(
      `SELECT ps.id, ps.kode_pesanan, ps.tanggal_pesan, ps.total_harga,
              ps.status, ps.metode_bayar, ps.catatan, COUNT(dp.id) AS jumlah_item
       FROM pesanan ps LEFT JOIN detail_pesanan dp ON ps.id = dp.pesanan_id
       WHERE ps.pelanggan_id = ? GROUP BY ps.id ORDER BY ps.tanggal_pesan DESC`, [req.params.id]);
    return R.ok(res, rows, `Riwayat pesanan pelanggan ID ${req.params.id}`);
  } catch (e) { return R.serverError(res, e); }
});

router.post('/', async (req, res) => {
  const { nama, email, telepon, alamat, kota, level } = req.body;
  if (!nama  || !nama.trim())  return R.badRequest(res, 'Field "nama" wajib diisi');
  if (!email || !email.trim()) return R.badRequest(res, 'Field "email" wajib diisi');
  if (level && !VALID_LEVEL.includes(level)) return R.badRequest(res, `Level tidak valid. Pilihan: ${VALID_LEVEL.join(', ')}`);
  try {
    const [result] = await db.execute(
      'INSERT INTO pelanggan (nama, email, telepon, alamat, kota, level) VALUES (?,?,?,?,?,?)',
      [nama.trim(), email.trim().toLowerCase(), telepon||null, alamat||null, kota||null, level||'regular']);
    const [rows] = await db.execute('SELECT * FROM pelanggan WHERE id = ?', [result.insertId]);
    return R.created(res, rows[0], 'Pelanggan berhasil dibuat');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Email sudah terdaftar');
    return R.serverError(res, e);
  }
});

router.put('/:id', async (req, res) => {
  const { nama, email, telepon, alamat, kota, level } = req.body;
  if (!nama  || !nama.trim())  return R.badRequest(res, 'Field "nama" wajib diisi');
  if (!email || !email.trim()) return R.badRequest(res, 'Field "email" wajib diisi');
  if (level && !VALID_LEVEL.includes(level)) return R.badRequest(res, `Level tidak valid. Pilihan: ${VALID_LEVEL.join(', ')}`);
  try {
    const [cek] = await db.execute('SELECT id FROM pelanggan WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Pelanggan tidak ditemukan');
    await db.execute(
      'UPDATE pelanggan SET nama=?,email=?,telepon=?,alamat=?,kota=?,level=? WHERE id=?',
      [nama.trim(), email.trim().toLowerCase(), telepon||null, alamat||null, kota||null, level||'regular', req.params.id]);
    const [rows] = await db.execute('SELECT * FROM pelanggan WHERE id = ?', [req.params.id]);
    return R.ok(res, rows[0], 'Pelanggan berhasil diperbarui');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Email sudah digunakan pelanggan lain');
    return R.serverError(res, e);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [cek] = await db.execute('SELECT id FROM pelanggan WHERE id = ?', [req.params.id]);
    if (!cek.length) return R.notFound(res, 'Pelanggan tidak ditemukan');
    await db.execute('DELETE FROM pelanggan WHERE id = ?', [req.params.id]);
    return R.ok(res, null, 'Pelanggan berhasil dihapus');
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2')
      return R.badRequest(res, 'Pelanggan tidak bisa dihapus karena memiliki riwayat pesanan');
    return R.serverError(res, e);
  }
});

module.exports = router;
