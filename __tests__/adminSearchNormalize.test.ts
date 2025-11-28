import { normalizeSearchResults } from '../app/admin/app/page';

describe('normalizeSearchResults', () => {
  it('maps admin video search payload to UI shape without transcript probing', () => {
    const results = normalizeSearchResults({
      items: [
        {
          video_id: 'abc123',
          url: 'https://youtube.com/watch?v=abc123',
          title: 'Sample title',
          channel: 'Yoga Channel',
          duration_seconds: 125,
          published_at: '2024-02-01T00:00:00Z',
          description_snippet: 'A sample video',
          has_transcript: true
        }
      ]
    });

    expect(results).toEqual([
      {
        videoId: 'abc123',
        url: 'https://youtube.com/watch?v=abc123',
        title: 'Sample title',
        channel: 'Yoga Channel',
        durationSeconds: 125,
        publishedAt: '2024-02-01T00:00:00Z',
        descriptionSnippet: 'A sample video'
      }
    ]);
  });

  it('ignores items without URLs', () => {
    const results = normalizeSearchResults({ items: [{ video_id: 'x', url: '', title: 'Missing url' }] });
    expect(results).toEqual([]);
  });
});
