import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import analysisRouter from './routes/analysis'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(
	cors({
		origin: true,
	}),
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok' })
})

app.use('/api', analysisRouter)

app.use(
	(error: unknown, _req: Request, res: Response, _next: NextFunction) => {
		console.error('Unhandled server error:', error)
		res.status(500).json({
			message: 'Internal server error',
		})
	},
)

app.listen(port, () => {
	console.log(`Resume reviewer API running on http://localhost:${port}`)
})
