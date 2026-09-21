import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

// Trap focus only for actual dialogs. Content screens keep the five tabs reachable.
export function useContentKeyboard(enabled: boolean, onClose: () => void, ref: RefObject<View | null>, trap = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const root = ref.current as unknown as HTMLElement | null;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, textarea, [tabindex="0"]'))
      .filter(element => element.offsetParent !== null && element.getAttribute('aria-disabled') !== 'true' && !element.hasAttribute('disabled'));
    const timer = setTimeout(() => controls()[0]?.focus(), 0);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (!trap) return;
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.getAttribute('role') === 'radio' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const radios = Array.from(focused.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
        if (radios.length) {
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
          const next = radios[(radios.indexOf(focused) + direction + radios.length) % radios.length];
          next.focus(); next.click();
        }
      }
      if (event.key === 'Tab') {
        const items = controls();
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (focused === first || !root.contains(focused))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (focused === last || !root.contains(focused))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keyboard, true); if (previous?.isConnected) previous.focus(); };
  }, [enabled, ref, trap]);
}
