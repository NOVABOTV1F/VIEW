export const stageCanvas: { current: HTMLCanvasElement | null } = { current: null };

export async function grabPng(): Promise<Blob | null> {
  const video = document.getElementById("playback");
  if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  const canvas = stageCanvas.current;
  if (!canvas) return null;
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
