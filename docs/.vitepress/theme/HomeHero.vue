<script setup lang="ts">
import { ref } from 'vue'

const copied = ref(false)

function copyInstall() {
  navigator.clipboard.writeText('npm install ai-armor')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <section class="hero">
    <div class="hero-bg">
      <div class="hero-dots" />
      <div class="hero-beam" />
      <div class="hero-beam hero-beam--2" />
    </div>

    <div class="hero-inner">
      <!-- Left: Content -->
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot" />
          Production AI Toolkit
        </div>

        <h1 class="hero-title">
          Protect your AI APIs.
          <span class="hero-title-accent">One package.</span>
        </h1>

        <p class="hero-desc">
          Rate limiting, cost tracking, caching, safety guardrails,
          and fallback chains for every AI provider.
          Zero vendor lock-in.
        </p>

        <div class="hero-actions">
          <a href="/ai-armor/guide/getting-started.html" class="btn-primary">
            Get Started
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
          <a href="https://github.com/billymaulana/ai-armor" class="btn-ghost" target="_blank">
            GitHub
          </a>
        </div>

        <button class="install-cmd" @click="copyInstall">
          <span class="install-prompt">$</span>
          <span class="install-text">npm install ai-armor</span>
          <span class="install-copy">{{ copied ? 'Copied!' : 'Copy' }}</span>
        </button>
      </div>

      <!-- Right: Code Window -->
      <div class="hero-visual">
        <div class="code-window">
          <div class="code-chrome">
            <div class="code-dots">
              <span /><span /><span />
            </div>
            <span class="code-file">armor.config.ts</span>
          </div>
          <pre class="code-body"><code><span class="ck">import</span> { <span class="cf">createArmor</span> } <span class="ck">from</span> <span class="cs">'ai-armor'</span>

<span class="ck">const</span> <span class="cv">armor</span> = <span class="cf">createArmor</span>({
  <span class="cp">rateLimit</span>: {
    <span class="cp">strategy</span>: <span class="cs">'sliding-window'</span>,
    <span class="cp">rules</span>: [{ <span class="cp">key</span>: <span class="cs">'user'</span>, <span class="cp">limit</span>: <span class="cn">30</span>, <span class="cp">window</span>: <span class="cs">'1m'</span> }],
  },
  <span class="cp">budget</span>: {
    <span class="cp">daily</span>: <span class="cn">50</span>,
    <span class="cp">onExceeded</span>: <span class="cs">'downgrade-model'</span>,
    <span class="cp">downgradeMap</span>: { <span class="cs">'gpt-4o'</span>: <span class="cs">'gpt-4o-mini'</span> },
  },
  <span class="cp">safety</span>: { <span class="cp">promptInjection</span>: <span class="cn">true</span>, <span class="cp">piiDetection</span>: <span class="cn">true</span> },
  <span class="cp">cache</span>: { <span class="cp">enabled</span>: <span class="cn">true</span>, <span class="cp">ttl</span>: <span class="cn">3600</span> },
})</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Provider Strip -->
  <section class="providers">
    <p class="providers-label">
      Trusted by teams using
    </p>
    <div class="providers-row">
      <span v-for="p in ['OpenAI', 'Anthropic', 'Google', 'Mistral', 'Cohere', 'DeepSeek', 'Groq', 'AWS Bedrock', 'Azure', '+9 more']" :key="p" class="provider">{{ p }}</span>
    </div>
  </section>
</template>

<style scoped>
/* ---- Hero Section ---- */
.hero {
  position: relative;
  overflow: hidden;
  padding: 100px 24px 80px;
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, black 20%, transparent 100%);
}

.hero-beam {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse at 50% 0%, rgba(0, 212, 234, 0.06) 0%, transparent 70%);
}

.hero-beam--2 {
  width: 300px;
  height: 600px;
  background: radial-gradient(ellipse at 50% 0%, rgba(0, 212, 234, 0.03) 0%, transparent 70%);
}

.hero-inner {
  position: relative;
  max-width: 1200px;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

/* ---- Content ---- */
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: #a1a1aa;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 28px;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4ea;
  box-shadow: 0 0 8px rgba(0, 212, 234, 0.4);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: #fafafa;
  margin: 0 0 20px;
}

.hero-title-accent {
  display: block;
  background: linear-gradient(135deg, #00d4ea 0%, #00b8d4 50%, #0097a7 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  font-size: 1.05rem;
  line-height: 1.7;
  color: #71717a;
  max-width: 460px;
  margin: 0 0 32px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 24px;
  background: #fafafa;
  color: #09090b;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 20px rgba(0, 0, 0, 0.3);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  padding: 11px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
  font-weight: 500;
  font-size: 0.9rem;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-ghost:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: #fafafa;
}

/* ---- Install Command ---- */
.install-cmd {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.install-cmd:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
}

.install-prompt {
  color: #00d4ea;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  font-weight: 600;
}

.install-text {
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  color: #a1a1aa;
}

.install-copy {
  font-size: 0.7rem;
  font-weight: 600;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  margin-left: 4px;
}

/* ---- Code Window ---- */
.hero-visual {
  position: relative;
}

.code-window {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: #09090b;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 25px 80px rgba(0, 0, 0, 0.5);
}

.code-chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.code-dots {
  display: flex;
  gap: 6px;
}

.code-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.code-dots span:nth-child(1) { background: #ef4444; opacity: 0.7; }
.code-dots span:nth-child(2) { background: #eab308; opacity: 0.7; }
.code-dots span:nth-child(3) { background: #22c55e; opacity: 0.7; }

.code-file {
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  color: #3f3f46;
  margin-left: 6px;
}

.code-body {
  padding: 20px;
  margin: 0;
  overflow-x: auto;
}

.code-body code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.75;
  color: #d4d4d8;
}

/* Syntax colors — muted, not screaming */
.ck { color: #c084fc; }
.cf { color: #7dd3fc; }
.cs { color: #86efac; }
.cn { color: #fbbf24; }
.cp { color: #94a3b8; }
.cv { color: #e2e8f0; }

/* ---- Providers ---- */
.providers {
  padding: 48px 24px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.providers-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #3f3f46;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin: 0 0 20px;
}

.providers-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
}

.provider {
  font-size: 0.82rem;
  font-weight: 500;
  color: #52525b;
  padding: 6px 14px;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.provider:hover {
  color: #a1a1aa;
}

/* ---- Responsive ---- */
@media (max-width: 960px) {
  .hero-inner {
    grid-template-columns: 1fr;
    gap: 48px;
    text-align: center;
  }

  .hero-title { font-size: 2.6rem; }
  .hero-desc { margin-inline: auto; }
  .hero-actions { justify-content: center; }
  .install-cmd { margin-inline: auto; }
}

@media (max-width: 480px) {
  .hero { padding: 80px 16px 60px; }
  .hero-title { font-size: 2rem; }
  .hero-actions { flex-direction: column; }
  .code-body code { font-size: 0.72rem; }
}
</style>

<!-- Light mode overrides (unscoped to target html:not(.dark)) -->
<style>
html:not(.dark) .hero {
  background: #fff;
}

html:not(.dark) .hero-dots {
  background-image: radial-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px);
}

html:not(.dark) .hero-beam {
  background: radial-gradient(ellipse at 50% 0%, rgba(0, 184, 212, 0.06) 0%, transparent 70%);
}

html:not(.dark) .hero-badge {
  border-color: rgba(0, 0, 0, 0.08);
  background: rgba(0, 184, 212, 0.06);
  color: #0097a7;
}

html:not(.dark) .hero-title {
  color: #09090b;
}

html:not(.dark) .hero-title-accent {
  background: linear-gradient(135deg, #0097a7 0%, #00838f 50%, #006064 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

html:not(.dark) .hero-desc {
  color: #52525b;
}

html:not(.dark) .btn-primary {
  background: #09090b;
  color: #fafafa;
}

html:not(.dark) .btn-primary:hover {
  background: #18181b;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

html:not(.dark) .btn-ghost {
  border-color: rgba(0, 0, 0, 0.12);
  color: #52525b;
}

html:not(.dark) .btn-ghost:hover {
  border-color: rgba(0, 0, 0, 0.25);
  color: #09090b;
}

html:not(.dark) .install-cmd {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.08);
}

html:not(.dark) .install-cmd:hover {
  border-color: rgba(0, 0, 0, 0.15);
  background: rgba(0, 0, 0, 0.05);
}

html:not(.dark) .install-prompt {
  color: #0097a7;
}

html:not(.dark) .install-text {
  color: #52525b;
}

html:not(.dark) .install-copy {
  color: #a1a1aa;
  background: rgba(0, 0, 0, 0.04);
}

html:not(.dark) .code-window {
  background: #fafafa;
  border-color: #e4e4e7;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.08);
}

html:not(.dark) .code-chrome {
  border-bottom-color: #e4e4e7;
}

html:not(.dark) .code-file {
  color: #a1a1aa;
}

html:not(.dark) .code-body code {
  color: #3f3f46;
}

/* Light mode syntax highlighting */
html:not(.dark) .ck { color: #7c3aed; }
html:not(.dark) .cf { color: #2563eb; }
html:not(.dark) .cs { color: #059669; }
html:not(.dark) .cn { color: #d97706; }
html:not(.dark) .cp { color: #64748b; }
html:not(.dark) .cv { color: #0f172a; }

html:not(.dark) .providers {
  border-top-color: rgba(0, 0, 0, 0.06);
}

html:not(.dark) .providers-label {
  color: #a1a1aa;
}

html:not(.dark) .provider {
  color: #71717a;
}

html:not(.dark) .provider:hover {
  color: #09090b;
}
</style>
