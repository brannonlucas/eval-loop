/**
 * eval-loop Dashboard Client
 *
 * Handles navigation, SSE streaming, and API interactions.
 * Uses safe DOM methods (no innerHTML) to prevent XSS.
 */

// State
const state = {
  currentView: 'live',
  challenges: [],
  selectedChallenge: null,
  activeJobs: new Map(),
  results: [],
}

// DOM Elements
const elements = {
  serverStatus: document.getElementById('server-status'),
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  navButtons: document.querySelectorAll('.nav-btn'),
  views: {
    live: document.getElementById('live-view'),
    challenges: document.getElementById('challenges-view'),
    results: document.getElementById('results-view'),
  },
  activeJobs: document.getElementById('active-jobs'),
  jobQueue: document.getElementById('job-queue'),
  queueList: document.getElementById('queue-list'),
  challengeList: document.getElementById('challenge-list'),
  challengeDetail: document.getElementById('challenge-detail'),
  resultsBody: document.getElementById('results-body'),
  filterChallenge: document.getElementById('filter-challenge'),
  filterModel: document.getElementById('filter-model'),
  modal: document.getElementById('competition-modal'),
  modalChallenge: document.getElementById('modal-challenge'),
  competitionForm: document.getElementById('competition-form'),
  startBtn: document.getElementById('start-competition-btn'),
}

// Safe DOM helpers
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value
    else if (key === 'textContent') el.textContent = value
    else if (key.startsWith('data')) el.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value)
    else el.setAttribute(key, value)
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child))
    } else if (child) {
      el.appendChild(child)
    }
  }
  return el
}

function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

// API Functions
const api = {
  async health() {
    const res = await fetch('/api/health')
    return res.json()
  },

  async challenges() {
    const res = await fetch('/api/challenges')
    const data = await res.json()
    return data.challenges || []
  },

  async challengeDetail(name) {
    const res = await fetch(`/api/challenges/${encodeURIComponent(name)}`)
    return res.json()
  },

  async jobs() {
    const res = await fetch('/api/jobs')
    if (!res.ok) return { jobs: [] }
    return res.json()
  },

  async startCompetition(config) {
    const res = await fetch('/api/compete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, stream: true }),
    })
    return res
  },
}

// Navigation
function switchView(viewName) {
  state.currentView = viewName

  elements.navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName)
  })

  Object.entries(elements.views).forEach(([name, el]) => {
    el.hidden = name !== viewName
  })

  if (viewName === 'challenges') loadChallenges()
  if (viewName === 'results') loadResults()
}

// Server Status
async function checkServerStatus() {
  try {
    const data = await api.health()
    elements.statusDot.classList.remove('error')
    elements.statusDot.classList.add('connected')
    elements.statusText.textContent = `OK (${data.activeJobs} jobs)`
  } catch (e) {
    elements.statusDot.classList.remove('connected')
    elements.statusDot.classList.add('error')
    elements.statusText.textContent = 'Disconnected'
  }
}

// Jobs
async function loadJobs() {
  try {
    const data = await api.jobs()
    renderJobs(data.jobs || [])
  } catch (e) {
    renderJobs([])
  }
}

function renderJobs(jobs) {
  const running = jobs.filter(j => j.status === 'running')
  const queued = jobs.filter(j => j.status === 'queued')

  clearElement(elements.activeJobs)

  if (running.length === 0 && queued.length === 0) {
    const emptyState = createElement('div', { className: 'empty-state' }, [
      createElement('div', { className: 'empty-icon', textContent: '\u25B6' }),
      createElement('p', { textContent: 'No active competitions' }),
      createElement('p', { className: 'text-muted', textContent: 'Start a new competition or wait for one to begin' }),
    ])
    elements.activeJobs.appendChild(emptyState)
    elements.jobQueue.hidden = true
    return
  }

  running.forEach(job => {
    elements.activeJobs.appendChild(renderJobCard(job))
  })

  if (queued.length > 0) {
    elements.jobQueue.hidden = false
    clearElement(elements.queueList)
    queued.forEach(job => {
      const item = createElement('div', { className: 'queue-item' }, [
        createElement('span', { textContent: job.config.challenge }),
        createElement('span', { className: 'job-status queued', textContent: 'Queued' }),
      ])
      elements.queueList.appendChild(item)
    })
  } else {
    elements.jobQueue.hidden = true
  }
}

function renderJobCard(job) {
  const models = job.config.models || []
  const progress = job.progress || {}

  const modelsContainer = createElement('div', { className: 'job-models' })
  models.forEach(model => {
    modelsContainer.appendChild(renderModelCard(model, progress, job.results))
  })

  const card = createElement('div', { className: 'job-card', 'data-job-id': job.id }, [
    createElement('div', { className: 'job-header' }, [
      createElement('span', { className: 'job-title', textContent: job.config.challenge }),
      createElement('span', { className: `job-status ${job.status}`, textContent: job.status }),
    ]),
    modelsContainer,
  ])

  return card
}

function renderModelCard(model, progress, results = []) {
  const result = results.find(r => r.model === model)
  const isCurrent = progress.currentModel === model
  const phase = isCurrent ? progress.phase : (result ? 'done' : 'pending')
  const attempt = isCurrent ? progress.currentAttempt : 0

  const phaseProgress = {
    pending: 0,
    generating: 25,
    writing: 40,
    testing: 60,
    benchmarking: 80,
    analyzing: 90,
    done: 100,
  }

  const progressPct = phaseProgress[phase] || 0

  const children = [
    createElement('div', { className: 'model-header' }, [
      createElement('span', { className: 'model-name', textContent: model }),
      isCurrent ? createElement('span', { className: 'model-status-icon', textContent: '\u25CF' }) : null,
    ].filter(Boolean)),
    createElement('div', { className: 'model-phase', textContent: phase + (attempt ? ` (attempt ${attempt})` : '') }),
    createElement('div', { className: 'model-progress' }, [
      createElement('div', { className: 'model-progress-bar', style: `width: ${progressPct}%` }),
    ]),
  ]

  if (result) {
    const resultText = result.passed
      ? `Passed in ${result.attempts} attempt${result.attempts > 1 ? 's' : ''}`
      : `Failed after ${result.attempts} attempts`
    children.push(createElement('div', {
      className: `model-result ${result.passed ? 'passed' : 'failed'}`,
      textContent: resultText,
    }))
  }

  return createElement('div', { className: 'model-card' }, children)
}

// SSE Streaming / Polling
function subscribeToJob(jobId) {
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
      if (!res.ok) {
        clearInterval(pollInterval)
        return
      }
      const job = await res.json()
      updateJobUI(job)
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        clearInterval(pollInterval)
        loadJobs()
      }
    } catch (e) {
      clearInterval(pollInterval)
    }
  }, 1000)
}

function updateJobUI(job) {
  const card = document.querySelector(`[data-job-id="${job.id}"]`)
  if (card) {
    const newCard = renderJobCard(job)
    card.parentNode.replaceChild(newCard, card)
  } else {
    loadJobs()
  }
}

// Challenges
async function loadChallenges() {
  try {
    state.challenges = await api.challenges()
    renderChallengeList()
    populateChallengeDropdowns()
  } catch (e) {
    console.error('Failed to load challenges:', e)
  }
}

function renderChallengeList() {
  clearElement(elements.challengeList)
  state.challenges.forEach(c => {
    const item = createElement('div', { className: 'challenge-item', 'data-name': c.name }, [
      createElement('div', { className: 'challenge-name', textContent: c.name }),
      createElement('span', { className: `challenge-type ${c.type}`, textContent: c.type }),
    ])
    elements.challengeList.appendChild(item)
  })
}

async function selectChallenge(name) {
  state.selectedChallenge = name

  document.querySelectorAll('.challenge-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === name)
  })

  try {
    const detail = await api.challengeDetail(name)
    renderChallengeDetail(detail)
  } catch (e) {
    clearElement(elements.challengeDetail)
    elements.challengeDetail.appendChild(
      createElement('div', { className: 'empty-state' }, [
        createElement('p', { textContent: 'Failed to load challenge' }),
      ])
    )
  }
}

function renderChallengeDetail(detail) {
  clearElement(elements.challengeDetail)

  const children = [
    createElement('h3', { textContent: detail.name }),
    createElement('span', { className: `challenge-type ${detail.type}`, textContent: detail.type }),
    createElement('div', { className: 'challenge-prompt', textContent: detail.prompt || 'No prompt available' }),
  ]

  const latestResult = detail.latestResults
  if (latestResult) {
    const resultsSection = createElement('div', {}, [
      createElement('h4', { textContent: 'Latest Results' }),
      createElement('p', { className: 'text-muted', textContent: new Date(latestResult.timestamp).toLocaleString() }),
    ])

    const modelsContainer = createElement('div', { className: 'job-models', style: 'margin-top: 12px' })
    ;(latestResult.results || []).forEach(r => {
      const resultText = r.passed ? 'Passed' : 'Failed'
      modelsContainer.appendChild(createElement('div', { className: 'model-card' }, [
        createElement('div', { className: 'model-header' }, [
          createElement('span', { className: 'model-name', textContent: r.model }),
        ]),
        createElement('div', {
          className: `model-result ${r.passed ? 'passed' : 'failed'}`,
          textContent: `${resultText} (${r.attempts} attempts)`,
        }),
      ]))
    })

    resultsSection.appendChild(modelsContainer)
    children.push(resultsSection)
  }

  const runBtn = createElement('button', { className: 'btn btn-primary', textContent: 'Run Competition' })
  runBtn.addEventListener('click', () => openCompetitionModal(detail.name))
  children.push(runBtn)

  children.forEach(child => elements.challengeDetail.appendChild(child))
}

function populateChallengeDropdowns() {
  // Modal dropdown
  clearElement(elements.modalChallenge)
  elements.modalChallenge.appendChild(createElement('option', { value: '', textContent: 'Select a challenge...' }))
  state.challenges.forEach(c => {
    elements.modalChallenge.appendChild(createElement('option', { value: c.name, textContent: c.name }))
  })

  // Filter dropdown
  clearElement(elements.filterChallenge)
  elements.filterChallenge.appendChild(createElement('option', { value: '', textContent: 'All Challenges' }))
  state.challenges.forEach(c => {
    elements.filterChallenge.appendChild(createElement('option', { value: c.name, textContent: c.name }))
  })
}

// Results
async function loadResults() {
  try {
    const allResults = []
    for (const challenge of state.challenges) {
      try {
        const detail = await api.challengeDetail(challenge.name)
        if (detail.latestResults) {
          const result = detail.latestResults
          for (const r of result.results || []) {
            allResults.push({
              challenge: challenge.name,
              model: r.model,
              passed: r.passed,
              attempts: r.attempts,
              metrics: r.metrics || r.reactMetrics || r.benchmarks,
              timestamp: result.timestamp,
            })
          }
        }
      } catch (e) {
        // Skip failed loads
      }
    }
    state.results = allResults
    renderResults()
  } catch (e) {
    console.error('Failed to load results:', e)
  }
}

function renderResults() {
  const filterChallenge = elements.filterChallenge.value
  const filterModel = elements.filterModel.value

  let filtered = state.results
  if (filterChallenge) {
    filtered = filtered.filter(r => r.challenge === filterChallenge)
  }
  if (filterModel) {
    filtered = filtered.filter(r => r.model === filterModel)
  }

  clearElement(elements.resultsBody)
  filtered.forEach(r => {
    const row = createElement('tr', {}, [
      createElement('td', { textContent: r.challenge }),
      createElement('td', { textContent: r.model }),
      createElement('td', {}, [
        createElement('span', {
          className: `result-badge ${r.passed ? 'passed' : 'failed'}`,
          textContent: r.passed ? 'Passed' : 'Failed',
        }),
      ]),
      createElement('td', { textContent: String(r.attempts) }),
      createElement('td', { textContent: formatMetrics(r.metrics) }),
      createElement('td', { textContent: new Date(r.timestamp).toLocaleDateString() }),
    ])
    elements.resultsBody.appendChild(row)
  })
}

function formatMetrics(metrics) {
  if (!metrics) return '-'
  if (Array.isArray(metrics)) {
    return metrics.map(b => `${b.name}: ${b.hz?.toFixed(0) || '?'} ops/s`).join(', ')
  }
  if (metrics.fps) {
    return `${metrics.fps.p95?.toFixed(0) || '?'} FPS`
  }
  return JSON.stringify(metrics).slice(0, 50)
}

// Modal
function openCompetitionModal(challengeName = '') {
  elements.modal.hidden = false
  if (challengeName) {
    elements.modalChallenge.value = challengeName
  }
}

function closeModal() {
  elements.modal.hidden = true
  elements.competitionForm.reset()
}

async function handleCompetitionSubmit(e) {
  e.preventDefault()

  const challenge = elements.modalChallenge.value
  const models = Array.from(document.querySelectorAll('input[name="models"]:checked'))
    .map(el => el.value)
  const maxAttempts = parseInt(document.getElementById('modal-attempts').value, 10)

  if (!challenge || models.length === 0) {
    alert('Please select a challenge and at least one model')
    return
  }

  closeModal()

  try {
    const res = await api.startCompetition({ challenge, models, maxAttempts })
    const data = await res.json()
    if (data.jobId) {
      subscribeToJob(data.jobId)
      loadJobs()
    }
  } catch (e) {
    console.error('Failed to start competition:', e)
    alert('Failed to start competition')
  }
}

// Event Listeners
elements.navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view))
})

elements.challengeList.addEventListener('click', (e) => {
  const item = e.target.closest('.challenge-item')
  if (item) selectChallenge(item.dataset.name)
})

elements.startBtn.addEventListener('click', () => openCompetitionModal())

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', closeModal)
})

elements.modal.addEventListener('click', (e) => {
  if (e.target === elements.modal) closeModal()
})

elements.competitionForm.addEventListener('submit', handleCompetitionSubmit)

elements.filterChallenge.addEventListener('change', renderResults)
elements.filterModel.addEventListener('change', renderResults)

// Initialize
async function init() {
  await checkServerStatus()
  await loadChallenges()
  await loadJobs()

  // Periodic refresh
  setInterval(checkServerStatus, 5000)
  setInterval(loadJobs, 3000)
}

init()
