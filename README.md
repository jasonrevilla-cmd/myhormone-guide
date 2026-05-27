# MyHormoneGuide — Authority Site

Patient education authority site for Bioidentical Hormone Replacement Therapy.
Built with Astro, Tailwind CSS, and MDX. Content pipeline powered by the Claude API.

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/bhrt-authority-site.git
cd bhrt-authority-site
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your API key

```bash
cp .env.example .env
# Edit .env and add your real ANTHROPIC_API_KEY
```

Get your API key at: https://console.anthropic.com

### 4. Start the dev server

```bash
npm run dev
# Open http://localhost:4321
```

---

## Connecting Vercel

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo — Vercel auto-detects Astro
4. Deploy — your site is live

Vercel auto-deploys on every push to `main`, including auto-generated posts.

---

## Setting Up the Daily Content Pipeline

### Step 1: Add your API key to GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: your Anthropic API key (`sk-ant-...`)
5. Save

### Step 2: Enable GitHub Actions

The workflow is already configured at `.github/workflows/daily-post.yml`.
It runs automatically at **8:00 AM CST** every day.

### Step 3: Manually trigger a post (for testing)

1. Go to your GitHub repo → **Actions** tab
2. Click **Daily Blog Post** in the left sidebar
3. Click **Run workflow** → **Run workflow**

A new post will be generated, QC-checked, saved to `src/content/posts/`, and committed.
Vercel will deploy within ~30 seconds.

---

## Generating a Post Locally

```bash
# Make sure ANTHROPIC_API_KEY is in your .env
npm run generate-post
```

The script will:
1. Find the next `"status": "pending"` post in `topics.json`
2. Call the Claude API with the full system + dynamic prompt
3. Run a QC check (second API call)
4. Save the MDX to `src/content/posts/`
5. Mark the post `"status": "published"` in `topics.json`

---

## Adding More Posts to the Queue

Edit `topics.json` and add entries to the `posts` array with `"status": "pending"`.
The pipeline processes one post per run, in order.

See the full topical map in `BHRT-Authority-Site-Blueprint.docx` for all 120+ planned posts.

---

## Connecting Beehiiv (Newsletter)

1. Create your publication at [app.beehiiv.com](https://app.beehiiv.com)
2. Go to **Grow** → **Embed**
3. Copy your embed code
4. Replace the placeholder div in `src/components/EmailOptIn.astro` with your embed code

---

## Customization Checklist

Before launch:

- [ ] Replace `https://myhormoneguide.com` in `astro.config.mjs` and `src/layouts/BaseLayout.astro` with your real domain
- [ ] Replace `hello@myhormoneguide.com` in About, Disclaimer, and Policy pages
- [ ] Add Beehiiv embed code to `src/components/EmailOptIn.astro`
- [ ] Wire the symptom checker email capture to your Beehiiv subscribe endpoint
- [ ] Update `public/robots.txt` sitemap URL with your real domain
- [ ] Review and publish the first 5 posts manually before enabling full automation
- [ ] Submit sitemap to Google Search Console

---

## Project Structure

```
bhrt-authority-site/
├── generate-post.js          # Daily content pipeline
├── topics.json               # Post queue (20 starter posts)
├── src/
│   ├── content/
│   │   ├── posts/            # Generated MDX files land here
│   │   └── compare/          # Comparison page MDX files
│   ├── components/           # Reusable Astro components
│   ├── layouts/              # Page layout templates
│   └── pages/                # Route pages
└── .github/workflows/        # GitHub Actions
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 4 |
| Styling | Tailwind CSS + @tailwindcss/typography |
| Content | MDX with Astro Content Collections |
| Sitemap | @astrojs/sitemap (auto-generated) |
| Hosting | Vercel (static output) |
| Content Pipeline | Node.js + Anthropic SDK |
| AI Model | claude-sonnet-4-6 |

---

*Confidential — Yvolve Agency*
