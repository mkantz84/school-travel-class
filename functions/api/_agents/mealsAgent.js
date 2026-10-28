import { getGenAIClient, analyzeTripDates } from './geminiClient.js';

const MEALS_SCHEMA = {
  type: 'object',
  properties: {
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ai_key: {
            type: 'string',
            description: 'Unique stable slug key, e.g. day1_dinner, day2_breakfast, campfire_marshmallows',
          },
          title: {
            type: 'string',
            description: 'Short Hebrew title of the meal or trip responsibility role',
          },
          menu: {
            type: 'string',
            description: 'Suggested Hebrew menu or role description tailored to the trip',
          },
          reason: {
            type: 'string',
            description: 'Short Hebrew explanation of why this meal/role is needed for this trip',
          },
        },
        required: ['ai_key', 'title', 'menu', 'reason'],
      },
    },
  },
  required: ['roles'],
};

function buildFallbackMeals(trip, dateInfo) {
  const roles = [];
  const { numDays, numNights, dayLabels } = dateInfo;
  const hay = [trip.name, trip.destination, trip.lodging, trip.schedule].join(' ');

  for (let d = 0; d < numDays; d++) {
    const dayLabel = dayLabels[d] || `יום ${d + 1}`;
    if (d === 0) {
      roles.push({
        ai_key: `day${d + 1}_snack`,
        title: `נשנושי דרך ופריסה ראשונה (${dayLabel})`,
        menu: 'מאפים, פירות חתוכים, ירקות ושתייה קלה בתחילת המסלול',
        reason: `מותאם ליום הפתיחה של הטיול (${dayLabel})`,
      });
      if (numNights >= 1) {
        roles.push({
          ai_key: `day${d + 1}_dinner`,
          title: `ארוחת ערב משותפת (${dayLabel})`,
          menu: 'פויקה / על האש / פסטות בסירים גדולים, סלטים טריים וחומוס-פיתות',
          reason: `ארוחת ערב מרכזית ללינה ב${trip.lodging || 'שטח'}`,
        });
      }
    } else {
      roles.push({
        ai_key: `day${d + 1}_breakfast`,
        title: `ארוחת בוקר (${dayLabel})`,
        menu: 'ביצים / שקשוקה, גבינות, ירקות חתוכים, לחם טרי וממרחים',
        reason: `ארוחת בוקר ליום ה-${d + 1} של הטיול`,
      });
      roles.push({
        ai_key: `day${d + 1}_lunch`,
        title: `ארוחת צהריים / פיקניק בשטח (${dayLabel})`,
        menu: 'כריכים מושקעים, טונה, תירס, ירקות, חטיפים ופירות למסלול',
        reason: `ארוחת צהריים מזינה להמשך המסלול ב${trip.destination || 'טיול'}`,
      });
      if (d < numDays - 1) {
        roles.push({
          ai_key: `day${d + 1}_dinner`,
          title: `ארוחת ערב (${dayLabel})`,
          menu: 'ארוחה חמה משותפת סביב השולחן / המדורה',
          reason: `ארוחת ערב ללילה ה-${d + 1} בטיול`,
        });
      }
    }
  }

  roles.push({
    ai_key: 'coffee_and_cake',
    title: 'פק״ל קפה, תה ועוגות',
    menu: 'קפה שחור, תה צמחים, חלב, עוגיות ועוגות בחושות לאורך כל הטיול',
    reason: 'תפקיד קבוע לפינוק ההורים והילדים בעצירות ובחניון',
  });

  if (numNights >= 1 || /מדורה|קמפינג|אוהלים|חאן|שטח/.test(hay)) {
    roles.push({
      ai_key: 'campfire_night',
      title: 'מדורה, מרשמלו ותפוחי אדמה',
      menu: 'עצים למדורה, מרשמלו, שיפודים, תפוחי אדמה בנייר כסף ושוקו חם',
      reason: 'פעילות ערב מגבשת סביב המדורה בחניון הלילה',
    });
  }

  roles.push({
    ai_key: 'games_and_first_aid',
    title: 'משחקי חברה, הדרכה ועזרה ראשונה',
    menu: 'תיק עזרה ראשונה כיתתי, משחקי שטח וכדור, חידון קצר על המסלול',
    reason: 'בטיחות והפעלת הילדים בזמן ההתארגנות ובמסלול',
  });

  return roles;
}

/**
 * AGENT 2: Suggests trip roles and meals based on trip dates, lodging, routes, and schedule.
 * Deduplicates against any existing roles/meals already on the trip.
 */
export async function runMealsAgent(env, trip, existingMeals = [], headcount = 20) {
  const dateInfo = analyzeTripDates(trip.start_date, trip.end_date);
  const client = getGenAIClient(env);

  let rawRoles = null;
  if (client) {
    try {
      const existingSummary =
        existingMeals.length > 0
          ? existingMeals.map((m) => `- ${m.title} (${m.menu || 'ללא פירוט'})`).join('\n')
          : 'אין עדיין תפקידים רשומים';

      const prompt = [
        'אתה סוכן AI מומחה לתכנון טיולי משפחות וכיתות בישראל (סוכן 2: תפקידים וארוחות).',
        `שם הטיול: ${trip.name}`,
        `תאריכים: ${trip.start_date || 'לא צוין'} עד ${trip.end_date || 'לא צוין'} (${dateInfo.numDays} ימים, ${dateInfo.numNights} לילות: ${dateInfo.dayLabels.join(', ')})`,
        `מקום לינה: ${trip.lodging || 'לא צוין'}`,
        `מסלולי הטיול: ${trip.destination || 'לא צוין'}`,
        `פרטים נוספים / לו״ז: ${trip.schedule || 'לא צוין'}`,
        `מספר משתתפים משוער: כ-${headcount} נפשות`,
        `תפקידים וארוחות שכבר קיימים בטיול:\n${existingSummary}`,
        '',
        'הנחיות:',
        '1. בנה רשימה מותאמת של תפקידים וארוחות לפי מספר ימי הטיול, הלילות, אופי הלינה והמסלולים.',
        '2. כלול ארוחות לכל יום בטיול (ערב, בוקר, צהריים/פיקניק לפי הימים) וכן תפקידים חיוניים לטיול (כמו פק״ל קפה ועוגות, מדורה ומרשמלו אם יש לינת שטח, הדרכה/משחקים ועזרה ראשונה).',
        '3. אם כבר קיימים תפקידים בטיול, הצע רק תפקידים או ארוחות שחסרים כדי להשלים את התוכנית בלי לשכפל תפקידים קיימים.',
        '4. החזר הכל בעברית ברורה, חמה ומעשית להורים.',
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
          schema: MEALS_SCHEMA,
        },
      });

      const parsed = JSON.parse(interaction.output_text || '{}');
      if (Array.isArray(parsed.roles) && parsed.roles.length > 0) {
        rawRoles = parsed.roles;
      }
    } catch (err) {
      console.warn('Gemini meals agent fallback:', err?.message || err);
    }
  }

  if (!rawRoles) {
    rawRoles = buildFallbackMeals(trip, dateInfo);
  }

  const existingTitles = new Set(
    existingMeals.map((m) => String(m.title || '').trim().toLowerCase())
  );
  const existingKeys = new Set(
    existingMeals.map((m) => String(m.ai_key || '').trim().toLowerCase()).filter(Boolean)
  );

  return rawRoles.filter((r) => {
    const normTitle = String(r.title || '').trim().toLowerCase();
    const normKey = String(r.ai_key || '').trim().toLowerCase();
    if (!normTitle) return false;
    if (normKey && existingKeys.has(normKey)) return false;
    if (existingTitles.has(normTitle)) return false;
    return true;
  });
}
