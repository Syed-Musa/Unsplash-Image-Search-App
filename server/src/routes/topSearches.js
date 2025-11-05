const express = require('express');
const Search = require('../models/Search');

const router = express.Router();

// GET / -> returns top search terms across all users
router.get('/', async (req, res) => {
  try {
    // aggregate top terms (case-insensitive, trimmed)
    const pipeline = [
      { $project: { term: { $trim: { input: '$term' } } } },
      { $project: { termLower: { $toLower: '$term' } } },
      { $group: { _id: '$termLower', count: { $sum: 1 }, example: { $first: '$termLower' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, term: '$_id', count: 1 } },
    ];

    const rows = await Search.aggregate(pipeline).exec();
    res.json({ ok: true, top: rows });
  } catch (err) {
    console.error('Failed to compute top searches', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
