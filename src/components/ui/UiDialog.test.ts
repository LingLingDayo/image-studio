import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import UiDialog from './UiDialog.vue';

describe('UiDialog (src/components/ui/UiDialog.vue)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should not render anything when isOpen is false', async () => {
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: false,
          title: '测试标题',
          description: '测试内容'
        });
      }
    });
    app.mount(container);
    await nextTick();

    expect(container.querySelector('.dialog-backdrop')).toBeNull();
    app.unmount();
  });

  it('should render title, description, and type class when isOpen is true', async () => {
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          type: 'warning',
          title: '未配置生图 API Key',
          description: '检测到尚未配置生图接口地址或 API Key。'
        });
      }
    });
    app.mount(container);
    await nextTick();

    const backdrop = container.querySelector('.dialog-backdrop');
    expect(backdrop).not.toBeNull();

    const dialogContainer = container.querySelector('.dialog-container');
    expect(dialogContainer?.classList.contains('type-warning')).toBe(true);

    const titleEl = container.querySelector('.dialog-title');
    expect(titleEl?.textContent).toContain('未配置生图 API Key');

    const descEl = container.querySelector('.dialog-description');
    expect(descEl?.textContent).toContain('检测到尚未配置生图接口地址或 API Key。');

    app.unmount();
  });

  it('should emit confirm event when clicking confirm button', async () => {
    let confirmCalled = false;
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          type: 'warning',
          confirmText: '前往配置',
          onConfirm: () => {
            confirmCalled = true;
          }
        });
      }
    });
    app.mount(container);
    await nextTick();

    const buttons = container.querySelectorAll('.dialog-actions button');
    // 第二个按钮是确认按钮
    const confirmBtn = buttons[1] as HTMLButtonElement;
    expect(confirmBtn.textContent).toContain('前往配置');

    confirmBtn.click();
    expect(confirmCalled).toBe(true);

    app.unmount();
  });

  it('should emit cancel and close events when clicking cancel button', async () => {
    let cancelCalled = false;
    let closeCalled = false;
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          type: 'danger',
          cancelText: '放弃',
          onCancel: () => {
            cancelCalled = true;
          },
          onClose: () => {
            closeCalled = true;
          }
        });
      }
    });
    app.mount(container);
    await nextTick();

    const buttons = container.querySelectorAll('.dialog-actions button');
    const cancelBtn = buttons[0] as HTMLButtonElement;
    expect(cancelBtn.textContent).toContain('放弃');

    cancelBtn.click();
    expect(cancelCalled).toBe(true);
    expect(closeCalled).toBe(true);

    app.unmount();
  });

  it('should support hide cancel button when showCancel is false', async () => {
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          type: 'info',
          showCancel: false
        });
      }
    });
    app.mount(container);
    await nextTick();

    const buttons = container.querySelectorAll('.dialog-actions button');
    expect(buttons.length).toBe(1);

    app.unmount();
  });

  it('should emit confirm when pressing Enter while dialog is open', async () => {
    let confirmCalled = false;
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          type: 'danger',
          confirmText: '删除',
          onConfirm: () => {
            confirmCalled = true;
          }
        });
      }
    });
    app.mount(container);
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(confirmCalled).toBe(true);

    app.unmount();
  });

  it('should emit close when pressing Escape while dialog is open', async () => {
    let closeCalled = false;
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          onClose: () => {
            closeCalled = true;
          }
        });
      }
    });
    app.mount(container);
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closeCalled).toBe(true);

    app.unmount();
  });

  it('should emit close when clicking backdrop if closeOnClickBackdrop is true', async () => {
    let closeCalled = false;
    const app = createApp({
      render() {
        return h(UiDialog, {
          isOpen: true,
          closeOnClickBackdrop: true,
          onClose: () => {
            closeCalled = true;
          }
        });
      }
    });
    app.mount(container);
    await nextTick();

    const backdrop = container.querySelector('.dialog-backdrop') as HTMLElement;
    backdrop.click();
    expect(closeCalled).toBe(true);

    app.unmount();
  });
});
