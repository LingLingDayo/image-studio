import { onMounted, onUnmounted, type Ref } from 'vue';

export function useClickOutside(
  targetRef: Ref<HTMLElement | null | undefined>,
  handler: (e: MouseEvent | TouchEvent) => void
) {
  function listener(event: MouseEvent | TouchEvent) {
    const el = targetRef.value;
    if (!el) return;

    const target = event.target as Node | null;
    if (!target) return;

    if (el === target || el.contains(target)) {
      return;
    }

    handler(event);
  }

  onMounted(() => {
    document.addEventListener('pointerdown', listener, true);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerdown', listener, true);
  });
}
