const mongoose = require('mongoose');

// Generic key/value store for studio-wide switches (e.g. camp registration on/off).
const SettingSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true, trim: true },
  value:     { type: mongoose.Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Setting', SettingSchema, 'settings');
