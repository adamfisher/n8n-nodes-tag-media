import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { copyFile, unlink, writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

const execFileAsync = promisify(execFile);

// Test metadata to write
const TEST_METADATA = {
	title: 'Test Title',
	artist: 'Test Artist',
	album: 'Test Album',
	year: '2024',
	genre: 'Test Genre',
	comment: 'Test Comment',
	author: 'Test Author',
	subject: 'Test Subject',
	keywords: 'test, metadata, n8n',
	description: 'Test Description',
	copyright: 'Test Copyright 2024',
	creator: 'Test Creator',
};

// Path to sample files
const SAMPLE_FILES_DIR = join(__dirname, 'sample-files');
const SCRIPTS_DIR = join(__dirname, '..', 'scripts');

// Tool availability - set once at startup
let pythonCmd: string | null = null;
let exiftoolAvailable = false;
const pythonModules: Record<string, boolean> = {
	mutagen: false,
	docx: false,
	openpyxl: false,
	pptx: false,
};

// Helper to create a temp copy of a file
async function createTempCopy(sourceFile: string): Promise<string> {
	const tempDir = join(tmpdir(), 'n8n-tag-media-tests');
	if (!existsSync(tempDir)) {
		await mkdir(tempDir, { recursive: true });
	}
	const ext = extname(sourceFile);
	const tempFile = join(tempDir, `test_${Date.now()}${ext}`);
	await copyFile(sourceFile, tempFile);
	return tempFile;
}

// Helper to write metadata JSON for Python scripts
async function writeMetadataJson(metadata: Record<string, unknown>): Promise<string> {
	const tempDir = join(tmpdir(), 'n8n-tag-media-tests');
	if (!existsSync(tempDir)) {
		await mkdir(tempDir, { recursive: true });
	}
	const metaPath = join(tempDir, `meta_${Date.now()}.json`);
	await writeFile(metaPath, JSON.stringify(metadata, null, 2));
	return metaPath;
}

// Helper to read metadata using exiftool
async function readMetadata(filePath: string): Promise<Record<string, unknown>> {
	try {
		const { stdout } = await execFileAsync('exiftool', ['-json', filePath]);
		const parsed = JSON.parse(stdout);
		return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : {};
	} catch (error) {
		console.error('Error reading metadata:', error);
		return {};
	}
}

// Helper to run Python script
async function runPythonScript(script: string, args: string[]): Promise<string> {
	if (!pythonCmd) throw new Error('Python not available');
	const { stdout, stderr } = await execFileAsync(pythonCmd, [script, ...args]);
	if (stderr) console.log('Script stderr:', stderr);
	return stdout;
}

// Helper to run exiftool for writing
async function runExiftool(args: string[]): Promise<string> {
	const { stdout, stderr } = await execFileAsync('exiftool', args);
	if (stderr) console.log('Exiftool stderr:', stderr);
	return stdout;
}

// Cleanup helper
async function cleanup(files: string[]): Promise<void> {
	for (const file of files) {
		try {
			await unlink(file);
		} catch {
			// Ignore cleanup errors
		}
	}
}

// Check tool availability once at module load
beforeAll(async () => {
	// Check for Python
	for (const cmd of ['python3', 'python']) {
		try {
			const { stdout } = await execFileAsync(cmd, ['--version']);
			if (stdout.toLowerCase().includes('python')) {
				pythonCmd = cmd;
				break;
			}
		} catch {
			// Try next
		}
	}

	// Check for exiftool
	try {
		await execFileAsync('exiftool', ['-ver']);
		exiftoolAvailable = true;
	} catch {
		// Not available
	}

	// Check for Python modules
	if (pythonCmd) {
		for (const mod of Object.keys(pythonModules)) {
			try {
				await execFileAsync(pythonCmd, ['-c', `import ${mod}`]);
				pythonModules[mod] = true;
			} catch {
				// Module not installed
			}
		}
	}

	console.log(`Tools available: Python=${pythonCmd || 'no'}, exiftool=${exiftoolAvailable}`);
	console.log(`Python modules: ${JSON.stringify(pythonModules)}`);
});

// ============================================================================
// Audio File Tests (Python/mutagen)
// ============================================================================

describe('Tag Audio File', () => {
	const audioTestCases = [
		{ file: 'file_example_WAV_1MG.wav', format: 'WAV' },
		{ file: 'file_example_MP3_700KB.mp3', format: 'MP3' },
	];

	it.each(audioTestCases)('should write metadata to $format file ($file)', async ({ file, format }) => {
		if (!pythonCmd || !pythonModules.mutagen) {
			console.log(`SKIP: ${format} - Python/mutagen not available`);
			return;
		}

		const sourcePath = join(SAMPLE_FILES_DIR, file);
		if (!existsSync(sourcePath)) {
			console.log(`SKIP: ${format} - Sample file not found: ${file}`);
			return;
		}

		const tempFile = await createTempCopy(sourcePath);
		const tempFiles = [tempFile];

		try {
			const metadata = {
				title: TEST_METADATA.title,
				artist: TEST_METADATA.artist,
				album: TEST_METADATA.album,
				year: TEST_METADATA.year,
				genre: TEST_METADATA.genre,
				comment: TEST_METADATA.comment,
				trackNumber: '1',
				discNumber: '1',
				extended: {},
			};
			const metaPath = await writeMetadataJson(metadata);
			tempFiles.push(metaPath);

			const scriptPath = join(SCRIPTS_DIR, 'tag_audio.py');
			const result = await runPythonScript(scriptPath, [tempFile, metaPath]);
			expect(result).toContain('OK');

			if (exiftoolAvailable) {
				const readBack = await readMetadata(tempFile);
				const title = readBack['Title'] || readBack['TIT2'];
				expect(title).toBeTruthy();
			}
		} finally {
			await cleanup(tempFiles);
		}
	});
});

// ============================================================================
// Media File Tests (exiftool)
// ============================================================================

describe('Tag Media File', () => {
	const mediaTestCases = [
		{ file: 'file_example_JPG_100kB.jpg', format: 'JPEG' },
		{ file: 'file_example_PNG_500kB.png', format: 'PNG' },
		{ file: 'file_example_TIFF_1MB.tiff', format: 'TIFF' },
		{ file: 'file-sample_150kB.pdf', format: 'PDF' },
	];

	it.each(mediaTestCases)('should write metadata to $format file ($file)', async ({ file, format }) => {
		if (!exiftoolAvailable) {
			console.log(`SKIP: ${format} - exiftool not available`);
			return;
		}

		const sourcePath = join(SAMPLE_FILES_DIR, file);
		if (!existsSync(sourcePath)) {
			console.log(`SKIP: ${format} - Sample file not found: ${file}`);
			return;
		}

		const tempFile = await createTempCopy(sourcePath);
		const tempFiles = [tempFile];

		try {
			const args = [
				'-overwrite_original',
				`-Title=${TEST_METADATA.title}`,
				`-Creator=${TEST_METADATA.creator}`,
				`-Description=${TEST_METADATA.description}`,
				`-Copyright=${TEST_METADATA.copyright}`,
				`-Keywords=${TEST_METADATA.keywords}`,
				tempFile,
			];
			await runExiftool(args);

			const readBack = await readMetadata(tempFile);
			const title = readBack['Title'] || readBack['XMP:Title'] || readBack['IPTC:ObjectName'];
			expect(title).toBe(TEST_METADATA.title);
		} finally {
			await cleanup(tempFiles);
		}
	});
});

// ============================================================================
// Office Document Tests (Python)
// ============================================================================

describe('Tag Office Document', () => {
	const officeTestCases = [
		{ file: 'file-sample_100kB.docx', format: 'DOCX', module: 'docx' },
		{ file: 'file_example_XLS_10.xlsx', format: 'XLSX', module: 'openpyxl' },
		{ file: 'file_example_PPT_250kB.pptx', format: 'PPTX', module: 'pptx' },
	];

	it.each(officeTestCases)('should write metadata to $format file ($file)', async ({ file, format, module }) => {
		if (!pythonCmd || !pythonModules[module]) {
			console.log(`SKIP: ${format} - Python/${module} not available`);
			return;
		}

		const sourcePath = join(SAMPLE_FILES_DIR, file);
		if (!existsSync(sourcePath)) {
			console.log(`SKIP: ${format} - Sample file not found: ${file}`);
			return;
		}

		const tempFile = await createTempCopy(sourcePath);
		const tempFiles = [tempFile];

		try {
			const metadata = {
				title: TEST_METADATA.title,
				subject: TEST_METADATA.subject,
				author: TEST_METADATA.author,
				description: TEST_METADATA.description,
				keywords: TEST_METADATA.keywords,
				category: 'Test Category',
				extended: {},
			};
			const metaPath = await writeMetadataJson(metadata);
			tempFiles.push(metaPath);

			const scriptPath = join(SCRIPTS_DIR, 'tag_office.py');
			const result = await runPythonScript(scriptPath, [tempFile, metaPath]);
			expect(result).toContain('OK');

			if (exiftoolAvailable) {
				const readBack = await readMetadata(tempFile);
				expect(readBack['Title']).toBe(TEST_METADATA.title);
				expect(readBack['Subject']).toBe(TEST_METADATA.subject);
			}
		} finally {
			await cleanup(tempFiles);
		}
	});
});

// ============================================================================
// Read File Tags Tests
// ============================================================================

describe('Read File Tags', () => {
	const readTestCases = [
		{ file: 'file_example_JPG_100kB.jpg', format: 'JPEG' },
		{ file: 'file_example_MP3_700KB.mp3', format: 'MP3' },
		{ file: 'file-sample_100kB.docx', format: 'DOCX' },
	];

	it.each(readTestCases)('should read metadata from $format file ($file)', async ({ file, format }) => {
		if (!exiftoolAvailable) {
			console.log(`SKIP: ${format} - exiftool not available`);
			return;
		}

		const sourcePath = join(SAMPLE_FILES_DIR, file);
		if (!existsSync(sourcePath)) {
			console.log(`SKIP: ${format} - Sample file not found: ${file}`);
			return;
		}

		const metadata = await readMetadata(sourcePath);
		expect(metadata['FileName']).toBe(file);
		expect(metadata['FileType']).toBeTruthy();
		expect(metadata['MIMEType']).toBeTruthy();
	});
});
