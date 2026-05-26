import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../App';
import * as api from '../api';

// ── Mock the API module ────────────────────────────────────────────────────
jest.mock('../api');

const NOTE_1 = {
  id: 'abc-1',
  title: 'First note',
  content: 'Content of first note',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const NOTE_2 = {
  id: 'abc-2',
  title: 'Second note',
  content: '',
  createdAt: '2024-01-16T11:00:00.000Z',
  updatedAt: '2024-01-16T11:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

const renderApp = () => render(<App />);

// ══════════════════════════════════════════════════════════════════════════
// 1. Initial render & layout
// ══════════════════════════════════════════════════════════════════════════
describe('Initial render', () => {
  it('shows the app logo', async () => {
    api.getNotes.mockResolvedValue([]);
    renderApp();
    expect(screen.getByText('notes')).toBeInTheDocument();
  });

  it('shows the "+ New note" button in the header', async () => {
    api.getNotes.mockResolvedValue([]);
    renderApp();
    expect(screen.getByRole('button', { name: /\+ new note/i })).toBeInTheDocument();
  });

  it('shows a loading spinner while fetching', () => {
    api.getNotes.mockReturnValue(new Promise(() => {}));
    renderApp();
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('calls getNotes on mount', async () => {
    api.getNotes.mockResolvedValue([]);
    renderApp();
    await waitFor(() => expect(api.getNotes).toHaveBeenCalledTimes(1));
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. Empty state
// ══════════════════════════════════════════════════════════════════════════
describe('Empty state', () => {
  beforeEach(() => { api.getNotes.mockResolvedValue([]); });

  it('shows "No notes yet." when there are no notes', async () => {
    renderApp();
    expect(await screen.findByText('No notes yet.')).toBeInTheDocument();
  });

  it('shows "Write your first note" CTA button', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: /write your first note/i })).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. Notes list
// ══════════════════════════════════════════════════════════════════════════
describe('Notes list', () => {
  beforeEach(() => { api.getNotes.mockResolvedValue([NOTE_1, NOTE_2]); });

  it('renders all note titles', async () => {
    renderApp();
    expect(await screen.findByText('First note')).toBeInTheDocument();
    expect(await screen.findByText('Second note')).toBeInTheDocument();
  });

  it('renders note content when present', async () => {
    renderApp();
    expect(await screen.findByText('Content of first note')).toBeInTheDocument();
  });

  it('does not render content paragraph when content is empty', async () => {
    renderApp();
    await screen.findByText('Second note');
    const cards = document.querySelectorAll('.note-card');
    const secondCard = cards[1];
    expect(within(secondCard).queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('does not show "No notes yet." when notes exist', async () => {
    renderApp();
    await screen.findByText('First note');
    expect(screen.queryByText('No notes yet.')).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. Error state
// ══════════════════════════════════════════════════════════════════════════
describe('Error state', () => {
  it('shows an error banner when getNotes fails', async () => {
    api.getNotes.mockRejectedValue(new Error('network error'));
    renderApp();
    expect(await screen.findByText(/could not load notes/i)).toBeInTheDocument();
  });

  it('dismisses the error banner when X is clicked', async () => {
    api.getNotes.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderApp();
    await screen.findByText(/could not load notes/i);
    await user.click(screen.getByRole('button', { name: /✕/i }));
    expect(screen.queryByText(/could not load notes/i)).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Create note
// ══════════════════════════════════════════════════════════════════════════
describe('Create note', () => {
  beforeEach(() => { api.getNotes.mockResolvedValue([]); });

  it('opens the new-note form when "+ New note" is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    expect(screen.getByPlaceholderText('Note title')).toBeInTheDocument();
  });

  it('opens the form when "Write your first note" is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: /write your first note/i }));
    expect(screen.getByPlaceholderText('Note title')).toBeInTheDocument();
  });

  it('"Add note" button is disabled when title is empty', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    expect(screen.getByRole('button', { name: /add note/i })).toBeDisabled();
  });

  it('"Add note" button enables once a title is typed', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    await user.type(screen.getByPlaceholderText('Note title'), 'My new note');
    expect(screen.getByRole('button', { name: /add note/i })).toBeEnabled();
  });

  it('calls createNote with title and content on submit', async () => {
    const newNote = { id: 'new-1', title: 'My new note', content: 'some content', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    api.createNote.mockResolvedValue(newNote);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    await user.type(screen.getByPlaceholderText('Note title'), 'My new note');
    await user.type(screen.getByPlaceholderText('Write something...'), 'some content');
    await user.click(screen.getByRole('button', { name: /add note/i }));
    expect(api.createNote).toHaveBeenCalledWith({ title: 'My new note', content: 'some content' });
  });

  it('adds the new note to the list after creation', async () => {
    const newNote = { id: 'new-1', title: 'Brand new', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    api.createNote.mockResolvedValue(newNote);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    await user.type(screen.getByPlaceholderText('Note title'), 'Brand new');
    await user.click(screen.getByRole('button', { name: /add note/i }));
    expect(await screen.findByText('Brand new')).toBeInTheDocument();
  });

  it('hides the form after a successful creation', async () => {
    const newNote = { id: 'new-1', title: 'Brand new', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    api.createNote.mockResolvedValue(newNote);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    await user.type(screen.getByPlaceholderText('Note title'), 'Brand new');
    await user.click(screen.getByRole('button', { name: /add note/i }));
    await screen.findByText('Brand new');
    expect(screen.queryByPlaceholderText('Note title')).not.toBeInTheDocument();
  });

  it('hides the form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    expect(screen.getByPlaceholderText('Note title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText('Note title')).not.toBeInTheDocument();
  });

  it('shows an error banner when createNote fails', async () => {
    api.createNote.mockRejectedValue(new Error('Title is required'));
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('No notes yet.');
    await user.click(screen.getByRole('button', { name: /\+ new note/i }));
    await user.type(screen.getByPlaceholderText('Note title'), 'test');
    await user.click(screen.getByRole('button', { name: /add note/i }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 6. Edit note
// ══════════════════════════════════════════════════════════════════════════
describe('Edit note', () => {
  beforeEach(() => { api.getNotes.mockResolvedValue([NOTE_1]); });

  it('replaces the note card with an edit form when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Edit'));
    expect(screen.getByRole('heading', { name: /edit note/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
  });

  it('pre-fills the form with the note title and content', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Edit'));
    expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Content of first note')).toBeInTheDocument();
  });

  it('calls updateNote with the new values on save', async () => {
    const updated = { ...NOTE_1, title: 'Updated title', updatedAt: new Date().toISOString() };
    api.updateNote.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Edit'));
    const titleInput = screen.getByDisplayValue('First note');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(api.updateNote).toHaveBeenCalledWith('abc-1', { title: 'Updated title', content: 'Content of first note' });
  });

  it('updates the note title in the list after saving', async () => {
    const updated = { ...NOTE_1, title: 'Updated title', updatedAt: new Date().toISOString() };
    api.updateNote.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Edit'));
    const titleInput = screen.getByDisplayValue('First note');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('Updated title')).toBeInTheDocument();
    expect(screen.queryByText('First note')).not.toBeInTheDocument();
  });

  it('restores the note card when Cancel is clicked in edit mode', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Edit'));
    expect(screen.getByRole('heading', { name: /edit note/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /edit note/i })).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 7. Delete note
// ══════════════════════════════════════════════════════════════════════════
describe('Delete note', () => {
  it('calls deleteNote with the correct id', async () => {
    api.getNotes.mockResolvedValue([NOTE_1]);
    api.deleteNote.mockResolvedValue(null);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Delete'));
    expect(api.deleteNote).toHaveBeenCalledWith('abc-1');
  });

  it('removes the note from the list after deletion', async () => {
    api.getNotes.mockResolvedValue([NOTE_1, NOTE_2]);
    api.deleteNote.mockResolvedValue(null);
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getAllByTitle('Delete')[0]);
    await waitFor(() => expect(screen.queryByText('First note')).not.toBeInTheDocument());
    expect(screen.getByText('Second note')).toBeInTheDocument();
  });

  it('shows error banner when deleteNote fails', async () => {
    api.getNotes.mockResolvedValue([NOTE_1]);
    api.deleteNote.mockRejectedValue(new Error('Delete failed'));
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('First note');
    await user.click(screen.getByTitle('Delete'));
    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
  });
});