import React from 'react';
import { hydrate } from 'react-dom';
import { Provider } from 'react-intl-redux';
import { ConnectedRouter } from 'connected-react-router';
import * as Sentry from '@sentry/browser';
import { createBrowserHistory } from 'history';
import { ReduxAsyncConnect } from 'redux-connect';
import { Api, persistAuthToken, ScrollToTop } from '@plone/volto/helpers';
import routes from '~/routes';
import '~/theme';
import { loadableReady } from '@loadable/component';


import configureStore from './store';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export const history = createBrowserHistory();

export default () => {
  const api = new Api();

  const store = configureStore(window.__data, history, api);
  persistAuthToken(store);
  loadableReady(() => {
    hydrate(
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <ScrollToTop>
            <ReduxAsyncConnect routes={routes} helpers={api} />
          </ScrollToTop>
        </ConnectedRouter>
      </Provider>,
      document.getElementById('main'),
    );
  });

};
