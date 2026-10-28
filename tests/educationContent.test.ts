import { describe, it, expect } from 'vitest';
import { educationContentSchema } from '../src/modules/education/schemas';

describe('education content schema', () => {
  it('accepts a video without a transcript', () => {
    const result = educationContentSchema.safeParse({
      content_type: 'video',
      title: 'Counting baby kicks',
      stage: 'trimester_3',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      transcript: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transcript).toBeNull();
      expect(result.data.status).toBe('published');
    }
  });

  it('requires a video link for videos', () => {
    const result = educationContentSchema.safeParse({ content_type: 'video', title: 'No link here' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['video_url']);
  });

  it('accepts an article with text and defaults it to General', () => {
    const result = educationContentSchema.safeParse({
      content_type: 'article',
      title: 'Foods that build blood',
      body: 'Ugu, beans and fish are rich in iron.',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stage).toBe('general');
  });

  it('accepts an article that is only a link', () => {
    const result = educationContentSchema.safeParse({
      content_type: 'article',
      title: 'WHO antenatal guidance',
      article_url: 'https://www.who.int/',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty article and non-http links', () => {
    expect(educationContentSchema.safeParse({ content_type: 'article', title: 'Empty one' }).success).toBe(false);
    expect(
      educationContentSchema.safeParse({ content_type: 'video', title: 'Bad link', video_url: 'javascript:alert(1)' }).success
    ).toBe(false);
  });
});
