import mammoth from 'mammoth'

export interface ResumeAnalysisData {
	score: number
	summary: string
	strengths: string[]
	gaps: string[]
	suggestions: string[]
	keywordMatches: string[]
	keywordGaps: string[]
	atsSignals: string[]
	finalVerdict: string
}

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'

function normalizeList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter((item) => item.length > 0)
}

function clampScore(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value)

	if (!Number.isFinite(parsed)) {
		return 0
	}

	return Math.max(0, Math.min(100, Math.round(parsed)))
}

function buildFallbackAnalysis(message: string): ResumeAnalysisData {
	return {
		score: 0,
		summary: message,
		strengths: [],
		gaps: [],
		suggestions: [
			'Connect Ollama to the machine and try again to generate a full review.',
		],
		keywordMatches: [],
		keywordGaps: [],
		atsSignals: [],
		finalVerdict: 'Could not complete analysis',
	}
}

function parseAnalysis(raw: string): ResumeAnalysisData {
	try {
		const parsed = JSON.parse(raw) as Partial<ResumeAnalysisData>

		return {
			score: clampScore(parsed.score),
			summary: typeof parsed.summary === 'string' ? parsed.summary : '',
			strengths: normalizeList(parsed.strengths),
			gaps: normalizeList(parsed.gaps),
			suggestions: normalizeList(parsed.suggestions),
			keywordMatches: normalizeList(parsed.keywordMatches),
			keywordGaps: normalizeList(parsed.keywordGaps),
			atsSignals: normalizeList(parsed.atsSignals),
			finalVerdict:
				typeof parsed.finalVerdict === 'string' && parsed.finalVerdict.trim()
					? parsed.finalVerdict.trim()
					: 'Review complete',
		}
	} catch {
		return buildFallbackAnalysis(raw)
	}
}

export async function extractResumeText(file: Express.Multer.File): Promise<string> {
	const originalName = file.originalname.toLowerCase()

	if (originalName.endsWith('.pdf') || file.mimetype === 'application/pdf') {
		const pdfParseModule = await import('pdf-parse')
		const pdfParse = ((pdfParseModule as any).default ?? pdfParseModule) as (
			buffer: Buffer,
		) => Promise<{ text: string }>

		const parsed = await pdfParse(file.buffer)

		return parsed.text.trim()
	}

	if (originalName.endsWith('.docx') || file.mimetype.includes('wordprocessingml')) {
		const parsed = await mammoth.extractRawText({ buffer: file.buffer })

		return parsed.value.trim()
	}

	return file.buffer.toString('utf8').trim()
}

export async function analyzeWithOllama(input: {
	resumeText: string
	jobDescription: string
}): Promise<{ analysis: ResumeAnalysisData; model: string }> {
	const prompt = `You are a senior recruiter and ATS specialist.

Review the resume against the job description and return only valid JSON with this schema:
{
	"score": number,
	"summary": string,
	"strengths": string[],
	"gaps": string[],
	"suggestions": string[],
	"keywordMatches": string[],
	"keywordGaps": string[],
	"atsSignals": string[],
	"finalVerdict": string
}

Rules:
- score must be an integer from 0 to 100
- keep all arrays short and concrete
- focus on role fit, measurable experience, missing keywords, and ATS readability
- do not wrap the JSON in markdown

Job description:
${input.jobDescription}

Resume:
${input.resumeText}`

	const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: OLLAMA_MODEL,
			stream: false,
			format: 'json',
			messages: [
				{
					role: 'system',
					content:
						'You are a precise hiring assistant that returns strict JSON and no extra commentary.',
				},
				{
					role: 'user',
					content: prompt,
				},
			],
		}),
	})

	if (!response.ok) {
		throw new Error(`Ollama request failed with status ${response.status}`)
	}

	const payload = (await response.json()) as {
		message?: { content?: string }
	}

	const content = payload.message?.content?.trim()

	if (!content) {
		return {
			analysis: buildFallbackAnalysis('Ollama returned an empty response'),
			model: OLLAMA_MODEL,
		}
	}

	return {
		analysis: parseAnalysis(content),
		model: OLLAMA_MODEL,
	}
}

export function getOllamaModelName() {
	return OLLAMA_MODEL
}
