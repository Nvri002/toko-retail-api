const router = require('express').Router();
const db = require('../config/db');
const R  = require('../middleware/response');

const VALID_STATUS = ['pending','diproses','dikirim','selesai','dibatalkan'];
const VALID_BAYAR  = ['tunai','transfer','qris','kartu_kredit'];

// Helper: validasi ID harus integer murni — fix bug "12fjdifnasodjjf" → 12
function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

router.get('/', async (req, res) => {
  try {
    const page        = Math.max(1, parseInt(req.query.page)   || 1);
    const limit       = Math.min(100, parseInt(req.query.limit) || 10);
    const offset      = (page - 1) * limit;
    const status      = req.query.status       || '';
    const pelangganId = req.query.pelanggan_id || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      if (!VALID_STATUS.includes(status))
        return R.badRequest(res, `Status tidak valid. Pilihan: ${VALID_STATUS.join(', ')}`);
      where += ' AND ps.status = ?';
      params.push(status);
    }
    if (pelangganId) {
      where += ' AND ps.pelanggan_id = ?';
      params.push(Number(pelangganId));
    }

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM pesanan ps ${where}`, params
    );

    const [rows] = await db.execute(
      `SELECT ps.*,
              pl.nama  AS nama_pelanggan,
              pl.email AS email_pelanggan,
              pl.kota, pl.level,
              COUNT(dp.id) AS jumlah_item
       FROM pesanan ps
       JOIN pelanggan pl ON ps.pelanggan_id = pl.id
       LEFT JOIN detail_pesanan dp ON ps.id = dp.pesanan_id
       ${where}
       GROUP BY ps.id
       ORDER BY ps.tanggal_pesan DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return R.ok(res, rows, 'Data pesanan berhasil diambil', {
      total, page, limit, total_pages: Math.ceil(total / limit),
    });
  } catch (e) { return R.serverError(res, e); }
});

// GET /:id — FIX BUG 1: validasi ID integer murni sebelum query
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return R.notFound(res, 'Pesanan tidak ditemukan');

  try {
    const [psRows] = await db.execute(
      `SELECT ps.*,
              pl.nama AS nama_pelanggan, pl.email AS email_pelanggan,
              pl.telepon, pl.kota, pl.level
       FROM pesanan ps
       JOIN pelanggan pl ON ps.pelanggan_id = pl.id
       WHERE ps.id = ?`,
      [id]
    );
    if (!psRows.length) return R.notFound(res, 'Pesanan tidak ditemukan');

    const [items] = await db.execute(
      `SELECT dp.id, dp.produk_id, dp.jumlah, dp.harga_satuan, dp.subtotal,
              pr.nama AS nama_produk, pr.kode_sku, k.nama AS kategori
       FROM detail_pesanan dp
       JOIN produk   pr ON dp.produk_id    = pr.id
       JOIN kategori k  ON pr.kategori_id  = k.id
       WHERE dp.pesanan_id = ?`,
      [id]
    );

    return R.ok(res, { pesanan: psRows[0], items });
  } catch (e) { return R.serverError(res, e); }
});

router.post('/', async (req, res) => {
  const { pelanggan_id, metode_bayar, catatan, items } = req.body;

  if (!pelanggan_id)
    return R.badRequest(res, 'Field "pelanggan_id" wajib diisi');
  if (!Array.isArray(items) || items.length === 0)
    return R.badRequest(res, 'Field "items" wajib diisi dan tidak boleh kosong');
  if (metode_bayar && !VALID_BAYAR.includes(metode_bayar))
    return R.badRequest(res, `Metode bayar tidak valid. Pilihan: ${VALID_BAYAR.join(', ')}`);

  for (let i = 0; i < items.length; i++) {
    if (!items[i].produk_id)
      return R.badRequest(res, `Item ke-${i + 1}: field "produk_id" wajib diisi`);
    if (!items[i].jumlah || Number(items[i].jumlah) < 1)
      return R.badRequest(res, `Item ke-${i + 1}: field "jumlah" harus >= 1`);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pelanggan]] = await conn.execute(
      'SELECT id FROM pelanggan WHERE id = ?', [Number(pelanggan_id)]
    );
    if (!pelanggan) {
      await conn.rollback(); conn.release();
      return R.notFound(res, 'Pelanggan tidak ditemukan');
    }

    let totalHarga = 0;
    const enrichedItems = [];

    for (const item of items) {
      const [[produk]] = await conn.execute(
        'SELECT id, nama, harga, stok FROM produk WHERE id = ?', [Number(item.produk_id)]
      );
      if (!produk) {
        await conn.rollback(); conn.release();
        return R.notFound(res, `Produk ID ${item.produk_id} tidak ditemukan`);
      }
      if (produk.stok < Number(item.jumlah)) {
        await conn.rollback(); conn.release();
        return R.badRequest(res,
          `Stok produk "${produk.nama}" tidak mencukupi. Stok tersedia: ${produk.stok}`
        );
      }
      totalHarga += Number(produk.harga) * Number(item.jumlah);
      enrichedItems.push({
        produk_id:    Number(item.produk_id),
        jumlah:       Number(item.jumlah),
        harga_satuan: Number(produk.harga),
      });
    }

    const [[{ lastId }]] = await conn.execute(
      'SELECT COALESCE(MAX(id), 0) AS lastId FROM pesanan'
    );
    const kode = `ORD-${new Date().getFullYear()}-${String(lastId + 1).padStart(4, '0')}`;

    const [result] = await conn.execute(
      `INSERT INTO pesanan (pelanggan_id, kode_pesanan, total_harga, metode_bayar, catatan)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(pelanggan_id), kode, totalHarga, metode_bayar || 'tunai', catatan || null]
    );
    const pesananId = result.insertId;

    for (const item of enrichedItems) {
      await conn.execute(
        `INSERT INTO detail_pesanan (pesanan_id, produk_id, jumlah, harga_satuan)
         VALUES (?, ?, ?, ?)`,
        [pesananId, item.produk_id, item.jumlah, item.harga_satuan]
      );
      await conn.execute(
        'UPDATE produk SET stok = stok - ? WHERE id = ?',
        [item.jumlah, item.produk_id]
      );
    }

    await conn.commit();

    const [[pesanan]] = await conn.execute(
      `SELECT ps.*, pl.nama AS nama_pelanggan
       FROM pesanan ps JOIN pelanggan pl ON ps.pelanggan_id = pl.id
       WHERE ps.id = ?`, [pesananId]
    );
    const [itemsResult] = await conn.execute(
      `SELECT dp.*, pr.nama AS nama_produk, pr.kode_sku
       FROM detail_pesanan dp JOIN produk pr ON dp.produk_id = pr.id
       WHERE dp.pesanan_id = ?`, [pesananId]
    );

    conn.release();
    return R.created(res, { pesanan, items: itemsResult }, 'Pesanan berhasil dibuat');

  } catch (e) {
    await conn.rollback(); conn.release();
    return R.serverError(res, e);
  }
});

// PUT /:id — FIX BUG 1 (validasi ID) + FIX BUG 2 (restore stok saat dibatalkan)
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return R.notFound(res, 'Pesanan tidak ditemukan');

  const { metode_bayar, catatan, status } = req.body;

  if (status       && !VALID_STATUS.includes(status))
    return R.badRequest(res, `Status tidak valid. Pilihan: ${VALID_STATUS.join(', ')}`);
  if (metode_bayar && !VALID_BAYAR.includes(metode_bayar))
    return R.badRequest(res, `Metode bayar tidak valid. Pilihan: ${VALID_BAYAR.join(', ')}`);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pesanan]] = await conn.execute(
      'SELECT id, status FROM pesanan WHERE id = ?', [id]
    );
    if (!pesanan) {
      await conn.rollback(); conn.release();
      return R.notFound(res, 'Pesanan tidak ditemukan');
    }

    // FIX BUG 2: jika status berubah ke 'dibatalkan', restore stok semua item
    if (status === 'dibatalkan' && pesanan.status !== 'dibatalkan') {
      const [items] = await conn.execute(
        'SELECT produk_id, jumlah FROM detail_pesanan WHERE pesanan_id = ?', [id]
      );
      for (const item of items) {
        await conn.execute(
          'UPDATE produk SET stok = stok + ? WHERE id = ?',
          [item.jumlah, item.produk_id]
        );
      }
    }

    // Jika status dari 'dibatalkan' kembali ke status lain, kurangi stok lagi
    if (pesanan.status === 'dibatalkan' && status && status !== 'dibatalkan') {
      const [items] = await conn.execute(
        'SELECT produk_id, jumlah FROM detail_pesanan WHERE pesanan_id = ?', [id]
      );
      for (const item of items) {
        const [[produk]] = await conn.execute(
          'SELECT stok FROM produk WHERE id = ?', [item.produk_id]
        );
        if (produk.stok < item.jumlah) {
          await conn.rollback(); conn.release();
          return R.badRequest(res,
            `Stok tidak mencukupi untuk reaktivasi pesanan ini`
          );
        }
        await conn.execute(
          'UPDATE produk SET stok = stok - ? WHERE id = ?',
          [item.jumlah, item.produk_id]
        );
      }
    }

    const sets   = [];
    const params = [];
    if (metode_bayar !== undefined) { sets.push('metode_bayar = ?'); params.push(metode_bayar); }
    if (catatan      !== undefined) { sets.push('catatan = ?');      params.push(catatan || null); }
    if (status       !== undefined) { sets.push('status = ?');       params.push(status); }

    if (sets.length === 0) {
      await conn.rollback(); conn.release();
      return R.badRequest(res, 'Tidak ada field yang dikirim untuk diperbarui');
    }

    params.push(id);
    await conn.execute(`UPDATE pesanan SET ${sets.join(', ')} WHERE id = ?`, params);
    await conn.commit();

    const [[rows]] = await conn.execute(
      `SELECT ps.*, pl.nama AS nama_pelanggan
       FROM pesanan ps JOIN pelanggan pl ON ps.pelanggan_id = pl.id
       WHERE ps.id = ?`, [id]
    );
    conn.release();
    return R.ok(res, rows, 'Pesanan berhasil diperbarui');
  } catch (e) {
    await conn.rollback(); conn.release();
    return R.serverError(res, e);
  }
});

// PATCH /:id/status — FIX BUG 1 (validasi ID) + FIX BUG 2 (restore stok saat dibatalkan)
router.patch('/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return R.notFound(res, 'Pesanan tidak ditemukan');

  const { status } = req.body;
  if (!status)
    return R.badRequest(res, 'Field "status" wajib diisi');
  if (!VALID_STATUS.includes(status))
    return R.badRequest(res, `Status tidak valid. Pilihan: ${VALID_STATUS.join(', ')}`);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pesanan]] = await conn.execute(
      'SELECT id, status FROM pesanan WHERE id = ?', [id]
    );
    if (!pesanan) {
      await conn.rollback(); conn.release();
      return R.notFound(res, 'Pesanan tidak ditemukan');
    }

    // Tidak ada perubahan status
    if (pesanan.status === status) {
      await conn.rollback(); conn.release();
      return R.ok(res, { id, status }, `Status pesanan sudah "${status}"`);
    }

    // FIX BUG 2: restore stok jika diubah ke 'dibatalkan'
    if (status === 'dibatalkan' && pesanan.status !== 'dibatalkan') {
      const [items] = await conn.execute(
        'SELECT produk_id, jumlah FROM detail_pesanan WHERE pesanan_id = ?', [id]
      );
      for (const item of items) {
        await conn.execute(
          'UPDATE produk SET stok = stok + ? WHERE id = ?',
          [item.jumlah, item.produk_id]
        );
      }
    }

    // Jika reaktivasi dari 'dibatalkan', kurangi stok lagi (cek dulu kecukupan)
    if (pesanan.status === 'dibatalkan' && status !== 'dibatalkan') {
      const [items] = await conn.execute(
        'SELECT dp.produk_id, dp.jumlah, pr.stok, pr.nama FROM detail_pesanan dp JOIN produk pr ON dp.produk_id = pr.id WHERE dp.pesanan_id = ?',
        [id]
      );
      for (const item of items) {
        if (item.stok < item.jumlah) {
          await conn.rollback(); conn.release();
          return R.badRequest(res,
            `Stok "${item.nama}" tidak mencukupi untuk reaktivasi pesanan (tersedia: ${item.stok})`
          );
        }
        await conn.execute(
          'UPDATE produk SET stok = stok - ? WHERE id = ?',
          [item.jumlah, item.produk_id]
        );
      }
    }

    await conn.execute('UPDATE pesanan SET status = ? WHERE id = ?', [status, id]);
    await conn.commit();

    const [[rows]] = await conn.execute(
      'SELECT id, kode_pesanan, status, total_harga FROM pesanan WHERE id = ?', [id]
    );
    conn.release();
    return R.ok(res, rows, 'Status pesanan berhasil diperbarui');
  } catch (e) {
    await conn.rollback(); conn.release();
    return R.serverError(res, e);
  }
});

// DELETE /:id — FIX BUG 1 (validasi ID)
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return R.notFound(res, 'Pesanan tidak ditemukan');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[pesanan]] = await conn.execute(
      'SELECT id, status FROM pesanan WHERE id = ?', [id]
    );
    if (!pesanan) {
      await conn.rollback(); conn.release();
      return R.notFound(res, 'Pesanan tidak ditemukan');
    }

    // Jika pesanan belum dibatalkan, restore stok sebelum hapus
    if (pesanan.status !== 'dibatalkan') {
      const [items] = await conn.execute(
        'SELECT produk_id, jumlah FROM detail_pesanan WHERE pesanan_id = ?', [id]
      );
      for (const item of items) {
        await conn.execute(
          'UPDATE produk SET stok = stok + ? WHERE id = ?',
          [item.jumlah, item.produk_id]
        );
      }
    }

    // detail_pesanan ikut terhapus via ON DELETE CASCADE
    await conn.execute('DELETE FROM pesanan WHERE id = ?', [id]);
    await conn.commit();
    conn.release();
    return R.ok(res, null, 'Pesanan berhasil dihapus');
  } catch (e) {
    await conn.rollback(); conn.release();
    return R.serverError(res, e);
  }
});

module.exports = router;
