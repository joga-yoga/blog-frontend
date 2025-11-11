import fs from 'fs';
import path from 'path';

export const OUTPUT_DIR = path.resolve(process.cwd(), 'public/llmtext/blog');

export const ensureOutputDirectory = async (): Promise<void> => {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
};

export const resolveMarkdownPath = (slug: string): string => path.join(OUTPUT_DIR, `${slug}.md`);

export const readFileIfExists = async (filePath: string): Promise<string | null> => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

export const writeFileAtomic = async (filePath: string, content: string): Promise<void> => {
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true });
  const tempFile = path.join(directory, `.tmp-${process.pid}-${Date.now()}.md`);
  await fs.promises.writeFile(tempFile, content, 'utf8');
  await fs.promises.rename(tempFile, filePath);
};
