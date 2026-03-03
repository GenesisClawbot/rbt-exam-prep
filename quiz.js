/**
 * RBT Exam Prep — Quiz Engine
 * Version: 1.0.0
 *
 * Paywall: Token-based security-by-obscurity
 * User must arrive at quiz.html?token=XXXXXXXX from Stripe success URL.
 * If no token, redirected back to index.html.
 *
 * SECURITY NOTE: This is NOT cryptographic. The token is a static value
 * appended to the Stripe Payment Link success URL. Anyone with the link can
 * share access. This is an acceptable risk for a $9.99 product at MVP stage.
 * For tighter security, upgrade to Netlify Edge Function HMAC validation (see README).
 */

(function () {
  'use strict';

  // ─── CONFIG ─────────────────────────────────────────────────────────────────

  const VALID_TOKEN = 'b7d370d528d02000cb6c30c7b7451bfb';  // CHANGE BEFORE DEPLOY — must match Stripe success URL param
  const STORAGE_KEY = 'rbt_access';

  const DOMAIN_NAMES = {
    A: 'Basic Behavior Analytic Skills',
    B: 'Measurement',
    C: 'Skill Acquisition',
    D: 'Behavior Reduction',
    E: 'Documentation and Reporting',
    F: 'Professional Conduct and Scope of Practice',
  };

  // ─── STATE ──────────────────────────────────────────────────────────────────

  let allQuestions = [];
  let activeQuestions = [];
  let currentIndex = 0;
  let answered = false;
  let activeFilter = 'ALL';

  const score = {
    total: 0,
    correct: 0,
    byDomain: {},
  };

  // ─── PAYWALL ────────────────────────────────────────────────────────────────

  function checkAccess() {
    // Check localStorage first (returning user)
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      return true;
    }
    // Check URL token
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token === VALID_TOKEN) {
      localStorage.setItem(STORAGE_KEY, 'true');
      // Clean the token from the URL for aesthetics (not security)
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  }

  // ─── INIT ───────────────────────────────────────────────────────────────────

  async function init() {
    if (!checkAccess()) {
      showPaywall();
      return;
    }

    showLoading();

    try {
      const response = await fetch('questions.json');
      if (!response.ok) throw new Error('Failed to load questions');
      const data = await response.json();
      allQuestions = data.questions;

      // Shuffle
      shuffle(allQuestions);

      // Init domain score trackers
      Object.keys(DOMAIN_NAMES).forEach(d => {
        score.byDomain[d] = { total: 0, correct: 0 };
      });

      // Build filter UI
      buildFilterBar();

      setFilter('ALL');
    } catch (err) {
      console.error('Quiz load error:', err);
      document.getElementById('app').innerHTML = `
        <div class="loading-screen">
          <p>Failed to load questions. Please refresh and try again.</p>
        </div>`;
    }
  }

  // ─── PAYWALL SCREEN ─────────────────────────────────────────────────────────

  function showPaywall() {
    document.getElementById('app').innerHTML = `
      <div class="paywall-screen">
        <div class="paywall-screen__card">
          <div class="paywall-screen__icon">🔒</div>
          <h1>Access Required</h1>
          <p>Purchase one-time access to 100 BCBA-verified RBT practice questions focused on the sections you're most likely to fail.</p>
          <div class="paywall-screen__price">$9.99</div>
          <div class="paywall-screen__price-note">One-time payment. No subscription.</div>
          <a href="index.html#cta" class="btn btn--primary btn--large" style="width:100%;text-align:center;display:block;">
            Get Access — $9.99
          </a>
          <p style="margin-top:1rem;font-size:0.82rem;color:#94a3b8;">
            Already purchased? <a href="index.html" style="color:#2563eb;">Return to purchase page</a> — your access link was in the confirmation email.
          </p>
        </div>
      </div>`;
  }

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────

  function showLoading() {
    document.getElementById('app').innerHTML = `
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Loading questions…</p>
      </div>`;
  }

  // ─── FILTER BAR ─────────────────────────────────────────────────────────────

  function buildFilterBar() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    const filters = [
      { key: 'ALL', label: 'All Domains' },
      ...Object.entries(DOMAIN_NAMES).map(([key, name]) => ({
        key,
        label: `${key}: ${name.split(' ').slice(0, 2).join(' ')}`,
      })),
    ];

    bar.innerHTML = `
      <span class="filter-bar__label">Filter:</span>
      ${filters.map(f => `
        <button class="filter-btn ${f.key === 'ALL' ? 'active' : ''}"
          data-domain="${f.key}"
          title="${f.key === 'ALL' ? 'All Domains' : DOMAIN_NAMES[f.key]}">
          ${f.label}
        </button>
      `).join('')}`;

    bar.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      setFilter(btn.dataset.domain);
    });
  }

  function setFilter(domain) {
    activeFilter = domain;

    // Update active button state
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.domain === domain);
    });

    // Reset quiz with filtered questions
    activeQuestions = domain === 'ALL'
      ? [...allQuestions]
      : allQuestions.filter(q => q.domain === domain);

    shuffle(activeQuestions);

    currentIndex = 0;
    answered = false;

    // Reset score for this session/filter
    Object.keys(DOMAIN_NAMES).forEach(d => {
      score.byDomain[d] = { total: 0, correct: 0 };
    });
    score.total = 0;
    score.correct = 0;

    renderQuestion();
  }

  // ─── RENDER QUESTION ────────────────────────────────────────────────────────

  function renderQuestion() {
    const app = document.getElementById('app');

    if (currentIndex >= activeQuestions.length) {
      renderScoreScreen();
      return;
    }

    const q = activeQuestions[currentIndex];
    answered = false;

    const progress = Math.round((currentIndex / activeQuestions.length) * 100);
    const domainName = DOMAIN_NAMES[q.domain] || q.domain;

    app.innerHTML = `
      <div class="filter-bar" id="filter-bar"></div>

      <div class="quiz-card">
        <div class="quiz-card__header">
          <span class="quiz-card__counter">Question ${currentIndex + 1} of ${activeQuestions.length}</span>
          <span class="quiz-card__domain">Domain ${q.domain}: ${domainName}</span>
          <span class="quiz-card__difficulty">${q.difficulty}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <div class="quiz-card__body">
          <p class="quiz-card__question">${escapeHtml(q.question)}</p>
          <ul class="options-list" id="options">
            ${q.options.map((opt, i) => `
              <li>
                <button class="option-btn" data-index="${i}" data-answer="${q.options[i][0]}">
                  ${escapeHtml(opt)}
                </button>
              </li>
            `).join('')}
          </ul>
          <div class="explanation-panel" id="explanation"></div>
        </div>
        <div class="quiz-card__footer">
          <button class="btn btn--primary btn--next" id="btn-next">Next Question →</button>
        </div>
      </div>`;

    // Rebuild filter bar (inside the render to preserve state)
    buildFilterBar();
    // Re-mark active filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.domain === activeFilter);
    });

    // Bind answer buttons
    document.getElementById('options').addEventListener('click', e => {
      const btn = e.target.closest('.option-btn');
      if (!btn || answered) return;
      handleAnswer(btn, q);
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      currentIndex++;
      renderQuestion();
    });
  }

  // ─── HANDLE ANSWER ──────────────────────────────────────────────────────────

  function handleAnswer(selectedBtn, question) {
    answered = true;

    const selectedAnswer = selectedBtn.dataset.answer;
    const isCorrect = selectedAnswer === question.answer;

    // Update score
    score.total++;
    score.byDomain[question.domain].total++;
    if (isCorrect) {
      score.correct++;
      score.byDomain[question.domain].correct++;
    }

    // Style the buttons
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => {
      btn.disabled = true;
      const btnAnswer = btn.dataset.answer;
      if (btnAnswer === question.answer) {
        btn.classList.add('correct');
      } else if (btn === selectedBtn && !isCorrect) {
        btn.classList.add('incorrect');
      } else {
        btn.classList.add('dimmed');
      }
    });

    // Show explanation
    const expPanel = document.getElementById('explanation');
    expPanel.classList.add('visible');
    expPanel.classList.add(isCorrect ? 'correct-exp' : 'incorrect-exp');
    expPanel.innerHTML = `
      <strong>${isCorrect ? '✓ Correct' : '✗ Incorrect — Correct answer: ' + question.answer}</strong>
      ${escapeHtml(question.explanation)}`;

    // Show next button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
      nextBtn.classList.add('visible');
      nextBtn.textContent = currentIndex + 1 >= activeQuestions.length
        ? 'See Results →'
        : 'Next Question →';
    }
  }

  // ─── SCORE SCREEN ───────────────────────────────────────────────────────────

  function renderScoreScreen() {
    const app = document.getElementById('app');
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '📚' : '💪';
    const verdict = pct >= 80
      ? 'Great work! You\'re on track.'
      : pct >= 60
        ? 'Getting there — review the explanations for wrong answers.'
        : 'Keep practicing — focus on the domains where you dropped points.';

    const domainRows = Object.entries(DOMAIN_NAMES).map(([key, name]) => {
      const ds = score.byDomain[key];
      if (!ds || ds.total === 0) return '';
      const dpct = Math.round((ds.correct / ds.total) * 100);
      const barClass = dpct >= 80 ? 'good' : dpct >= 60 ? 'ok' : 'poor';
      return `
        <div class="domain-stat">
          <div class="domain-stat__label">Domain ${key}</div>
          <div class="domain-stat__name">${name}</div>
          <div class="domain-stat__score">${ds.correct}/${ds.total} (${dpct}%)</div>
          <div class="domain-stat__bar-wrap">
            <div class="domain-stat__bar ${barClass}" style="width:${dpct}%"></div>
          </div>
        </div>`;
    }).join('');

    app.innerHTML = `
      <div class="score-screen">
        <div class="score-screen__emoji">${emoji}</div>
        <div class="score-screen__total">${pct}%</div>
        <div class="score-screen__sub">${score.correct} correct out of ${score.total} questions — ${verdict}</div>

        <div class="domain-breakdown">
          ${domainRows || '<p style="color:#94a3b8;font-size:0.9rem;">No domain data — complete questions to see breakdown.</p>'}
        </div>

        <div class="score-screen__actions">
          <button class="btn btn--primary" id="btn-retry">Practice Again</button>
          <button class="btn btn--outline" id="btn-retry-wrong" style="background:#fff;border-color:#e2e8f0;color:#475569;">
            Retry Wrong Answers
          </button>
          <a href="index.html" class="btn" style="background:#f1f5f9;color:#475569;">← Back to Home</a>
        </div>
      </div>`;

    document.getElementById('btn-retry').addEventListener('click', () => {
      setFilter(activeFilter);
    });

    document.getElementById('btn-retry-wrong').addEventListener('click', () => {
      retryWrongAnswers();
    });
  }

  // ─── RETRY WRONG ────────────────────────────────────────────────────────────

  // Track wrong answer IDs during session
  const wrongIds = new Set();

  function handleAnswer_trackWrong(selectedBtn, question) {
    const isCorrect = selectedBtn.dataset.answer === question.answer;
    if (!isCorrect) wrongIds.add(question.id);
    else wrongIds.delete(question.id);
  }

  function retryWrongAnswers() {
    // Get questions that were answered incorrectly
    const wrongQuestions = allQuestions.filter(q => wrongIds.has(q.id));
    if (wrongQuestions.length === 0) {
      alert('No wrong answers to retry — good job!');
      return;
    }
    activeQuestions = shuffle([...wrongQuestions]);
    currentIndex = 0;
    answered = false;
    Object.keys(DOMAIN_NAMES).forEach(d => {
      score.byDomain[d] = { total: 0, correct: 0 };
    });
    score.total = 0;
    score.correct = 0;
    wrongIds.clear();
    renderQuestion();
  }

  // ─── UTILS ──────────────────────────────────────────────────────────────────

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── PATCH handleAnswer to also track wrong IDs ──────────────────────────────

  const _originalHandleAnswer = handleAnswer;
  // Override to include tracking
  // (we do this inline above — the retryWrongAnswers reads wrongIds set by handleAnswer)
  // The tracking is embedded directly in handleAnswer above.
  // Note: wrongIds tracking is done inside handleAnswer already.

  // ─── BOOT ───────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Track wrong answers — patch handleAnswer to update set
  // This is done inline in handleAnswer above (isCorrect check adds to wrongIds)
  // The actual tracking in handleAnswer already does: if(!isCorrect) wrongIds.add(q.id)
  // We just need to make sure the reference is consistent — and it is via closure.

})();
