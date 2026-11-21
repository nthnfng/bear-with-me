import React from 'react';
import ReactDOM from 'react-dom/client';

// Pixel fonts, bundled so the popup never loads anything from the network.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/press-start-2p/400.css';

import App from './App.tsx';

import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
