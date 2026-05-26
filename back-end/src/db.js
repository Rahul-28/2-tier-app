const { v4: uuidv4 } = require('uuid');

// In-memory store — swap this for a real DB (Postgres, SQLite) later
let notes = [];

const getAll = () => [...notes];

const getById = (id) => notes.find((n) => n.id === id) || null;

const create = ({ title, content }) => {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error('Title is required');
  }
  const note = {
    id: uuidv4(),
    title: title.trim(),
    content: content ? content.trim() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes.push(note);
  return note;
};

const update = (id, { title, content }) => {
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return null;
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    throw new Error('Title cannot be empty');
  }
  notes[index] = {
    ...notes[index],
    ...(title !== undefined && { title: title.trim() }),
    ...(content !== undefined && { content: content.trim() }),
    updatedAt: new Date().toISOString(),
  };
  return notes[index];
};

const remove = (id) => {
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) return false;
  notes.splice(index, 1);
  return true;
};

// For tests — reset state
const reset = () => { notes = []; };

module.exports = { getAll, getById, create, update, remove, reset };