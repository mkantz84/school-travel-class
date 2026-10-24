// Cloudflare Pages Function – handles every request under /api/*
// Storage: D1 (binding "DB"), optional R2 (binding "TRIP_IMAGES"), Gemini API ("GEMINI_API_KEY")

import { runImageAgent, runMealsAgent, runGearAgent } from './_agents.js';

const FAMILY_FIELDS = ['name', 'parents', 'kids_names', 'phone', 'adults', 'kids', 'notes'];
const TRIP_FIELDS = [
  'name', 'start_date', 'end_date', 'destination', 'meeting_time', 'meeting_place',
  'lodging', 'lodging_phone', 'lodging_details', 'missing_items', 'food_notes', 'schedule',
  'focalizer_family_id', 'focalizer_name', 'focalizer_phone', 'tools_name', 'tools_phone',
  'included_expenses', 'plans_deadline', 'final_check', 'gear_keeper', 'shortages', 'status',
  'expected_people', 'image_url', 'image_style', 'ai_status',
];
const MEAL_FIELDS = ['title', 'responsible', 'phone', 'menu', 'helpers', 'tools', 'plan_received', 'sort', 'source', 'ai_key'];
const GEAR_FIELDS = ['item', 'needed_for', 'brought_by', 'source', 'ai_key', 'quantity'];
const EXPENSE_FIELDS = ['family_id', 'description', 'amount', 'included', 'split_families'];

const TRIP_PUBLIC_COLS = `
  id, name, start_date, end_date, destination, meeting_time, meeting_place,
  lodging, lodging_phone, lodging_details, missing_items, food_notes, schedule,
  focalizer_family_id, focalizer_name, focalizer_phone, tools_name, tools_phone,
  included_expenses, plans_deadline, final_check, gear_keeper, shortages, status,
  expected_people, image_url, image_style, ai_status, created_at
`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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

let schemaInitialized = false;

async function ensureSchema(db) {
  if (schemaInitialized) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS gear (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    needed_for TEXT DEFAULT '',
    brought_by TEXT DEFAULT '',
    source TEXT DEFAULT 'user',
    ai_key TEXT DEFAULT '',
    quantity TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();

  const alterStatements = [
    `ALTER TABLE expenses ADD COLUMN split_families TEXT DEFAULT ''`,
    `ALTER TABLE trips ADD COLUMN expected_people INTEGER DEFAULT 0`,
    `ALTER TABLE trips ADD COLUMN image_url TEXT DEFAULT ''`,
    `ALTER TABLE trips ADD COLUMN image_style TEXT DEFAULT ''`,
    `ALTER TABLE trips ADD COLUMN image_data TEXT DEFAULT ''`,
    `ALTER TABLE trips ADD COLUMN ai_status TEXT DEFAULT ''`,
    `ALTER TABLE meals ADD COLUMN source TEXT DEFAULT 'user'`,
    `ALTER TABLE meals ADD COLUMN ai_key TEXT DEFAULT ''`,
    `ALTER TABLE gear ADD COLUMN source TEXT DEFAULT 'user'`,
    `ALTER TABLE gear ADD COLUMN ai_key TEXT DEFAULT ''`,
    `ALTER TABLE gear ADD COLUMN quantity TEXT DEFAULT ''`,
  ];

  for (const stmt of alterStatements) {
    try {
      await db.prepare(stmt).run();
    } catch (_) {
      // Column already exists
    }
  }

  await db.prepare(`CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT DEFAULT '',
    error TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS agent_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    trip_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    needed_for TEXT DEFAULT '',
    ai_key TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )`).run();

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

  schemaInitialized = true;
}

async function getTripFull(db, id) {
  await ensureSchema(db);
  const trip = await first(db, `SELECT ${TRIP_PUBLIC_COLS} FROM trips WHERE id = ?`, id);
  if (!trip) throw new HttpError(404, 'הטיול לא נמצא');
  const [participants, meals, gear, expenses] = await Promise.all([
    all(db, 'SELECT * FROM participants WHERE trip_id = ?', id),
    all(db, 'SELECT * FROM meals WHERE trip_id = ? ORDER BY sort, id', id),
    all(db, 'SELECT * FROM gear WHERE trip_id = ? ORDER BY id', id),
    all(db, 'SELECT * FROM expenses WHERE trip_id = ? ORDER BY id DESC', id),
  ]);
  return { trip, participants, meals, gear, expenses };
}

function calculateEffectiveHeadcount(trip, participants) {
  const registeredPeople = (participants || []).reduce(
    (sum, p) => sum + (Number(p.adults) || 0) + (Number(p.kids) || 0),
    0
  );
  const expected = Number(trip.expected_people) || 0;
  return Math.max(registeredPeople, expected, 16);
}

async function executeInitialAgents(env, db, tripId) {
  const runId = `init_${tripId}_${Date.now()}`;
  const trip = await first(db, `SELECT ${TRIP_PUBLIC_COLS} FROM trips WHERE id = ?`, tripId);
  if (!trip) return;

  await db
    .prepare('INSERT INTO agent_runs (id, trip_id, mode, status) VALUES (?, ?, ?, ?)')
    .bind(runId, tripId, 'initial', 'running')
    .run();
  await update(db, 'trips', tripId, { ai_status: 'running' });

  try {
    const participants = await all(db, 'SELECT * FROM participants WHERE trip_id = ?', tripId);
    const existingMeals = await all(db, 'SELECT * FROM meals WHERE trip_id = ?', tripId);
    const existingGear = await all(db, 'SELECT * FROM gear WHERE trip_id = ?', tripId);
    const headcount = calculateEffectiveHeadcount(trip, participants);

    // Run Agent 1 (Image) in parallel with Agent 2 (Meals/Roles) -> Agent 3 (Gear/Supplies)
    const [imageResult, mealsAndGearResult] = await Promise.all([
      runImageAgent(env, trip),
      (async () => {
        const suggestedMeals = await runMealsAgent(env, trip, existingMeals, headcount);
        const combinedMeals = [
          ...existingMeals,
          ...suggestedMeals.map((m) => ({ title: m.title, menu: m.menu, ai_key: m.ai_key })),
        ];
        const suggestedGear = await runGearAgent(env, trip, combinedMeals, existingGear, headcount);
        return { suggestedMeals, suggestedGear };
      })(),
    ]);

    const batchStmts = [];

    if (imageResult?.image_url) {
      batchStmts.push(
        db
          .prepare('UPDATE trips SET image_url = ?, image_style = ?, image_data = ?, ai_status = ? WHERE id = ?')
          .bind(
            imageResult.image_url,
            imageResult.image_style || '',
            imageResult.image_data || '',
            'done',
            tripId
          )
      );
    } else {
      batchStmts.push(db.prepare('UPDATE trips SET ai_status = ? WHERE id = ?').bind('done', tripId));
    }

    const { suggestedMeals, suggestedGear } = mealsAndGearResult;
    suggestedMeals.forEach((m, idx) => {
      batchStmts.push(
        db
          .prepare(
            'INSERT INTO meals (trip_id, title, responsible, menu, sort, source, ai_key) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(tripId, m.title, '', m.menu || '', idx + 1, 'ai', m.ai_key || '')
      );
    });

    suggestedGear.forEach((g) => {
      batchStmts.push(
        db
          .prepare(
            'INSERT INTO gear (trip_id, item, needed_for, brought_by, source, ai_key, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(tripId, g.item, g.needed_for || 'כללי', '', 'ai', g.ai_key || '', g.quantity || '')
      );
    });

    batchStmts.push(
      db
        .prepare('UPDATE agent_runs SET status = ?, summary = ? WHERE id = ?')
        .bind(
          'done',
          `נוצרו ${suggestedMeals.length} תפקידים ו-${suggestedGear.length} פריטי ציוד ומצרכים`,
          runId
        )
    );

    await db.batch(batchStmts);
    return {
      ok: true,
      run_id: runId,
      meals_added: suggestedMeals.length,
      gear_added: suggestedGear.length,
      image_style: imageResult?.image_style || '',
    };
  } catch (err) {
    await update(db, 'trips', tripId, { ai_status: 'failed' });
    await db
      .prepare('UPDATE agent_runs SET status = ?, error = ? WHERE id = ?')
      .bind('failed', err?.message || 'שגיאה בהרצת סוכני ה-AI', runId)
      .run();
    throw err;
  }
}

function normalizeFamilyName(raw) {
  return String(raw || '')
    .trim()
    .replace(/^משפחת\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function route(request, env, parts, ctx) {
  const db = env.DB;
  await ensureSchema(db);
  const method = request.method;
  const body = ['POST', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : null;
  const [res, id, sub, subId] = parts;

  // ---- bootstrap: everything needed for lists ----
  if (res === 'bootstrap' && method === 'GET') {
    const [families, trips, counts] = await Promise.all([
      all(db, 'SELECT * FROM families ORDER BY name'),
      all(db, `SELECT ${TRIP_PUBLIC_COLS} FROM trips ORDER BY start_date DESC, id DESC`),
      all(
        db,
        `SELECT t.id AS trip_id,
                (SELECT COUNT(*) FROM participants p WHERE p.trip_id = t.id) AS families,
                (SELECT COALESCE(SUM(adults + kids),0) FROM participants p WHERE p.trip_id = t.id) AS people,
                (SELECT COALESCE(SUM(amount),0) FROM expenses e WHERE e.trip_id = t.id AND e.included = 1) AS total
         FROM trips t`
      ),
    ]);
    return json({ families, trips, counts });
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
        db.prepare('UPDATE trips SET focalizer_family_id = NULL WHERE focalizer_family_id = ?').bind(id),
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
      if (data.focalizer_family_id !== undefined) {
        data.focalizer_family_id = data.focalizer_family_id ? Number(data.focalizer_family_id) : null;
      }
      if (data.expected_people !== undefined) {
        data.expected_people = Math.max(0, parseInt(data.expected_people, 10) || 0);
      }
      data.ai_status = 'running';
      const tripId = await insert(db, 'trips', data);

      // Run the 3 parallel AI agents right away during creation (or via waitUntil if supported)
      try {
        await executeInitialAgents(env, db, tripId);
      } catch (err) {
        console.warn('Initial agents error during trip creation:', err);
      }

      return json({ id: tripId });
    }

    // Serve generated trip image from R2 or D1 image_data
    if (method === 'GET' && id && sub === 'image') {
      if (env.TRIP_IMAGES && typeof env.TRIP_IMAGES.get === 'function') {
        const obj = await env.TRIP_IMAGES.get(`trip-${id}`);
        if (obj) {
          return new Response(obj.body, {
            headers: {
              'content-type': obj.httpMetadata?.contentType || 'image/png',
              'cache-control': 'public, max-age=86400',
            },
          });
        }
      }
      const row = await first(db, 'SELECT image_data FROM trips WHERE id = ?', id);
      if (row?.image_data && row.image_data.startsWith('data:')) {
        const match = row.image_data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const b64 = match[2];
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          return new Response(bytes, {
            headers: {
              'content-type': mimeType,
              'cache-control': 'public, max-age=86400',
            },
          });
        }
      }
      throw new HttpError(404, 'Image not found');
    }

    // AI Agents endpoints under /api/trips/:id/agents/:action
    if (id && sub === 'agents') {
      if (method === 'POST' && subId === 'initial') {
        const resData = await executeInitialAgents(env, db, id);
        return json(resData);
      }

      // Recalculate roles & gear (Admin Family only, does NOT regenerate trip image)
      if (method === 'POST' && subId === 'recalculate') {
        const trip = await first(db, `SELECT ${TRIP_PUBLIC_COLS} FROM trips WHERE id = ?`, id);
        if (!trip) throw new HttpError(404, 'הטיול לא נמצא');

        const requestingFamilyId = Number(body?.family_id) || 0;
        const adminFamilyId = Number(trip.focalizer_family_id) || 0;
        if (!adminFamilyId || requestingFamilyId !== adminFamilyId) {
          throw new HttpError(403, 'רק המשפחה המנהלת של הטיול מורשית להריץ חישוב מחדש של סוכני ה-AI');
        }

        const runId = `recalc_${id}_${Date.now()}`;
        await db
          .prepare('INSERT INTO agent_runs (id, trip_id, mode, status) VALUES (?, ?, ?, ?)')
          .bind(runId, id, 'recalculate', 'running')
          .run();

        try {
          const [participants, existingMeals, existingGear] = await Promise.all([
            all(db, 'SELECT * FROM participants WHERE trip_id = ?', id),
            all(db, 'SELECT * FROM meals WHERE trip_id = ? ORDER BY sort, id', id),
            all(db, 'SELECT * FROM gear WHERE trip_id = ? ORDER BY id', id),
          ]);

          const headcount = calculateEffectiveHeadcount(trip, participants);

          // Agent 2 (Meals/Roles) -> Agent 3 (Gear/Supplies scaled by headcount)
          const suggestedMeals = await runMealsAgent(env, trip, existingMeals, headcount);
          const allMealsForGear = [
            ...existingMeals,
            ...suggestedMeals.map((m) => ({ title: m.title, menu: m.menu, ai_key: m.ai_key })),
          ];
          const suggestedGear = await runGearAgent(env, trip, allMealsForGear, existingGear, headcount);

          const stmts = [];
          for (const m of suggestedMeals) {
            stmts.push(
              db
                .prepare(
                  `INSERT INTO agent_suggestions (run_id, trip_id, kind, title, subtitle, needed_for, ai_key, reason, payload, status)
                   VALUES (?, ?, 'meal', ?, ?, '', ?, ?, ?, 'pending')`
                )
                .bind(
                  runId,
                  id,
                  m.title,
                  m.menu || '',
                  m.ai_key || '',
                  m.reason || `מותאם לימי הטיול ול-${headcount} משתתפים`,
                  JSON.stringify(m)
                )
            );
          }

          for (const g of suggestedGear) {
            stmts.push(
              db
                .prepare(
                  `INSERT INTO agent_suggestions (run_id, trip_id, kind, title, subtitle, needed_for, ai_key, reason, payload, status)
                   VALUES (?, ?, 'gear', ?, ?, ?, ?, ?, ?, 'pending')`
                )
                .bind(
                  runId,
                  id,
                  g.item,
                  g.quantity || '',
                  g.needed_for || 'כללי',
                  g.ai_key || '',
                  g.reason || `מותאם ל-${headcount} משתתפים`,
                  JSON.stringify(g)
                )
            );
          }

          stmts.push(
            db
              .prepare('UPDATE agent_runs SET status = ?, summary = ? WHERE id = ?')
              .bind(
                'done',
                `נמצאו ${suggestedMeals.length} תפקידים ו-${suggestedGear.length} פריטי ציוד/מצרכים להשלמה`,
                runId
              )
          );

          if (stmts.length > 0) {
            await db.batch(stmts);
          }

          const rawSuggestions = await all(
            db,
            'SELECT * FROM agent_suggestions WHERE run_id = ? ORDER BY id',
            runId
          );
          const savedSuggestions = rawSuggestions.map((s) => {
            let parsedPayload = {};
            try {
              parsedPayload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload || {};
            } catch (_) {
              parsedPayload = {};
            }
            return { ...s, payload: parsedPayload };
          });

          return json({
            run_id: runId,
            headcount,
            registered_families: participants.length,
            suggestions: savedSuggestions,
          });
        } catch (err) {
          await db
            .prepare('UPDATE agent_runs SET status = ?, error = ? WHERE id = ?')
            .bind('failed', err?.message || 'שגיאה בחישוב מחדש', runId)
            .run();
          throw err;
        }
      }

      // Approve selected suggestions from the recalculation modal
      if (method === 'POST' && subId === 'approve') {
        const trip = await first(db, `SELECT ${TRIP_PUBLIC_COLS} FROM trips WHERE id = ?`, id);
        if (!trip) throw new HttpError(404, 'הטיול לא נמצא');

        const requestingFamilyId = Number(body?.family_id) || 0;
        const adminFamilyId = Number(trip.focalizer_family_id) || 0;
        if (!adminFamilyId || requestingFamilyId !== adminFamilyId) {
          throw new HttpError(403, 'רק המשפחה המנהלת של הטיול מורשית לאשר הצעות AI');
        }

        const suggestionIds = Array.isArray(body?.suggestion_ids)
          ? body.suggestion_ids.map(Number).filter(Boolean)
          : [];
        if (suggestionIds.length === 0) {
          return json({ ok: true, added_meals: 0, added_gear: 0 });
        }

        const placeholders = suggestionIds.map(() => '?').join(',');
        const rows = await all(
          db,
          `SELECT * FROM agent_suggestions WHERE trip_id = ? AND status = 'pending' AND id IN (${placeholders})`,
          id,
          ...suggestionIds
        );

        const batchStmts = [];
        let addedMeals = 0;
        let addedGear = 0;

        for (const s of rows) {
          if (s.kind === 'meal') {
            addedMeals++;
            batchStmts.push(
              db
                .prepare(
                  'INSERT INTO meals (trip_id, title, responsible, menu, sort, source, ai_key) VALUES (?, ?, ?, ?, ?, ?, ?)'
                )
                .bind(id, s.title, '', s.subtitle || '', 50 + addedMeals, 'ai', s.ai_key || '')
            );
          } else if (s.kind === 'gear') {
            addedGear++;
            batchStmts.push(
              db
                .prepare(
                  'INSERT INTO gear (trip_id, item, needed_for, brought_by, source, ai_key, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)'
                )
                .bind(id, s.title, s.needed_for || 'כללי', '', 'ai', s.ai_key || '', s.subtitle || '')
            );
          }
          batchStmts.push(
            db.prepare(`UPDATE agent_suggestions SET status = 'approved' WHERE id = ?`).bind(s.id)
          );
        }

        if (batchStmts.length > 0) {
          await db.batch(batchStmts);
        }

        return json({ ok: true, added_meals: addedMeals, added_gear: addedGear });
      }
    }

    if (method === 'GET' && id && !sub) return json(await getTripFull(db, id));
    if (method === 'PUT' && id && !sub) {
      const data = pick(body, TRIP_FIELDS);
      if (data.focalizer_family_id !== undefined) {
        data.focalizer_family_id = data.focalizer_family_id ? Number(data.focalizer_family_id) : null;
      }
      if (data.expected_people !== undefined) {
        data.expected_people = Math.max(0, parseInt(data.expected_people, 10) || 0);
      }
      await update(db, 'trips', id, data);
      return json({ ok: true });
    }
    if (method === 'DELETE' && id && !sub) {
      await db.batch(
        ['participants', 'meals', 'gear', 'checklist', 'expenses', 'agent_runs', 'agent_suggestions']
          .map((t) => db.prepare(`DELETE FROM ${t} WHERE trip_id = ?`).bind(id))
          .concat(db.prepare('DELETE FROM trips WHERE id = ?').bind(id))
      );
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
        await db
          .prepare(
            `INSERT INTO participants (trip_id, family_id, adults, kids) VALUES (?,?,?,?)
             ON CONFLICT(trip_id, family_id) DO UPDATE SET adults = excluded.adults, kids = excluded.kids`
          )
          .bind(id, subId, adults, kids)
          .run();
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
      if (!data.family_id || !data.description || !(data.amount > 0))
        throw new HttpError(400, 'יש למלא מי שילם, עבור מה וסכום');
      return json({ id: await insert(db, 'expenses', { ...data, trip_id: id }) });
    }
  }

  // ---- single items ----
  if (res === 'meals' && id) {
    if (method === 'PUT') {
      await update(db, 'meals', id, pick(body, MEAL_FIELDS));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM meals WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  if (res === 'gear' && id) {
    if (method === 'PUT') {
      await update(db, 'gear', id, pick(body, GEAR_FIELDS));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM gear WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  if (res === 'expenses' && id) {
    if (method === 'PUT') {
      await update(db, 'expenses', id, pick(body, EXPENSE_FIELDS));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  throw new HttpError(404, 'Not found');
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = [].concat(params.path || []);
  try {
    return await route(request, env, parts, context);
  } catch (err) {
    return json({ error: err.message || 'שגיאה' }, err.status || 500);
  }
}
