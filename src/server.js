require('dotenv/config');

const http = require('node:http');
const net = require('node:net');
const { buildApp } = require('./app');
const { createMongoStore } = require('./db');

const preferredPort = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const mongoDbName = process.env.MONGODB_DB || 'bytelogic';

let server;
let store;

async function startServer() {
  store = await createMongoStore({ uri: mongoUri, dbName: mongoDbName });
  const app = buildApp(store);
  const port = await findAvailablePort(preferredPort);

  server = http.createServer(app);
  server.on('error', error => {
    console.error('Server failed to start:', error.message);
    process.exit(1);
  });

  server.listen({ port, host: '::' }, () => {
    console.log(`Bytelogic chess tournament API running on http://localhost:${port}`);
  });
}

async function shutdown(signal) {
  console.log(`Received ${signal}, closing server...`);

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }

  if (store) {
    await store.close();
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function findAvailablePort(startPort) {
  let port = startPort;

  while (port < startPort + 50) {
    const available = await isPortAvailable(port);

    if (available) {
      return port;
    }

    port += 1;
  }

  throw new Error(`No available port found starting at ${startPort}`);
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen({ port, host: '::', exclusive: true });
  });
}

startServer().catch(error => {
  console.error('Unable to start server:', error.message);
  process.exit(1);
});