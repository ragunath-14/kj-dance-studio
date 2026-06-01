const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyAdminToken: auth } = require('../middleware/auth');

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { adminId, password } = req.body;

    const user = await User.findOne({ username: adminId });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Admin ID or Password' 
      });
    }

    // Check password (handles both hashed and legacy plain text if we want, 
    // but here we assume hashed as per new model)
    const isMatch = await user.comparePassword(password).catch(() => false);
    
    // Fallback for legacy plain text passwords during transition
    const isPlainMatch = user.password === password;

    if (!isMatch && !isPlainMatch) {
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
    res.status(500).json({ success: false, message: err.message });
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
