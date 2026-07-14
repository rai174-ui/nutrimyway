import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.log("No API key");
    return;
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  for (const m of models) {
    try {
      console.log("Trying", m);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent("Hello");
      console.log(m, "SUCCESS", res.response.text());
    } catch (e) {
      console.error(m, "FAILED", e.message);
    }
  }
}
main();
