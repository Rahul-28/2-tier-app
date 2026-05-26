const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const handleResponse = async (res) => {
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const getNotes = () =>
  fetch(`${BASE}/notes`).then(handleResponse);

export const createNote = (payload) =>
  fetch(`${BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const updateNote = (id, payload) =>
  fetch(`${BASE}/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);

export const deleteNote = (id) =>
  fetch(`${BASE}/notes/${id}`, { method: 'DELETE' }).then(handleResponse);