export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const visionPrompt = `You are an architectural analyst. Examine this photo of an interior or exterior space and return a JSON object (no markdown fences, raw JSON only) with these fields:
{
  "roomType": "string — e.g. 'Living Room', 'Kitchen', 'Master Bedroom', 'Garage', 'Office'",
  "estimatedDimensions": "string — e.g. '14 ft × 18 ft' based on visual cues like furniture scale, door height, ceiling height",
  "features": ["array of strings — notable architectural features: windows, doors, fireplace, island, built-ins, ceiling height, etc."],
  "description": "string — a natural-language paragraph (3-5 sentences) describing the space that a user could paste into a floor plan request. Include room type, approximate size, key features, and any layout observations."
}
Be concise and accurate. If the image is unclear, make reasonable estimates.`;

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
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: visionPrompt,
              },
            ],
          },
        ],
      }),
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
      // Try to extract JSON from the response if wrapped in other text
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { description: text };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
