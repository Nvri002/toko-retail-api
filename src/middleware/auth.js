const jwt = require('jsonwebtoken');
const R   = require('./response');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader) {
    return R.unauthorized(res, 'Token tidak ditemukan. Sertakan header: Authorization: Bearer <token>');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return R.unauthorized(res, 'Format token salah. Gunakan: Authorization: Bearer <token>');
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_default');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return R.unauthorized(res, 'Token sudah kadaluarsa. Silakan login kembali.');
    }
    if (err.name === 'JsonWebTokenError') {
      return R.unauthorized(res, 'Token tidak valid atau telah dimanipulasi.');
    }
    return R.unauthorized(res, 'Token tidak valid.');
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return R.forbidden(res, 'Akses ditolak. Hanya admin yang dapat melakukan aksi ini.');
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
