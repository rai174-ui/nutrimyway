import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const prompt = `Analyse this food image and respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "food_item": "<name of the food>",
  "calories_kcal": <estimated kcal as a number or null>,
  "protein_g": <estimated protein in grams as a number or null>,
  "fiber_g": <estimated fiber in grams as a number or null>
}
If you cannot identify food, return: {"error": "No food detected"}`;

async function run() {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const res = await fetch('https://upload.wikimedia.org/wikipedia/commons/8/89/Tomato_je.jpg');
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: 'image/jpeg' } }
    ]);
    console.log('Result:', result.response.text());
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
