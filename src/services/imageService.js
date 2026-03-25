import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const THUMBNAIL_CACHE_DIR = FileSystem.cacheDirectory + 'thumbnails/';
const COMPRESSED_CACHE_DIR = FileSystem.cacheDirectory + 'compressed/';

export async function initializeImageCache() {
  await FileSystem.makeDirectoryAsync(THUMBNAIL_CACHE_DIR, { intermediates: true });
  await FileSystem.makeDirectoryAsync(COMPRESSED_CACHE_DIR, { intermediates: true });
}

export async function compressImage(uri) {
  try {
    const cacheKey = createCacheKey(uri);
    const cachedPath = COMPRESSED_CACHE_DIR + cacheKey;

    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    if (fileInfo.exists) return cachedPath;

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024, height: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    await FileSystem.moveAsync({ from: result.uri, to: cachedPath });
    return cachedPath;
  } catch (error) {
    console.error('Image compression failed:', error);
    return uri;
  }
}

export async function getThumbnailUri(uri) {
  try {
    const cacheKey = createCacheKey(uri) + '_thumb';
    const cachedPath = THUMBNAIL_CACHE_DIR + cacheKey;

    const fileInfo = await FileSystem.getInfoAsync(cachedPath);
    if (fileInfo.exists) return cachedPath;

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 256, height: 256 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    await FileSystem.moveAsync({ from: result.uri, to: cachedPath });
    return cachedPath;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return uri;
  }
}

function createCacheKey(uri) {
  return uri.split('/').pop();
}

export async function clearImageCache() {
  try {
    await FileSystem.deleteAsync(THUMBNAIL_CACHE_DIR, { idempotent: true });
    await FileSystem.deleteAsync(COMPRESSED_CACHE_DIR, { idempotent: true });
    await initializeImageCache();
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
}
