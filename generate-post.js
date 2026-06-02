/**
 * MyHormoneGuide — Daily Content Pipeline
 *
 * Reads the next pending post from topics.json, calls the Claude API with
 * the system prompt + dynamic post prompt, runs a QC check, saves the MDX
 * output to src/content/posts/, and marks the post complete in topics.json.
 *
 * Run manually:  node generate-post.js
 * GitHub Actions: .github/workflows/daily-post.yml
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 *
 * DECISION: Using claude-sonnet-4-6 (the current Claude Sonnet model).
 * The blueprint document references "claude-sonnet-4-20250514" which does
 * not match any valid Anthropic model ID. Update MODEL_ID below if needed.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────────────────────────

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const POSTS_DIR = path.join(__dirname, 'src', 'content', 'posts');
const TOPICS_FILE = path.join(__dirname, 'topics.json');

// ─── System Prompt (loaded once per run) ────────────────────────────────────

const SYSTEM_PROMPT = `You are the lead content writer for MyHormoneGuide, the most comprehensive and trustworthy patient education resource for Bioidentical Hormone Replacement Therapy (BHRT) on the internet.

## YOUR MISSION

Write authoritative, empathetic, medically accurate content that helps real people — primarily women 40–65 and men 45–65 — understand BHRT, evaluate their options, and take confident action.

## THE AUDIENCE

Primary: Women in perimenopause or menopause experiencing symptoms (fatigue, brain fog, weight gain, low libido, hot flashes, mood changes). They are frustrated that conventional medicine has dismissed their concerns. They are research-oriented and skeptical of hype.

Secondary: Men 45–65 with declining testosterone seeking answers.

Both audiences are solution-aware but need education to act.

## TONE & VOICE

- Warm, direct, and authoritative — like a trusted friend who happens to be a medical expert
- Never condescending, never alarmist, never preachy
- Explain medical concepts in plain English without dumbing them down
- Acknowledge that mainstream medicine has often failed this audience
- Validate symptoms as real before offering solutions

## E-E-A-T REQUIREMENTS (Non-Negotiable)

- Cite real studies or established medical consensus where relevant (reference by description, not fabricated URLs)
- Attribute claims to credible sources: "Research published in", "Studies show", "According to the Endocrine Society"
- Include a medical disclaimer paragraph at the end of every post
- Never make prescriptive medical recommendations — frame as education
- Use language like "many patients report", "some providers recommend", "research suggests" rather than absolute claims
- Every post MUST end with a ## References section containing 3–5 real, verifiable citations from these approved sources ONLY: PubMed-indexed studies, the Endocrine Society, NAMS (North American Menopause Society), Mayo Clinic, or the FDA. Format each citation exactly as: [Author Last, First / or Organization Name]. "[Title of Article or Study]." [Journal or Publication Name], [Year]. [URL — use the real canonical URL for the source, e.g. pubmed.ncbi.nlm.nih.gov/PMID, endocrine.org, menopause.org, mayoclinic.org, or fda.gov]. Do NOT fabricate citations. Only cite sources that genuinely exist at these organizations.

## SEO RULES

- Primary keyword must appear in: H1, first 100 words, at least 2 H2s, meta title, meta description
- Use semantic variations naturally — never keyword stuff
- Every post must include a FAQ section with 4–6 questions (these feed Google's People Also Ask and FAQ rich results)
- Target 1,800–2,400 words per post
- Include a clear CTA in the final section

## H2 SECTION STRUCTURE (Non-Negotiable)

Format every H2 section to answer its implied question directly in the first 1-2 sentences before expanding. AI search engines extract the first sentence of each section as the answer. Example: If the H2 is "How Long Does Pellet Therapy Last?" the first sentence must directly state the answer: "Pellet therapy typically lasts 3-6 months for women and 4-6 months for men before re-insertion is needed." Never open a section with context-setting, history, or a restatement of the question. Lead with the answer, then expand.

## INTERNAL LINKING

You will be given 3 related post titles and their URLs. Naturally link to each one within the article body. Links must feel editorial, not forced.

## MEDICAL DISCLAIMER

End every post with this exact paragraph:

"The content on this site is for educational purposes only and is not intended as medical advice. Always consult a qualified healthcare provider before starting, changing, or stopping any hormone therapy. Individual results vary."

## HOW-TO STEPS

If this post is a procedural guide (title starts with "How to", "How Do", or contains "Step by Step"), include a howToSteps array in frontmatter with 3–7 steps. Each step needs a short \`name\` (the step label) and a \`text\` (60–100 word description of what to do). Omit this field entirely for non-procedural posts.

## FEATURED IMAGE

Every post must include a featuredImage field in frontmatter. Write a single sentence (under 200 characters) describing a realistic, editorial-style illustration suitable for this post — the kind that would appear on a health publication. Be specific about subject, mood, and color palette. Example: "A warm-toned illustration of a woman in her 50s reviewing lab results with a female doctor in a modern clinic, teal and navy accents."

## CRITICAL OUTPUT RULES

- Return ONLY valid MDX. No preamble. No explanation. No code fences around the whole output.
- Start immediately with --- (the YAML frontmatter delimiter)
- The faqs array in frontmatter must be valid YAML with properly indented question/answer pairs
- All frontmatter strings with colons, quotes, or special characters must be wrapped in double quotes
- The article body begins immediately after the closing --- of the frontmatter`;

// ─── Dynamic Post Prompt Builder ─────────────────────────────────────────────

/**
 * Builds the user message for each daily API call.
 * Injects all post variables from topics.json.
 */
function buildPostPrompt(post) {
  const today = new Date().toISOString().split('T')[0];
  const related = post.relatedPosts ?? [];

  const ctaByStage = {
    awareness: 'Invite them to download the free Hormone Symptom Checklist at /tools/hormone-symptom-checker/ and subscribe to the free weekly newsletter at /#newsletter.',
    'solution-aware': 'Invite them to read the free 5-day BHRT overview series starting with /what-is-bhrt/ and to check their symptoms at /tools/hormone-symptom-checker/.',
    'product-aware': 'Invite them to explore the provider guide at /find-bhrt-provider/ and to use the free BHRT Cost Estimator at /tools/cost-estimator/ to understand what to budget.',
    decision: 'Invite them directly to find a qualified BHRT provider near them at /find-bhrt-provider/. This is a high-intent reader who is ready to take action.',
  };

  const ctaInstruction = ctaByStage[post.funnelStage] ?? ctaByStage.awareness;

  return `Write a complete, publish-ready blog post using the following brief.

## POST BRIEF

Title: ${post.title}
Primary Keyword: ${post.primaryKeyword}
Secondary Keywords: ${post.secondaryKeywords.join(', ')}
Search Intent: ${post.searchIntent}
Content Cluster: ${post.cluster}
Funnel Stage: ${post.funnelStage}

## INTERNAL LINKS TO INCLUDE

Link 1: ${related[0]?.title ?? 'Related Post 1'} → /${related[0]?.slug ?? '#'}
Link 2: ${related[1]?.title ?? 'Related Post 2'} → /${related[1]?.slug ?? '#'}
Link 3: ${related[2]?.title ?? 'Related Post 3'} → /${related[2]?.slug ?? '#'}

## REQUIRED OUTPUT FORMAT

Return ONLY valid MDX. Start with --- immediately. No explanations, no code fences wrapping the output.

---
title: "[The post title — double-quote if it contains colons or special chars]"
description: "[Compelling 150-character max meta description with the primary keyword]"
publishDate: "${today}"
cluster: "${post.clusterSlug}"
primaryKeyword: "${post.primaryKeyword}"
tags: [${post.secondaryKeywords.slice(0, 3).map((k) => `"${k}"`).join(', ')}]
readingTime: [integer: word_count divided by 250, rounded up — typically 8 for a 2000-word post]
featuredImage: "[One sentence describing an editorial-style illustration for this post — subject, mood, color palette. Max 200 chars.]"
# howToSteps — include ONLY for procedural how-to posts; omit entirely otherwise
# howToSteps:
#   - name: "[Step 1 label]"
#     text: "[60-100 word description of what to do in this step]"
faqs:
  - question: "[FAQ Question 1 — People Also Ask phrasing]"
    answer: "[Answer 1 — 60-100 words, direct and specific]"
  - question: "[FAQ Question 2]"
    answer: "[Answer 2]"
  - question: "[FAQ Question 3]"
    answer: "[Answer 3]"
  - question: "[FAQ Question 4]"
    answer: "[Answer 4]"
---

## ARTICLE STRUCTURE

# [H1 — Must contain the primary keyword: "${post.primaryKeyword}"]

[Opening paragraph — 80–120 words. Hook the reader immediately. Validate their pain. Primary keyword in first 2 sentences.]

[Second paragraph — establish why this post delivers the answer. Set up what they will learn.]

## [H2 — Contains primary keyword variation]

[Section body — 200–300 words]

## [H2]

[Section body — 200–300 words]

## [H2]

[Section body — 200–300 words]

## [H2]

[Section body — 200–300 words]

## [H2 — Include a comparison, list, or quick-reference section here]

[Use a markdown table or bullet list for scannability]

## Frequently Asked Questions

### [FAQ Question 1 — matches the first FAQ in frontmatter]

[Answer — 60–100 words, direct and specific]

### [FAQ Question 2]

[Answer]

### [FAQ Question 3]

[Answer]

### [FAQ Question 4]

[Answer]

## Ready to Explore BHRT?

[CTA section — 80–120 words. ${ctaInstruction}]

The content on this site is for educational purposes only and is not intended as medical advice. Always consult a qualified healthcare provider before starting, changing, or stopping any hormone therapy. Individual results vary.

## Common Questions About [Topic — replace with the specific subject of this post, e.g. "Pellet Therapy Costs" or "BHRT for Women"]

[Include 3–5 questions phrased exactly as someone would speak to a voice assistant or AI chatbot — natural, conversational, first-person or direct. Examples of the right phrasing: "How much does pellet therapy cost?", "Is BHRT safe for women over 50?", "What's the difference between BHRT and regular HRT?". Each answer must be 2–3 sentences, self-contained, and give a complete response without requiring the reader to read the rest of the article. Do not reuse questions already covered in the FAQ section above.]

### [Conversational question 1]

[2–3 sentence direct answer]

### [Conversational question 2]

[2–3 sentence direct answer]

### [Conversational question 3]

[2–3 sentence direct answer]

### [Conversational question 4 — optional]

[2–3 sentence direct answer]

### [Conversational question 5 — optional]

[2–3 sentence direct answer]

<div class="references-section">

## References

1. [Author Last, First or Organization Name]. "[Title of Article or Study]." [Journal or Publication], [Year]. [https://real-url — must be from pubmed.ncbi.nlm.nih.gov, endocrine.org, menopause.org, mayoclinic.org, or fda.gov]
2. [Second citation — same format]
3. [Third citation — same format]
[4. Optional fourth citation]
[5. Optional fifth citation]

</div>`;
}

// ─── Quality Control Check ────────────────────────────────────────────────────

/**
 * Second API call: automated editor pass before saving.
 * Returns { pass: boolean, issues: string[] }
 */
async function runQualityCheck(client, post, mdx) {
  const qcPrompt = `Review this BHRT blog post against the following checklist.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation.
Format: {"pass": true, "issues": []} where issues is an array of plain strings.
Each issue must be a plain string like "Missing medical disclaimer" — NOT an object.

CHECKLIST:
1. Primary keyword "${post.primaryKeyword}" appears in H1
2. Primary keyword appears in first 100 words
3. Word count is at least 1500 words
4. FAQ section present with 4 or more questions (### headings under ## Frequently Asked Questions)
5. Medical disclaimer paragraph present at the end
6. At least 2 internal links present (markdown links with href starting with /)
7. No absolute medical claims (no phrases like "BHRT will cure" or "BHRT eliminates")
8. A CTA section present near the end
9. Output starts with --- (YAML frontmatter delimiter)
10. A References section is present near the end inside a div with class "references-section", containing at least 3 numbered citations with author/org, title, publication, year, and a URL from pubmed.ncbi.nlm.nih.gov, endocrine.org, menopause.org, mayoclinic.org, or fda.gov

Set pass to true only if ALL 10 checks pass. List each failing check as a plain string in issues.

POST CONTENT:
${mdx}`;

  let rawText = '';
  try {
    const qcResult = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2000,
      messages: [{ role: 'user', content: qcPrompt }],
    });

    rawText = qcResult.content[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('   QC raw response:', rawText.slice(0, 300));
      return { pass: false, issues: ['QC response did not contain valid JSON'] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize issues — handle both string[] and object[] responses from Claude
    const issues = (parsed.issues ?? []).map((item) =>
      typeof item === 'string' ? item : JSON.stringify(item)
    );

    return { pass: parsed.pass === true && issues.length === 0, issues };
  } catch (err) {
    console.error('   QC raw response:', rawText.slice(0, 300));
    return { pass: false, issues: [`QC parse error: ${err.message}`] };
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  // ── Startup diagnostics ────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('MyHormoneGuide — Content Pipeline');
  console.log(`Node.js  : ${process.version}`);
  console.log(`Model    : ${MODEL_ID}`);
  console.log(`Posts dir: ${POSTS_DIR}`);
  console.log(`Queue    : ${TOPICS_FILE}`);
  console.log('═'.repeat(60));

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is not set. Add it to your .env or GitHub Secrets.');
    process.exit(1);
  }
  const keyPreview = process.env.ANTHROPIC_API_KEY.slice(0, 12) + '…';
  console.log(`✅ API key present: ${keyPreview} (${process.env.ANTHROPIC_API_KEY.length} chars)\n`);

  // Load queue
  let queue;
  try {
    queue = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to read/parse topics.json:', err.message);
    process.exit(1);
  }

  const total   = queue.posts.length;
  const pending = queue.posts.filter((p) => p.status === 'pending').length;
  const done    = total - pending;
  console.log(`📋 Queue: ${total} total | ${done} published | ${pending} pending`);

  const post = queue.posts.find((p) => p.status === 'pending');

  if (!post) {
    console.log('✅ Queue is empty — all posts are published. Add more topics to topics.json.');
    process.exit(0);
  }

  console.log(`\n📝 Next post: "${post.title}" (${post.id})`);
  console.log(`   Cluster: ${post.cluster} | Funnel stage: ${post.funnelStage}\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Step 1: Generate the post ──────────────────────────────────────────────
  console.log('🤖 Calling Claude API (generation)...');
  const genStart = Date.now();
  let mdx;
  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPostPrompt(post) }],
    });
    mdx = response.content[0].text.trim();
    console.log(`   ✅ Generation complete (${((Date.now() - genStart) / 1000).toFixed(1)}s)`);
    console.log(`   Output length: ${mdx.length} chars`);
  } catch (err) {
    const elapsed = ((Date.now() - genStart) / 1000).toFixed(1);
    console.error(`❌ Generation API call failed after ${elapsed}s`);
    // Classify the error for faster debugging
    if (err.status === 401) {
      console.error('   → Authentication error (401): API key is invalid or revoked.');
      console.error('   → Check the ANTHROPIC_API_KEY secret in GitHub Settings → Secrets → Actions.');
    } else if (err.status === 429) {
      console.error('   → Rate limit (429): Too many requests or usage limit reached.');
    } else if (err.status === 529 || err.status === 503) {
      console.error(`   → API overloaded (${err.status}): Anthropic is experiencing high traffic.`);
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('   → Network error: Could not connect to api.anthropic.com');
    } else {
      console.error(`   → Error type: ${err.constructor.name} | Status: ${err.status ?? 'n/a'}`);
    }
    console.error('   Full error:', err.message);
    process.exit(1);
  }

  // Ensure the output starts with frontmatter
  if (!mdx.startsWith('---')) {
    console.error('❌ Output did not start with YAML frontmatter. Claude may have included a preamble.');
    console.error('First 200 chars:', mdx.slice(0, 200));
    process.exit(1);
  }

  // ── Step 2: Quality check ──────────────────────────────────────────────────
  console.log('🔍 Running QC check...');
  const qc = await runQualityCheck(client, post, mdx);

  if (!qc.pass) {
    console.error('❌ QC FAILED. Issues:');
    qc.issues.forEach((issue) => console.error(`   • ${issue}`));

    // Save the draft for inspection even though it failed QC
    ensureDir(POSTS_DIR);
    const debugFile = path.join(POSTS_DIR, `_debug-${toSlug(post.title)}.mdx`);
    fs.writeFileSync(debugFile, mdx, 'utf8');
    console.error(`\n📄 Draft saved for inspection: src/content/posts/_debug-${toSlug(post.title)}.mdx`);
    console.error('   Review the file, then re-run to generate a fresh attempt.\n');
    process.exit(1);
  }

  console.log('✅ QC passed');

  // ── Step 3: Save MDX file ──────────────────────────────────────────────────
  ensureDir(POSTS_DIR);
  // Reuse the existing filename if this post was previously generated (regeneration)
  const filename = post.outputFile
    ? path.basename(post.outputFile)
    : `${toSlug(post.title)}.mdx`;
  const filepath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(filepath, mdx, 'utf8');
  console.log(`💾 Saved: src/content/posts/${filename}`);

  // ── Step 4: Mark post complete in topics.json ──────────────────────────────
  post.status = 'published';
  post.publishedDate = new Date().toISOString().split('T')[0];
  post.outputFile = `src/content/posts/${filename}`;
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(queue, null, 2), 'utf8');
  console.log(`📋 Marked complete in topics.json\n`);

  const totalSecs = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`🎉 Published: "${post.title}"`);
  console.log(`   File: ${filepath}`);
  console.log(`   Total time: ${totalSecs}s`);
}

main().catch((err) => {
  console.error('Unhandled error:', err.message);
  console.error(err);
  process.exit(1);
});
