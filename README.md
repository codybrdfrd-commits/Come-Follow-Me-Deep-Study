# Deep Study — deploying your own copy

This folder is a complete, ready-to-deploy website:

- `index.html` — the whole app (self-contained, ~3.8MB, includes the full King James Old Testament)
- `netlify/functions/ai-insight.js` — a small serverless function that calls Anthropic's API on your behalf, so your API key never touches the browser
- `netlify.toml` — tells Netlify where the site and function live

You do **not** need to know how to code to deploy this. You'll need:
- A free [Netlify](https://netlify.com) account
- A free [GitHub](https://github.com) account (recommended route below)
- An [Anthropic API key](https://console.anthropic.com/settings/keys) — only needed if you want the "AI Insight" button to work. The rest of the app works without one.

## Step 1 — Get an Anthropic API key (optional, only for AI Insight)

1. Go to <https://console.anthropic.com/settings/keys> and sign in (or create an account).
2. Click **Create Key**, name it anything (e.g. "deep-study"), and copy the key. You won't be able to see it again, so paste it somewhere safe for a minute.
3. Anthropic requires billing to be set up before a key will work — add a card under **Settings → Billing**. Costs here are small: the app uses Claude Haiku, and a single verse insight costs a fraction of a cent.

You can skip this step and deploy anyway — everything except the "AI Insight" panel will work fine without a key.

## Step 2 — Put this folder on GitHub

The easiest way if you don't already use git:

1. Go to <https://github.com/new>, create a new repository (e.g. `deep-study`), keep it **empty** (don't add a README).
2. On the new repo's page, click **uploading an existing file**.
3. Drag in all the files from this folder — `index.html`, `netlify.toml`, and the whole `netlify` folder (make sure the folder structure is preserved: `netlify/functions/ai-insight.js`).
4. Commit the files.

(If you're comfortable with git instead: `git init && git add . && git commit -m "Deep Study" && git remote add origin <your-repo-url> && git push -u origin main`.)

## Step 3 — Connect it to Netlify

1. Go to <https://app.netlify.com>, sign in, click **Add new site → Import an existing project**.
2. Choose **GitHub**, authorize Netlify, and pick the repository you just created.
3. Build settings: leave **Build command** blank, and set **Publish directory** to `.` (a single period). Netlify should also auto-detect the `netlify.toml` and pick these up automatically.
4. Click **Deploy site**. Wait a minute or two — your site will get a random URL like `https://cheerful-narwhal-123abc.netlify.app`.

## Step 4 — Add your API key (only if you did Step 1)

1. In your new Netlify site, go to **Site configuration → Environment variables**.
2. Click **Add a variable**, key = `ANTHROPIC_API_KEY`, value = the key you copied in Step 1. Scope it to all deploy contexts.
3. Go to **Deploys** and click **Trigger deploy → Deploy site** so the function picks up the new variable.

## Step 5 — Try it

Open your Netlify URL, click into any verse in a book other than Isaiah, switch to the **🤖 AI Insight** tab in the study panel, and click **Generate Insight**. If you skipped the API key step, you'll see a clear error explaining that — everything else in the app still works.

## Using a custom domain (optional)

In Netlify: **Domain management → Add a domain**, then follow the prompts to point your own domain's DNS at Netlify. Free HTTPS is automatic.

## Notes

- Every AI Insight response is labeled "unverified" in the app on purpose, and is visually distinct (amber warning banner) from the rest of the app's sourced, verified content. This is intentional — it's a quick first-pass tool, not a citation.
- The function only runs when someone clicks "Generate Insight." Nothing calls the API automatically, so there's no surprise cost from just browsing the app.
- If you ever want to swap which Claude model the function uses, edit the `MODEL` constant near the top of `netlify/functions/ai-insight.js`.
