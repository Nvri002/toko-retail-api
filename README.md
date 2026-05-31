# 🛒 TokoRetail REST API v2.0 — dengan JWT Authentication

REST API sistem manajemen toko retail menggunakan **Node.js + Express.js + MySQL**.  
Dilengkapi autentikasi **JWT (JSON Web Token)** — semua endpoint terlindungi.

---

## 📁 Struktur Project

```
toko-retail-api/
├── app.js                        ← Entry point server
├── package.json
├── .env.example                  ← Template konfigurasi
├── .gitignore
├── README.md
│
├── database/
│   └── toko_retail.sql           ← Import ke phpMyAdmin (6 tabel + seed data)
│
├── src/
│   ├── config/
│   │   └── db.js                 ← Koneksi MySQL pool
│   ├── middleware/
│   │   ├── auth.js               ← JWT verify middleware
│   │   └── response.js           ← Format response standar
│   └── routes/
│       ├── auth.js               ← Login, register, me, change-password
│       ├── kategori.js           ← CRUD Kategori
│       ├── produk.js             ← CRUD Produk
│       ├── pelanggan.js          ← CRUD Pelanggan
│       ├── pesanan.js            ← CRUD Pesanan (transaksi atomik)
│       └── statistik.js          ← 9 endpoint statistik
│
└── docs/
    ├── TokoRetail_API.postman_collection.json    ← Import ke Postman
    └── TokoRetail_API.postman_environment.json   ← Environment Postman
```

---

## 🗄️ Struktur Database (6 Tabel)

| Tabel | Tipe | Keterangan |
|---|---|---|
| `users` | Auth | Username, password (bcrypt), role |
| `kategori` | Master | Kategori produk |
| `produk` | Master | Data produk & stok |
| `pelanggan` | Master | Data pelanggan |
| `pesanan` | Transaksi | Header pesanan |
| `detail_pesanan` | Transaksi | Item tiap pesanan |

**Relasi:**
```
kategori  (1)──(N) produk
pelanggan (1)──(N) pesanan
pesanan   (1)──(N) detail_pesanan
produk    (1)──(N) detail_pesanan
```

---

## 🚀 Cara Menjalankan

### 1. Import Database via phpMyAdmin

1. Buka browser → `http://localhost/phpmyadmin`
2. Klik tab **Import**
3. Klik **Choose File** → pilih `database/toko_retail.sql`
4. Klik **Go**
5. Database `toko_retail` otomatis terbuat dengan 6 tabel + data

### 2. Install Dependencies

```bash
npm install
```

### 3. Buat file .env

```bash
cp .env.example .env
```

Edit `.env` — isi password MySQL:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mysql_kamu
DB_NAME=toko_retail
PORT=3000
JWT_SECRET=ganti_dengan_string_random_panjang_rahasia
JWT_EXPIRES_IN=24h
```

### 4. Jalankan Server

```bash
node app.js
```

Output sukses:
```
✅  Database MySQL terhubung!

╔══════════════════════════════════════════════════╗
║  🚀  Server     →  http://localhost:3000          ║
║  🔐  Login      →  POST /api/auth/login           ║
╚══════════════════════════════════════════════════╝

  Default users (password: password123)
  ├─ admin  (role: admin)
  ├─ staff1 (role: staff)
  └─ staff2 (role: staff)
```

---

## 🔐 Sistem Autentikasi JWT

### Cara Kerja

```
Client                          Server
  │                               │
  │  POST /api/auth/login         │
  │  { username, password }  ───► │ Cek username & password (bcrypt)
  │                               │ Generate JWT Token
  │  { token: "eyJ..." }    ◄───  │
  │                               │
  │  GET /api/produk              │
  │  Authorization: Bearer eyJ... │
  │                          ───► │ Verifikasi token
  │  { data: [...] }        ◄───  │ Kembalikan data
```

### Header yang Harus Disertakan

Setelah login, sertakan token di **setiap request**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Codes Autentikasi

| Kondisi | HTTP | Pesan |
|---|---|---|
| Tanpa header Authorization | 401 | Token tidak ditemukan |
| Format salah (bukan Bearer) | 401 | Format token salah |
| Token palsu / dimanipulasi | 401 | Token tidak valid |
| Token kadaluarsa | 401 | Token sudah kadaluarsa |
| Role tidak cukup (non-admin) | 403 | Akses ditolak |

---

## 🔗 Daftar Endpoint

### Auth (Public — tidak perlu token)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/auth/login` | **Login → dapat token JWT** |

### Auth (Protected — perlu token)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/auth/me` | Info user yang sedang login |
| PATCH | `/api/auth/change-password` | Ganti password sendiri |
| POST | `/api/auth/register` | Daftarkan user baru *(admin only)* |
| GET | `/api/auth/users` | Daftar semua user *(admin only)* |
| PATCH | `/api/auth/users/:id/toggle-active` | Aktif/nonaktif user *(admin only)* |

### Master — Kategori *(semua perlu token)*
| Method | Endpoint |
|---|---|
| GET | `/api/kategori` |
| GET | `/api/kategori/:id` |
| POST | `/api/kategori` |
| PUT | `/api/kategori/:id` |
| DELETE | `/api/kategori/:id` |

### Master — Produk *(semua perlu token)*
| Method | Endpoint |
|---|---|
| GET | `/api/produk` — query: `search`, `kategori_id`, `page`, `limit` |
| GET | `/api/produk/:id` |
| POST | `/api/produk` |
| PUT | `/api/produk/:id` |
| PATCH | `/api/produk/:id/stok` |
| DELETE | `/api/produk/:id` |

### Master — Pelanggan *(semua perlu token)*
| Method | Endpoint |
|---|---|
| GET | `/api/pelanggan` — query: `search`, `level`, `page`, `limit` |
| GET | `/api/pelanggan/:id` |
| GET | `/api/pelanggan/:id/pesanan` |
| POST | `/api/pelanggan` |
| PUT | `/api/pelanggan/:id` |
| DELETE | `/api/pelanggan/:id` |

### Transaksional — Pesanan *(semua perlu token)*
| Method | Endpoint |
|---|---|
| GET | `/api/pesanan` — query: `status`, `pelanggan_id`, `page`, `limit` |
| GET | `/api/pesanan/:id` |
| POST | `/api/pesanan` *(atomik: validasi stok, kurangi stok)* |
| PUT | `/api/pesanan/:id` |
| PATCH | `/api/pesanan/:id/status` |
| DELETE | `/api/pesanan/:id` |

### Statistik *(semua perlu token)*
| Endpoint | Keterangan |
|---|---|
| `GET /api/statistik/ringkasan` | KPI utama |
| `GET /api/statistik/penjualan-harian` | 30 hari terakhir |
| `GET /api/statistik/penjualan-bulanan` | Per bulan (filter `?tahun=`) |
| `GET /api/statistik/produk-terlaris` | Top produk (filter `?limit=`) |
| `GET /api/statistik/pelanggan-terbaik` | Top pelanggan |
| `GET /api/statistik/penjualan-per-kategori` | Per kategori |
| `GET /api/statistik/status-pesanan` | Distribusi + persentase |
| `GET /api/statistik/metode-pembayaran` | Statistik metode bayar |
| `GET /api/statistik/stok-produk` | Kondisi stok (habis/menipis/aman) |

---

## 📋 Format Response

```json
{
  "success": true,
  "message": "Keterangan",
  "data": { ... },
  "meta": { "total": 15, "page": 1, "limit": 10, "total_pages": 2 }
}
```

| HTTP | Kondisi |
|---|---|
| 200 | Berhasil |
| 201 | Data berhasil dibuat |
| 400 | Validasi gagal / stok tidak cukup |
| 401 | Token tidak ada / tidak valid / kadaluarsa |
| 403 | Role tidak cukup |
| 404 | Data tidak ditemukan |
| 409 | Data duplikat |
| 500 | Internal Server Error |

---

## 📮 Postman

### Import Collection

1. Buka **Postman**
2. Klik **Import** → pilih kedua file dari folder `docs/`:
   - `TokoRetail_API.postman_collection.json`
   - `TokoRetail_API.postman_environment.json`
3. Pilih environment **TokoRetail Local** (pojok kanan atas)

### Cara Jalankan

**Otomatis semua (Collection Runner):**
1. Klik kanan **"TokoRetail API v2"** → **Run collection**
2. Jalankan **dari folder [1] ke [6]** secara berurutan
3. Target: **48 passed, 0 failed**

**Manual (urutan wajib):**
```
[1] Login dulu → token tersimpan otomatis
[2] Kategori   → POST dulu (simpan kategori_id)
[3] Produk     → POST dulu (simpan produk_id)
[4] Pelanggan  → POST dulu (simpan pelanggan_id)
[5] Pesanan    → POST dulu (simpan pesanan_id)
[6] Statistik  → bebas urutan
```

---

## 📤 Push ke GitHub

```bash
git init
git add .
git commit -m "feat: TokoRetail REST API v2.0 dengan JWT Auth"
git branch -M main
git remote add origin https://github.com/username/toko-retail-api.git
git push -u origin main
```
