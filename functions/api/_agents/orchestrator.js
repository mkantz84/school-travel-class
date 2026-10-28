import { calculateEffectiveHeadcount } from './geminiClient.js';
import { runImageAgent, saveTripImageData } from './imageAgent.js';
import { runMealsAgent } from './mealsAgent.js';
import { runGearAgent } from './gearAgent.js';

/**
 * Runs all 3 agents on initial trip creation (or manual initial re-run):
 * - Agent 1 (Trip Illustration) in parallel with
 * - Agent 2 (Roles & Meals) -> Agent 3 (Gear & Supplies scaled to headcount)
 */
export async function executeInitialAgents(env, db, trip, options = {}) {
  const tripId = trip.id;
  const runId = `init_${tripId}_${Date.now()}`;

  await db
    .prepare('INSERT INTO agent_runs (id, trip_id, mode, status) VALUES (?, ?, ?, ?)')
    .bind(runId, tripId, 'initial', 'running')
    .run();
  await db.prepare('UPDATE trips SET ai_status = ? WHERE id = ?').bind('running', tripId).run();

  try {
    if (options?.replace_ai) {
      const stmts = [
        db
          .prepare(
            "DELETE FROM gear WHERE trip_id = ? AND source = 'ai' AND (brought_by IS NULL OR brought_by = '')"
          )
          .bind(tripId),
      ];
      if (!options?.gear_only) {
        stmts.unshift(
          db
            .prepare(
              "DELETE FROM meals WHERE trip_id = ? AND source = 'ai' AND (responsible IS NULL OR responsible = '')"
            )
            .bind(tripId)
        );
      }
      await db.batch(stmts);
    }

    const [{ results: participants = [] }, { results: existingMeals = [] }, { results: existingGear = [] }] =
      await Promise.all([
        db.prepare('SELECT * FROM participants WHERE trip_id = ?').bind(tripId).all(),
        db.prepare('SELECT * FROM meals WHERE trip_id = ?').bind(tripId).all(),
        db.prepare('SELECT * FROM gear WHERE trip_id = ?').bind(tripId).all(),
      ]);

    const headcount = calculateEffectiveHeadcount(trip, participants);

    // Run Agent 1 (Image) in parallel with Agent 2 (Meals/Roles) -> Agent 3 (Gear/Supplies)
    const [imageResult, mealsAndGearResult] = await Promise.all([
      options?.skip_image || options?.gear_only ? Promise.resolve(null) : runImageAgent(env, trip),
      (async () => {
        const suggestedMeals = options?.gear_only
          ? []
          : await runMealsAgent(env, trip, existingMeals, headcount);
        const combinedMeals = [
          ...existingMeals,
          ...suggestedMeals.map((m) => ({ title: m.title, menu: m.menu, ai_key: m.ai_key })),
        ];
        const suggestedGear = await runGearAgent(env, trip, combinedMeals, existingGear, headcount);
        return { suggestedMeals, suggestedGear };
      })(),
    ]);

    const batchStmts = [
      db.prepare('UPDATE trips SET ai_status = ? WHERE id = ?').bind('done', tripId),
    ];

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

    if (imageResult?.image_url) {
      try {
        await saveTripImageData(
          db,
          tripId,
          imageResult.image_url,
          imageResult.image_style || '',
          imageResult.image_data || ''
        );
      } catch (imgStoreErr) {
        console.warn('Warning: failed to store chunked image data in D1:', imgStoreErr);
      }
    }

    return {
      ok: true,
      run_id: runId,
      meals_added: suggestedMeals.length,
      gear_added: suggestedGear.length,
      image_style: imageResult?.image_style || '',
      has_gemini_key: Boolean(env?.GEMINI_API_KEY),
    };
  } catch (err) {
    await db.prepare('UPDATE trips SET ai_status = ? WHERE id = ?').bind('failed', tripId).run();
    await db
      .prepare('UPDATE agent_runs SET status = ?, error = ? WHERE id = ?')
      .bind('failed', err?.message || 'שגיאה בהרצת סוכני ה-AI', runId)
      .run();
    throw err;
  }
}

/**
 * Runs Agent 2 (Meals/Roles) and Agent 3 (Gear/Supplies) during recalculation
 * and stages their suggestions in `agent_suggestions` for Admin Family approval.
 * Does NOT regenerate the trip illustration.
 */
export async function executeRecalculateAgents(env, db, trip) {
  const tripId = trip.id;
  const runId = `recalc_${tripId}_${Date.now()}`;

  await db
    .prepare('INSERT INTO agent_runs (id, trip_id, mode, status) VALUES (?, ?, ?, ?)')
    .bind(runId, tripId, 'recalculate', 'running')
    .run();

  try {
    const [
      { results: participants = [] },
      { results: existingMeals = [] },
      { results: existingGear = [] },
    ] = await Promise.all([
      db.prepare('SELECT * FROM participants WHERE trip_id = ?').bind(tripId).all(),
      db.prepare('SELECT * FROM meals WHERE trip_id = ? ORDER BY sort, id').bind(tripId).all(),
      db.prepare('SELECT * FROM gear WHERE trip_id = ? ORDER BY id').bind(tripId).all(),
    ]);

    const headcount = calculateEffectiveHeadcount(trip, participants);

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
            tripId,
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
            tripId,
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

    const { results: rawSuggestions = [] } = await db
      .prepare('SELECT * FROM agent_suggestions WHERE run_id = ? ORDER BY id')
      .bind(runId)
      .all();

    const savedSuggestions = rawSuggestions.map((s) => {
      let parsedPayload = {};
      try {
        parsedPayload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload || {};
      } catch (_) {
        parsedPayload = {};
      }
      return { ...s, payload: parsedPayload };
    });

    return {
      run_id: runId,
      headcount,
      registered_families: participants.length,
      suggestions: savedSuggestions,
    };
  } catch (err) {
    await db
      .prepare('UPDATE agent_runs SET status = ?, error = ? WHERE id = ?')
      .bind('failed', err?.message || 'שגיאה בחישוב מחדש', runId)
      .run();
    throw err;
  }
}

/**
 * Approves selected pending suggestions from `agent_suggestions` and inserts them into `meals` and `gear`.
 */
export async function approveAgentSuggestions(db, tripId, suggestionIds) {
  const validIds = Array.isArray(suggestionIds) ? suggestionIds.map(Number).filter(Boolean) : [];
  if (validIds.length === 0) {
    return { ok: true, added_meals: 0, added_gear: 0 };
  }

  const placeholders = validIds.map(() => '?').join(',');
  const { results: rows = [] } = await db
    .prepare(
      `SELECT * FROM agent_suggestions WHERE trip_id = ? AND status = 'pending' AND id IN (${placeholders})`
    )
    .bind(tripId, ...validIds)
    .all();

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
          .bind(tripId, s.title, '', s.subtitle || '', 50 + addedMeals, 'ai', s.ai_key || '')
      );
    } else if (s.kind === 'gear') {
      addedGear++;
      batchStmts.push(
        db
          .prepare(
            'INSERT INTO gear (trip_id, item, needed_for, brought_by, source, ai_key, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(tripId, s.title, s.needed_for || 'כללי', '', 'ai', s.ai_key || '', s.subtitle || '')
      );
    }
    batchStmts.push(
      db.prepare("UPDATE agent_suggestions SET status = 'approved' WHERE id = ?").bind(s.id)
    );
  }

  if (batchStmts.length > 0) {
    await db.batch(batchStmts);
  }

  return { ok: true, added_meals: addedMeals, added_gear: addedGear };
}
