// Browser mic capture — ported from spike/public/index.html (makeRecorder). Records webm/opus,
// which both ASR engines accept (Google STT uses the WEBM_OPUS encoding for it).
export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  /** Drop any recording in progress and turn the mic off. Safe to call at any time, any number of times;
   *  the recorder can start again afterwards. The page calls it when a recording view goes away mid-recording
   *  (a skip, the next step, leaving the exam), so the tab doesn't keep the mic. */
  release(): void;
}

export function makeRecorder(): Recorder {
  let mr: MediaRecorder | undefined;
  let chunks: BlobPart[] = [];
  let stream: MediaStream | undefined;
  // Bumped by release(): a start() still waiting on the mic (the permission prompt) sees it and backs out,
  // turning off the stream it was handed instead of recording into a view that's already gone.
  let gen = 0;
  const off = (s?: MediaStream) => s?.getTracks().forEach((t) => t.stop());
  return {
    async start() {
      const mine = ++gen;
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (mine !== gen) { off(s); return; }
      stream = s;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mr = new MediaRecorder(s, { mimeType: mime });
      chunks = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mr.start();
    },
    stop() {
      return new Promise<Blob>((resolve) => {
        const r = mr, s = stream;
        const done = () => { off(s); resolve(new Blob(chunks, { type: "audio/webm" })); };
        if (!r || r.state === "inactive") return done();
        r.onstop = done;
        r.stop();
      });
    },
    release() {
      gen++;
      if (mr && mr.state !== "inactive") {
        mr.onstop = null;
        mr.ondataavailable = null;
        try { mr.stop(); } catch { /* already stopping */ }
      }
      off(stream);
      mr = undefined;
      stream = undefined;
    },
  };
}
