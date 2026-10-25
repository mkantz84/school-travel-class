export const IMAGE_STYLES = {
  watercolor_storybook: {
    id: 'watercolor_storybook',
    label: 'צבעי מים – איור ספר ילדים',
    promptStyle:
      'Whimsical hand-painted watercolor and soft ink storybook illustration, warm textured paper, gentle washes of color, charming stylized nature, non-realistic artistic style, no text or letters',
    palette: ['#FEF6E4', '#F3D2C1', '#8BD3DD', '#2A9D8F', '#E76F51', '#264653'],
  },
  paper_cut_craft: {
    id: 'paper_cut_craft',
    label: 'אמנות גזרי נייר בשכבות',
    promptStyle:
      'Layered 3D paper-cut diorama art style, textured colored craft paper layers with subtle depth shadows, geometric stylized trees, hills and tents, vibrant handcrafted aesthetic, non-realistic, no text',
    palette: ['#FFF8F0', '#F4A261', '#E76F51', '#2A9D8F', '#1F7A6E', '#1D3557'],
  },
  linocut_folk: {
    id: 'linocut_folk',
    label: 'הדפס עץ ואמנות פולק',
    promptStyle:
      'Artistic block-print linocut folk illustration, bold carved line textures, warm earthy terracotta, sage green, ochre and indigo palette, stylized outdoor adventure art, non-realistic, no text',
    palette: ['#F9F4EA', '#E9C46A', '#E76F51', '#2A9D8F', '#264653', '#1B2A32'],
  },
  vintage_travel_poster: {
    id: 'vintage_travel_poster',
    label: 'פוסטר טיולים רטרו מאויר',
    promptStyle:
      'Mid-century vintage screenprint travel poster illustration, flat graphic shapes, sun-drenched Israeli landscape colors, stylized scenic horizon, retro artistic grain, non-realistic, no text or typography',
    palette: ['#FDF0D5', '#F4A261', '#E63946', '#457B9D', '#2A9D8F', '#1D3557'],
  },
  gouache_whimsical: {
    id: 'gouache_whimsical',
    label: 'איור גואש פסטלי קסום',
    promptStyle:
      'Matte gouache painting with playful brush strokes, rich pastel and botanical tones, dreamy stylized Israeli nature landscape, cozy family camping atmosphere, non-realistic illustration, no text',
    palette: ['#F8F9FA', '#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#073B4C'],
  },
};

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function analyzeTripDates(startDate, endDate) {
  if (!startDate) {
    return { numDays: 2, numNights: 1, dayLabels: ['יום 1 (ערב)', 'יום 2 (בוקר וצהריים)'] };
  }
  const start = new Date(startDate + 'T12:00:00');
  const end = endDate ? new Date(endDate + 'T12:00:00') : start;
  const diffDays = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const numDays = Math.min(7, diffDays + 1);
  const numNights = Math.max(0, numDays - 1);

  const dayLabels = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayName = HEBREW_DAYS[d.getDay()];
    dayLabels.push(`יום ${dayName} (${d.getDate()}/${d.getMonth() + 1})`);
  }
  return { numDays, numNights, dayLabels };
}

export function detectTripTheme(trip) {
  const hay = [trip.name, trip.destination, trip.lodging, trip.schedule].join(' ').toLowerCase();
  if (/מדבר|נגב|ערבה|מכתש|דרום|ים המלח|מצדה|נחל פרצים|צאלים|חאן|כוכבים/.test(hay)) {
    return 'desert';
  }
  if (/נחל|מים|כנרת|ים|מעיין|ירדן|חצבני|בניאס|דן|סחנה|חוף|אגם|גליל עליון/.test(hay)) {
    return 'water';
  }
  return 'forest';
}

function getGenAIClient(env) {
  const apiKey = env?.GEMINI_API_KEY;
  if (!apiKey) return null;

  return {
    interactions: {
      async create(body) {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Gemini Interactions API error (${res.status}): ${errText}`);
        }
        const interaction = await res.json();
        const steps = Array.isArray(interaction.steps) ? interaction.steps : [];

        // Extract output_text and output_images from model_output steps (matching @google/genai SDK)
        const textParts = [];
        const outputImages = [];
        for (const step of steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const item of step.content) {
              if (item.type === 'text' && item.text) {
                textParts.push(item.text);
              } else if (item.type === 'image' && item.data) {
                outputImages.push(item);
              }
            }
          }
        }
        return {
          ...interaction,
          output_text: textParts.join(''),
          output_image: outputImages[0] || undefined,
          output_images: outputImages,
        };
      },
    },
  };
}

function generateStylizedSvgDataUrl(trip, styleObj, theme) {
  const [bg, sunCol, accent1, accent2, hill1, hill2] = styleObj.palette;
  const seed = Array.from(String(trip.name || 'trip')).reduce((s, c) => s + c.charCodeAt(0), 0);
  const sunX = 180 + (seed % 440);
  const sunY = 95 + (seed % 45);

  const desertElements =
    theme === 'desert'
      ? `<path d="M0 320 Q200 240 420 300 T800 270 L800 450 L0 450 Z" fill="${accent1}" opacity="0.85"/>
         <path d="M0 355 Q280 290 540 345 T800 330 L800 450 L0 450 Z" fill="${hill1}"/>
         <circle cx="${sunX}" cy="${sunY}" r="58" fill="${sunCol}" opacity="0.9"/>`
      : theme === 'water'
      ? `<circle cx="${sunX}" cy="${sunY}" r="48" fill="${sunCol}" opacity="0.9"/>
         <path d="M0 290 Q180 220 380 280 T800 250 L800 450 L0 450 Z" fill="${accent2}" opacity="0.8"/>
         <path d="M0 350 Q260 320 480 360 T800 345 L800 450 L0 450 Z" fill="${hill1}"/>
         <path d="M120 395 Q260 375 400 395 T680 395" stroke="${bg}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.7"/>
         <path d="M180 420 Q320 400 460 420 T720 420" stroke="${bg}" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.5"/>`
      : `<circle cx="${sunX}" cy="${sunY}" r="46" fill="${sunCol}" opacity="0.9"/>
         <path d="M0 285 Q220 200 450 275 T800 240 L800 450 L0 450 Z" fill="${accent2}" opacity="0.85"/>
         <path d="M0 340 Q300 275 560 335 T800 320 L800 450 L0 450 Z" fill="${hill1}"/>
         <polygon points="130,250 105,335 155,335" fill="${hill2}"/>
         <polygon points="175,265 153,340 197,340" fill="${hill2}" opacity="0.85"/>
         <polygon points="640,245 612,335 668,335" fill="${hill2}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${sunCol}" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#sky)"/>
    ${desertElements}
    <!-- Stylized family tents & campfire -->
    <polygon points="350,365 395,295 440,365" fill="${bg}" stroke="${hill2}" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="395,295 395,365 440,365" fill="${sunCol}" opacity="0.85"/>
    <polygon points="465,372 498,320 532,372" fill="${bg}" stroke="${hill2}" stroke-width="3.5" stroke-linejoin="round"/>
    <!-- Campfire -->
    <path d="M310 382 C302 365 316 352 320 340 C326 352 338 365 330 382 Z" fill="${accent1}"/>
    <path d="M315 382 C311 370 318 362 320 354 C323 362 329 370 325 382 Z" fill="${sunCol}"/>
    <line x1="302" y1="385" x2="338" y2="379" stroke="${hill2}" stroke-width="5" stroke-linecap="round"/>
    <line x1="304" y1="379" x2="336" y2="385" stroke="${hill2}" stroke-width="5" stroke-linecap="round"/>
  </svg>`;

  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

// ============================================================================
// AGENT 1: Unique Trip Illustration Generator
// ============================================================================
export async function runImageAgent(env, trip) {
  const styleKeys = Object.keys(IMAGE_STYLES);
  const seed = Array.from(String(trip.name || '') + String(trip.destination || '')).reduce(
    (acc, ch) => acc + ch.charCodeAt(0),
    0
  );
  let chosenStyleKey = styleKeys[seed % styleKeys.length];
  const theme = detectTripTheme(trip);
  const client = getGenAIClient(env);

  if (client) {
    try {
      // Step 1: Let Gemini 3.8 Flash pick the ideal artistic style and compose a vivid scene prompt
      const styleDecisionSchema = {
        type: 'object',
        properties: {
          style_id: {
            type: 'string',
            enum: styleKeys,
          },
          scene_prompt: {
            type: 'string',
            description:
              'English visual description of the trip landscape, lodging atmosphere, and outdoor elements (no text in image)',
          },
        },
        required: ['style_id', 'scene_prompt'],
      };

      const styleDirectorPrompt = [
        'You are an art director for an Israeli family camping & travel app.',
        `Trip Name: ${trip.name || ''}`,
        `Destination / Routes: ${trip.destination || 'טבע ישראלי'}`,
        `Lodging: ${trip.lodging || 'קמפינג / לינת שטח'}`,
        `Details: ${trip.schedule || ''}`,
        `Dates: ${trip.start_date || ''} to ${trip.end_date || ''}`,
        'Choose the best artistic style_id and write a rich English scene_prompt that captures this specific trip nature. Do not include any text, letters, or realistic photography.',
      ].join('\n');

      const directorRes = await client.interactions.create({
        model: 'gemini-3.8-flash',
        input: styleDirectorPrompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: styleDecisionSchema,
        },
      });

      const parsedDirector = JSON.parse(directorRes.output_text || '{}');
      if (parsedDirector.style_id && IMAGE_STYLES[parsedDirector.style_id]) {
        chosenStyleKey = parsedDirector.style_id;
      }
      const styleObj = IMAGE_STYLES[chosenStyleKey];
      const finalImagePrompt = `${styleObj.promptStyle}. Scene: ${
        parsedDirector.scene_prompt ||
        `Scenic Israeli ${theme} landscape with cozy family camping atmosphere`
      }. Pure illustration, no words, no text, no watermarks.`;

      // Step 2: Generate the unique illustration using gemini-3.1-flash-image
      const imgRes = await client.interactions.create({
        model: 'gemini-3.1-flash-image',
        input: finalImagePrompt,
        response_format: {
          type: 'image',
          aspect_ratio: '16:9',
          image_size: '1K',
        },
      });

      const outImg = imgRes.output_image;
      if (outImg && outImg.data) {
        const mimeType = outImg.mime_type || 'image/png';
        const dataUrl = `data:${mimeType};base64,${outImg.data}`;

        if (env.TRIP_IMAGES && typeof env.TRIP_IMAGES.put === 'function') {
          const binary = Uint8Array.from(atob(outImg.data), (c) => c.charCodeAt(0));
          await env.TRIP_IMAGES.put(`trip-${trip.id}`, binary, {
            httpMetadata: { contentType: mimeType },
          });
        }

        return {
          image_url: `/api/trips/${trip.id}/image?v=${Date.now()}`,
          image_style: styleObj.label,
          image_data: dataUrl,
          ai_generated: true,
        };
      }
    } catch (err) {
      console.warn('Gemini image agent fallback:', err?.message || err);
    }
  }

  // Fallback: unique stylized SVG illustration in the chosen artistic language
  const styleObj = IMAGE_STYLES[chosenStyleKey];
  const svgDataUrl = generateStylizedSvgDataUrl(trip, styleObj, theme);
  return {
    image_url: `/api/trips/${trip.id}/image?v=${Date.now()}`,
    image_style: styleObj.label,
    image_data: svgDataUrl,
    ai_generated: false,
  };
}

// ============================================================================
// AGENT 2: Roles & Meals Planner
// ============================================================================
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

  // Deduplicate against existing meals by ai_key or normalized title
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

// ============================================================================
// AGENT 3: Gear, Supplies & Headcount-Scaled Quantities Planner
// ============================================================================
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

    // Count how many slots of this item already exist in the trip's gear list
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
