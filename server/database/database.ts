import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

export interface ResumeReviewRecord {
	id: number
	createdAt: string
	filename: string | null
	jobDescription: string
	resumeText: string
	score: number
	model: string
	analysis: ResumeAnalysisData
}

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

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'resume-reviewer.sqlite')

fs.mkdirSync(dataDir, { recursive: true })

const database = new Database(dbPath)

database.pragma('journal_mode = WAL')
database.exec(`
	CREATE TABLE IF NOT EXISTS reviews (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at TEXT NOT NULL,
		filename TEXT,
		job_description TEXT NOT NULL,
		resume_text TEXT NOT NULL,
		score INTEGER NOT NULL,
		model TEXT NOT NULL,
		analysis_json TEXT NOT NULL
	)
`)

const insertReviewStatement = database.prepare(`
	INSERT INTO reviews (
		created_at,
		filename,
		job_description,
		resume_text,
		score,
		model,
		analysis_json
	) VALUES (
		@createdAt,
		@filename,
		@jobDescription,
		@resumeText,
		@score,
		@model,
		@analysisJson
	)
`)

const selectReviewStatement = database.prepare(`
	SELECT id, created_at, filename, job_description, resume_text, score, model, analysis_json
	FROM reviews
	WHERE id = ?
`)

const listReviewsStatement = database.prepare(`
	SELECT id, created_at, filename, job_description, resume_text, score, model, analysis_json
	FROM reviews
	ORDER BY created_at DESC, id DESC
	LIMIT ?
`)

type ReviewRow = {
	id: number
	created_at: string
	filename: string | null
	job_description: string
	resume_text: string
	score: number
	model: string
	analysis_json: string
}

function mapRow(row: ReviewRow): ResumeReviewRecord {
	return {
		id: row.id,
		createdAt: row.created_at,
		filename: row.filename,
		jobDescription: row.job_description,
		resumeText: row.resume_text,
		score: row.score,
		model: row.model,
		analysis: JSON.parse(row.analysis_json) as ResumeAnalysisData,
	}
}

export function saveReview(input: {
	filename: string | null
	jobDescription: string
	resumeText: string
	score: number
	model: string
	analysis: ResumeAnalysisData
}): ResumeReviewRecord {
	const createdAt = new Date().toISOString()
	const result = insertReviewStatement.run({
		createdAt,
		filename: input.filename,
		jobDescription: input.jobDescription,
		resumeText: input.resumeText,
		score: input.score,
		model: input.model,
		analysisJson: JSON.stringify(input.analysis),
	})

	const reviewId = Number(result.lastInsertRowid)
	const row = selectReviewStatement.get(reviewId) as ReviewRow | undefined

	if (!row) {
		throw new Error('Unable to load saved review')
	}

	return mapRow(row)
}

export function listReviews(limit = 10): ResumeReviewRecord[] {
	const rows = listReviewsStatement.all(limit) as ReviewRow[]

	return rows.map(mapRow)
}

export function getReviewById(id: number): ResumeReviewRecord | null {
	const row = selectReviewStatement.get(id) as ReviewRow | undefined

	return row ? mapRow(row) : null
}
