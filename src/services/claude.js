import * as FileSystem from 'expo-file-system/legacy';
import { CLAUDE_API_KEY, CLAUDE_API_URL } from '../constants/config';

const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Business', 'Healthcare', 'Entertainment', 'Other'];

export const parseReceiptWithVision = async (imageUri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
    const apiResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: `This is a Canadian receipt. Extract the following fields and return ONLY raw JSON, no markdown, no backticks, no explanation.

{
  "vendor": "store name or null if unreadable",
  "date": "YYYY-MM-DD or null if not found",
  "total": "22.70 or null if not found",
  "tax": "6.24 or 0.00 if no tax",
  "category": "one of: Food, Transport, Shopping, Business, Healthcare, Entertainment, Other",
  "notes": ["short note about any uncertainty, missing field, or assumption"]
}

Rules:
- tax = sum of HST + GST + PST + QST; use "0.00" if none found
- category must be exactly one of the 7 listed values; use "Other" if uncertain
- notes is an array of short strings; use [] if everything is clear
- Use null (not the string "null") for genuinely missing vendor/date/total` },
          ],
        }],
      }),
    });
    const data = await apiResponse.json();
    const text = data.content[0].text.trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Normalise category
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.notes = [...(parsed.notes || []), `Category "${parsed.category}" not recognised — defaulted to Other`];
      parsed.category = 'Other';
    }

    // Normalise notes to always be an array
    if (!Array.isArray(parsed.notes)) {
      parsed.notes = parsed.notes ? [String(parsed.notes)] : [];
    }

    return parsed;
  } catch (e) {
    console.log('Parse error:', e.message);
    return {
      vendor: null,
      date: null,
      total: null,
      tax: '0.00',
      category: 'Other',
      notes: ['Failed to read receipt — please enter details manually'],
    };
  }
};
