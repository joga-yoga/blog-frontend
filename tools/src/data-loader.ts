import fs from 'fs';
import path from 'path';

export type RawPayload = {
  data: unknown;
  source: string;
};

const isJsonFile = (fileName: string): boolean => fileName.toLowerCase().endsWith('.json');

const readJsonFile = async (filePath: string): Promise<RawPayload> => {
  const content = await fs.promises.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(content) as unknown;
    return { data: parsed, source: filePath };
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${(error as Error).message}`);
  }
};

const loadFromDirectory = async (directory: string): Promise<RawPayload[]> => {
  const entries = await fs.promises.readdir(directory);
  const jsonFiles = entries.filter(isJsonFile);
  const payloads = await Promise.all(
    jsonFiles.map((file) => readJsonFile(path.join(directory, file)))
  );
  return payloads;
};

export const loadPayloads = async (inputPath?: string): Promise<RawPayload[]> => {
  if (inputPath) {
    const absolutePath = path.resolve(process.cwd(), inputPath);
    const stats = await fs.promises.stat(absolutePath);
    if (stats.isDirectory()) {
      return loadFromDirectory(absolutePath);
    }
    if (stats.isFile()) {
      return [await readJsonFile(absolutePath)];
    }
    return [];
  }

  const fixturesDir = path.resolve(process.cwd(), 'data/payloads');
  try {
    const fixturesStats = await fs.promises.stat(fixturesDir);
    if (!fixturesStats.isDirectory()) {
      return [];
    }
    return loadFromDirectory(fixturesDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};
