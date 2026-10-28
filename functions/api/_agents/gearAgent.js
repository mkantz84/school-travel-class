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
            description: 'Canonical key for this item type, e.g. eggs, pita_pack, salad_veggies, water_sixpack, cooking_pot, campfire_wood',
          },
          base_name: {
            type: 'string',
            description: 'Hebrew name of the tool or ingredient without quantity, e.g. ביצים, מארז פיתות, ירקות לסלט, סיר בישול גדול',
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
            description: 'Amount needed per person (0 if fixed equipment)',
          },
          slot_size: {
            type: 'number',
            description: 'How many units one family should bring in a single claimable slot (e.g. 12 for eggs, 10 for pitas, 1 for a pot)',
          },
          fixed_slots: {
            type: 'number',
            description: 'If per_person_qty is 0, how many total slots are needed for the group (e.g. 1 or 2)',
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
      base_name: 'ביצים לארוחת בוקר',
      needed_for: breakfastTitle,
      unit: 'יח׳',
      per_person_qty: 1.5,
      slot_size: 12,
      fixed_slots: 1,
      reason: 'חישוב של כ-1.5 ביצים למשתתף (חלוקה לתבניות של 12 ביצים למשפחה)',
    },
    {
      ai_key: 'salad_veggies',
      base_name: 'עגבניות, מלפפונים וירקות לסלט',
      needed_for: breakfastTitle,
      unit: 'ק״ג',
      per_person_qty: 0.2,
      slot_size: 2,
      fixed_slots: 1,
      reason: 'כ-200 גרם ירקות למשתתף (שקית של 2 ק״ג למשפחה)',
    },
    {
      ai_key: 'bread_and_pita',
      base_name: 'מארז פיתות / לחם פרוס טרי',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 1.5,
      slot_size: 10,
      fixed_slots: 1,
      reason: 'חבילת 10 פיתות/לחם לכל ~7 משתתפים',
    },
    {
      ai_key: 'spreads_cheeses',
      base_name: 'גבינות וממרחים (קוטג׳, לבנה, חומוס, טחינה)',
      needed_for: breakfastTitle,
      unit: 'מארז',
      per_person_qty: 0.12,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'מארז של 2-3 גבינות/ממרחים לכל ~8 משתתפים',
    },
    {
      ai_key: 'dinner_main_pot',
      base_name: 'סיר גדול / מחבת רחבה וכף הגשה',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 0.08,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'כלי בישול מרכזי לכל ~12 משתתפים',
    },
    {
      ai_key: 'camping_stove',
      base_name: 'כירת גז / גזייה ובלון גז תקין',
      needed_for: dinnerTitle,
      unit: 'יח׳',
      per_person_qty: 0.07,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'עמדת בישול לכל ~15 משתתפים',
    },
    {
      ai_key: 'cutting_board_knife',
      base_name: 'קרש חיתוך גדול וסכין חדה',
      needed_for: breakfastTitle,
      unit: 'סט',
      per_person_qty: 0.08,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'עמדת חיתוך סלטים והכנות משותפת',
    },
    {
      ai_key: 'fruits_and_snacks',
      base_name: 'פירות העונה ונשנושים למסלול',
      needed_for: lunchTitle,
      unit: 'מארז',
      per_person_qty: 0.1,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'מארז פירות וחטיפים לכל ~10 משתתפים במסלול',
    },
    {
      ai_key: 'coffee_kit_milk',
      base_name: 'חלב, עוגה בחושה ועוגיות לפק״ל קפה',
      needed_for: coffeeTitle,
      unit: 'מארז',
      per_person_qty: 0.09,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'חלב וכיבוד מתוק לפי מספר המשפחות בטיול',
    },
    {
      ai_key: 'water_coolers',
      base_name: 'שישיית מים מינרליים / ג׳ריקן מים',
      needed_for: 'כללי',
      unit: 'שישייה',
      per_person_qty: 0.12,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'גיבוי מים לשתייה ולבישול בשטח לפי כמות המשתתפים',
    },
    {
      ai_key: 'folding_table',
      base_name: 'שולחן שטח מתקפל ומפה',
      needed_for: 'כללי',
      unit: 'יח׳',
      per_person_qty: 0.08,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'שולחן הגשה ואכילה לכל ~12 משתתפים',
    },
    {
      ai_key: 'trash_bags_wipes',
      base_name: 'שקיות אשפה חזקות, מגבונים ונייר סופג',
      needed_for: 'כללי',
      unit: 'ערכה',
      per_person_qty: 0,
      slot_size: 1,
      fixed_slots: 2,
      reason: 'שמירה על ניקיון החניון והמסלול',
    },
  ];

  if (campfireTitle) {
    catalog.push({
      ai_key: 'campfire_wood_marshmallows',
      base_name: 'עצים למדורה, מרשמלו ונייר כסף',
      needed_for: campfireTitle,
      unit: 'ערכה',
      per_person_qty: 0.08,
      slot_size: 1,
      fixed_slots: 1,
      reason: 'עצים ומרשמלו לפי גודל הקבוצה סביב המדורה',
    });
  }

  return catalog;
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

    const perPerson = Number(spec.per_person_qty) || 0;
    const slotSize = Math.max(1, Number(spec.slot_size) || 1);
    const fixedSlots = Math.max(1, Number(spec.fixed_slots) || 1);

    let totalUnitsNeeded = slotSize * fixedSlots;
    let slotsNeeded = fixedSlots;

    if (perPerson > 0) {
      totalUnitsNeeded = Math.max(slotSize, Math.ceil(perPerson * effectivePeople));
      slotsNeeded = Math.max(1, Math.ceil(totalUnitsNeeded / slotSize));
    }

    const existingMatching = existingGear.filter((g) => {
      if (g.ai_key && String(g.ai_key).toLowerCase() === key) return true;
      const gItem = String(g.item || '').toLowerCase();
      return gItem.includes(baseName.toLowerCase());
    });

    const existingCount = existingMatching.length;
    const missingSlots = Math.max(0, slotsNeeded - existingCount);

    for (let i = 0; i < missingSlots; i++) {
      const slotIndex = existingCount + i + 1;
      const qtyLabel =
        slotSize > 1
          ? `${slotSize} ${spec.unit || 'יח׳'}`
          : spec.unit && spec.unit !== 'יח׳'
          ? `${spec.unit} 1`
          : '';
      const slotSuffix = slotsNeeded > 1 ? ` #${slotIndex}` : '';
      const fullItemTitle = qtyLabel
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
        `מספר משתתפים לחישוב כמויות: ${effectivePeople} נפשות`,
        `ארוחות ותפקידים בטיול:\n${mealsSummary}`,
        `פריטים שכבר קיימים ברשימה:\n${existingGearSummary}`,
        '',
        'הנחיות:',
        '1. הפק קטלוג של כלים, ציוד בישול/שטח ומצרכים מרכזיים (כגון ביצים, פיתות/לחם, ירקות לסלט, גבינות/ממרחים, סירים, גזייה, שולחנות מתקפלים, מים, פחמים/עצים למדורה וכו׳) בהתאם לתפריט הארוחות ולאופי הטיול.',
        '2. עבור מצרכים וציוד שתלויים במספר האנשים, הגדר per_person_qty (כמות לאדם) ו-slot_size (גודל מנה נוחה למשפחה אחת להביא, למשל 12 ביצים, 10 פיתות, 2 ק״ג ירקות, 1 סיר גדול) כדי שהמערכת תחלק את הכמות למספר מנות בין המשפחות.',
        '3. אם יש פריטים שכבר קיימים עם ai_key, השתמש באותו ai_key ו-base_name כדי שהמערכת תוכל לחשב אם צריך להוסיף עוד מנות מאותו פריט בעקבות גידול במספר המשתתפים.',
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
