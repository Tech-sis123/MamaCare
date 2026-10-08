/**
 * Works out how to play a video link pasted by a doctor.
 * Returns { kind: 'iframe' | 'file' | 'link', src } or null for an empty link.
 */
export const getVideoSource = (url) => {
  if (!url) return null;
  const value = String(url).trim();

  const youtube = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/i);
  if (youtube) return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}?autoplay=0&rel=0` };

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };

  const drive = value.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/i);
  if (drive) return { kind: 'iframe', src: `https://drive.google.com/file/d/${drive[1]}/preview` };

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value)) return { kind: 'file', src: value };

  return { kind: 'link', src: value };
};
