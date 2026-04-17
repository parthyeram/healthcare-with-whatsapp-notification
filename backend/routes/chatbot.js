/* =====================================================
   Healthcare+  ·  AI Chatbot Routes
   POST /api/chatbot/chat
   GET  /api/chatbot/history/:sessionId
   ===================================================== */
const express = require('express');
const router  = express.Router();
const db      = require('../db/connection');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/* Body-part / symptom → specialist fast lookup */
const BODY_SPEC_MAP = {
  'heart|chest|cardiac|cardiovascular|bp|blood pressure|palpitation': 'Cardiologist',
  'bone|joint|knee|spine|back|fracture|shoulder|hip|ankle':           'Orthopedic',
  'brain|nerve|headache|migraine|epilepsy|stroke|dizzy':              'Neurologist',
  'skin|acne|rash|eczema|hair|nail|psoriasis|itching':                'Dermatologist',
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

const FOOD_GUIDANCE = {
  acidity: {
    eat: ['banana', 'oats', 'rice', 'curd', 'plain khichdi', 'coconut water'],
    avoid: ['spicy food', 'fried food', 'coffee', 'cola', 'citrus on empty stomach', 'late-night meals'],
    doctor: 'If acidity is frequent, causes vomiting, weight loss, black stools, or chest pain, see a doctor today.',
    specialist: 'Gastroenterologist',
  },
  cold: {
    remedies: ['drink warm water', 'take steam inhalation', 'rest well', 'use honey with warm water if suitable', 'eat light warm meals'],
    avoid: ['very cold drinks', 'smoking', 'sleeping too late'],
    doctor: 'See a doctor if you have breathing trouble, chest pain, fever for more than 3 days, or severe weakness.',
    specialist: 'General Physician',
  },
};

function findSuggestedDoctors(message, docs) {
  const ml = message.toLowerCase();
  for (const [kw, spec] of Object.entries(BODY_SPEC_MAP)) {
    if (kw.split('|').some(k => ml.includes(k))) {
      return docs.filter(d => d.specialization === spec).slice(0, 3);
    }
  }
  return [];
}

function buildDoctorSuggestionText(suggestedDoctors) {
  if (!suggestedDoctors.length) return '';
  return ` Suggested doctors: ${suggestedDoctors.map(d => `${d.name} (${d.specialization})`).join(', ')}.`;
}

function buildFallbackReply(message, docs) {
  const ml = message.toLowerCase();
  const suggestedDoctors = findSuggestedDoctors(message, docs);

  if (/how.*book|book.*appointment|appointment.*book/.test(ml)) {
    return {
      reply: 'To book an appointment: open Appointments, choose a doctor, pick a date, select an available time slot, then confirm. If you tell me your symptom first, I can suggest the right doctor before you book.',
      suggested_doctors: suggestedDoctors,
    };
  }

  if (/cancel.*appointment|appointment.*cancel/.test(ml)) {
    return {
      reply: 'To cancel an appointment, go to the Appointments section, open your booking, and use the cancel option if it is still active. If you cannot find it, tell me the doctor or date and I will guide you.',
      suggested_doctors: [],
    };
  }

  if (/health record|records|prescription|report|upload report/.test(ml)) {
    return {
      reply: 'Your records are in the Health Records section. You can upload prescriptions, lab reports, scans, and then view them there later whenever needed.',
      suggested_doctors: [],
    };
  }

  if (/acidity|acid reflux|heartburn|gastric/.test(ml)) {
    return {
      reply: `For acidity, you can eat: ${FOOD_GUIDANCE.acidity.eat.join(', ')}. Avoid: ${FOOD_GUIDANCE.acidity.avoid.join(', ')}. ${FOOD_GUIDANCE.acidity.doctor}${buildDoctorSuggestionText(suggestedDoctors)}`,
      suggested_doctors: suggestedDoctors.length ? suggestedDoctors : docs.filter(d => d.specialization === FOOD_GUIDANCE.acidity.specialist).slice(0, 3),
    };
  }

  if (/cold|runny nose|sore throat|blocked nose|common cold/.test(ml)) {
    return {
      reply: `For a simple cold, try: ${FOOD_GUIDANCE.cold.remedies.join(', ')}. Avoid: ${FOOD_GUIDANCE.cold.avoid.join(', ')}. ${FOOD_GUIDANCE.cold.doctor}${buildDoctorSuggestionText(suggestedDoctors)}`,
      suggested_doctors: suggestedDoctors.length ? suggestedDoctors : docs.filter(d => d.specialization === 'General Physician').slice(0, 3),
    };
  }

  if (/mild|minor|home|doctor.*today|need.*doctor/.test(ml)) {
    return {
      reply: 'If symptoms are mild and improving, home care may be enough for now. If they are getting worse, last more than 2 to 3 days, or include high fever, breathing trouble, chest pain, dehydration, or severe weakness, please see a doctor today.',
      suggested_doctors: suggestedDoctors,
    };
  }

  if (suggestedDoctors.length) {
    const spec = suggestedDoctors[0].specialization;
    return {
      reply: `Based on your symptoms, you should consult a ${spec}. This can help you get the right treatment faster.${buildDoctorSuggestionText(suggestedDoctors)} Would you like help booking an appointment?`,
      suggested_doctors: suggestedDoctors,
    };
  }

  if (/medicine|tablet|pill|dose|reminder/.test(ml)) {
    return {
      reply: 'In the Medicines section you can add your medicine, set reminder times, change them later, and send a WhatsApp reminder immediately. Tell me the condition too if you want food advice or doctor guidance.',
      suggested_doctors: [],
    };
  }

  return {
    reply: 'I can help with booking appointments, finding the right doctor, explaining app features, food advice for common problems, simple home care, and when to see a doctor. Tell me your symptom or ask something like "how do I book an appointment?"',
    suggested_doctors: [],
  };
}

function buildSystemPrompt(specs, hosps, docs) {
  return `You are HealthBot+, the AI assistant for Healthcare+.
Be friendly, practical, and easy to understand. Keep answers short and useful.

Your jobs:
1. Explain how to use the app step by step.
2. Answer FAQ questions like booking, canceling appointments, and finding records.
3. Give simple food advice for common issues like acidity.
4. Give basic home-care advice for common symptoms like cold, mild fever, or cough.
5. Tell the user whether home care is reasonable or whether they should see a doctor today.
6. Suggest the correct specialist and available doctors when needed.

Rules:
- Do not claim to diagnose.
- For emergencies like chest pain, breathing trouble, stroke signs, severe dehydration, fainting, or uncontrolled bleeding, say: "Please call 108 or go to the nearest emergency department now."
- For minor issues, give simple self-care steps and a clear doctor-visit threshold.
- For food advice, include "eat" and "avoid" lists in simple language.
- For product/how-to questions, explain the exact section of the app to open.
- End with one helpful next step.

Specialist map:
${JSON.stringify(BODY_SPEC_MAP)}

Platform specializations:
${specs.map(s => `- ${s.icon} ${s.name}: ${s.keywords}`).join('\n')}

Partner hospitals:
${hosps.map(h => `- ${h.name}, ${h.city} (rating ${h.rating})`).join('\n')}

Top doctors:
${docs.slice(0, 20).map(d => `- ${d.name} | ${d.specialization} | ${d.hospital}, ${d.city} | fee ${d.consultation_fee} | rating ${d.rating}`).join('\n')}
`;
}

async function callGemini(systemPrompt, conversationHistory, message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const contents = [
    ...conversationHistory.slice(-10).map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content || '' }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 700,
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
  }

  const text = (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

/* -- POST /chat --------------------------------------- */
router.post('/chat', async (req, res) => {
  try {
    const { message, session_id, conversation_history = [], user_id } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });

    const [specs] = await db.query('SELECT name, keywords, icon FROM specializations');
    const [hosps] = await db.query("SELECT id, name, city, rating FROM hospitals WHERE status = 'active'");
    const [docs]  = await db.query(
      `SELECT d.id, d.name, d.experience_years, d.consultation_fee, d.available_days, d.rating,
              s.name AS specialization, h.name AS hospital, h.city
       FROM doctors d
       LEFT JOIN specializations s ON d.specialization_id = s.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       WHERE d.status = 'active'
       ORDER BY d.rating DESC`
    );

    let suggested_doctors = findSuggestedDoctors(message, docs);
    let reply = '';

    try {
      const systemPrompt = buildSystemPrompt(specs, hosps, docs);
      reply = await callGemini(systemPrompt, conversation_history, message);
    } catch (aiErr) {
      console.warn('[chatbot] falling back to local logic:', aiErr.message);
      const fallback = buildFallbackReply(message, docs);
      reply = fallback.reply;
      suggested_doctors = fallback.suggested_doctors;
    }

    if (session_id) {
      await db.query(
        'INSERT INTO chat_history (session_id, user_id, role, message) VALUES (?, ?, ?, ?)',
        [session_id, user_id || null, 'user', message]
      );
      await db.query(
        'INSERT INTO chat_history (session_id, user_id, role, message) VALUES (?, ?, ?, ?)',
        [session_id, user_id || null, 'assistant', reply]
      );
    }

    res.json({ success: true, message: reply, suggested_doctors, session_id });
  } catch (err) {
    console.error('[chatbot]', err.message);
    res.status(500).json({
      success: false,
      message: "I'm having a moment. Please try again shortly. If urgent, call 108.",
      error: err.message,
    });
  }
});

/* -- GET /history/:sessionId -------------------------- */
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
