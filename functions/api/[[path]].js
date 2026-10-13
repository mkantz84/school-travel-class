// Cloudflare Pages Function – handles every request under /api/*
// Storage: D1 (binding "DB"). Simple protection: shared group access code (env.ACCESS_CODE).

const MEAL_TEMPLATE = [
  { title: 'פריסה בהגעה', responsible: 'כל משפחה', menu: 'אוכל אישי שאפשר לחלוק עד הערב' },
  { title: 'ארוחת ערב' },
  { title: 'ארוחת בוקר' },
  { title: 'כריכים לטיול' },
  { title: 'פיקניק סיום' },
];

const CHECKLIST_TEMPLATE = [
  ['לפני הטיול', 'קיבלתי את פרטי הטיול, הלינה, המפגש, המשתתפים והנקודות לטיפול'],
  ['לפני הטיול', 'מונו אחראים לערב, לבוקר, לכריכים, לפיקניק ולכלים'],
  ['לפני הטיול', 'התקבלו תפריטים וכמויות ונבדקו צרכים מיוחדים באוכל'],
  ['לפני הטיול', 'הועברו לאחראי הכלים כל דרישות הבישול וההגשה מכל הארוחות'],
  ['לפני הטיול', 'אחראי הכלים אישר מה קיים במקום, מה בארגז ומה מביאות המשפחות'],
  ['לפני הטיול', 'תואמו הבאה והחזרה של ארגז החוג, השולחן, המפה והמחצלת'],
  ['לפני הטיול', 'אושר מספר המשתתפים בכל משפחה וסוכם מה נכלל בהוצאות המשותפות'],
  ['לפני הטיול', 'המשפחות קיבלו את שעת ומקום המפגש, הפריסה בהגעה ומה להביא'],
  ['בדיקת אחראי הכלים', 'נבדקו כמויות וגדלים של סירים, מחבתות וכלי הכנה והגשה; תואמו אמצעי הבישול הדרושים, ונקבע מי מביא כל פריט חסר'],
  ['במהלך הטיול ובסיומו', 'האחראים תיאמו עזרה – הארוחות, הכריכים והפיקניק מוכנים בזמנים שסוכמו'],
  ['במהלך הטיול ובסיומו', 'נאספו סכומי הקניות והקבלות וכל ההוצאות המשותפות נרשמו'],
  ['במהלך הטיול ובסיומו', 'הכלים נוקו והוחזרו לבעליהם; הארגז נבדק ונרשמו חוסרים לטיול הבא'],
  ['במהלך הטיול ובסיומו', 'תואם מי שומר את ציוד החוג ונשלח סיכום ההתחשבנות'],
];

const FAMILY_FIELDS = ['name', 'parents', 'kids_names', 'phone', 'adults', 'kids', 'notes'];
const TRIP_FIELDS = [
  'name', 'start_date', 'end_date', 'destination', 'meeting_time', 'meeting_place',
  'lodging', 'lodging_phone', 'lodging_details', 'missing_items', 'food_notes', 'schedule',
  'focalizer_family_id', 'focalizer_name', 'focalizer_phone', 'tools_name', 'tools_phone',
  'included_expenses', 'plans_deadline', 'final_check', 'gear_keeper', 'shortages', 'status',
];
const MEAL_FIELDS = ['title', 'responsible', 'phone', 'menu', 'helpers', 'tools', 'plan_received', 'sort'];
const EXPENSE_FIELDS = ['family_id', 'description', 'amount', 'included'];

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

async function getTripFull(db, id) {
  const trip = await first(db, 'SELECT * FROM trips WHERE id = ?', id);
  if (!trip) throw new HttpError(404, 'הטיול לא נמצא');
  const [participants, meals, checklist, expenses] = await Promise.all([
    all(db, 'SELECT * FROM participants WHERE trip_id = ?', id),
    all(db, 'SELECT * FROM meals WHERE trip_id = ? ORDER BY sort, id', id),
    all(db, 'SELECT * FROM checklist WHERE trip_id = ? ORDER BY sort, id', id),
    all(db, 'SELECT * FROM expenses WHERE trip_id = ? ORDER BY id DESC', id),
  ]);
  return { trip, participants, meals, checklist, expenses };
}

async function route(request, env, parts) {
  const db = env.DB;
  const method = request.method;
  const body = ['POST', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : null;
  const [res, id, sub, subId] = parts;

  // ---- auth check ----
  if (res === 'login' && method === 'POST') {
    const ok = !env.ACCESS_CODE || body.code === env.ACCESS_CODE;
    return ok ? json({ ok: true }) : json({ error: 'קוד שגוי' }, 401);
  }

  // ---- bootstrap: everything needed for the lists ----
  if (res === 'bootstrap' && method === 'GET') {
    const [families, trips, counts] = await Promise.all([
      all(db, 'SELECT * FROM families ORDER BY name'),
      all(db, 'SELECT * FROM trips ORDER BY start_date DESC, id DESC'),
      all(db, `SELECT t.id AS trip_id,
                 (SELECT COUNT(*) FROM participants p WHERE p.trip_id = t.id) AS families,
                 (SELECT COALESCE(SUM(adults + kids),0) FROM participants p WHERE p.trip_id = t.id) AS people,
                 (SELECT COUNT(*) FROM checklist c WHERE c.trip_id = t.id) AS tasks,
                 (SELECT COUNT(*) FROM checklist c WHERE c.trip_id = t.id AND c.done = 1) AS done,
                 (SELECT COALESCE(SUM(amount),0) FROM expenses e WHERE e.trip_id = t.id AND e.included = 1) AS total
               FROM trips t`),
    ]);
    return json({ families, trips, counts });
  }

  // ---- families ----
  if (res === 'families') {
    if (method === 'POST' && !id) {
      const data = pick(body, FAMILY_FIELDS);
      if (!data.name) throw new HttpError(400, 'חסר שם משפחה');
      return json({ id: await insert(db, 'families', data) });
    }
    if (method === 'PUT' && id) { await update(db, 'families', id, pick(body, FAMILY_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE' && id) {
      const used = await first(db, 'SELECT COUNT(*) AS n FROM expenses WHERE family_id = ?', id);
      if (used.n > 0) throw new HttpError(400, 'למשפחה יש הוצאות רשומות – אי אפשר למחוק אותה');
      await db.batch([
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
      const stmts = [];
      MEAL_TEMPLATE.forEach((m, i) =>
        stmts.push(db.prepare('INSERT INTO meals (trip_id, title, responsible, menu, sort) VALUES (?,?,?,?,?)')
          .bind(tripId, m.title, m.responsible || '', m.menu || '', i)));
      CHECKLIST_TEMPLATE.forEach(([section, text], i) =>
        stmts.push(db.prepare('INSERT INTO checklist (trip_id, section, text, sort) VALUES (?,?,?,?)')
          .bind(tripId, section, text, i)));
      await db.batch(stmts);
      return json({ id: tripId });
    }
    if (method === 'GET' && id && !sub) return json(await getTripFull(db, id));
    if (method === 'PUT' && id && !sub) { await update(db, 'trips', id, pick(body, TRIP_FIELDS)); return json({ ok: true }); }
    if (method === 'DELETE' && id && !sub) {
      await db.batch(['participants', 'meals', 'checklist', 'expenses']
        .map((t) => db.prepare(`DELETE FROM ${t} WHERE trip_id = ?`).bind(id))
        .concat(db.prepare('DELETE FROM trips WHERE id = ?').bind(id)));
      return json({ ok: true });
    }

    // participants: /trips/:id/participants/:familyId
    if (sub === 'participants' && subId) {
      if (method === 'PUT') {
        const adults = Math.max(0, parseInt(body.adults) || 0);
        const kids = Math.max(0, parseInt(body.kids) || 0);
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
      if (!data.title) throw new HttpError(400, 'חסר שם למשימה');
      return json({ id: await insert(db, 'meals', { ...data, trip_id: id, sort: 100 }) });
    }
    if (sub === 'checklist' && method === 'POST') {
      if (!body.text) throw new HttpError(400, 'חסר תיאור למשימה');
      return json({ id: await insert(db, 'checklist', { trip_id: id, section: body.section || 'משימות נוספות', text: body.text, sort: 100 }) });
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
  if (res === 'checklist' && id) {
    if (method === 'PUT') {
      const done = body.done ? 1 : 0;
      await db.prepare('UPDATE checklist SET done = ?, done_by = ?, done_at = ? WHERE id = ?')
        .bind(done, done ? body.done_by || '' : '', done ? new Date().toISOString() : '', id).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') { await db.prepare('DELETE FROM checklist WHERE id = ?').bind(id).run(); return json({ ok: true }); }
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
    if (parts[0] !== 'login' && env.ACCESS_CODE && request.headers.get('x-access-code') !== env.ACCESS_CODE) {
      return json({ error: 'unauthorized' }, 401);
    }
    return await route(request, env, parts);
  } catch (err) {
    return json({ error: err.message || 'שגיאה' }, err.status || 500);
  }
}
