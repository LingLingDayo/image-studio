import { describe, it, expect } from 'vitest';
import GalleryCard from './GalleryCard.vue';
import GalleryGrid from './GalleryGrid.vue';
import LightboxModal from './LightboxModal.vue';
import TaskCard from './card/TaskCard.vue';
import ArtworkCard from './card/ArtworkCard.vue';
import LightboxViewport from './lightbox/LightboxViewport.vue';
import LightboxDetailPanel from './lightbox/LightboxDetailPanel.vue';

describe('Gallery Components (src/components/gallery)', () => {
  it('should export all gallery components properly', () => {
    expect(GalleryCard).toBeDefined();
    expect(GalleryGrid).toBeDefined();
    expect(LightboxModal).toBeDefined();
  });

  it('should export card subcomponents properly', () => {
    expect(TaskCard).toBeDefined();
    expect(ArtworkCard).toBeDefined();
  });

  it('should export lightbox subcomponents properly', () => {
    expect(LightboxViewport).toBeDefined();
    expect(LightboxDetailPanel).toBeDefined();
  });
});
