import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const host = readArg('--host', '0.0.0.0');
const port = Number(readArg('--port', '19080'));
const logFile = resolve(readArg('--log-file', './_dev/player-telemetry.log'));

ensureParentDir(logFile);
writeFileSync(logFile, '', 'utf8');

const items = [];

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, buildCorsHeaders());
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    response.writeHead(200, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: true, host, port, count: items.length }, null, 2));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/items') {
    response.writeHead(200, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: true, count: items.length, items }, null, 2));
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/telemetry') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        items.push(payload);
        appendFileSync(logFile, `${JSON.stringify(payload)}\n`, 'utf8');
        response.writeHead(200, {
          ...buildCorsHeaders(),
          'content-type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({ ok: true }, null, 2));
      } catch (error) {
        response.writeHead(400, {
          ...buildCorsHeaders(),
          'content-type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : 'invalid payload',
        }, null, 2));
      }
    });
    return;
  }

  response.writeHead(404, {
    ...buildCorsHeaders(),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify({ ok: false, message: 'not found' }, null, 2));
});

server.listen(port, host, () => {
  appendFileSync(logFile, `${JSON.stringify({ type: 'server-started', host, port, timestamp: new Date().toISOString() })}\n`, 'utf8');
  console.log(`player telemetry server listening on http://${host}:${port}`);
  console.log(`log file: ${logFile}`);
});

server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

function ensureParentDir(file) {
  const parent = dirname(file);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

function buildCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) {
    return fallback;
  }
  return args[index + 1];
}
