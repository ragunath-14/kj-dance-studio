const jwt = require('jsonwebtoken');

// Only tokens signed by this server (HS256) are accepted; never trust the algorithm named in the token itself.
const JWT_OPTIONS = { algorithms: ['HS256'] };

const verifyAdminToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';  // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access Denied: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Socket.io handshake guard: the admin dashboard must present its login token to receive live updates.
const verifySocketToken = (socket, next) => {
  const token = socket.handshake.auth?.token;
  try {
    const decoded = jwt.verify(String(token || ''), process.env.JWT_SECRET, JWT_OPTIONS);
    if (decoded.role !== 'admin') throw new Error('not admin');
    socket.data.admin = decoded;
    next();
  } catch (err) {
    next(new Error('unauthorized'));
  }
};

module.exports = { verifyAdminToken, verifySocketToken, JWT_OPTIONS };
