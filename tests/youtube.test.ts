import { expect, test } from 'vitest';
import { videoIdOf } from '../tools/youtube';

test('YouTube havolasidan video id', () => {
  expect(videoIdOf('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(videoIdOf('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ');
  expect(videoIdOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
  expect(videoIdOf('https://example.com/youtube/v1')).toBeNull();
});
