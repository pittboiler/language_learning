// Browser mic capture — ported from spike/public/index.html (makeRecorder). Records webm/opus,
// which both ASR engines accept (Google STT uses the WEBM_OPUS encoding for it).
export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
}

export function makeRecorder(): Recorder {
  let mr: MediaRecorder;
  let chunks: BlobPart[] = [];
  let stream: MediaStream;
  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mr = new MediaRecorder(stream, { mimeType: mime });
      chunks = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mr.start();
    },
    stop() {
      return new Promise<Blob>((resolve) => {
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: "audio/webm" }));
        };
        mr.stop();
      });
    },
  };
}
