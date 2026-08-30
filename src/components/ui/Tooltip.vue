<template>
  <div
    id="global-tooltip"
    ref="tooltipRef"
    data-component="Tooltip"
    v-bind="popoverProps"
    :class="['tooltip-container', className]"
    :style="customStyle"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  className: {
    type: String,
    default: ''
  },
  offset: {
    type: Number,
    default: 8
  },
  showDelay: {
    type: Number,
    default: 600
  },
  backgroundColor: {
    type: String,
    default: ''
  },
  textColor: {
    type: String,
    default: ''
  },
  borderColor: {
    type: String,
    default: ''
  }
});

const tooltipRef = ref<HTMLDivElement | null>(null);
const activeElementRef = ref<HTMLElement | null>(null);
const scheduledTargetRef = ref<HTMLElement | null>(null);
const timerRef = ref<number | null>(null);

const popoverProps = { popover: 'manual' };

const customStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.backgroundColor) {
    styles['--theme-tooltip-bg'] = props.backgroundColor;
  }
  if (props.textColor) {
    styles['--theme-tooltip-text'] = props.textColor;
  }
  if (props.borderColor) {
    styles['--theme-tooltip-border'] = props.borderColor;
  }
  return styles;
});

const updatePosition = (target: HTMLElement) => {
  const tooltip = tooltipRef.value;
  if (!tooltip || !tooltip.matches(':popover-open')) return;

  const rect = target.getBoundingClientRect();
  const padding = props.offset;

  tooltip.style.top = '0px';
  tooltip.style.left = '0px';

  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;

  let top = rect.top - th - padding;
  let left = rect.left + rect.width / 2 - tw / 2;

  if (top < padding) {
    top = rect.bottom + padding;
  }

  if (left < padding) {
    left = padding;
  } else if (left + tw > window.innerWidth - padding) {
    left = window.innerWidth - tw - padding;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
};

const showTooltip = (target: HTMLElement, text: string) => {
  scheduledTargetRef.value = target;

  const delayAttr = target.getAttribute('data-tip-delay');
  const currentDelay = delayAttr ? parseInt(delayAttr, 10) : props.showDelay;

  const show = () => {
    if (scheduledTargetRef.value !== target) return;

    activeElementRef.value = target;
    scheduledTargetRef.value = null;
    timerRef.value = null;

    const tooltip = tooltipRef.value;
    if (tooltip) {
      tooltip.textContent = text;
      try {
        if (!tooltip.matches(':popover-open')) {
          tooltip.showPopover();
        }
        nextTick(() => {
          updatePosition(target);
        });
      } catch (err) {
        console.warn('Popover API error:', err);
      }
    }
  };

  if (currentDelay > 0) {
    timerRef.value = window.setTimeout(show, currentDelay);
  } else {
    show();
  }
};

const hideTooltip = () => {
  if (timerRef.value) {
    clearTimeout(timerRef.value);
    timerRef.value = null;
  }
  scheduledTargetRef.value = null;
  activeElementRef.value = null;
  tooltipRef.value?.hidePopover();
};

const handleMouseMove = (e: MouseEvent) => {
  const path = e.composedPath();
  const target = path.find(
    (node) => node instanceof HTMLElement && node.hasAttribute('data-tip')
  ) as HTMLElement | undefined;

  if (target === (activeElementRef.value || scheduledTargetRef.value)) {
    return;
  }

  hideTooltip();

  if (target) {
    const text = target.getAttribute('data-tip');
    if (text) {
      showTooltip(target, text);
    }
  }
};

const handleMouseLeaveWindow = () => hideTooltip();

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseleave', handleMouseLeaveWindow);
});

onUnmounted(() => {
  if (timerRef.value) clearTimeout(timerRef.value);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseleave', handleMouseLeaveWindow);
});
</script>

<style lang="scss">
.tooltip-container[popover] {
  position: fixed;
  inset: unset;
  margin: 0;
  padding: 5px 12px;
  background: var(--theme-tooltip-bg, rgba(15, 23, 42, 0.94));
  color: var(--theme-tooltip-text, #ffffff);
  border: 1px solid var(--theme-tooltip-border, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-family: $font-main;
  font-size: 11px;
  line-height: 1.4;
  border-radius: 6px;
  pointer-events: none;
  z-index: 11400;
  max-width: 240px;
  white-space: pre-wrap;
  word-wrap: break-word;
  opacity: 0;
  transform: translateY(4px) scale(0.95);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    display 0.15s allow-discrete,
    overlay 0.15s allow-discrete;

  &::backdrop {
    background: transparent;
  }
}

.tooltip-container:popover-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@starting-style {
  .tooltip-container:popover-open {
    opacity: 0;
    transform: translateY(4px) scale(0.95);
  }
}

[data-tip] {
  cursor: help;
}

button[data-tip],
a[data-tip],
.clickable[data-tip],
.pointer[data-tip],
.tool-btn[data-tip],
.card-action-btn[data-tip],
.card-prompt[data-tip],
.filter-btn[data-tip],
.config-btn[data-tip],
.page-btn[data-tip],
.suffix-action-btn[data-tip],
.ref-delete-btn[data-tip],
.ref-clear-all[data-tip],
.clear-text-btn[data-tip],
.btn-clip[data-tip],
.btn-send[data-tip],
.btn-cancel[data-tip],
.btn-fav[data-tip],
.auto-value[data-tip],
.reset-btn[data-tip],
.step-btn[data-tip] {
  cursor: pointer;
}

input[data-tip],
textarea[data-tip] {
  cursor: text;
}
</style>
