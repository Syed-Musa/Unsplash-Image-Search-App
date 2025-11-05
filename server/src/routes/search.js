const express = require('express');
const Search = require('../models/Search');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/search { term }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { term } = req.body;
    if (!term || typeof term !== 'string') return res.status(400).json({ message: 'term is required' });

    const doc = new Search({ user: req.user.id, term });
    await doc.save();

    res.status(201).json({ ok: true, search: { id: doc._id, term: doc.term, createdAt: doc.createdAt } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Optional: GET /api/search/history -> returns user's search history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const rows = await Search.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.json({ ok: true, history: rows.map(r => ({ id: r._id, term: r.term, createdAt: r.createdAt })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/search -> paginated history with optional q filter (returns same data shape)
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const q = (req.query.q || '').trim();

    const filter = { user: req.user.id };
    if (q) filter.term = { $regex: q, $options: 'i' };

    const total = await Search.countDocuments(filter);
    const rows = await Search.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ ok: true, page, limit, total, history: rows.map(r => ({ id: r._id, term: r.term, createdAt: r.createdAt })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/search -> delete all history for current user
router.delete('/', requireAuth, async (req, res) => {
  try {
    await Search.deleteMany({ user: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
