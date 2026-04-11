/* =====================================================
   Healthcare+  ·  AI Chatbot Routes
   POST /api/chatbot/chat
   GET  /api/chatbot/history/:sessionId
   ===================================================== */
const express    = require('express');
const router     = express.Router();
const db         = require('../db/connection');
const Anthropic  = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* Body-part / symptom → specialist fast lookup */
const BODY_SPEC_MAP = {
  'heart|chest|cardiac|cardiovascular|bp|blood pressure|palpitation': 'Cardiologist',
  'bone|joint|knee|spine|back|fracture|shoulder|hip|ankle':           'Orthopedic',
  'brain|nerve|headache|migraine|epilepsy|stroke|dizzy':              'Neurologist',
  'skin|acne|rash|eczema|hair|nail|psoriasis|itching':               'Dermatologist',
  'child|baby|infant|kid|pediatric|growth':                           'Pediatrician',
  'eye|vision|blur|cataract|glaucoma|retina|spectacle':               'Ophthalmologist',
  'ear|nose|throat|sinus|tonsil|hearing|ent':                         'ENT Specialist',
  'lung|breathing|asthma|cough|respiratory|bronchitis|pneumonia':     'Pulmonologist',
  'stomach|liver|intestine|digestion|acidity|ulcer|constipation':     'Gastroenterologist',
  'diabetes|thyroid|hormone|insulin|sugar|endocrine':                 'Endocrinologist',
  'mental|anxiety|depression|stress|insomnia|psychology|mood':        'Psychiatrist',
  'kidney|bladder|urine|prostate|urinary|uti':                        'Urologist',
  'women|pregnancy|uterus|ovary|menstrual|fertility|gynec':           'Gynecologist',
  'cancer|tumor|chemotherapy|biopsy|oncology':                        'Oncologist',
};

function buildFallbackReply(message, docs) {
  const ml = message.toLowerCase();

  for (const [kw, spec] of Object.entries(BODY_SPEC_MAP)) {
    if (kw.split('|').some(k => ml.includes(k))) {
      const suggested = docs.filter(d => d.specialization === spec).slice(0, 3);
      const doctorText = suggested.length
        ? ` Top matches: ${suggested.map(d => `${d.name} at ${d.hospital}`).join(', ')}.`
        : '';
      return {
        reply: `Based on your symptoms, you should consult a ${spec}. They can evaluate this properly and guide treatment.${doctorText} Would you like to book an appointment from the Find Doctors section?`,
        suggested_doctors: suggested,
      };
    }
  }

  if (/book|appointment|schedule/.test(ml)) {
    return {
      reply: 'You can book an appointment from the Appointments section by choosing a doctor, date, and time slot. If you tell me your symptom, I can suggest the right specialist first.',
      suggested_doctors: [],
    };
  }

  if (/medicine|tablet|pill|dose|reminder/.test(ml)) {
    return {
      reply: 'You can use the Medicines section to track doses, refill stock, and send WhatsApp reminders. If you want, I can also help identify which specialist to consult for your condition.',
      suggested_doctors: [],
    };
  }

  if (/hospital|clinic/.test(ml)) {
    return {
      reply: 'Healthcare+ includes partner hospitals and doctor listings. Open the Hospitals or Find Doctors section and I can help narrow it down by symptom or specialty.',
      suggested_doctors: [],
    };
  }

  return {
    reply: 'I can help with finding the right doctor, booking appointments, and managing medicines. Tell me a symptom, body part, or the type of doctor you need.',
    suggested_doctors: [],
  };
}

/* ── POST /chat ─────────────────────────────────────── */
router.post('/chat', async (req, res) => {
  try {
    const { message, session_id, conversation_history = [], user_id } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });

    /* Fetch live context from DB */
    const [specs]  = await db.query('SELECT name, keywords, icon FROM specializations');
    const [hosps]  = await db.query("SELECT id, name, city, rating FROM hospitals WHERE status = 'active'");
    const [docs]   = await db.query(
      `SELECT d.id, d.name, d.experience_years, d.consultation_fee, d.available_days, d.rating,
              s.name AS specialization, h.name AS hospital, h.city
       FROM   doctors d
       LEFT JOIN specializations s ON d.specialization_id = s.id
       LEFT JOIN hospitals       h ON d.hospital_id       = h.id
       WHERE  d.status = 'active'
       ORDER BY d.rating DESC`
    );

    const systemPrompt = `You are HealthBot+, the AI assistant for Healthcare+ — a comprehensive Indian healthcare platform.
Be friendly, empathetic and concise (2-4 sentences unless in a multi-step booking flow).

## Your capabilities
1. Book appointments — guide the user step-by-step
2. Find doctors — suggest the RIGHT specialist from symptoms or body parts
3. Track medicines — help understand the Medicines section
4. Answer basic health questions (always recommend seeing a doctor for diagnosis)

## Smart Specialist Matching
- If user mentions a body part or symptom → map to the correct specialist
- Explain WHY they need that type of doctor
- Suggest available doctors from our platform
- Map: ${JSON.stringify(BODY_SPEC_MAP)}

## Platform Specializations
${specs.map(s => `- ${s.icon} ${s.name}: ${s.keywords}`).join('\n')}

## Partner Hospitals
${hosps.map(h => `- ${h.name}, ${h.city} (⭐${h.rating})`).join('\n')}

## Top Doctors (first 20)
${docs.slice(0,20).map(d => `- ${d.name} | ${d.specialization} | ${d.hospital}, ${d.city} | ₹${d.consultation_fee} | ⭐${d.rating}`).join('\n')}

## Rules
- Use emojis sparingly
- Emergency keywords (chest pain, can't breathe, stroke) → immediately say "Please call 108 or go to the nearest Emergency"
- Always end with a helpful follow-up question or next-action button hint
- Respond in the same language the user uses`;

    const messages = [
      ...conversation_history.slice(-10),
      { role: 'user', content: message },
    ];

    const ml = message.toLowerCase();
    let suggested_doctors = [];
    for (const [kw, spec] of Object.entries(BODY_SPEC_MAP)) {
      if (kw.split('|').some(k => ml.includes(k))) {
        suggested_doctors = docs.filter(d => d.specialization === spec).slice(0, 3);
        break;
      }
    }

    let reply = '';
    try {
      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:     systemPrompt,
        messages,
      });
      reply = response.content[0].text;
    } catch (aiErr) {
      console.warn('[chatbot] falling back to local logic:', aiErr.message);
      const fallback = buildFallbackReply(message, docs);
      reply = fallback.reply;
      suggested_doctors = fallback.suggested_doctors;
    }

    /* Persist to DB */
    if (session_id) {
      await db.query('INSERT INTO chat_history (session_id, user_id, role, message) VALUES (?, ?, ?, ?)', [session_id, user_id || null, 'user',      message]);
      await db.query('INSERT INTO chat_history (session_id, user_id, role, message) VALUES (?, ?, ?, ?)', [session_id, user_id || null, 'assistant', reply]);
    }

    res.json({ success: true, message: reply, suggested_doctors, session_id });
  } catch (err) {
    console.error('[chatbot]', err.message);
    res.status(500).json({
      success: false,
      message: "I'm having a moment — please try again shortly. If urgent, call 108.",
      error:   err.message,
    });
  }
});

/* ── GET /history/:sessionId ────────────────────────── */
router.get('/history/:sessionId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM chat_history WHERE session_id = ? ORDER BY created_at ASC',
      [req.params.sessionId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
