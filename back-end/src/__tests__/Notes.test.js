const request = require('supertest');
const { app, server } = require('../server');
const db = require('../db');

beforeEach(() => db.reset());
afterAll(() => server.close());

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/notes', () => {
  it('returns empty array initially', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all notes', async () => {
    db.create({ title: 'Test', content: 'body' });
    const res = await request(app).get('/api/notes');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Test');
  });
});

describe('POST /api/notes', () => {
  it('creates a note', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'Hello', content: 'World' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Hello');
    expect(res.body.content).toBe('World');
  });

  it('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ content: 'No title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });
});

describe('PUT /api/notes/:id', () => {
  it('updates a note', async () => {
    const note = db.create({ title: 'Old', content: 'old content' });
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .send({ title: 'New', content: 'new content' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/api/notes/nonexistent')
      .send({ title: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('deletes a note', async () => {
    const note = db.create({ title: 'To Delete', content: '' });
    const res = await request(app).delete(`/api/notes/${note.id}`);
    expect(res.status).toBe(204);
    expect(db.getById(note.id)).toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/notes/nonexistent');
    expect(res.status).toBe(404);
  });
});