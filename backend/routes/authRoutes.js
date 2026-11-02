const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { verifyAdminToken: auth } = require('../middleware/auth');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const BCRYPT_HASH =/^\$2[aby]\$\d{2}\$.{53}$/;

// Constant-time string comparison (does not leak how many characters matched)
const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { adminId, password } = req.body || {};

    // Only plain text is accepted: an object here (e.g. {"$ne": null}) would be read by Mongo as a query operator
    if (typeof adminId !== 'string' || typeof password !== 'string' || !adminId || !password) {
      return res.status(401).json({ success: false, message: 'Invalid Admin ID or Password' });
    }

    const user = await User.findOne({ username: adminId.trim() });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);   // same work as a real check, so timing does not reveal which ids exist
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin ID or Password'
      });
    }

    let isMatch = false;
    if (BCRYPT_HASH.test(user.password)) {
      isMatch = await user.comparePassword(password).catch(() => false);
    } else if (safeEqual(user.password, password)) {
      // Old account saved before passwords were hashed: let them in once, then store it hashed.
      // (A stored hash is never accepted as the password itself.)
      isMatch = true;
      await User.updateOne({ _id: user._id }, { password: await bcrypt.hash(password, 10) });
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Admin ID or Password'
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      success: true, 
      message: 'Login successful',
      token,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// @route   GET api/auth/verify
// @desc    Verify if token is valid
router.get('/verify', auth, (req, res) => {
  res.json({
    success: true,
    user: req.admin
  });
});

module.exports = router;
