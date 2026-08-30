import 'fake-indexeddb/auto';

// 全局 Mock 浏览器 Image 对象以加速测试中的尺寸探测
if (typeof window !== 'undefined') {
  class MockImage {
    naturalWidth = 1024;
    naturalHeight = 1024;
    onload: any = null;
    onerror: any = null;
    set src(_val: string) {
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  }
  (window as any).Image = MockImage;
}
