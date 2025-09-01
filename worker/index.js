/**
 * Cloudflare Worker that acts as a relay between the AidGen front‑end and the OpenAI API.
 *
 * This worker expects an environment binding `OPENAI_API_KEY` to be configured via Cloudflare dashboard.
 * It receives JSON payloads with the coffee details, constructs the appropriate
 * prompt for the OpenAI Chat API, forwards the request, and returns the HTML
 * string produced by the model to the client as JSON. This design keeps the
 * secret API key safely on the server and away from the client.
 */

export default {
  /**
   * Handles incoming requests to the worker.
   * @param {Request} request The incoming HTTP request.
   * @param {any} env Environment bindings (contains OPENAI_API_KEY).
   */
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const body = await request.json();
      // Construct user message based on provided fields
      const lines = [];
      const mapping = {
        name: 'Name',
        roast: 'Roast profile',
        origin: 'Origin',
        process: 'Processing method',
        varietal: 'Varietal',
        masl: 'MASL',
        roastDate: 'Roast date',
        brewProfile: 'Brew profile',
      };
      for (const key of Object.keys(mapping)) {
        if (body[key] && body[key].toString().trim() !== '') {
          lines.push(`${mapping[key]}: ${body[key]}`);
        }
      }
      const userMessage = lines.join('\n');
      const systemPrompt =
        `You are AidGen, a recipe generator for the Fellow Aiden coffee machine.\n` +
        `Your task is to generate precise coffee brewing recipes based on user inputs.\n\n` +
        `The user will provide some or all of the following fields: Name, Roast profile, Origin, Processing method, Varietal, MASL, Roast date, Brew profile.\n` +
        `If any fields are blank, ignore them.\n\n` +
        `Output as an HTML block containing ONLY tables. Each table must be dark mode styled and readable when injected directly into the page.\n\n` +
        `Tables Required:\n` +
        `1. Aiden Recipe Table (Temperature, Coffee-to-Water Ratio, Bloom Ratio, Bloom Time, Bloom Temperature).\n` +
        `2. Single Serve Recipe Table (Pulse #, Pulse Temp, Time Until Next Pulse).\n` +
        `3. Batch Recipe Table (Pulse #, Pulse Temp, Time Until Next Pulse).\n\n` +
        `Rules:\n` +
        `- All values must fall within specified ranges.\n` +
        `- Be precise & realistic for the Fellow Aiden brewer.\n` +
        `- Do not output text outside of tables.`;
      // Prepare request payload for OpenAI
      const payload = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 800,
      };
      // Make the API call
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!openaiRes.ok) {
        const errorText = await openaiRes.text();
        return new Response(JSON.stringify({ error: 'OpenAI API error', details: errorText }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = await openaiRes.json();
      const content = result.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ html: content }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid request', message: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};