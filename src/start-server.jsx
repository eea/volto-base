// only customized to allow importing from ./server instead of plone volto
// server

import http from 'http';

import app from './server';
import * as Sentry from '@sentry/node';

export default () => {
  const server = http.createServer(app);
  const port = process.env.PORT || 3000;

  let currentApp = app;

  server
    .listen(port, () => {
      console.log(`🚀 started on port ${port} `);
    })
    .on('error', e => {
      console.error(e.message);
      throw e;
    });

  return () => {
    console.log('✅  Server-side HMR Enabled!');

    module.hot.accept('volto-base/server', () => {
      console.log('🔁  HMR Reloading `volto-base/server`...');
      server.removeListener('request', currentApp);
      const newApp = require('volto-base/server').default; // eslint-disable-line global-require
      server.on('request', newApp);
      currentApp = newApp;

      if (process.env.SENTRY_DSN) {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
        });
      }
    });
  };
};
