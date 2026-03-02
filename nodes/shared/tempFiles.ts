import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Generate a temp file path with consistent naming convention
 * Format: /tmp/<nodename>_<suffix>_<timestamp>.<ext>
 */
export function createTempFilePath(nodeName: string, suffix: string, extension: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	const fileName = `${nodeName}_${suffix}_${timestamp}_${random}.${extension}`;
	return join(tmpdir(), fileName);
}

/**
 * Write a buffer to a temp file
 */
export async function writeTempFile(filePath: string, data: Buffer): Promise<void> {
	await writeFile(filePath, data);
}

/**
 * Write metadata object to a temp JSON file
 * Returns the path to the created file
 */
export async function writeMetadataJson(
	nodeName: string,
	metadata: Record<string, unknown>,
): Promise<string> {
	const filePath = createTempFilePath(nodeName, 'meta', 'json');
	await writeFile(filePath, JSON.stringify(metadata, null, 2));
	return filePath;
}

/**
 * Create an input temp file path for binary data
 */
export function createInputFilePath(nodeName: string, extension: string): string {
	return createTempFilePath(nodeName, 'in', extension);
}
