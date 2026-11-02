// Strips MongoDB operators out of anything a client sends, so `{"adminId": {"$ne": null}}` or
// `?classType[$ne]=x` can never be read by Mongo as a query operator (NoSQL injection).
// Any key that starts with "$" or contains "." is removed, in the body, the query string and the URL params.

const MAX_PAGE_SIZE = 1000;

const clean = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => clean(v, depth + 1));
  const out = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = clean(value[key], depth + 1);
  }
  return out;
};

const sanitizeRequest = (req, res, next) => {
  if (req.body)   req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  if (req.query) {
    // Every filter in this API is a single text value. A nested object (`?x[$ne]=1`) is dropped, and a
    // repeated value (`?x=1&x=2`) keeps the first one, so controllers always receive plain strings.
    const cleaned = {};
    for (const [key, raw] of Object.entries(clean(req.query))) {
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (typeof value === 'string') cleaned[key] = value;
    }
    // Page size is capped so one request can never ask the database for everything at once
    if (cleaned.limit !== undefined) cleaned.limit = String(Math.min(Math.max(parseInt(cleaned.limit) || 50, 1), MAX_PAGE_SIZE));
    if (cleaned.page  !== undefined) cleaned.page  = String(Math.min(Math.max(parseInt(cleaned.page)  || 1, 1), 100000));
    for (const key of Object.keys(req.query)) delete req.query[key];
    Object.assign(req.query, cleaned);
  }
  next();
};

module.exports = { sanitizeRequest, clean };
