// Screen sharing helpers: grabbing a frame and the always-on-top controls window.

// Chrome/Edge APIs missing from TypeScript's DOM typings.
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: {
        width?: number;
        height?: number;
      }): Promise<Window>;
    };
  }
  interface ImageCapture {
    grabFrame(): Promise<ImageBitmap>;
  }
}

/** PNG of the current frame of a shared screen. */
export async function grabPng(
  stream: MediaStream,
  video: HTMLVideoElement | null,
): Promise<Blob | null> {
  const track = stream.getVideoTracks()[0];
  if (!track) return null;
  // grabFrame reads the shared screen directly, so it works while this tab is in the background.
  const frame =
    "ImageCapture" in window
      ? await new ImageCapture(track).grabFrame()
      : video;
  if (!frame) return null;
  const canvas = document.createElement("canvas");
  canvas.width =
    frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width;
  canvas.height =
    frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height;
  canvas.getContext("2d")!.drawImage(frame, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Always-on-top mini window styled like this page, so controls float over any tab or app. */
export async function openFloatingWindow(): Promise<Window> {
  const win = await window.documentPictureInPicture!.requestWindow({
    width: 200,
    height: 52,
  });
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = win.document.createElement("style");
      style.textContent = Array.from(
        sheet.cssRules,
        (rule) => rule.cssText,
      ).join("\n");
      win.document.head.append(style);
    } catch {
      if (sheet.ownerNode)
        win.document.head.append(sheet.ownerNode.cloneNode(true)); // cross-origin sheet
    }
  }
  win.document.documentElement.className = document.documentElement.className;
  win.document.body.className = document.body.className;
  win.document.title = "ReVibe capture";
  return win;
}
