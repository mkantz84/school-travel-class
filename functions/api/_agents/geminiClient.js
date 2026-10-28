const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * Zero-dependency Gemini Interactions API client for Cloudflare Workers / Pages Functions.
 * Calls https://generativelanguage.googleapis.com/v1beta/interactions directly via Web fetch.
 */
export function getGenAIClient(env) {
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

/**
 * Analyzes start_date and end_date into number of days, nights, and Hebrew day labels.
 */
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

/**
 * Detects the dominant landscape theme of a trip ('desert' | 'water' | 'forest').
 */
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

/**
 * Computes effective headcount from registered participants vs. trip.expected_people.
 */
export function calculateEffectiveHeadcount(trip, participants) {
  const registeredPeople = (participants || []).reduce(
    (sum, p) => sum + (Number(p.adults) || 0) + (Number(p.kids) || 0),
    0
  );
  const expected = Number(trip?.expected_people) || 0;
  return Math.max(registeredPeople, expected, 16);
}
