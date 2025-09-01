/**
 * Cloudflare Pages Function to handle AidGen recipe generation.
 *
 * This function receives POST requests with JSON containing coffee
 * attributes. It constructs a system and user prompt, invokes the
 * OpenAI API using a secret API key stored in the environment (OPENAI_API_KEY),
 * and returns the resulting HTML tables for display on the client.
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
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
    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 800,
    };
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
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', details: errorText }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const result = await openaiRes.json();
    const content = result.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ html: content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', message: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
