import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const text_splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

export async function chunkText(content: string) {
  const chunks = await text_splitter.splitText(content);
  return chunks;
}

export async function scrapePage(url: string) {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (pages, browser) => {
      const result = await pages.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });

  const rawHtml = await loader.scrape();

  // Cleanup steps
  return rawHtml
    ?.replace(/<[^>]*>?/gm, "") // Remove HTML tags
    .replace(/[\n\t]/g, " ") // Replace newlines and tabs with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces to single space
    .trim(); // Remove leading/trailing whitespace
}

export async function scrapePageWithScreenshot(url: string) {
  // Create loader instance
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "networkidle2",
    },
  });

  // Get text content using standard scrape
  const text = await loader.scrape();
  const cleanedText =
    text
      ?.replace(/<[^>]*>?/gm, "")
      .replace(/[\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "";

  console.log("cleanedText", cleanedText.substring(0, 512));

  // Get screenshot using the built-in method
  const screenshotDoc = await loader.screenshot();
  console.log("screenshotDoc", screenshotDoc.pageContent.substring(0, 512));
  // Convert binary data to proper base64
  const screenshotBase64 = Buffer.from(screenshotDoc.pageContent).toString(
    "base64"
  );

  return {
    text: cleanedText,
    screenshot: screenshotBase64,
  };
}
