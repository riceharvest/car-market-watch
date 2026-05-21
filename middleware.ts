import { evaluateAccessRequest } from './src/server/accessGate';

const loginPage = (rejected = false) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Car Market Watch</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #05070d; color: #f6f7fb; }
      main { width: min(92vw, 380px); padding: 32px; border: 1px solid rgba(255,255,255,.14); border-radius: 24px; background: linear-gradient(145deg, rgba(18,24,38,.96), rgba(8,11,18,.96)); box-shadow: 0 24px 80px rgba(0,0,0,.45); }
      h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.03em; }
      p { margin: 0 0 24px; color: #9ba4b5; line-height: 1.5; }
      label { display: grid; gap: 8px; color: #c9d1df; font-size: 14px; }
      input { box-sizing: border-box; width: 100%; border: 1px solid rgba(255,255,255,.16); border-radius: 14px; padding: 13px 14px; background: rgba(255,255,255,.06); color: #fff; font: inherit; }
      button { margin-top: 16px; width: 100%; border: 0; border-radius: 14px; padding: 13px 14px; background: #8b5cf6; color: #fff; font-weight: 700; cursor: pointer; }
      .error { margin-bottom: 14px; color: #fca5a5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Car Market Watch</h1>
      <p>Private dashboard. Enter the access password.</p>
      ${rejected ? '<div class="error">Wrong password.</div>' : ''}
      <form method="post" action="/access">
        <label>Password<input name="password" type="password" autocomplete="current-password" autofocus /></label>
        <button type="submit">Enter</button>
      </form>
    </main>
  </body>
</html>`;

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const submittedPassword = request.method.toUpperCase() === 'POST' && url.pathname === '/access'
    ? String((await request.formData()).get('password') ?? '')
    : undefined;

  const decision = evaluateAccessRequest(
    {
      method: request.method,
      pathname: url.pathname,
      cookieHeader: request.headers.get('cookie'),
      submittedPassword,
    },
    process.env.ACCESS_PASSWORD,
  );

  if (decision.kind === 'allow') return undefined;
  if (decision.kind === 'grant') {
    return new Response(null, {
      status: decision.status,
      headers: {
        Location: decision.location,
        'Set-Cookie': decision.cookie,
      },
    });
  }

  return new Response(loginPage(decision.kind === 'reject'), {
    status: decision.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export const config = {
  matcher: '/(.*)',
};
