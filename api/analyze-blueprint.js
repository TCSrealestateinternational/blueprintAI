export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const blueprintPrompt = `You are an expert architectural plan reader. Analyze this floor plan image carefully and extract every detail you can see. Return ONLY a valid JSON object (no markdown, raw JSON):

{
  "description": "A detailed natural-language description of the floor plan — room layout, flow, adjacencies, overall shape, special features — written so an architect could recreate it",
  "totalSqft": estimated_total_square_footage_as_number,
  "bedrooms": number_of_bedrooms,
  "bathrooms": number_of_bathrooms,
  "stories": number_of_stories,
  "exteriorDims": { "width": estimated_width_in_feet, "depth": estimated_depth_in_feet },
  "rooms": [
    {
      "name": "Room Name",
      "dimensions": "14 x 16",
      "sqft": estimated_sqft,
      "position": "e.g. north wing, center of plan, southwest corner",
      "adjacentTo": ["list of adjacent room names"],
      "features": ["list of visible features: closet, window count, en-suite, etc."]
    }
  ],
  "specialFeatures": ["open concept living", "attached 2-car garage", "walk-in closets", "mudroom", "etc."],
  "layoutNotes": "Description of overall layout organization, traffic flow, zoning (public vs private areas)",
  "estimatedStyle": "e.g. Ranch, Colonial, Craftsman, Split-level"
}

Be as detailed as possible. If dimensions are not clearly labeled, estimate from relative proportions. Include ALL rooms visible including closets, hallways, bathrooms, utility rooms.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: blueprintPrompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { description: text };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
