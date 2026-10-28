import { getGenAIClient, detectTripTheme } from './geminiClient.js';

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

function generateStylizedSvgDataUrl(trip, styleObj, theme) {
  const [bg, sunCol, accent1, accent2, hill1, hill2] = styleObj.palette;
  const seed = Array.from(String(trip.name || 'trip')).reduce((s, c) => s + c.charCodeAt(0), 0);
  const sunX = 180 + (seed % 440);
  const sunY = 95 + (seed % 45);

  const landscapeElements =
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
    ${landscapeElements}
    <polygon points="350,365 395,295 440,365" fill="${bg}" stroke="${hill2}" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="395,295 395,365 440,365" fill="${sunCol}" opacity="0.85"/>
    <polygon points="465,372 498,320 532,372" fill="${bg}" stroke="${hill2}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M310 382 C302 365 316 352 320 340 C326 352 338 365 330 382 Z" fill="${accent1}"/>
    <path d="M315 382 C311 370 318 362 320 354 C323 362 329 370 325 382 Z" fill="${sunCol}"/>
    <line x1="302" y1="385" x2="338" y2="379" stroke="${hill2}" stroke-width="5" stroke-linecap="round"/>
    <line x1="304" y1="379" x2="336" y2="385" stroke="${hill2}" stroke-width="5" stroke-linecap="round"/>
  </svg>`;

  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * AGENT 1: Generates a unique, non-realistic artistic illustration for a trip.
 * Uses Gemini 3.8 Flash as art director and Gemini 3.1 Flash Image for rendering.
 */
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
        generation_config: {
          thinking_level: 'low',
        },
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

  const styleObj = IMAGE_STYLES[chosenStyleKey];
  const svgDataUrl = generateStylizedSvgDataUrl(trip, styleObj, theme);
  return {
    image_url: `/api/trips/${trip.id}/image?v=${Date.now()}`,
    image_style: styleObj.label,
    image_data: svgDataUrl,
    ai_generated: false,
  };
}

/**
 * Stores generated image data in 400KB chunks inside `trip_image_chunks`
 * so Cloudflare D1 never exceeds its 1MB SQLite row/statement limit.
 */
export async function saveTripImageData(db, tripId, imageUrl, imageStyle, imageData) {
  await db.prepare('DELETE FROM trip_image_chunks WHERE trip_id = ?').bind(tripId).run();
  if (imageData && imageData.length > 0) {
    const CHUNK_SIZE = 400000;
    for (let i = 0, idx = 0; i < imageData.length; i += CHUNK_SIZE, idx++) {
      const part = imageData.slice(i, i + CHUNK_SIZE);
      await db
        .prepare('INSERT INTO trip_image_chunks (trip_id, chunk_idx, data) VALUES (?, ?, ?)')
        .bind(tripId, idx, part)
        .run();
    }
  }
  await db
    .prepare('UPDATE trips SET image_url = ?, image_style = ?, image_data = ? WHERE id = ?')
    .bind(imageUrl || '', imageStyle || '', '', tripId)
    .run();
}

/**
 * Serves a trip's generated illustration from R2, D1 `trip_image_chunks`, or legacy `trips.image_data`.
 */
export async function serveTripImage(env, db, tripId) {
  if (env.TRIP_IMAGES && typeof env.TRIP_IMAGES.get === 'function') {
    const obj = await env.TRIP_IMAGES.get(`trip-${tripId}`);
    if (obj) {
      return new Response(obj.body, {
        headers: {
          'content-type': obj.httpMetadata?.contentType || 'image/png',
          'cache-control': 'public, max-age=86400',
        },
      });
    }
  }

  const { results: chunks = [] } = await db
    .prepare('SELECT data FROM trip_image_chunks WHERE trip_id = ? ORDER BY chunk_idx ASC')
    .bind(tripId)
    .all();

  let dataUri = chunks.length > 0 ? chunks.map((c) => c.data).join('') : '';
  if (!dataUri) {
    const row = await db.prepare('SELECT image_data FROM trips WHERE id = ?').bind(tripId).first();
    dataUri = row?.image_data || '';
  }

  if (dataUri && dataUri.startsWith('data:')) {
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
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

  return null;
}
