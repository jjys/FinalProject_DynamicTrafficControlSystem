import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, `rl_log_${Date.now()}.jsonl`);
const metricsFile = path.join(logDir, `metrics_log_${Date.now()}.jsonl`);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      fs.appendFileSync(logFile, body + '\n');
      res.writeHead(200);
      res.end('Logged');
    });
  } else if (req.method === 'POST' && req.url === '/metrics') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      fs.appendFileSync(metricsFile, body + '\n');
      res.writeHead(200);
      res.end('Metrics Logged');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log(`Logger server running on http://localhost:3001`);
  console.log(`Logging data to ${logFile}`);
});
