import { describe, expect, it } from 'vitest';
import {
  chooseLandingDesignPattern,
  designLandingPage,
  LANDING_DESIGN_SKILL_KEY,
} from '../ai/landingDesignAgent';
import { buildLandingSections } from '../services/landingTools';

describe('landing design agent', () => {
  it('selects a grounded pattern from the brief without changing the landing order', () => {
    const design = designLandingPage({
      projectName: 'Aqua Marina',
      brief: 'Tạo landing dự án ven biển có marina và khu nghỉ dưỡng.',
      galleryImages: ['/uploads/00000000-0000-0000-0000-000000000001/hero.jpg'],
    });

    expect(design.skillKey).toBe(LANDING_DESIGN_SKILL_KEY);
    expect(design.pattern).toBe('coastal');
    expect(design.gallery.layout).toBe('single-focus');
    expect(design.palette.navy).toMatch(/^#/);
    expect(design.accessibility).toEqual({
      contrastChecked: true,
      mobileFirst: true,
      altTextRequired: true,
    });

    const sections = buildLandingSections(
      { projectName: 'Aqua Marina', location: 'Long An', area: '45 ha', amenities: [] },
      'vi',
      ['/uploads/00000000-0000-0000-0000-000000000001/hero.jpg'],
      design,
    );
    expect(sections.map(section => section.stage)).toEqual([
      'hero',
      'gallery',
      'legal',
      'price',
      'amenities',
      'contact',
    ]);
    expect(sections[0].design?.skillKey).toBe(LANDING_DESIGN_SKILL_KEY);
    expect(sections[1].layout).toBe('single-focus');
  });

  it('uses safe fallbacks when there are no verified design inputs', () => {
    const design = designLandingPage({});

    expect(chooseLandingDesignPattern({})).toBe('sanctuary');
    expect(design.gallery.layout).toBe('editorial-grid');
    expect(design.confidence).toBeLessThan(0.7);
    expect(design.needsReview).toBe(true);
  });

  it('keeps multiple verified images in a deliberate mosaic layout', () => {
    const design = designLandingPage({
      brief: 'Landing cho khu đô thị gần metro.',
      galleryImages: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });

    expect(design.pattern).toBe('urban');
    expect(design.gallery.layout).toBe('mosaic');
    expect(design.hero.imageTreatment).toBe('image-led');
    expect(design.cta.placement).toBe('hero-and-contact');
  });
});