/**
 * Simple in-memory FSM (Finite State Machine) per chat.
 * Stores what step the user is currently on and any temp data.
 *
 * States:
 *   null              — normal mode
 *   "setup_p1"        — waiting for Player 1 name
 *   "setup_p2"        — waiting for Player 2 name
 *   "record_score1"   — waiting for Player 1's wins
 *   "record_score2"   — waiting for Player 2's wins
 */

const states = new Map(); // chatId → { state, data }

export function getState(chatId) {
  return states.get(chatId) || { state: null, data: {} };
}

export function setState(chatId, state, data = {}) {
  states.set(chatId, { state, data });
}

export function clearState(chatId) {
  states.delete(chatId);
}
