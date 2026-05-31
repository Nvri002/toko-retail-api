const ok = (res, data, message = 'OK', meta = null) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
};

const created = (res, data, message = 'Data berhasil dibuat') =>
  res.status(201).json({ success: true, message, data });

const badRequest = (res, message = 'Request tidak valid') =>
  res.status(400).json({ success: false, message, data: null });

const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message, data: null });

const forbidden = (res, message = 'Akses ditolak') =>
  res.status(403).json({ success: false, message, data: null });

const notFound = (res, message = 'Data tidak ditemukan') =>
  res.status(404).json({ success: false, message, data: null });

const conflict = (res, message = 'Data sudah ada') =>
  res.status(409).json({ success: false, message, data: null });

const serverError = (res, err) => {
  console.error('[ERROR]', err.message);
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
    error:   process.env.NODE_ENV !== 'production' ? err.message : undefined,
    data:    null,
  });
};

module.exports = { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError };
