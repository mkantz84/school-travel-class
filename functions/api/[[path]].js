// Cloudflare Pages Function – handles every request under /api/*
// Storage: D1 (binding "DB"). No access code required – family & creator flows use direct URLs.

const ROLE_TEMPLATE = [
  { title: 'ארוחת ערב' },
  { title: 'ארוחת בוקר' },
  { title: 'סנדוויצ׳ים' },
  { title: 'פיקניק' },
  { title: 'הפעלה / הדרכה' },
];

const FAMILY_FIELDS = ['name', 'parents', 'kids_names', 'phone', 'adults', 'kids', 'notes'];
const TRIP_FIELDS = [
  'name', 'start_date', 'end_date', 'destination', 'meeting_time', 'meeting_place',
  'lodging', 'lodging_phone', 'lodging_details', 'missing_items', 'food_notes', 'schedule',
  'focalizer_family_id', 'focalizer_name', 'focalizer_phone', 'tools_name', 'tools_phone',
  'included_expenses', 'plans_deadline', 'final_check', 'gear_keeper', 'shortages', 'status',
];
const MEAL_FIELDS = ['title', 'responsible', 'phone', 'menu', 'helpers', 'tools', 'plan_received', 'sort'];
const GEAR_FIELDS = ['item', 'needed_for', 'brought_by'];
const EXPENSE_FIELDS = ['family_id', 'description', 'amount', 'included', 'split_families'];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body && body[f] !== undefined) out[f] = body[f];
  return out;
}

async function insert(db, table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  const res = await db.prepare(sql).bind(...keys.map((k) => data[k])).run();
  return res.meta.last_row_id;
}

async function update(db, table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...keys.map((k) => data[k]), id).run();
}

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();

async function ensureSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS gear (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    needed_for TEXT DEFAULT '',
    brought_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();

  try {
    await db.prepare(`ALTER TABLE expenses ADD COLUMN split_families TEXT DEFAULT ''`).run();
  } catch (_) {
    // Column already exists
  }

  await db.prepare(`CREATE TABLE IF NOT EXISTS _app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`).run();

  const applied = await first(db, `SELECT name FROM _app_migrations WHERE name = '0003_clear_old_trips'`);
  if (!applied) {
    await db.batch([
      db.prepare('DELETE FROM participants'),
      db.prepare('DELETE FROM meals'),
      db.prepare('DELETE FROM checklist'),
      db.prepare('DELETE FROM expenses'),
      db.prepare('DELETE FROM gear'),
      db.prepare('DELETE FROM trips'),
      db.prepare(`INSERT INTO _app_migrations (name) VALUES ('0003_clear_old_trips')`),
    ]);
  }
}

async function getTripFull(db, id) {
  await ensureSchema(db);
  const trip = await first(db, 'SELECT * FROM trips WHERE id = ?', id);
  if (!trip) throw new HttpError(404, 'הטיול לא נמצא');
  const [participants, meals, gear, expenses] = await Promise.all([
    all(db, 'SELECT * FROM participants WHERE trip_id = ?', id),
    all(db, 'SELECT * FROM meals WHERE trip_id = ? ORDER BY sort, id', id),
    all(db, 'SELECT * FROM gear WHERE trip_id = ? ORDER BY id', id),
    all(db, 'SELECT * FROM expenses WHERE trip_id = ? ORDER BY id DESC', id),
  ]);
  return { trip, participants, meals, gear, expenses };
}

async function route(request, env, parts) {
  const db = env.DB;
  await ensureSchema(db);
  const method = request.method;
  const body = ['POST', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : null;
  const [res, id, sub, subId] = parts;

  // ---- bootstrap: everything needed for lists ----
  if (res === 'bootstrap' && method === 'GET') {
    const [families, trips, counts] = await Promise.all([
      all(db, 'SELECT * FROM families ORDER BY name'),
      all(db, 'SELECT * FROM trips ORDER BY start_date DESC, id DESC'),
      all(db, `SELECT t.id AS trip_id,
                 (SELECT COUNT(*) FROM participants p WHERE p.trip_id = t.id) AS families,
                 (SELECT COALESCE(SUM(adults + kids),0) FROM participants p WHERE p.trip_id = t.id) AS people,
                 (SELECT COALESCE(SUM(amount),0) FROM expenses e WHERE e.trip_id = t.id AND e.included = 1) AS total
               FROM trips t`),
    ]);
    return json({ families, trips, counts });
  }

function normalizeFamilyName(raw) {
  return String(raw || '')
    .trim()
    .replace(/^משפחת\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

  // ---- families ----
  if (res === 'families') {
    if (method === 'POST' && !id) {
      const data = pick(body, FAMILY_FIELDS);
      if (data.name) data.name = String(data.name).trim();
      if (!data.name) throw new HttpError(400, 'חסר שם משפחה');
      const allFams = await all(db, 'SELECT id, name FROM families');
      const norm = normalizeFamilyName(data.name);
      if (allFams.some((f) => normalizeFamilyName(f.name) === norm)) {
        throw new HttpError(409, 'שם המשפחה כבר קיים במערכת – נא להוסיף גם שמות פרטיים כדי להבדיל');
      }
      return json({ id: await insert(db, 'families', data) });
    }
    if (method === 'PUT' && id) {
      const data = pick(body, FAMILY_FIELDS);
      if (data.name !== undefined) {
        data.name = String(data.name).trim();
        if (!data.name) throw new HttpError(400, 'חסר שם משפחה');
        const allFams = await all(db, 'SELECT id, name FROM families WHERE id != ?', id);
        const norm = normalizeFamilyName(data.name);
        if (allFams.some((f) => normalizeFamilyName(f.name) === norm)) {
          throw new HttpError(409, 'שם המשפחה כבר קיים במערכת – נא להוסיף גם שמות פרטיים כדי להבדיל');
        }
      }
      const oldFam = await first(db, 'SELECT name FROM families WHERE id = ?', id);
      await update(db, 'families', id, data);
      if (data.name && oldFam && oldFam.name && oldFam.name !== data.name) {
        await db.batch([
          db.prepare('UPDATE meals SET responsible = ? WHERE responsible = ?').bind(data.name, oldFam.name),
          db.prepare('UPDATE gear SET brought_by = ? WHERE brought_by = ?').bind(data.name, oldFam.name),
        ]);
      }
      return json({ ok: true });
    }
    if (method === 'DELETE' && id) {
      await db.batch([
        db.prepare('DELETE FROM expenses WHERE family_id = ?').bind(id),
        db.prepare('DELETE FROM participants WHERE family_id = ?').bind(id),
        db.prepare('DELETE FROM families WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  // ---- trips ----
  if (res === 'trips') {
    if (method === 'POST' && !id) {
      const data = pick(body, TRIP_FIELDS);
      if (!data.name) throw new HttpError(400, 'חסר שם לטיול');
      const tripId = await insert(db, 'trips', data);
      const stmts = ROLE_TEMPLATE.map((m, i) =>
        db.prepare('INSERT INTO meals (trip_id, title, responsible, menu, sort) VALUES (?,?,?,?,?)')
          .bind(tripId, m.title, '', '', i)
      );
      await db.batch(stmts);
      return json({ id: tripId });
    }
    if (method === 'GET' && id && !sub) return json(await getTripFull(db, id));
    if (method === 'PUT' && id && !sub) { await update(db, 'trips', id, pick(body, TRIP_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE' && id && !sub) {
      await db.batch(['participants', 'meals', 'gear', 'checklist', 'expenses']
        .map((t) => db.prepare(`DELETE FROM ${t} WHERE trip_id = ?`).bind(id))
        .concat(db.prepare('DELETE FROM trips WHERE id = ?').bind(id)));
      return json({ ok: true });
    }

    // participants: /trips/:id/participants/:familyId
    if (sub === 'participants' && subId) {
      if (method === 'PUT') {
        const adults = Math.max(0, parseInt(body.adults) || 0);
        const kids = Math.max(0, parseInt(body.kids) || 0);
        if (body.notes !== undefined) {
          await db.prepare('UPDATE families SET notes = ? WHERE id = ?').bind(body.notes, subId).run();
        }
        await db.prepare(`INSERT INTO participants (trip_id, family_id, adults, kids) VALUES (?,?,?,?)
                          ON CONFLICT(trip_id, family_id) DO UPDATE SET adults = excluded.adults, kids = excluded.kids`)
          .bind(id, subId, adults, kids).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM participants WHERE trip_id = ? AND family_id = ?').bind(id, subId).run();
        return json({ ok: true });
      }
    }
    if (sub === 'meals' && method === 'POST') {
      const data = pick(body, MEAL_FIELDS);
      if (!data.title) throw new HttpError(400, 'חסר שם לתפקיד');
      return json({ id: await insert(db, 'meals', { ...data, trip_id: id, sort: 100 }) });
    }
    if (sub === 'gear' && method === 'POST') {
      const data = pick(body, GEAR_FIELDS);
      if (!data.item) throw new HttpError(400, 'חסר שם הפריט');
      return json({ id: await insert(db, 'gear', { ...data, trip_id: id }) });
    }
    if (sub === 'expenses' && method === 'POST') {
      const data = pick(body, EXPENSE_FIELDS);
      data.amount = Number(data.amount);
      if (!data.family_id || !data.description || !(data.amount > 0)) throw new HttpError(400, 'יש למלא מי שילם, עבור מה וסכום');
      return json({ id: await insert(db, 'expenses', { ...data, trip_id: id }) });
    }
  }

  // ---- single items ----
  if (res === 'meals' && id) {
    if (method === 'PUT') { await update(db, 'meals', id, pick(body, MEAL_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE') { await db.prepare('DELETE FROM meals WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  }
  if (res === 'gear' && id) {
    if (method === 'PUT') { await update(db, 'gear', id, pick(body, GEAR_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE') { await db.prepare('DELETE FROM gear WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  }
  if (res === 'expenses' && id) {
    if (method === 'PUT') { await update(db, 'expenses', id, pick(body, EXPENSE_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE') { await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run(); return json({ ok: true }); }
  }

  throw new HttpError(404, 'Not found');
}

export async function onRequest({ request, env, params }) {
  const parts = [].concat(params.path || []);
  try {
    return await route(request, env, parts);
  } catch (err) {
    return json({ error: err.message || 'שגיאה' }, err.status || 500);
  }
}
