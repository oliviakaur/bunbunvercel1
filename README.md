# BunBun Vercel CSR Static HTML Frontend + Serverless XML Sitemap

**Backend API Reference:** `API_ENDPOINT_DOCS.md` (`https://bunbunserver.my.id`)

## Project Structure

```text
bunbun-vercel-csr/
├── index.html        # Static Client-Side Rendered (CSR) HTML frontend (Homepage, Category Page, Single Article Page)
├── api/
│   └── sitemap.js    # Vercel Serverless Function: reads backend /sitemap.xml and rewrites origin to Vercel subdomain
├── vercel.json       # Rewrites /sitemap.xml -> /api/sitemap with application/xml Content-Type
├── package.json      # Project manifest
└── README.md         # Deployment & routing documentation
```

## How It Works

1. **Static CSR HTML (`index.html`)**:
   - **Homepage (`/`)**: Fetches `GET https://bunbunserver.my.id/api/articles/random?limit=24` (`priority: 'high'`) in `<head>`, sets canonical URL (`https://<vercel-subdomain>/`), and renders `WebSite` + `ItemList` JSON-LD.
   - **Category Page (`/?category=<category>`)**: Fetches `GET https://bunbunserver.my.id/api/category/<category>?limit=24`, sets canonical URL (`https://<vercel-subdomain>/?category=<category>`), and outputs **2 Meta Only** (`meta robots` + `meta description`, zero JSON-LD).
   - **Single Article Page (`/?category=<category>&slug=<slug>`)**:
     - Priority #1 Fetch in `<head>`: `GET https://bunbunserver.my.id/api/article?category=<category>&slug=<slug>` (`sentences` & `images` rendered first in `<main>`).
     - Sets canonical URL (`https://<vercel-subdomain>/?category=<category>&slug=<slug>`), `Article` JSON-LD, and `BreadcrumbList` JSON-LD.
     - No categories listing in the header navigation bar.
     - Priority #2 Deferred (`priority: 'low'`): Fetches **Related Posts** (`GET /api/articles/random?limit=10`) and Cross-Domain **Related Links** (`GET /api/articles/random?limit=5` + `GET /api/domains/status`) after primary article text and diagrams are mounted.

2. **Vercel Serverless XML Sitemap (`/sitemap.xml` -> `api/sitemap.js`)**:
   - Reads the incoming request's Vercel subdomain/domain (`x-forwarded-proto` + `x-forwarded-host` / `host`).
   - Fetches the backend XML sitemap (`https://bunbunserver.my.id/sitemap.xml`).
   - Rewrites every `<loc>https://.../?category=...</loc>` origin to match the receiving Vercel subdomain address (`https://<your-subdomain>.vercel.app/?category=...&amp;slug=...`).
   - Returns `Content-Type: application/xml; charset=UTF-8`.

## Deploy to Vercel

```bash
npx vercel --prod
```

Remember to add your Vercel subdomain (e.g., `https://your-project.vercel.app`) to `backend/allowed_domains.txt` on `bunbunserver.my.id`.
