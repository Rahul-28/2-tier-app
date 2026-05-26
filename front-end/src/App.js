import React, { useState, useEffect, useCallback } from 'react';
import * as api from './api';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function NoteForm({ initial, onSubmit, onCancel, loading }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [content, setContent] = useState(initial?.content || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), content: content.trim() });
  };

  return (
    <form className="note-form" onSubmit={handleSubmit}>
      <input
        className="form-input"
        type="text"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        maxLength={120}
      />
      <textarea
        className="form-textarea"
        placeholder="Write something..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
      />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={loading || !title.trim()}>
          {loading ? '...' : initial ? 'Save' : 'Add note'}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function NoteCard({ note, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(note.id);
  };

  return (
    <article className={`note-card ${deleting ? 'deleting' : ''}`}>
      <header className="note-card-header">
        <h3 className="note-title">{note.title}</h3>
        <div className="note-actions">
          <button className="icon-btn" title="Edit" onClick={() => onEdit(note)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="icon-btn icon-btn-danger" title="Delete" onClick={handleDelete} disabled={deleting}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </header>
      {note.content && <p className="note-content">{note.content}</p>}
      <footer className="note-footer">
        <span className="note-date">{formatDate(note.updatedAt)}</span>
      </footer>
    </article>
  );
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // note being edited
  const [showForm, setShowForm] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getNotes();
      setNotes(data);
    } catch (e) {
      setError('Could not load notes. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const note = await api.createNote(payload);
      setNotes((prev) => [note, ...prev]);
      setShowForm(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload) => {
    setSaving(true);
    try {
      const updated = await api.updateNote(editing.id, payload);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◆</span>
            <span className="logo-text">notes</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setShowForm(true); setEditing(null); }}
          >
            + New note
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="error-close" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {(showForm && !editing) && (
          <div className="form-panel">
            <h2 className="form-heading">New note</h2>
            <NoteForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              loading={saving}
            />
          </div>
        )}

        {loading ? (
          <div className="state-center">
            <span className="spinner" />
          </div>
        ) : notes.length === 0 && !showForm ? (
          <div className="state-center empty-state">
            <p className="empty-icon">◇</p>
            <p className="empty-msg">No notes yet.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Write your first note
            </button>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) =>
              editing?.id === note.id ? (
                <div key={note.id} className="form-panel form-panel-inline">
                  <h2 className="form-heading">Edit note</h2>
                  <NoteForm
                    initial={editing}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditing(null)}
                    loading={saving}
                  />
                </div>
              ) : (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={(n) => { setEditing(n); setShowForm(false); }}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}