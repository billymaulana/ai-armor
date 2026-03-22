<script setup lang="ts">
</script>

<template>
  <section class="hero-section">
    <!-- Grid background -->
    <div class="hero-grid" />

    <!-- Glow orb -->
    <div class="hero-glow" />

    <div class="hero-container">
      <div class="hero-content">
        <div class="hero-badge">
          Production-ready AI toolkit
        </div>
        <h1 class="hero-title">
          <span class="hero-gradient">ai-armor</span>
          <br>
          Ship AI to production
          <br>
          without going broke.
        </h1>
        <p class="hero-tagline">
          Rate limiting, cost tracking, caching, model routing, and safety
          guardrails for every AI provider. One config. Zero vendor lock-in.
        </p>
        <div class="hero-actions">
          <a href="/ai-armor/guide/getting-started.html" class="btn-primary">
            Get Started
          </a>
          <a href="https://github.com/billymaulana/ai-armor" class="btn-outline" target="_blank">
            View on GitHub
          </a>
        </div>

        <!-- Install command -->
        <div class="install-cmd">
          <code>npm install ai-armor</code>
        </div>
      </div>

      <!-- Code Preview -->
      <div class="hero-code">
        <div class="code-window">
          <div class="code-titlebar">
            <span class="code-dot code-dot--red" />
            <span class="code-dot code-dot--yellow" />
            <span class="code-dot code-dot--green" />
            <span class="code-filename">app.ts</span>
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
  <span class="cp">cache</span>: { <span class="cp">enabled</span>: <span class="cn">true</span>, <span class="cp">ttl</span>: <span class="cn">3600</span> },
})</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Providers strip -->
  <section class="providers-section">
    <p class="providers-label">
      Works with every AI provider
    </p>
    <div class="providers-grid">
      <span class="provider-name">OpenAI</span>
      <span class="provider-sep" />
      <span class="provider-name">Anthropic</span>
      <span class="provider-sep" />
      <span class="provider-name">Google</span>
      <span class="provider-sep" />
      <span class="provider-name">Mistral</span>
      <span class="provider-sep" />
      <span class="provider-name">Cohere</span>
      <span class="provider-sep" />
      <span class="provider-name">DeepSeek</span>
      <span class="provider-sep" />
      <span class="provider-name">Groq</span>
      <span class="provider-sep" />
      <span class="provider-name">AWS Bedrock</span>
      <span class="provider-sep" />
      <span class="provider-name">Azure</span>
      <span class="provider-sep" />
      <span class="provider-name">+9 more</span>
    </div>
  </section>
</template>

<style scoped>
/* Hero Section */
.hero-section {
  position: relative;
  overflow: hidden;
  padding: 80px 24px 60px;
  min-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 100%);
}

.hero-glow {
  position: absolute;
  top: -120px;
  right: 10%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(0, 229, 255, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-container {
  position: relative;
  max-width: 1200px;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 100px;
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: rgba(0, 229, 255, 0.06);
  color: #00E5FF;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-bottom: 24px;
}

.hero-title {
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #E2E8F0;
  margin: 0 0 20px;
}

.hero-gradient {
  background: linear-gradient(135deg, #00E5FF 0%, #00B8D4 60%, #0097A7 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-tagline {
  font-size: 1.1rem;
  line-height: 1.7;
  color: #94A3B8;
  max-width: 480px;
  margin: 0 0 32px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 12px 28px;
  background: #00E5FF;
  color: #0A0F1E;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #18FFFF;
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.3);
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  padding: 12px 28px;
  border: 1px solid rgba(0, 229, 255, 0.3);
  color: #00E5FF;
  font-weight: 600;
  font-size: 0.95rem;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-outline:hover {
  border-color: #00E5FF;
  background: rgba(0, 229, 255, 0.06);
}

.install-cmd {
  display: inline-flex;
  padding: 10px 20px;
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid rgba(0, 229, 255, 0.1);
  border-radius: 8px;
}

.install-cmd code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: #64748B;
}

/* Code Window */
.hero-code {
  position: relative;
}

.code-window {
  border-radius: 12px;
  border: 1px solid rgba(0, 229, 255, 0.1);
  background: #080C18;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(0, 229, 255, 0.05),
    0 20px 60px rgba(0, 0, 0, 0.4);
}

.code-titlebar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: rgba(0, 229, 255, 0.03);
  border-bottom: 1px solid rgba(0, 229, 255, 0.06);
}

.code-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.code-dot--red { background: #FF5F57; }
.code-dot--yellow { background: #FEBC2E; }
.code-dot--green { background: #28C840; }

.code-filename {
  margin-left: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: #475569;
}

.code-body {
  padding: 20px;
  margin: 0;
  overflow-x: auto;
}

.code-body code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
  line-height: 1.7;
  color: #CBD5E1;
}

/* Syntax highlighting */
.ck { color: #C792EA; }  /* keyword: import, const */
.cf { color: #82AAFF; }  /* function */
.cs { color: #C3E88D; }  /* string */
.cn { color: #F78C6C; }  /* number */
.cp { color: #89DDFF; }  /* property */
.cv { color: #EEFFFF; }  /* variable */

/* Providers Section */
.providers-section {
  padding: 40px 24px;
  text-align: center;
  border-top: 1px solid rgba(0, 229, 255, 0.06);
  border-bottom: 1px solid rgba(0, 229, 255, 0.06);
}

.providers-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 20px;
}

.providers-grid {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 4px;
}

.provider-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748B;
  padding: 0 12px;
  transition: color 0.2s;
  cursor: default;
}

.provider-name:hover {
  color: #00E5FF;
}

.provider-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #334155;
}

/* Responsive */
@media (max-width: 900px) {
  .hero-container {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .hero-title {
    font-size: 2.4rem;
  }

  .hero-code {
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 1.8rem;
  }

  .hero-actions {
    flex-direction: column;
  }

  .code-body code {
    font-size: 0.72rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-glow {
    display: none;
  }
}
</style>

<!-- Light mode overrides (unscoped for html.dark targeting) -->
<style>
html:not(.dark) .hero-section .hero-grid {
  background-image:
    linear-gradient(rgba(0, 184, 212, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 184, 212, 0.08) 1px, transparent 1px);
}

html:not(.dark) .hero-section .hero-glow {
  background: radial-gradient(circle, rgba(0, 184, 212, 0.06) 0%, transparent 70%);
}

html:not(.dark) .hero-section .hero-badge {
  border-color: rgba(0, 184, 212, 0.35);
  background: rgba(0, 184, 212, 0.1);
  color: #0097A7;
}

html:not(.dark) .hero-section .hero-title {
  color: #0F172A;
}

html:not(.dark) .hero-section .hero-gradient {
  background: linear-gradient(135deg, #00B8D4 0%, #0097A7 60%, #00838F 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

html:not(.dark) .hero-section .hero-tagline {
  color: #475569;
}

html:not(.dark) .hero-section .btn-primary {
  background: #00B8D4;
  color: #FFFFFF;
}

html:not(.dark) .hero-section .btn-primary:hover {
  background: #0097A7;
  box-shadow: 0 0 24px rgba(0, 184, 212, 0.25);
}

html:not(.dark) .hero-section .btn-outline {
  border-color: rgba(0, 184, 212, 0.4);
  color: #0097A7;
}

html:not(.dark) .hero-section .btn-outline:hover {
  border-color: #00B8D4;
  background: rgba(0, 184, 212, 0.08);
}

html:not(.dark) .hero-section .install-cmd {
  background: rgba(0, 184, 212, 0.06);
  border-color: rgba(0, 184, 212, 0.18);
}

html:not(.dark) .hero-section .install-cmd code {
  color: #475569;
}

html:not(.dark) .hero-section .code-window {
  background: #F8FAFC;
  border-color: #E2E8F0;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
}

html:not(.dark) .hero-section .code-titlebar {
  background: rgba(0, 0, 0, 0.02);
  border-bottom-color: #E2E8F0;
}

html:not(.dark) .hero-section .code-filename {
  color: #94A3B8;
}

html:not(.dark) .hero-section .code-body code {
  color: #334155;
}

/* Light mode syntax highlighting */
html:not(.dark) .hero-section .ck { color: #7C3AED; }
html:not(.dark) .hero-section .cf { color: #2563EB; }
html:not(.dark) .hero-section .cs { color: #059669; }
html:not(.dark) .hero-section .cn { color: #EA580C; }
html:not(.dark) .hero-section .cp { color: #0891B2; }
html:not(.dark) .hero-section .cv { color: #0F172A; }

/* Providers section light mode */
html:not(.dark) .providers-section {
  border-color: rgba(0, 184, 212, 0.1);
}

html:not(.dark) .providers-section .providers-label {
  color: #64748B;
}

html:not(.dark) .providers-section .provider-name {
  color: #475569;
}

html:not(.dark) .providers-section .provider-name:hover {
  color: #0097A7;
}

html:not(.dark) .providers-section .provider-sep {
  background: #CBD5E1;
}
</style>
