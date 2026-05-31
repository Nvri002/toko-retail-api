const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const R       = require('../middleware/response');
const { verifyToken, requireAdmin } = require('../middleware/auth');

/* ── POST /api/auth/login ──────────────────────────────────
   Public endpoint — tidak perlu token
   Body: { username, password }
   Response: { token, expires_in, user: {...} }
────────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Validasi input
  if (!username || !username.trim())
    return R.badRequest(res, 'Field "username" wajib diisi');
  if (!password || !password.trim())
    return R.badRequest(res, 'Field "password" wajib diisi');

  try {
    // Cari user berdasarkan username
    const [rows] = await db.execute(
      'SELECT id, nama, username, password, role, is_active FROM users WHERE username = ?',
      [username.trim().toLowerCase()]
    );

    if (!rows.length) {
      return R.unauthorized(res, 'Username atau password salah');
    }

    const user = rows[0];

    // Cek apakah akun aktif
    if (!user.is_active) {
      return R.unauthorized(res, 'Akun Anda telah dinonaktifkan. Hubungi administrator.');
    }

    // Verifikasi password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return R.unauthorized(res, 'Username atau password salah');
    }

    // Buat JWT token
    const secret     = process.env.JWT_SECRET    || 'secret_key_default';
    const expiresIn  = process.env.JWT_EXPIRES_IN || '24h';

    const payload = {
      id:       user.id,
      username: user.username,
      nama:     user.nama,
      role:     user.role,
    };

    const token = jwt.sign(payload, secret, { expiresIn });

    // Decode untuk ambil waktu expire
    const decoded   = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000).toISOString();

    return R.ok(res, {
      token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      user: {
        id:       user.id,
        nama:     user.nama,
        username: user.username,
        role:     user.role,
      },
    }, 'Login berhasil');

  } catch (e) { return R.serverError(res, e); }
});

/* ── GET /api/auth/me ──────────────────────────────────────
   Protected — perlu token
   Menampilkan data user yang sedang login
────────────────────────────────────────────────────────── */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, nama, username, role, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return R.notFound(res, 'User tidak ditemukan');
    return R.ok(res, rows[0], 'Data user berhasil diambil');
  } catch (e) { return R.serverError(res, e); }
});

/* ── POST /api/auth/register ───────────────────────────────
   Protected — hanya admin yang bisa mendaftarkan user baru
   Body: { nama, username, password, role }
────────────────────────────────────────────────────────── */
router.post('/register', verifyToken, requireAdmin, async (req, res) => {
  const { nama, username, password, role } = req.body;

  if (!nama     || !nama.trim())     return R.badRequest(res, 'Field "nama" wajib diisi');
  if (!username || !username.trim()) return R.badRequest(res, 'Field "username" wajib diisi');
  if (!password || password.length < 6)
    return R.badRequest(res, 'Field "password" minimal 6 karakter');
  if (role && !['admin', 'staff'].includes(role))
    return R.badRequest(res, 'Role harus "admin" atau "staff"');

  try {
    // Cek username sudah ada
    const [cek] = await db.execute(
      'SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]
    );
    if (cek.length) return R.conflict(res, 'Username sudah digunakan');

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      'INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)',
      [nama.trim(), username.trim().toLowerCase(), hashed, role || 'staff']
    );

    const [rows] = await db.execute(
      'SELECT id, nama, username, role, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    return R.created(res, rows[0], 'User berhasil didaftarkan');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return R.conflict(res, 'Username sudah digunakan');
    return R.serverError(res, e);
  }
});

/* ── PATCH /api/auth/change-password ───────────────────────
   Protected — user hanya bisa ganti password sendiri
   Body: { password_lama, password_baru }
────────────────────────────────────────────────────────── */
router.patch('/change-password', verifyToken, async (req, res) => {
  const { password_lama, password_baru } = req.body;

  if (!password_lama) return R.badRequest(res, 'Field "password_lama" wajib diisi');
  if (!password_baru || password_baru.length < 6)
    return R.badRequest(res, 'Field "password_baru" minimal 6 karakter');

  try {
    const [rows] = await db.execute(
      'SELECT id, password FROM users WHERE id = ?', [req.user.id]
    );
    if (!rows.length) return R.notFound(res, 'User tidak ditemukan');

    const valid = await bcrypt.compare(password_lama, rows[0].password);
    if (!valid) return R.badRequest(res, 'Password lama tidak sesuai');

    const hashed = await bcrypt.hash(password_baru, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    return R.ok(res, null, 'Password berhasil diperbarui. Silakan login kembali dengan password baru.');
  } catch (e) { return R.serverError(res, e); }
});

/* ── GET /api/auth/users ───────────────────────────────────
   Protected — hanya admin
   Daftar semua user (tanpa password)
────────────────────────────────────────────────────────── */
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, nama, username, role, is_active, created_at, updated_at FROM users ORDER BY id'
    );
    return R.ok(res, rows, 'Daftar user berhasil diambil');
  } catch (e) { return R.serverError(res, e); }
});

/* ── PATCH /api/auth/users/:id/toggle-active ───────────────
   Protected — hanya admin
   Aktifkan / nonaktifkan akun user
────────────────────────────────────────────────────────── */
router.patch('/users/:id/toggle-active', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username, is_active FROM users WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return R.notFound(res, 'User tidak ditemukan');
    if (rows[0].id === req.user.id)
      return R.badRequest(res, 'Tidak bisa menonaktifkan akun sendiri');

    const newStatus = rows[0].is_active ? 0 : 1;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    return R.ok(res, {
      id:        rows[0].id,
      username:  rows[0].username,
      is_active: Boolean(newStatus),
    }, `Akun berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
  } catch (e) { return R.serverError(res, e); }
});

module.exports = router;
