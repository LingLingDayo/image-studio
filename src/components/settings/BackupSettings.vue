<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { Download, Upload } from '@lucide/vue';
import { UiButton } from '@/components/ui';
import { createBackup, prepareBackup, importBackup, releaseBackup, type PreparedBackup } from '@/core/storage/BackupService';
import { useGalleryStore } from '@/stores/galleryStore';
import { downloadImage } from '@/utils/download';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });
const galleryStore = useGalleryStore();
const fileInput = ref<HTMLInputElement | null>(null);
const preview = shallowRef<PreparedBackup | null>(null);
const selectedFilename = ref('');
const operation = ref<'export' | 'preview' | 'import' | null>(null);
const message = ref('');
const hasError = ref(false);
let active = true;

function setMessage(text: string, error = false): void {
  if (!active) return;
  message.value = text;
  hasError.value = error;
}

function cancelPreview(): void {
  releaseBackup(preview.value);
  preview.value = null;
  selectedFilename.value = '';
  setMessage('');
}

async function exportBackup(): Promise<void> {
  if (operation.value || props.disabled) return;
  operation.value = 'export';
  setMessage('正在准备备份…');
  try {
    const backup = await createBackup();
    if (!active) return;
    if (backup.count === 0) {
      setMessage('暂无作品可备份');
      return;
    }
    const url = URL.createObjectURL(backup.blob);
    // 下载读取异步进行，延迟释放其独占 URL，避免关闭设置导致文件读取中断。
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    await downloadImage(url, backup.filename);
    setMessage(`已生成 ${backup.count} 张作品的备份并发起下载，请确认文件保存完成`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '备份导出失败，请重试', true);
  } finally {
    if (active) operation.value = null;
  }
}

function chooseBackup(): void {
  if (!operation.value && !props.disabled) fileInput.value?.click();
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || operation.value || props.disabled) return;
  cancelPreview();
  operation.value = 'preview';
  setMessage('正在检查备份…');
  try {
    const prepared = await prepareBackup(file);
    if (!active) {
      releaseBackup(prepared);
      return;
    }
    preview.value = prepared;
    selectedFilename.value = file.name;
    setMessage('');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '备份检查失败，请重新选择', true);
  } finally {
    if (active) operation.value = null;
  }
}

async function confirmImport(): Promise<void> {
  if (!preview.value || operation.value || props.disabled) return;
  operation.value = 'import';
  setMessage('正在合并作品…');
  try {
    const result = await importBackup(preview.value);
    preview.value = null;
    try {
      await galleryStore.loadGallery();
      setMessage(`导入完成：新增 ${result.added} 张，跳过 ${result.skipped} 张重复作品`);
    } catch {
      setMessage(`已导入 ${result.added} 张作品，但列表刷新失败，请刷新页面查看`, true);
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '导入失败，未写入新作品', true);
  } finally {
    if (active) operation.value = null;
  }
}

onBeforeUnmount(() => {
  active = false;
  cancelPreview();
});
</script>

<template>
  <div class="backup-settings">
    <p class="backup-description">包含图片、参考图与生成参数，不含接口密钥。备份与导入立即生效，无需保存设置。</p>
    <div class="backup-actions">
      <UiButton :disabled="disabled || operation !== null" :loading="operation === 'export'" @click="exportBackup">
        <template #icon><Download :size="14" /></template>
        导出数据
      </UiButton>
      <UiButton :disabled="disabled || operation !== null" :loading="operation === 'preview'" @click="chooseBackup">
        <template #icon><Upload :size="14" /></template>
        导入数据
      </UiButton>
      <input ref="fileInput" class="backup-file-input" type="file" accept=".json,application/json" aria-label="选择作品备份文件" @change="handleFileChange" />
    </div>
    <p class="backup-limit">当前支持最多 1000 张作品、128 MiB 文件，图像及参考图数据总计不超过 80 MiB；仅支持本地 PNG、JPEG、WebP 图像。</p>
    <div v-if="preview" class="backup-preview">
      <p>已选择：{{ selectedFilename }}</p>
      <p>备份共 {{ preview.total }} 张作品，将新增 {{ preview.added }} 张，跳过 {{ preview.skipped }} 张重复作品。</p>
      <p>现有作品不会被覆盖或清空。</p>
      <p v-if="preview.unsupportedCount">原库中 {{ preview.unsupportedCount }} 条未识别旧记录会保持原状。</p>
      <div class="backup-actions">
        <UiButton variant="primary" :disabled="disabled || operation !== null || preview.added === 0" :loading="operation === 'import'" @click="confirmImport">合并导入</UiButton>
        <UiButton :disabled="operation !== null" @click="cancelPreview">取消</UiButton>
      </div>
    </div>
    <p v-if="message" class="backup-message" :class="{ 'is-error': hasError }" :role="hasError ? 'alert' : 'status'" aria-live="polite">{{ message }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.backup-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-description,
.backup-limit,
.backup-message,
.backup-preview {
  color: $text-muted;
  font-size: 0.78rem;
  line-height: 1.5;
}

.backup-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.backup-file-input {
  display: none;
}

.backup-limit {
  font-size: 0.72rem;
}

.backup-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-surface-subtle;
}

.backup-message.is-error {
  color: $danger;
}
</style>
