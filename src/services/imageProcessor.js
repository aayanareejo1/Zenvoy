import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_EDGE    = 1600;
const COMPRESS    = 0.75;
const MAX_BYTES   = 3 * 1024 * 1024; // 3 MB hard stop before Claude call
const WARN_TOKENS = 3000;             // educate user if Claude uses more than this

/** Resolve original image dimensions. */
const getImageDimensions = (uri) =>
  new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject)
  );

/**
 * Resize longest edge to MAX_EDGE and compress to COMPRESS quality.
 * Returns { uri, size } where size is in bytes.
 */
export const preprocessImage = async (uri) => {
  const { width, height } = await getImageDimensions(uri);
  const longestEdge = Math.max(width, height);

  const actions = [];
  if (longestEdge > MAX_EDGE) {
    actions.push(
      width >= height
        ? { resize: { width: MAX_EDGE } }
        : { resize: { height: MAX_EDGE } }
    );
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: COMPRESS,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const info = await FileSystem.getInfoAsync(result.uri, { size: true });
  return { uri: result.uri, size: info.size || 0 };
};

/** Returns true if the (post-preprocessing) image is too large to send. */
export const isTooLarge = (bytes) => bytes > MAX_BYTES;

/** Returns true if token usage from a Claude response warrants a warning. */
export const isUnusuallyLargeScan = (usage) =>
  usage && (usage.input_tokens + (usage.output_tokens || 0)) >= WARN_TOKENS;
