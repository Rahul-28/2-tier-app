const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/notes
router.get('/', (req, res) => {
  res.json(db.getAll());
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  const note = db.getById(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

// POST /api/notes
router.post('/', (req, res) => {
  try {
    const note = db.create(req.body);
    res.status(201).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  try {
    const note = db.update(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const deleted = db.remove(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Note not found' });
  res.status(204).send();
});

module.exports = router;