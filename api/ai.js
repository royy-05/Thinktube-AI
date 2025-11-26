// api/ai.js - AI-powered YouTube video transcript analysis API

// -------------------------------
// CONFIGURATION
// -------------------------------
const rateLimitStore = new Map();

const CONFIG = {
  MAX_DESCRIPTION_LENGTH: 10000,
  RATE_LIMIT_REQUESTS: 10,
  RATE_LIMIT_WINDOW: 60 * 1000,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'models/gemini-2.5-flash',
  REQUEST_TIMEOUT: 30000,
};


// -------------------------------
// CORS HANDLER
// -------------------------------
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}


// -------------------------------
// RATE LIMITING
// -------------------------------
function checkRateLimit(clientId) {
  const now = Date.now();
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(t => t > windowStart);
    if (validTimestamps.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, validTimestamps);
  }

  const clientRequests = rateLimitStore.get(clientId) || [];
  if (clientRequests.filter(t => t > windowStart).length >= CONFIG.RATE_LIMIT_REQUESTS) {
    return false;
  }

  clientRequests.push(now);
  rateLimitStore.set(clientId, clientRequests);
  return true;
}

function getClientId(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'unknown';
}


// -------------------------------
// INPUT VALIDATION
// -------------------------------
function validateInput(text) {
  if (!text) return { isValid: false, error: 'Input is required' };
  if (typeof text !== 'string') return { isValid: false, error: 'Input must be text' };
  if (text.trim().length === 0) return { isValid: false, error: 'Input cannot be empty' };

  if (text.length > CONFIG.MAX_DESCRIPTION_LENGTH) {
    return { isValid: false, error: `Too long. Max ${CONFIG.MAX_DESCRIPTION_LENGTH} characters allowed.` };
  }

  return { isValid: true, sanitized: text.trim() };
}


// -------------------------------
// PROMPT GENERATOR (THE MAGIC 🧠)
// -------------------------------
function generatePrompt(requestType, data) {
  if (requestType === 'summary') {
    return `
You are an AI that summarizes YouTube video transcripts.
Summarize the following transcript clearly in under 200 words:

${data.description}
    `;
  }

  if (requestType === 'question') {
    return `
You are an AI assistant analyzing a YouTube video transcript.

VIDEO TITLE: ${data.title}
USER QUESTION: ${data.customPrompt}

If the answer exists in the transcript, reply with a helpful answer.
If needed, give a short answer AND a detailed explanation separately.
Example format:

Short Answer: ...
Detailed Explanation: ...
    `;
  }

  return data.description;
}


// -------------------------------
// ERROR LOGGER
// -------------------------------
function logError(context, error, info = {}) {
  console.error(
    'API Error:',
    JSON.stringify({ timestamp: new Date().toISOString(), context, error: error.message || error, ...info }, null, 2)
  );
}


// -------------------------------
// MAIN HANDLER
// -------------------------------
export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed — Use POST' });
  }

  const clientId = getClientId(req);
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: 60 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY in Vercel env' });
  }

  // -------------------------------
  // REQUEST BODY PROCESSING
  // -------------------------------
  try {
    const { description, title, customPrompt } = req.body;
    let requestType = 'summary';
    let validatedData;

    if (customPrompt) {
      requestType = 'question';
      validatedData = validateInput(
        `Title: ${title}\nTranscript: ${description}\nUser Question: ${customPrompt}`
      );
    } else {
      validatedData = validateInput(description);
    }

    if (!validatedData.isValid) {
      return res.status(400).json({ error: validatedData.error });
    }

    // -------------------------------
    // GEMINI API REQUEST
    // -------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${CONFIG.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: generatePrompt(requestType, { description, title, customPrompt }) }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500,
          },
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      logError('Gemini Error', data, { status: response.status });
      return res.status(500).json({ error: 'Gemini API error', details: data });
    }

    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'AI could not generate a response.';

    return res.status(200).json({
      response: result.trim(),
      metadata: { model: CONFIG.GEMINI_MODEL, timestamp: new Date().toISOString() }
    });

  } catch (err) {
    logError('Server Error', err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}
