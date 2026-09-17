// Deep Study — AI Explore-content draft generator
//
// Same trust model as ai-insight.js: runs server-side, key never touches
// the browser, and everything it returns is treated as an unverified draft
// by the front end — never merged into the app's curated People/Themes/
// Symbols data automatically.

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 900;

const SCHEMAS = {
  person: `{
  "name": "Full name as commonly known",
  "who": "1-2 sentence summary of who they were",
  "timeline": ["3-6 short chronological milestones"],
  "events": ["2-4 key events associated with them"],
  "scriptures": ["2-5 scripture references where they appear or are discussed"],
  "strengths": ["1-3 strengths, grounded in the text"],
  "challenges": ["1-3 struggles or failures, grounded in the text"],
  "christEncounters": ["0-2 ways this person's story connects to Christ, only if genuinely supportable"],
  "callings": ["0-2 formal roles, e.g. Prophet, King, Judge"],
  "whyMatters": "1-2 sentences on why this person is worth studying"
}`,
  theme: `{
  "name": "Theme name",
  "intro": "1-2 sentences introducing the theme",
  "entries": [{"ref": "scripture reference", "note": "1 sentence on how this passage develops the theme"}],
  "synthesis": "2-4 sentences tying the entries together into a developing idea, not just a list"
}`,
  symbol: `{
  "name": "Symbol name",
  "meaning": "1 sentence general meaning",
  "ot": "one Old Testament reference and how it's used there",
  "nt": "one New Testament reference and how it's used there, or empty string if none confident",
  "bom": "one Book of Mormon reference and how it's used there, or empty string if none confident",
  "christ": "how this symbol connects to Christ, or empty string if no confident connection",
  "temple": "temple/covenant connection if any, or empty string"
}`,
};

const SYSTEM_PROMPT = (type) => `You are a careful, conservative research assistant embedded in an LDS/Christian scripture study app called Deep Study.
You are drafting a ${type} entry for a topic the app's own curated research does not yet cover.

Ground rules, followed strictly:
- Never invent a scripture reference, quotation, historical fact, or connection you are not genuinely confident is accurate. Leave a field as an empty string or empty array rather than guess.
- Ground every claim in the actual biblical/Book of Mormon/Restoration text where possible; cite the reference.
- Do not present any claim as official Church doctrine — note when something is a common interpretation rather than an explicit teaching.
- Keep entries concise, in the same plain, non-flowery register a study app would use.
- If the requested topic is not a real, identifiable figure/theme/symbol from the Bible, Book of Mormon, or Restoration scripture, respond with {"error": "explanation"} instead of inventing one.

Respond ONLY with a single JSON object (no markdown fences, no preamble) matching exactly this shape:
${SCHEMAS[type]}`;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Use POST." }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on this Netlify site. Add it under Site settings → Environment variables, then redeploy." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { type, query } = payload;
  if (!["person", "theme", "symbol"].includes(type)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "type must be person, theme, or symbol." }) };
  }
  if (!query || String(query).trim().length < 2 || String(query).length > 100) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Give a specific name or topic (2-100 characters)." }) };
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT(type),
        messages: [{ role: "user", content: `Topic: ${query}` }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: `Anthropic API error (${resp.status}): ${errText.slice(0, 300)}` }) };
    }

    const data = await resp.json();
    const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();

    let parsed;
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: "The model's response wasn't valid — try again or rephrase the topic." }) };
    }

    if (parsed.error) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: parsed.error }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ result: parsed, type }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Request to Anthropic failed: " + err.message }) };
  }
};
