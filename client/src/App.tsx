import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Analysis = {
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

type ReviewRecord = {
  id: number
  createdAt: string
  filename: string | null
  jobDescription: string
  resumeText: string
  score: number
  model: string
  analysis: Analysis
}

type ApiReviewResponse = {
  review: ReviewRecord
  model: string
}

const emptyAnalysis: Analysis = {
  score: 0,
  summary: '',
  strengths: [],
  gaps: [],
  suggestions: [],
  keywordMatches: [],
  keywordGaps: [],
  atsSignals: [],
  finalVerdict: '',
}

function App() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [analysis, setAnalysis] = useState<Analysis>(emptyAnalysis)
  const [history, setHistory] = useState<ReviewRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')

  const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

  const resumeLabel = useMemo(() => {
    if (resumeFile) {
      return resumeFile.name
    }

    if (resumeText.trim()) {
      return 'Pasted resume text'
    }

    return 'No file selected'
  }, [resumeFile, resumeText])

  async function loadHistory() {
    setLoadingHistory(true)

    try {
      const response = await fetch(`${apiBase}/api/reviews`)

      if (!response.ok) {
        throw new Error('Unable to load recent reviews')
      }

      const data = (await response.json()) as { reviews: ReviewRecord[] }
      setHistory(data.reviews ?? [])
    } catch (historyError) {
      console.error(historyError)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!jobDescription.trim()) {
      setError('Add a target job description before reviewing the resume.')
      return
    }

    if (!resumeFile && !resumeText.trim()) {
      setError('Upload a resume file or paste the resume text.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()

      if (resumeFile) {
        formData.append('resume', resumeFile)
      }

      formData.append('jobDescription', jobDescription)
      formData.append('resumeText', resumeText)

      const response = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null

        throw new Error(payload?.message ?? 'Resume review failed')
      }

      const data = (await response.json()) as ApiReviewResponse
      setAnalysis(data.review.analysis)
      await loadHistory()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unexpected error while reviewing the resume',
      )
    } finally {
      setLoading(false)
    }
  }

  const scoreBand =
    analysis.score >= 80 ? 'strong' : analysis.score >= 60 ? 'medium' : 'needs-work'

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="brand-row">
            <img className="app-mark" src="/app-icon.svg" alt="" aria-hidden="true" />
            <span>AI Resume Reviewer</span>
          </div>
          <p className="eyebrow">Resume Review</p>
          <h1>Review resumes against a job description.</h1>
          <p className="hero-text">
            Upload a resume or paste text. The app gives a score, finds missing
            keywords, and shows simple feedback.
          </p>
          <div className="hero-metrics">
            <div>
              <strong>{history.length}</strong>
              <span>saved reviews</span>
            </div>
            <div>
              <strong>PDF / DOCX / TXT</strong>
              <span>file support</span>
            </div>
            <div>
              <strong>Local AI</strong>
              <span>runs with Ollama</span>
            </div>
          </div>
        </div>
        <div className={`score-card ${scoreBand}`}>
          <p>Score</p>
          <strong>{analysis.score || '--'}</strong>
          <span>{analysis.finalVerdict || 'Run a review to see the result.'}</span>
        </div>
      </section>

      <section className="content-grid">
        <form className="review-panel form-panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="panel-label">Inputs</p>
              <h2>Add resume details</h2>
            </div>
            <span className="status-pill">{resumeLabel}</span>
          </div>

          <label className="field">
            <span>Resume file</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field">
            <span>Resume text</span>
            <textarea
              rows={8}
              placeholder="Paste the resume here if you do not want to upload a file."
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Target job description</span>
            <textarea
              rows={10}
              placeholder="Paste the job description here."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
            />
          </label>

          {error ? <p className="error-box">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Reviewing...' : 'Run review'}
          </button>
        </form>

        <aside className="review-panel result-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label">Results</p>
              <h2>Simple feedback</h2>
            </div>
            <span className="status-pill">Local model</span>
          </div>

          <p className="summary-copy">
            {analysis.summary || 'Your score and feedback will appear here.'}
          </p>

          <div className="two-column">
            <CardList title="Strengths" items={analysis.strengths} />
            <CardList title="Gaps" items={analysis.gaps} />
            <CardList title="Keyword matches" items={analysis.keywordMatches} />
            <CardList title="Keyword gaps" items={analysis.keywordGaps} />
            <CardList title="ATS signals" items={analysis.atsSignals} />
            <CardList title="Suggestions" items={analysis.suggestions} />
          </div>
        </aside>
      </section>

      <section className="history-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-label">History</p>
            <h2>Recent reviews</h2>
          </div>
          <span className="status-pill">
            {loadingHistory ? 'Loading...' : `${history.length} saved`}
          </span>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <p className="empty-state">
              No reviews yet. Run one to see it here.
            </p>
          ) : (
            history.map((item) => (
              <article className="history-item" key={item.id}>
                <div>
                  <strong>{item.filename ?? 'Pasted resume'}</strong>
                  <p>{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <span>{item.score}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function CardList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="info-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="card-empty">Waiting for analysis</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default App
