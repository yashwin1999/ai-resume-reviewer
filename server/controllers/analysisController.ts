import type { Request, Response } from 'express'
import { getReviewById, listReviews, saveReview } from '../database/database'
import {
	analyzeWithOllama,
	extractResumeText,
	getOllamaModelName,
} from '../services/ai'

function getStringField(value: unknown): string {
	return typeof value === 'string' ? value.trim() : ''
}

export async function analyzeResume(req: Request, res: Response) {
	try {
		const jobDescription = getStringField(req.body?.jobDescription)
		const resumeTextInput = getStringField(req.body?.resumeText)
		const uploadedFile = req.file as Express.Multer.File | undefined

		if (!jobDescription) {
			return res.status(400).json({
				message: 'Job description is required',
			})
		}

		if (!uploadedFile && !resumeTextInput) {
			return res.status(400).json({
				message: 'Upload a resume file or paste resume text',
			})
		}

		const resumeText = uploadedFile
			? await extractResumeText(uploadedFile)
			: resumeTextInput

		if (!resumeText) {
			return res.status(400).json({
				message: 'Could not extract any text from the resume',
			})
		}

		const { analysis, model } = await analyzeWithOllama({
			resumeText,
			jobDescription,
		})

		const savedReview = saveReview({
			filename: uploadedFile?.originalname ?? null,
			jobDescription,
			resumeText,
			score: analysis.score,
			model,
			analysis,
		})

		return res.json({
			review: savedReview,
			model,
		})
	} catch (error) {
		console.error('Resume analysis failed:', error)

		return res.status(500).json({
			message:
				error instanceof Error
					? error.message
					: 'Unexpected error while analyzing the resume',
		})
	}
}

export function getReviews(_req: Request, res: Response) {
	return res.json({ reviews: listReviews(12) })
}

export function getReview(req: Request, res: Response) {
	const reviewId = Number(req.params.id)

	if (!Number.isFinite(reviewId)) {
		return res.status(400).json({ message: 'Invalid review id' })
	}

	const review = getReviewById(reviewId)

	if (!review) {
		return res.status(404).json({ message: 'Review not found' })
	}

	return res.json({ review, model: getOllamaModelName() })
}
