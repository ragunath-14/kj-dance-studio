const Setting = require('../models/Setting');

const CAMP_KEY = 'campRegistrationEnabled';

// Camp registration is OFF until an admin switches it on.
const isCampEnabled = async () => {
  const setting = await Setting.findOne({ key: CAMP_KEY }).lean();
  return setting?.value === true;
};

// ─── GET /api/settings/public  (no auth — the landing page reads this) ───────
exports.getPublicSettings = async (req, res) => {
  try {
    res.json({ campEnabled: await isCampEnabled() });
  } catch (err) {
    console.error('getPublicSettings error:', err);
    res.status(500).json({ message: 'Could not load settings.' });
  }
};

// ─── PUT /api/settings/camp  (admin) — body: { enabled: boolean } ────────────
exports.setCampEnabled = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ message: '"enabled" must be true or false.' });

    await Setting.findOneAndUpdate(
      { key: CAMP_KEY },
      { value: enabled, updatedAt: new Date() },
      { upsert: true }
    );

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'settings' });

    res.json({ campEnabled: enabled });
  } catch (err) {
    console.error('setCampEnabled error:', err);
    res.status(500).json({ message: 'Could not update camp registration setting.' });
  }
};

exports.isCampEnabled = isCampEnabled;
