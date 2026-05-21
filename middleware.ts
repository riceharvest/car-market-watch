import { evaluateAccessRequest, resolveConfiguredAccessPassword } from './src/server/accessGate';

const loginPage = (rejected = false) => `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Car Market Watch</title>
    <style>
      :root { color-scheme: light; font-family: Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eceff1; color: #263238; }
      main { width: min(92vw, 380px); padding: 32px; border-radius: 4px; background: #fff; box-shadow: 0 10px 24px rgba(0,0,0,.18), 0 4px 10px rgba(0,0,0,.12); }
      h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.03em; }
      p { margin: 0 0 24px; color: #607d8b; line-height: 1.5; }
      label { display: grid; gap: 8px; color: #455a64; font-size: 14px; }
      input { box-sizing: border-box; width: 100%; border: 1px solid rgba(38,50,56,.16); border-radius: 3px; padding: 13px 14px; background: #fafafa; color: #263238; font: inherit; }
      button { margin-top: 16px; width: 100%; border: 0; border-radius: 3px; padding: 13px 14px; background: #1976d2; color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; cursor: pointer; }
      .error { margin-bottom: 14px; color: #c62828; }
    </style>
  </head>
  <body>
    <main>
      <h1>Car Market Watch</h1>
      <p>Privédashboard. Voer het toegangswachtwoord in.</p>
      ${rejected ? '<div class="error">Verkeerd wachtwoord.</div>' : ''}
      <form method="post" action="/access">
        <label>Wachtwoord<input name="password" type="password" autocomplete="current-password" autofocus /></label>
        <button type="submit">Binnenkomen</button>
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
    resolveConfiguredAccessPassword(process.env),
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
