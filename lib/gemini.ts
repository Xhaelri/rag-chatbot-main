import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const visionModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

export async function analyzeScreenshot(imageBase64: string) {
  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: "image/png",
    },
  };
  const prompt =
    "Describe this webpage screenshot in detail, focusing on layout, key visual elements, and any important text content:";

  const result = await visionModel.generateContent([prompt, imagePart]);

  return result.response.text();
}
