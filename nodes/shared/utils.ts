import type { IExecuteFunctions, IBinaryData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Extract binary data buffer from an input item
 */
export async function getBinaryBuffer(
	context: IExecuteFunctions,
	itemIndex: number,
	binaryPropertyName: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string; extension: string }> {
	const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);

	const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

	const fileName = binaryData.fileName || 'file';
	const extension = getExtensionFromBinaryData(binaryData, fileName);

	return {
		buffer,
		mimeType: binaryData.mimeType,
		fileName,
		extension,
	};
}

/**
 * Get file extension from binary data, checking mimeType and fileName
 */
function getExtensionFromBinaryData(binaryData: IBinaryData, fileName: string): string {
	// Try to get from fileName first
	const fileNameExt = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;
	if (fileNameExt) {
		return fileNameExt;
	}

	// Fall back to mimeType mapping
	const mimeToExt: Record<string, string> = {
		'audio/mpeg': 'mp3',
		'audio/mp3': 'mp3',
		'audio/wav': 'wav',
		'audio/x-wav': 'wav',
		'audio/wave': 'wav',
		'audio/flac': 'flac',
		'audio/x-flac': 'flac',
		'audio/mp4': 'm4a',
		'audio/x-m4a': 'm4a',
		'audio/aac': 'm4a',
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/tiff': 'tiff',
		'application/pdf': 'pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
	};

	return mimeToExt[binaryData.mimeType] || 'bin';
}

/**
 * Run a command and return stdout, throwing on error with stderr details
 */
export async function runCommand(
	context: IExecuteFunctions,
	itemIndex: number,
	command: string,
	args: string[],
): Promise<string> {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, {
			maxBuffer: 10 * 1024 * 1024, // 10MB buffer
		});

		// Log stderr as warning if present but command succeeded
		if (stderr && stderr.trim()) {
			console.warn(`Command stderr: ${stderr}`);
		}

		return stdout;
	} catch (error: unknown) {
		const err = error as Error & { stderr?: string; code?: number };
		const stderrMsg = err.stderr || err.message || 'Unknown error';
		throw new NodeOperationError(
			context.getNode(),
			`Command failed: ${stderrMsg}`,
			{ itemIndex },
		);
	}
}

/**
 * Safely delete files, ignoring errors if files don't exist
 */
export async function cleanupFiles(paths: string[]): Promise<void> {
	const fs = await import('fs/promises');

	for (const filePath of paths) {
		try {
			await fs.unlink(filePath);
		} catch {
			// Ignore errors (file may not exist)
		}
	}
}
