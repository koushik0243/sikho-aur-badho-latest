// The one rule for every video upload in the app (lesson, course intro, assignment
// submission): "MP4, WebM, MOV, AVI, and MKV formats, up to 2 GB".
// Must match the server (server/_helpers/videoConvert.js). Files that don't play in every
// browser (most MOV/AVI/MKV) are converted to MP4 on the server after upload.

export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
export const VIDEO_FORMATS_LABEL = 'MP4, WebM, MOV, AVI, and MKV';
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_VIDEO_LABEL = '2 GB';
/** For <input type="file" accept>. By extension: browsers report no type for some .mkv/.avi. */
export const VIDEO_ACCEPT = VIDEO_EXTENSIONS.join(',');
/** "MP4, WebM, MOV, AVI, and MKV formats" — the note under every video picker. The size
    limit isn't shown; a file over MAX_VIDEO_BYTES still gets the "too large" message. */
export const VIDEO_UPLOAD_NOTE = `${VIDEO_FORMATS_LABEL} formats`;

const extensionOf = (name) => {
  const m = /\.[^.]+$/.exec(String(name || ''));
  return m ? m[0].toLowerCase() : '';
};

/** Why this file can't be uploaded as a video, or '' when it's fine. */
export function videoFileProblem(file) {
  if (!file) return 'Please choose a video.';
  if (!VIDEO_EXTENSIONS.includes(extensionOf(file.name))) {
    return `Please choose a video in ${VIDEO_FORMATS_LABEL} format.`;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `Video file is too large. Maximum allowed size is ${MAX_VIDEO_LABEL}.`;
  }
  return '';
}

/** Whether this browser can play a picked file directly (MOV/AVI/MKV usually can't). */
export function canBrowserPlay(file) {
  if (!file?.type || typeof document === 'undefined') return false;
  return document.createElement('video').canPlayType(file.type) !== '';
}
