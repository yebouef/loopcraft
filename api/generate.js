// LoopCraft — /api/generate
// Vercel serverless function. Turns a plain-language brief into
// structured prompt fields using the Claude API.
//
// TO ACTIVATE:
// 1. Get an API key at https://console.anthropic.com
// 2. In Vercel → your loopcraft project → Settings → Environment Variables
//    add:  ANTHROPIC_API_KEY = sk-ant-...
// 3. Redeploy. The tool detects this endpoint automatically and switches
//    from smart-template mode to live AI mode. No frontend change needed.
//
// Until then, this file is harmless — the frontend falls back to its
// built-in template engine when this endpoint errors.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'API key not configured' });
  }

  const { brief, lang } = req.body || {};
  if (!brief || typeof brief !== 'string' || brief.length > 4000) {
    return res.status(400).json({ error: 'Invalid brief' });
  }

  const system = `You convert a person's plain-language work description into structured prompt fields.
Respond ONLY with a JSON object — no markdown, no backticks, no preamble. Keys:
- projectName: short title, max 5 words
- loop: "core" (one deliverable) or "fleet" (multiple workstreams)
- role: one of "Developer", "Data Analyst", "AI Engineer", "Business Analyst", "Cloud / DevOps Engineer", "UX Designer"
- format: one of "Working code", "Step-by-step action plan", "Written report", "SQL queries", "Data analysis", "Email / proposal draft"
- goal: one clear sentence stating what to build or do
- doneWhen: one sentence describing the observable finish line (infer a sensible one)
- outOfScope: things NOT to do, or "" if none implied
- hasMemory: true if the person references past work/sessions, else false
- memStatus, memLast, memDecisions, memNext: memory snapshot fields, "" if hasMemory is false
Write field values in ${lang === 'fr' ? 'French' : 'English'}.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: brief }]
      })
    });

    if (!r.ok) {
      return res.status(502).json({ error: 'Upstream error' });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: 'Generation failed' });
  }
}
