// Telegram WebApp haptic feedback helpers.
// All calls are no-ops when running outside Telegram (dev / browser).

function hf() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp?.HapticFeedback : null;
}

export const haptic = {
  /** Short tap — buttons, taps, list selections. */
  light()    { try { hf()?.impactOccurred('light'); }    catch { /* ignore */ } },
  /** Medium tap — primary actions (open sheet, switch tab). */
  medium()   { try { hf()?.impactOccurred('medium'); }   catch { /* ignore */ } },
  /** Strong tap — irreversible / heavier (delete confirmation). */
  heavy()    { try { hf()?.impactOccurred('heavy'); }    catch { /* ignore */ } },
  /** ✓ — successful save. */
  success()  { try { hf()?.notificationOccurred('success'); } catch { /* ignore */ } },
  /** ✗ — error toast. */
  error()    { try { hf()?.notificationOccurred('error');   } catch { /* ignore */ } },
  /** ! — warning before destructive action. */
  warning()  { try { hf()?.notificationOccurred('warning'); } catch { /* ignore */ } },
  /** Rapid value change — counter ± buttons. */
  selection(){ try { hf()?.selectionChanged(); } catch { /* ignore */ } },
};
