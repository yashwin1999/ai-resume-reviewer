import { Router } from 'express'
import multer from 'multer'
import { analyzeResume, getReview, getReviews } from '../controllers/analysisController'

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
})

const router = Router()

router.post('/analyze', upload.single('resume'), analyzeResume)
router.get('/reviews', getReviews)
router.get('/reviews/:id', getReview)

export default router
