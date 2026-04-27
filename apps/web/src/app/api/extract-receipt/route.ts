import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: "Missing imageBase64 or mediaType" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Extract all data from this receipt image and return ONLY a JSON object with these fields (use null for missing values):
{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "expenseType": "one of: Diesel, Gas - Regular, Gas - Supreme, Groceries, Supplies, FCRP, Other, or null",
  "cost": number or null (the amount charged to card/cash),
  "litres": number or null,
  "pricePerLitre": number or null,
  "total": number or null (pre-tax subtotal if different from cost),
  "location": "store name and city or null",
  "vehicle": "license plate or vehicle description or null",
  "items": "brief description of items purchased or null",
  "odometer": "odometer reading if shown or null",
  "creditCard": "last 4 digits if visible e.g. VISA **1234, or null",
  "notes": "anything else notable or null"
}

Return ONLY the JSON, no explanation.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from response (strip any markdown fencing)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse receipt data" }, { status: 422 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ data: extracted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("extract-receipt error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
