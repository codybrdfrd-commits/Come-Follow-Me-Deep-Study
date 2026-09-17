// Deep Study — AI Insight function
//
// This runs on Netlify's servers, never in the browser, which is the whole
// point: your ANTHROPIC_API_KEY lives in Netlify's environment variables
// and is never sent to (or visible from) the person's browser. The page
// calls this function at /.netlify/functions/ai-insight; this function
// calls Anthropic; the answer comes back through the same round trip.
//
// Everything this returns is labeled "unverified" in the UI on purpose —
// see index.html's AI Insight panel. This function does not try to make
// the model's output trustworthy; it tries to make the output honest
// about its own limits (say "I'm not sure" rather than invent a citation).

const MODEL = "claude-haiku-4-5-20251001"; // fast + inexpensive; change if you prefer a different model you have access to
const MAX_TOKENS = 700;

const SYSTEM_PROMPT = `You are a careful, conservative study assistant embedded in an LDS/Christian scripture study app called Deep Study.
You are answering about a single Bible verse the app's own curated research does not yet cover.

Ground rules, followed strictly:
- Never invent a scripture cross-reference, quotation, Hebrew/Greek definition, historical fact, or citation you are not genuinely confident is accurate. If you are not sure, say so plainly instead of guessing.
- Keep everything concise: this is a quick first-pass study aid, not an essay.
- Clearly distinguish plain textual observation from interpretation, and interpretation from personal application.
- Do not present any claim as official Church doctrine. If something reflects a common Latter-day Saint or Christian reading rather than an explicit text or official teaching, say so.
- Never fabricate a citation to a General Conference talk, a specific verse, or a specific historical event. A vague, honest answer is always better than a specific, invented one.

Respond ONLY with a JSON object (no markdown fences, no preamble) with this exact shape:
{
  "context": "1-3 sentences of plain historical/literary context for the verse, or an empty string if you are not confident of anything specific.",
  "connections": ["0 to 3 short strings, each a possible related scripture and a one-sentence reason it might connect — only include ones you are reasonably confident actually exist and connect"],
  "reflection": "one honest, specific reflection question tied to the actual content of this verse (not generic)."
}`;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Use POST." }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "ANTHROPIC_API_KEY is not set on this Netlify site. Add it under Site settings → Environment variables, then redeploy.",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { book, chapter, verse, text } = payload;
  if (!book || !chapter || !verse || !text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing book, chapter, verse, or text." }) };
  }
  if (String(text).length > 2000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Verse text too long." }) };
  }

  const userMessage = `${book} ${chapter}:${verse} (King James Version): "${text}"`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: `Anthropic API error (${resp.status}): ${errText.slice(0, 300)}` }),
      };
    }

    const data = await resp.json();
    const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();

    let parsed;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Model didn't return clean JSON — surface the raw text rather than fail silently.
      parsed = { context: raw, connections: [], reflection: "" };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ result: parsed }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Request to Anthropic failed: " + err.message }) };
  }
};
