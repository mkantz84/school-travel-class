import { getGenAIClient } from './geminiClient.js';

const GEAR_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ai_key: {
            type: 'string',
            description: 'Canonical key for this item type, e.g. challah, eggs, pita_pack, salad_veggies, water_sixpack, cooking_pot',
          },
          base_name: {
            type: 'string',
            description: 'Hebrew name of the tool or ingredient without quantity, e.g. חלות לשבת, ביצים לארוחת בוקר, מארז פיתות, ירקות לסלט',
          },
          needed_for: {
            type: 'string',
            description: 'Exact Hebrew title of the meal/role this item belongs to, or כללי',
          },
          unit: {
            type: 'string',
            description: 'Hebrew unit name, e.g. יח׳, ק״ג, מארז, שקית',
          },
          per_person_qty: {
            type: 'number',
            description: 'Modest amount needed per person (0 if fixed equipment or group kit)',
          },
          slot_size: {
            type: 'number',
            description: 'How many units one family brings in a single slot (e.g. 2 for challahs, 12 for eggs, 10 for pitas/rolls, 2 for kg veggies, 1 for a kit/pot)',
          },
          fixed_slots: {
            type: 'number',
            description: 'If per_person_qty is 0, how many total slots are needed for the whole group (usually 1 or 2)',
          },
          reason: {
            type: 'string',
            description: 'Short Hebrew explanation of the calculation for the participants',
          },
        },
        required: [
          'ai_key',
          'base_name',
          'needed_for',
          'unit',
          'per_person_qty',
          'slot_size',
          'fixed_slots',
          'reason',
        ],
      },
    },
  },
  required: ['items'],
};

function findMatchingMealTitle(mealsList, regex, fallback = 'כללי') {
  const found = mealsList.find((m) => regex.test(m.title || ''));
  return found ? found.title : fallback;
}

function buildFallbackGearCatalog(trip, mealsList) {
  const breakfastTitle = findMatchingMealTitle(mealsList, /בוקר/, 'ארוחת בוקר');
  const dinnerTitle = findMatchingMealTitle(mealsList, /ערב/, 'ארוחת ערב');
  const lunchTitle = findMatchingMealTitle(mealsList, /צהריים|פיקניק|נשנוש/, 'כללי');
  const coffeeTitle = findMatchingMealTitle(mealsList, /קפה/, 'כללי');
  const campfireTitle = findMatchingMealTitle(mealsList, /מדורה/, '');

  const catalog = [
    {
      ai_key: 'eggs',
      base_name: 'תבנית ביצים לארוחת בוקר',
      needed_for: breakfastTitle,
      unit: 'יח׳',
      per_person_qty: 0.9,
      slot_size: 12,
      fixed_slots: 1,
      reason: 'כביצה אחת למשתתף בממוצע (תבנית של 12 ביצים לכל ~13 משתתפים)',
    },
    {
      ai_key: 'salad_veggies',
      base_name: 'עגבניות, מלפפונים וירקות לסלט',
      needed_for: breakfastTitle,
      unit: 'ק״ג',
      per_person_qty: 0.12,
      slot_size: 2,
      fixed_slots: 1,
      reason: 'כ-120 גרם ירקות למשתתף (שקית של 2 ק״ג לכל ~15 משתתפים)',
    },
    {
      ai_key: 'bread_and_pita',
      base_name: 'מארז פיתות / לחמניות טריות',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 0.85,
      slot_size: 10,
      fixed_slots: 1,
      reason: 'מארז 10 פיתות/לחמניות לכל ~12 משתתפים',
    },
    {
      ai_key: 'spreads_cheeses',
      base_name: 'מארז גבינות וממרחים (קוטג׳, לבנה, חומוס, טחינה)',
      needed_for: breakfastTitle,
      unit: 'מארז',
      per_person_qty: 0.07,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'מארז גבינות וממרחים לכל ~14 משתתפים',
    },
    {
      ai_key: 'dinner_main_pot',
      base_name: 'סיר גדול / מחבת רחבה וכף הגשה',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 0,
      slot_size: 1,
      fixed_slots: 2,
      reason: 'כלי בישול מרכזי לארוחה המשותפת',
    },
    {
      ai_key: 'camping_stove',
      base_name: 'כירת גז / גזייה ובלון גז תקין',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 0,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'עמדת בישול וחימום בשטח',
    },
    {
      ai_key: 'cutting_board_knife',
      base_name: 'קרש חיתוך גדול וסכין חדה',
      needed_for: breakfastTitle,
      unit: 'סט',
      per_person_qty: 0,
      slot_size: 1,
      fixed_slots: 2,
      reason: 'עמדת חיתוך סלטים והכנות משותפת',
    },
    {
      ai_key: 'fruits_and_snacks',
      base_name: 'פירות העונה ונשנושים למסלול',
      needed_for: lunchTitle,
      unit: 'מארז',
      per_person_qty: 0.07,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'מארז פירות וחטיפים לכל ~14 משתתפים במסלול',
    },
    {
      ai_key: 'coffee_kit_milk',
      base_name: 'חלב, עוגה בחושה ועוגיות לפק״ל קפה',
      needed_for: coffeeTitle,
      unit: 'מארז',
      per_person_qty: 0.06,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'חלב וכיבוד מתוק לפינה החמה',
    },
    {
      ai_key: 'water_coolers',
      base_name: 'שישיית מים מינרליים / ג׳ריקן מים',
      needed_for: 'כללי',
      unit: 'שישייה',
      per_person_qty: 0.07,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'גיבוי מים משותף לבישול ולשתייה (שישייה לכל ~14 משתתפים)',
    },
    {
      ai_key: 'folding_table',
      base_name: 'שולחן שטח מתקפל ומפה',
      needed_for: 'כללי',
      unit: 'יח׳',
      per_person_qty: 0.06,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'שולחן הגשה משותף לכל ~15 משתתפים',
    },
    {
      ai_key: 'trash_bags_wipes',
      base_name: 'גליל שקיות אשפה חזקות, מגבונים ונייר סופג',
      needed_for: 'כללי',
      unit: 'ערכה',
      per_person_qty: 0,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'שמירה על ניקיון החניון והמסלול',
    },
  ];

  if (campfireTitle) {
    catalog.push({
      ai_key: 'campfire_wood_marshmallows',
      base_name: 'עצים למדורה, מרשמלו ונייר כסף',
      needed_for: campfireTitle,
      unit: 'ערכה',
      per_person_qty: 0.06,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'עצים ומרשמלו סביב המדורה',
    });
  }

  return catalog;
}

/**
 * Calibrates LLM-provided per-person quantities and slot caps so quantities stay realistic
 * for family trips (where ~half of participants are children and meals are shared buffets).
 */
function computeRealisticSlotsNeeded(spec, effectivePeople) {
  const nameAndKey = `${spec.ai_key || ''} ${spec.base_name || ''}`.toLowerCase();
  const unit = String(spec.unit || 'יח׳').trim();
  const perPerson = Number(spec.per_person_qty) || 0;
  let slotSize = Math.max(1, Number(spec.slot_size) || 1);
  const fixedSlots = Math.max(1, Number(spec.fixed_slots) || 1);

  // 1. Challah (חלות): for ~25 people, 2 slots of 2 challahs (4 challahs total) is plenty.
  if (/חלה|חלות|\bchallah/.test(nameAndKey)) {
    const slots = effectivePeople <= 15 ? 1 : effectivePeople <= 32 ? 2 : 3;
    return { slotsNeeded: slots, slotSize: 2, unit: 'יח׳' };
  }

  // 2. Eggs (ביצים) - use word boundary \beggs?\b so "veggies" never matches!
  //    For 25 people -> 2 cartons of 12 eggs (24 eggs total).
  if (/ביצים|ביצה|\beggs?\b/.test(nameAndKey)) {
    const eggsNeeded = effectivePeople * 0.8;
    const slots = Math.max(1, Math.round(eggsNeeded / 12));
    return { slotsNeeded: slots, slotSize: 12, unit: 'יח׳' };
  }

  // 3. Vegetables & Fruits (ירקות / פירות): ~2 kg per slot, 1-2 slots for 25 people.
  if (/ירקות|סלט|פירות|\bveggie|\bsalad|\bfruit/.test(nameAndKey)) {
    const slots = effectivePeople <= 16 ? 1 : 2;
    if (unit === 'ק״ג' || unit === 'ק"ג' || unit === 'kg') {
      return { slotsNeeded: slots, slotSize: 2, unit: 'ק״ג' };
    }
    return { slotsNeeded: slots, slotSize: 1, unit };
  }

  // 4. Bread / Rolls / Pitas (פיתות / לחמניות / לחם):
  //    If measured in individual units (יח׳) -> 10 per pack, 2 packs for 25 people.
  //    If measured in packs/loaves (מארז / כיכר / חבילה) -> 1 per slot, 2 slots for 25 people.
  if (/פיתות|לחמניות|לחם|\bpita|\bbread|\broll/.test(nameAndKey)) {
    const slots = effectivePeople <= 15 ? 1 : 2;
    const isPackInNameOrUnit =
      /מארז|חבילה|כיכר|שקית/.test(unit) || /מארז|חבילה|כיכר/.test(spec.base_name || '');
    if (isPackInNameOrUnit) {
      return { slotsNeeded: slots, slotSize: 1, unit: 'מארז' };
    }
    return { slotsNeeded: slots, slotSize: 10, unit: 'יח׳' };
  }

  // 5. Trash bags, first aid, disposable tableware, coffee kit, tea herbs: 1 slot (or 2 for 30+ people).
  if (
    /אשפה|מגבונים|חד פעמי|מתכלים|עזרה ראשונה|פק"ל|פק״ל|תיונים|עשבי תיבול|\btrash|\bdisposable|\bcoffee|\btea/.test(
      nameAndKey
    )
  ) {
    const maxKits = effectivePeople > 30 ? 2 : 1;
    return { slotsNeeded: maxKits, slotSize: 1, unit };
  }

  // General calculation for all other items:
  // In family trips ~half of participants are kids, so effective adult portions ≈ 0.8 * headcount.
  let slotsNeeded = Math.min(fixedSlots, 2);
  if (perPerson > 0) {
    const adjustedPeople = effectivePeople * 0.8;
    const totalUnitsNeeded = Math.max(slotSize, adjustedPeople * perPerson);
    const rawSlots = totalUnitsNeeded / slotSize;
    slotsNeeded = Math.max(1, Math.floor(rawSlots + 0.6));
  }

  // Cap any single item at ~1 slot per 13 participants (so 25 people = max 2 slots per item)
  const maxReasonableSlots = Math.max(2, Math.round(effectivePeople / 13));
  slotsNeeded = Math.min(slotsNeeded, maxReasonableSlots);

  // If unit is already a package/kit/jar, keep slotSize at 1 or 2 max so it never says "(8 מארז)"
  if (/מארז|ערכה|צנצנת|שישייה|מגש|בקבוק|שקית/.test(unit) && slotSize > 2) {
    slotSize = 1;
  }

  return { slotsNeeded, slotSize, unit };
}

/**
 * Expands a gear catalog into family-sized slots (`#1`, `#2`, ...) scaled to `headcount`
 * and subtracts slots that already exist in `existingGear`.
 */
export function expandGearCatalogToSlots(catalogItems, existingGear, headcount) {
  const effectivePeople = Math.max(4, Number(headcount) || 16);
  const suggestions = [];

  for (const spec of catalogItems) {
    const key = String(spec.ai_key || spec.base_name || '').trim().toLowerCase();
    const baseName = String(spec.base_name || '').trim();
    if (!baseName) continue;

    const { slotsNeeded, slotSize, unit } = computeRealisticSlotsNeeded(spec, effectivePeople);

    const existingMatching = existingGear.filter((g) => {
      if (g.ai_key && String(g.ai_key).toLowerCase() === key) return true;
      const gItem = String(g.item || '').toLowerCase();
      return gItem.includes(baseName.toLowerCase());
    });

    const existingCount = existingMatching.length;
    const missingSlots = Math.max(0, slotsNeeded - existingCount);

    for (let i = 0; i < missingSlots; i++) {
      const slotIndex = existingCount + i + 1;

      // Only show parenthetical quantity when slotSize > 1 (e.g. "12 יח׳", "2 ק״ג")
      const qtyLabel = slotSize > 1 ? `${slotSize} ${unit}` : '';
      const slotSuffix = slotsNeeded > 1 ? ` #${slotIndex}` : '';
      const hasQtyInBaseName = qtyLabel && baseName.includes(String(slotSize));
      const fullItemTitle =
        qtyLabel && !hasQtyInBaseName
          ? `${baseName} (${qtyLabel})${slotSuffix}`
          : `${baseName}${slotSuffix}`;

      const reasonText =
        existingCount > 0
          ? `השלמת כמות עבור ${effectivePeople} משתתפים (קיימים ${existingCount}, נדרשים ${slotsNeeded})`
          : spec.reason || `מותאם ל-${effectivePeople} משתתפים`;

      suggestions.push({
        ai_key: key,
        item: fullItemTitle,
        quantity: qtyLabel,
        needed_for: spec.needed_for || 'כללי',
        reason: reasonText,
      });
    }
  }

  return suggestions;
}

/**
 * AGENT 3: Generates headcount-scaled gear, cooking tools, and supply slots
 * tailored to the trip's meals, schedule, and participant headcount.
 */
export async function runGearAgent(env, trip, mealsList = [], existingGear = [], headcount = 20) {
  const effectivePeople = Math.max(4, Number(headcount) || 16);
  const client = getGenAIClient(env);
  let catalogItems = null;

  if (client) {
    try {
      const mealsSummary =
        mealsList.length > 0
          ? mealsList.map((m) => `- ${m.title}: ${m.menu || ''}`).join('\n')
          : 'ארוחת ערב, ארוחת בוקר, פק״ל קפה';

      const existingGearSummary =
        existingGear.length > 0
          ? existingGear
              .map((g) => `- ${g.item} [ai_key=${g.ai_key || 'user'}] (${g.needed_for || 'כללי'})`)
              .join('\n')
          : 'טרם נוספו כלים או מצרכים';

      const prompt = [
        'אתה סוכן AI מומחה ללוגיסטיקה, כלים ומצרכים לטיולי משפחות (סוכן 3: כלים, מצרכים והשלמות).',
        `שם הטיול: ${trip.name}`,
        `מקום לינה: ${trip.lodging || 'שטח / קמפינג'}`,
        `מסלולים: ${trip.destination || ''}`,
        `פרטים נוספים: ${trip.schedule || ''}`,
        `מספר משתתפים לחישוב כמויות: ${effectivePeople} נפשות (מתוכם כמחצית ילדים!)`,
        `ארוחות ותפקידים בטיול:\n${mealsSummary}`,
        `פריטים שכבר קיימים ברשימה:\n${existingGearSummary}`,
        '',
        'הנחיות חשובות לחישוב כמויות ריאליות ומאוזנות (לא להגזים בכמויות!):',
        '1. זכור שמחצית מהמשתתפים הם ילדים, וכל ארוחה כוללת מגוון מנות על השולחן – לכן הכמויות צריכות להיות הגיוניות וצנועות:',
        '   - חלות לשבת: חלה אחת מספיקה ל-8–10 אנשים. עבור 25 איש מספיקות 2–3 חלות סה״כ (1–2 מנות של 2 חלות, per_person_qty: 0.12, slot_size: 2).',
        '   - ביצים לארוחת בוקר: כ-0.85 ביצה לאדם בממוצע. עבור 25 איש מספיקות 2 תבניות של 12 ביצים (per_person_qty: 0.85, slot_size: 12).',
        '   - לחמניות / פיתות: כ-0.85 יחידה לאדם (per_person_qty: 0.85, slot_size: 10 -> 2 מארזים ל-25 איש).',
        '   - ירקות לסלט / פירות לדרך: כ-0.12 ק״ג לאדם (per_person_qty: 0.12, slot_size: 2 ק״ג -> 1–2 מנות ל-25 איש).',
        '   - גבינות / ממרחים / חומוס / חטיפים / דגני בוקר וחלב: מארז משותף אחד לכל ~14 משתתפים (1–2 מנות בלבד לקבוצה של 25 איש).',
        '   - ציוד קבוצתי (פק״ל קפה, תיונים, שקיות אשפה, כלים מתכלים, מחצלת, סיר/מחבת): הגדר per_person_qty: 0 ו-fixed_slots: 1 (או 2 לכל היותר).',
        '2. אל תכלול את הכמות בתוך base_name (למשל כתוב "חלות לשבת" ולא "חלות לשבת (2 יח׳)"), כי המערכת מוסיפה את הכמות אוטומטית.',
        '3. אם יש פריטים שכבר קיימים עם ai_key, השתמש באותו ai_key ו-base_name.',
      ].join('\n');

      const interaction = await client.interactions.create({
        model: 'gemini-3.8-flash',
        input: prompt,
        generation_config: {
          thinking_level: 'low',
        },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: GEAR_SCHEMA,
        },
      });

      const parsed = JSON.parse(interaction.output_text || '{}');
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        catalogItems = parsed.items;
      }
    } catch (err) {
      console.warn('Gemini gear agent fallback:', err?.message || err);
    }
  }

  if (!catalogItems) {
    catalogItems = buildFallbackGearCatalog(trip, mealsList);
  }

  return expandGearCatalogToSlots(catalogItems, existingGear, effectivePeople);
}
