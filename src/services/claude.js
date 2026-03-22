import * as FileSystem from 'expo-file-system/legacy';
import { CLAUDE_API_KEY, CLAUDE_API_URL } from '../constants/config';

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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: 'This is a Canadian receipt. Extract these 4 fields and return ONLY raw JSON, no markdown, no backticks, no explanation.\n\n{"vendor":"store name","date":"YYYY-MM-DD","total":"22.70","tax":"6.24"}\n\ntax = total tax amount, add together HST + GST + PST + QST if multiple lines. Use 0.00 if no tax found.' }
          ],
        }],
      }),
    });
    const data = await apiResponse.json();
    const text = data.content[0].text.trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.log('Parse error:', e.message);
    return { vendor: 'Not found', date: 'Not found', total: '0.00', tax: '0.00' };
  }
};
