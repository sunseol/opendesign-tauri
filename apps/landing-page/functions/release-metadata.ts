import { RELEASE_GITHUB_LATEST_URL, fallbackReleaseMetadata } from '../app/_lib/release-metadata';

type PagesFunctionContext<Env> = {
  readonly request: Request;
  readonly env: Env;
};

type PagesFunction<Env> = (context: PagesFunctionContext<Env>) => Response | Promise<Response>;

const CACHE_CONTROL = 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600';

function fallbackResponse(): Response {
  return new Response(JSON.stringify(fallbackReleaseMetadata()), {
    status: 200,
    headers: {
      'Cache-Control': CACHE_CONTROL,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export const onRequest: PagesFunction<Record<string, never>> = async () => {
  try {
    const response = await fetch(RELEASE_GITHUB_LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) return fallbackResponse();

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', CACHE_CONTROL);
    headers.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof Error) return fallbackResponse();
    throw error;
  }
};
