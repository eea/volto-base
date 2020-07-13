import { combineReducers, createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';

import { composeWithDevTools } from 'redux-devtools-extension/developmentOnly';
import { connectRouter, routerMiddleware } from 'connected-react-router';

import { api, crashReporter } from '@plone/volto/middleware';
import { matchPath } from 'react-router';

import { settings, addonReducers } from '~/config'; // This needs to come before reducers import
import reducers from '~/reducers';
import routes from '~/routes';

import { createInstance } from '@datapunt/matomo-tracker-react';

let matomo;
if (__CLIENT__) {
  matomo = createInstance({
    urlBase: 'https://matomo.eea.europa.eu/',
    siteId: settings.matomoSiteId, // optional, default value: `1`
    // trackerUrl: 'https://LINK.TO.DOMAIN/tracking.php', // optional, default value: `${urlBase}matomo.php`
    // srcUrl: 'https://LINK.TO.DOMAIN/tracking.js', // optional, default value: `${urlBase}matomo.js`
  });
}

const defaultRoutes = routes[2].routes;

const PREFETCH_ROUTER_LOCATION_CHANGE = 'PREFETCH_ROUTER_LOCATION_CHANGE';

const matchCurrentPath = path => {
  // const pathsList = ['/', '/**'];
  let alreadyMatched;

  for (let pathOption of defaultRoutes) {
    const match = matchPath(path, pathOption);
    // console.debug('pathOption', alreadyMatched, path, pathOption, match);
    if (
      match &&
      !alreadyMatched &&
      (match.path === '/**' || match.path === '/')
    ) {
      return true;
    }
    if (match) {
      alreadyMatched = true;
    }
  }
};

const precacheContentStart = ({ dispatch, getState }) => next => action => {
  if (typeof action === 'function') {
    return next(action);
  }

  switch (action.type) {
    case '@@router/LOCATION_CHANGE':
      if (action.payload?.location?.state?.isFromLogin) return next(action);

      console.log('action', action.type);
      if (!action.payload?.prefetched) {
        const path = action.payload.location.pathname;
        // TODO: use getBaseUrl based matching
        const isGetContent = matchCurrentPath(path);
        const expand =
          isGetContent && settings.contentExpand?.length
            ? `&expand=${settings.contentExpand.join(',')}`
            : '';
        const fullObjects = `${isGetContent ? '?fullobjects' : ''}${expand}`;
        const url = `${path}${fullObjects}`;
        if (!isGetContent) return next(action);
        const prefetchAction = {
          type: PREFETCH_ROUTER_LOCATION_CHANGE,
          path,
          originalAction: action,
          request: {
            op: 'get',
            path: url,
          },
        };
        // console.debug('Start prefetch', url);
        return next(prefetchAction);
      }
      return next(action);
    default:
      return next(action);
  }
};

const precacheContentEnd = ({ dispatch, getState }) => next => action => {
  if (typeof action === 'function') {
    return next(action);
  }

  const type = `${PREFETCH_ROUTER_LOCATION_CHANGE}_SUCCESS`;

  if (action.type === type) {
    console.log('prefetch action end', action);
    return dispatch({
      ...action.originalAction,
      payload: {
        ...action.originalAction.payload,
        prefetched: action.result,
      },
    });
  }

  // console.log('precacheContentEnd', action.type);
  return next(action);
};

const optimizeProvidersFetch = ({ getState, dispatch }) => next => action => {
  if (typeof action === 'function') {
    return next(action);
  }
  if (action.type === 'GET_DATA_FROM_PROVIDER') {
    const { data_providers } = getState();
    const { path } = action.request;
    if (
      data_providers.requested.includes(path) ||
      Object.keys(data_providers.data).includes(path)
    ) {
      // console.debug(`provider already fetched: ${path}`);
      return;
    }

    return next(action);
  }
  return next(action);
};

function prefetch(state = {}, action = {}) {
  switch (action.type) {
    case `@@router/LOCATION_CHANGE`:
      // console.debug('action location change', action);
      return action.payload?.prefetched
        ? {
            ...state,
            [action.payload.location.pathname]: action.payload.prefetched,
          }
        : state;
    default:
      return state;
  }
}

const trackMatomo = ({ getState, dispatch }) => next => action => {
  if (typeof action === 'function') {
    return next(action);
  }
  switch (action.type) {
    case `@@router/LOCATION_CHANGE`:
      if (__CLIENT__ && action.payload?.prefetched) {
        const content = action.payload.prefetched;
        matomo.trackPageView({
          documentTitle: content.title || 'untitled',
          href: content['@id']
            .replace(settings.apiPath, '')
            .replace(settings.internalApiPath, ''),
        });
      }
      break;
    default:
  }

  return next(action);
};

const configureStore = (initialState, history, apiHelper) => {
  const defaultMiddleware = [
    optimizeProvidersFetch,
    precacheContentStart,
    routerMiddleware(history),
    crashReporter,
    thunk,
    api(apiHelper),
    precacheContentEnd,
  ];

  if (settings.matomoSiteId) {
    defaultMiddleware.push(trackMatomo);
  }

  const middlewares = composeWithDevTools(
    applyMiddleware(...defaultMiddleware),
  );

  // console.log('addonrecuders store.js', addonReducers);

  const store = createStore(
    combineReducers({
      router: connectRouter(history),
      ...reducers,
      ...addonReducers,
      prefetch,
    }),
    initialState,
    middlewares,
  );

  return store;
};

export default configureStore;
