// The only file that touches the camera and the OCR engine (Apple Vision on iOS), so both can be
// swapped or mocked. Photos are read on the phone; nothing is uploaded.

import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';

export const ocrSupported = isSupported;
export type PhotoSource = 'camera' | 'library';

/** Lines of text in a photo of a nutrition table; null if the user cancelled. */
export async function readLabelPhoto(source: PhotoSource): Promise<string[] | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  return extractTextFromImage(result.assets[0].uri);
}
