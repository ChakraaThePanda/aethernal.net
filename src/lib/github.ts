// Recently updated public repos for the home page, fetched at build time. Uses GITHUB_TOKEN when
// present (the deploy workflow passes one) to avoid the low anonymous rate limit. Any failure just
// hides the section.

const USER = 'ChakraaThePanda';
const SKIP = new Set(['aethernal.net']);

export interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  url: string;
  pushedAt: string;
}

export async function recentRepos(count = 4): Promise<Repo[]> {
  try {
    const res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=20`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const repos = await res.json();
    return repos
      .filter((r: any) => !r.fork && !r.archived && !SKIP.has(r.name))
      .slice(0, count)
      .map((r: any) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        url: r.html_url,
        pushedAt: r.pushed_at,
      }));
  } catch {
    return [];
  }
}
