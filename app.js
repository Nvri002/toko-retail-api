require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const { verifyToken } = require('./src/middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware global ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Public route (tidak perlu token) ────────────────────────
app.use('/api/auth', require('./src/routes/auth'));

// ── Protected routes (wajib token) ──────────────────────────
// semua route di bawah ini melewati verifyToken terlebih dahulu
app.use('/api/kategori',  verifyToken, require('./src/routes/kategori'));
app.use('/api/produk',    verifyToken, require('./src/routes/produk'));
app.use('/api/pelanggan', verifyToken, require('./src/routes/pelanggan'));
app.use('/api/pesanan',   verifyToken, require('./src/routes/pesanan'));
app.use('/api/statistik', verifyToken, require('./src/routes/statistik'));

// ── Root info ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TokoRetail REST API v2.0 — dengan JWT Authentication',
    catatan: 'Semua endpoint /api/* memerlukan token. Dapatkan token via POST /api/auth/login',
    auth_endpoints: {
      'POST /api/auth/login':                  'Login → dapat token JWT  [PUBLIC]',
      'GET  /api/auth/me':                     'Info user yg login       [TOKEN]',
      'POST /api/auth/register':               'Daftar user baru         [TOKEN + ADMIN]',
      'PATCH /api/auth/change-password':       'Ganti password sendiri   [TOKEN]',
      'GET  /api/auth/users':                  'Daftar semua user        [TOKEN + ADMIN]',
      'PATCH /api/auth/users/:id/toggle-active':'Aktif/nonaktif user     [TOKEN + ADMIN]',
    },
    protected_endpoints: {
      kategori:  'GET|POST /api/kategori  •  GET|PUT|DELETE /api/kategori/:id',
      produk:    'GET|POST /api/produk    •  GET|PUT|DELETE /api/produk/:id  •  PATCH /api/produk/:id/stok',
      pelanggan: 'GET|POST /api/pelanggan •  GET|PUT|DELETE /api/pelanggan/:id  •  GET /api/pelanggan/:id/pesanan',
      pesanan:   'GET|POST /api/pesanan   •  GET|PUT|DELETE /api/pesanan/:id  •  PATCH /api/pesanan/:id/status',
      statistik: [
        'GET /api/statistik/ringkasan',
        'GET /api/statistik/penjualan-harian',
        'GET /api/statistik/penjualan-bulanan',
        'GET /api/statistik/produk-terlaris',
        'GET /api/statistik/pelanggan-terbaik',
        'GET /api/statistik/penjualan-per-kategori',
        'GET /api/statistik/status-pesanan',
        'GET /api/statistik/metode-pembayaran',
        'GET /api/statistik/stok-produk',
      ],
    },
  });
});

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} tidak ditemukan`,
    data: null,
  });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    data: null,
  });
});

// ── Start server ─────────────────────────────────────────────
const pool = require('./src/config/db');
pool.getConnection()
  .then(conn => {
    conn.release();
    console.log('✅  Database MySQL terhubung!');
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log(`║  🚀  Server     →  http://localhost:${PORT}          ║`);
      console.log(`║  🔐  Login      →  POST /api/auth/login            ║`);
      console.log(`║  📖  Info API   →  GET  /                          ║`);
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
      console.log('  Default users (password: password123)');
      console.log('  ├─ admin  (role: admin)');
      console.log('  ├─ staff1 (role: staff)');
      console.log('  └─ staff2 (role: staff)');
      console.log('');
    });
  })
  .catch(err => {
    console.error('❌  Gagal koneksi database:', err.message);
    console.error('    → Cek file .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1);
  });
