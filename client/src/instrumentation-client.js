// Runs in the browser before the app becomes interactive.
// Drives the full-page loading overlay (lib/pageLoader.js).
import { startPageLoad } from './lib/pageLoader';

try {
  startPageLoad(); // the app's first page
} catch { /* the overlay is cosmetic — never block the app */ }

export function onRouterTransitionStart(url) {
  try {
    startPageLoad(url);
  } catch { /* cosmetic */ }
}
