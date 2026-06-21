// Client-side Transformers.js Embedding Service
// Loads the model dynamically in the browser, bypassing Webpack compile-time checks

let extractorInstance: any = null;

async function getExtractor(onModelProgress?: (percent: number) => void) {
  if (extractorInstance) return extractorInstance;

  // Use dynamic Function constructor to bypass Webpack static analysis during build
  const getTransformers = Function("return import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0')");
  const transformers = await getTransformers();
  
  // Disable local models search, force loading from Hugging Face CDN (which uses IndexedDB caching)
  transformers.env.allowLocalModels = false;

  extractorInstance = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    progress_callback: (data: any) => {
      if (data.status === 'progress') {
        onModelProgress?.(Math.round(data.progress));
      }
    }
  });

  return extractorInstance;
}

export async function generateClientEmbedding(
  text: string,
  onModelProgress?: (percent: number) => void
): Promise<number[]> {
  const extractor = await getExtractor(onModelProgress);
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
