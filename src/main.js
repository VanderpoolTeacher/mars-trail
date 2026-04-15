// Mars Trail — entry point
// Builds initial state and runs first render. Interactivity comes in slice 3.

import { createInitialState } from './state.js';
import { render } from './render.js';

const state = createInitialState();
render(state);

// Expose for browser-console inspection during development.
window.__marsTrail = { state, render };
