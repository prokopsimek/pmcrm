# Vercel Deployment Setup (Frontend)

Complete guide for deploying the Personal Network CRM frontend to Vercel.

## Overview

Vercel is the optimal platform for Next.js applications, offering:
- Automatic HTTPS
- Global CDN
- Edge functions
- Preview deployments for PRs
- Automatic CI/CD with GitHub

## Prerequisites

- Vercel account (https://vercel.com)
- GitHub repository
- Vercel CLI (optional)

## Installation

### Install Vercel CLI

```bash
npm install -g vercel

# Login to Vercel
vercel login
```

## Deployment Steps

### 1. Import Project

#### Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Vercel will auto-detect Next.js

#### Via CLI

```bash
cd frontend
vercel
```

### 2. Configure Build Settings

Vercel auto-detects Next.js, but verify settings:

**Framework Preset**: Next.js
**Root Directory**: `frontend`
**Build Command**: `npm run build`
**Output Directory**: `.next` (auto-detected)
**Install Command**: `npm install`

### 3. Environment Variables

Add environment variables in Vercel dashboard or via CLI:

#### Via Dashboard

1. Go to Project Settings → Environment Variables
2. Add variables for each environment:

**Production:**
```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

**Preview (Staging):**
```bash
NEXT_PUBLIC_API_URL=https://staging-api.your-domain.com
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

**Development:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

#### Via CLI

```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.your-domain.com

vercel env add NEXT_PUBLIC_API_URL preview
# Enter: https://staging-api.your-domain.com
```

### 4. Configure Next.js for Production

Ensure `frontend/next.config.js` includes:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Image optimization
  images: {
    domains: ['your-domain.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 5. Custom Domain

#### Add Domain

1. Go to Project Settings → Domains
2. Add your domain (e.g., `pmcrm.your-domain.com`)
3. Configure DNS:

**Option A: Using Vercel Nameservers** (Recommended)
- Update your domain's nameservers to Vercel's

**Option B: Using CNAME**
```
CNAME: pmcrm.your-domain.com → cname.vercel-dns.com
```

**For Apex Domain:**
```
A Record: your-domain.com → 76.76.21.21
```

### 6. Git Integration

Vercel automatically deploys on push:

**Production Branch**: `main`
- Deployed to: `https://pmcrm.your-domain.com`

**Preview Branches**: All other branches
- Deployed to: `https://branch-name-project.vercel.app`

**Pull Requests**: Automatic preview deployments
- Comment on PR with preview URL

### 7. Deploy

#### Automatic Deployment

Push to GitHub:
```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

Vercel automatically builds and deploys.

#### Manual Deployment

```bash
cd frontend

# Production
vercel --prod

# Preview
vercel
```

## Advanced Configuration

### Environment-Specific Builds

Create `frontend/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.your-domain.com/:path*"
    }
  ]
}
```

### Performance Optimization

1. **Enable Edge Runtime** (for API routes):
```typescript
// app/api/route.ts
export const runtime = 'edge';
```

2. **Image Optimization**:
```typescript
import Image from 'next/image';

<Image
  src="/profile.jpg"
  alt="Profile"
  width={500}
  height={500}
  priority
/>
```

3. **Font Optimization**:
```typescript
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
```

### Analytics

#### Enable Vercel Analytics

1. Go to Project Settings → Analytics
2. Click "Enable Analytics"
3. Add to `app/layout.tsx`:

```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Enable Web Vitals

```bash
npm install @vercel/speed-insights
```

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Monitoring and Logs

### View Deployment Logs

```bash
# Via CLI
vercel logs

# Via Dashboard
# Go to Deployments → Select deployment → View Logs
```

### Real-time Logs

```bash
vercel logs --follow
```

### Analytics

View in dashboard:
- Page views
- Top pages
- Countries
- Devices
- Web Vitals

## CI/CD Integration

### GitHub Actions

The `.github/workflows/cd.yml` includes Vercel deployment:

```yaml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    vercel-args: '--prod'
    working-directory: ./frontend
```

### Get Required Secrets

```bash
# Get Vercel Token
vercel token create

# Get Organization ID
vercel whoami
# Or check: https://vercel.com/account/tokens

# Get Project ID
vercel link
# Check .vercel/project.json
```

Add to GitHub Secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Preview Deployments

### Automatic PR Previews

Vercel automatically creates preview deployments for PRs:

1. Create PR on GitHub
2. Vercel builds and deploys preview
3. Preview URL posted in PR comments
4. Share preview URL for testing

### Manual Preview

```bash
vercel
# Generates preview URL
```

## Rollback

### Via Dashboard

1. Go to Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

### Via CLI

```bash
# List deployments
vercel ls

# Promote deployment
vercel promote <deployment-url>
```

## Troubleshooting

### Build Failures

```bash
# Check logs
vercel logs <deployment-url>

# Local build test
cd frontend
npm run build
```

### Environment Variables Not Working

```bash
# List environment variables
vercel env ls

# Pull environment variables locally
vercel env pull
```

### CORS Issues

Add to backend CORS configuration:
```typescript
cors({
  origin: [
    'https://pmcrm.your-domain.com',
    'https://*.vercel.app', // For preview deployments
  ],
  credentials: true,
})
```

## Cost Optimization

Vercel pricing:
- **Hobby**: Free (personal projects)
- **Pro**: $20/month per user
- **Enterprise**: Custom pricing

Tips to reduce costs:
1. Use Hobby plan for staging
2. Configure build minutes limit
3. Optimize images and assets
4. Use Edge runtime for better performance

## Additional Resources

- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Vercel Support: https://vercel.com/support
- Vercel Status: https://www.vercel-status.com
