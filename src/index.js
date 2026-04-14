import 'core-js/es/map';
import 'core-js/es/set';
import 'raf/polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import Providers from './context/Providers';

const rootElement = document.getElementById('root');

ReactDOM.render(
    <React.StrictMode>
      <Providers>
        <App />
      </Providers>
    </React.StrictMode>,
    rootElement,
);

// Show app immediately after React mounts — do NOT wait for window.onload
// (window onload waits for ALL resources including preloaded images to load)
const showApp = () => {
    if (rootElement) rootElement.style.display = 'block';
};
// Try to show ASAP; also fallback on onload for safety
if (document.readyState === 'complete') {
    showApp();
} else {
    // Show once React finishes first render (next microtask)
    Promise.resolve().then(showApp);
    window.addEventListener('load', showApp, { once: true });
}

  // Disable react dev tools in production
  // Safe check for process.env
  const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
  if (
    isProd &&
    typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object'
  ) {
    for (let [key, value] of Object.entries(
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    )) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] =
        typeof value == 'function' ? () => {} : null;
    }
  }