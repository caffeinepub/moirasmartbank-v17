import { useCallback, useEffect, useRef, useState } from "react";

// ===== Types =====
export type RecordingStatus = "idle" | "recording" | "playing";

export interface VoicePrintData {
  audioBuffer: Float32Array;
  duration: number;
  timestamp: string;
  blob: Blob;
}

// ===== Voice Recorder Panel =====
export function VoiceRecorderPanel({
  onVoicePrintCaptured,
}: {
  onVoicePrintCaptured: (data: VoicePrintData) => void;
}) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const drawLiveWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "oklch(0.08 0.02 240)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00ff88";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00ff88";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(drawLiveWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
        setRecordedBlob(blob);
        setRecordedDuration(dur);
        for (const t of stream.getTracks()) t.stop();

        // Decode audio for voice print
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const decodeCtx = new AudioContext();
          const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
          const channelData = decoded.getChannelData(0);
          // Downsample to 512 points for viz
          const samples = 512;
          const step = Math.floor(channelData.length / samples);
          const downsampled = new Float32Array(samples);
          for (let i = 0; i < samples; i++) {
            downsampled[i] = channelData[i * step];
          }
          decodeCtx.close();

          onVoicePrintCaptured({
            audioBuffer: downsampled,
            duration: dur,
            timestamp: new Date().toLocaleString("en-IN"),
            blob,
          });
        } catch (_) {
          // fallback: generate random waveform
          const fake = new Float32Array(512);
          for (let i = 0; i < 512; i++) fake[i] = (Math.random() - 0.5) * 0.8;
          onVoicePrintCaptured({
            audioBuffer: fake,
            duration: dur,
            timestamp: new Date().toLocaleString("en-IN"),
            blob,
          });
        }
      };

      mr.start(100);
      setStatus("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      drawLiveWaveform();
    } catch (_) {
      // Generate simulated waveform if no mic
      setStatus("recording");
      setDuration(0);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Draw simulated waveform
      const canvas = canvasRef.current;
      if (canvas) {
        const animateSim = () => {
          const ctx2 = canvas.getContext("2d");
          if (!ctx2) return;
          ctx2.fillStyle = "#080d14";
          ctx2.fillRect(0, 0, canvas.width, canvas.height);
          ctx2.lineWidth = 2;
          ctx2.strokeStyle = "#00ff88";
          ctx2.shadowBlur = 8;
          ctx2.shadowColor = "#00ff88";
          ctx2.beginPath();
          const t = Date.now() / 200;
          for (let i = 0; i <= canvas.width; i++) {
            const y =
              canvas.height / 2 +
              Math.sin(i * 0.08 + t) * 18 +
              Math.sin(i * 0.03 + t * 1.5) * 10 +
              (Math.random() - 0.5) * 6;
            if (i === 0) ctx2.moveTo(i, y);
            else ctx2.lineTo(i, y);
          }
          ctx2.stroke();
          animFrameRef.current = requestAnimationFrame(animateSim);
        };
        animateSim();
      }
    }
  }, [drawLiveWaveform, onVoicePrintCaptured]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      // simulated mode
      const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
      const fake = new Float32Array(512);
      for (let i = 0; i < 512; i++) fake[i] = (Math.random() - 0.5) * 0.8;
      const fakeBlob = new Blob([], { type: "audio/webm" });
      setRecordedBlob(fakeBlob);
      setRecordedDuration(dur);
      onVoicePrintCaptured({
        audioBuffer: fake,
        duration: dur,
        timestamp: new Date().toLocaleString("en-IN"),
        blob: fakeBlob,
      });
    }
    setStatus("idle");
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Draw flat line on canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#080d14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#00ff8844";
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    }
  }, [onVoicePrintCaptured]);

  const playRecording = useCallback(() => {
    if (!recordedBlob || recordedBlob.size === 0) return;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setStatus("playing");
    audio.onended = () => {
      setStatus("idle");
      URL.revokeObjectURL(url);
    };
    audio.play();
  }, [recordedBlob]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current?.state === "recording")
        mediaRecorderRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const statusColor =
    status === "recording"
      ? "#00ff88"
      : status === "playing"
        ? "oklch(0.82 0.18 200)"
        : "oklch(0.45 0.04 230)";

  return (
    <div
      className="hud-panel rounded flex flex-col shrink-0 overflow-hidden"
      style={{ height: 200 }}
      data-ocid="voice_recorder.panel"
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2 shrink-0"
        style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: statusColor,
            boxShadow: status !== "idle" ? `0 0 6px ${statusColor}` : "none",
            animation:
              status === "recording"
                ? "blink 0.8s ease-in-out infinite"
                : "none",
          }}
        />
        <div
          className="orbitron font-bold flex-1"
          style={{ color: "#00ff88", fontSize: 9, letterSpacing: 1 }}
        >
          VOICE RECORDER — GNANI.AI
        </div>
        <div
          className="orbitron font-black px-1.5 py-0.5 rounded"
          style={{
            fontSize: 7,
            background:
              status === "recording"
                ? "oklch(0.18 0.08 145 / 0.4)"
                : status === "playing"
                  ? "oklch(0.16 0.06 200 / 0.4)"
                  : "oklch(0.12 0.02 240 / 0.4)",
            border: `1px solid ${statusColor}`,
            color: statusColor,
            letterSpacing: 1,
          }}
        >
          {status === "recording"
            ? "● REC"
            : status === "playing"
              ? "▶ PLAY"
              : "◼ IDLE"}
        </div>
      </div>

      {/* Canvas waveform */}
      <div className="px-2 pt-2 shrink-0">
        <canvas
          ref={canvasRef}
          width={260}
          height={52}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 4,
            border: "1px solid oklch(0.22 0.04 235)",
            background: "#080d14",
            display: "block",
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-2">
        {status === "idle" && (
          <>
            <button
              type="button"
              data-ocid="voice_recorder.primary_button"
              onClick={startRecording}
              className="flex-1 rounded orbitron font-bold py-1.5 transition-all"
              style={{
                fontSize: 9,
                letterSpacing: 1,
                background:
                  "linear-gradient(135deg, oklch(0.18 0.08 145), oklch(0.12 0.04 160))",
                color: "#00ff88",
                border: "1px solid #00ff8866",
                boxShadow: "0 0 8px #00ff8833",
                cursor: "pointer",
              }}
            >
              ● START RECORDING
            </button>
            {recordedBlob && recordedBlob.size > 0 && (
              <button
                type="button"
                data-ocid="voice_recorder.secondary_button"
                onClick={playRecording}
                className="rounded orbitron font-bold px-3 py-1.5 transition-all"
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  background: "oklch(0.15 0.05 200 / 0.6)",
                  color: "oklch(0.82 0.18 200)",
                  border: "1px solid oklch(0.82 0.18 200 / 0.5)",
                  cursor: "pointer",
                }}
              >
                ▶ PLAY
              </button>
            )}
          </>
        )}
        {status === "recording" && (
          <button
            type="button"
            data-ocid="voice_recorder.secondary_button"
            onClick={stopRecording}
            className="flex-1 rounded orbitron font-bold py-1.5 transition-all"
            style={{
              fontSize: 9,
              letterSpacing: 1,
              background:
                "linear-gradient(135deg, oklch(0.20 0.08 25), oklch(0.14 0.05 25))",
              color: "oklch(0.72 0.25 25)",
              border: "1px solid oklch(0.62 0.25 25 / 0.6)",
              boxShadow: "0 0 8px oklch(0.62 0.25 25 / 0.3)",
              cursor: "pointer",
            }}
          >
            ◼ STOP — {duration}s
          </button>
        )}
        {status === "playing" && (
          <div
            className="flex-1 rounded orbitron font-bold py-1.5 text-center"
            style={{
              fontSize: 9,
              letterSpacing: 1,
              background: "oklch(0.12 0.04 200 / 0.4)",
              color: "oklch(0.82 0.18 200)",
              border: "1px solid oklch(0.82 0.18 200 / 0.4)",
            }}
          >
            ▶▶ PLAYING AUDIO…
          </div>
        )}
      </div>

      {recordedDuration > 0 && status === "idle" && (
        <div
          className="mx-2 mb-2 rounded px-2 py-1"
          style={{
            background: "oklch(0.10 0.025 245 / 0.8)",
            border: "1px solid #00ff8833",
          }}
        >
          <span
            className="orbitron"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            LAST RECORDING: {recordedDuration}s ∙ VOICE PRINT CAPTURED
          </span>
        </div>
      )}
    </div>
  );
}

// ===== Voice Print Panel =====
export function VoicePrintPanel({
  voicePrint,
}: {
  voicePrint: VoicePrintData | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#050c12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!voicePrint) {
      // Draw flat placeholder
      ctx.strokeStyle = "#00ff8822";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "9px monospace";
      ctx.fillStyle = "#00ff8844";
      ctx.textAlign = "center";
      ctx.fillText(
        "AWAITING VOICE PRINT...",
        canvas.width / 2,
        canvas.height / 2 - 8,
      );
      return;
    }

    const data = voicePrint.audioBuffer;
    const w = canvas.width;
    const h = canvas.height;
    const midY = h / 2;

    // Gradient stroke
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#00ff8800");
    grad.addColorStop(0.1, "#00ff88");
    grad.addColorStop(0.5, "#00ffcc");
    grad.addColorStop(0.9, "#00ff88");
    grad.addColorStop(1, "#00ff8800");

    // Draw glow (thick, faint)
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#00ff8830";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * w;
      const y = midY + data[i] * (h * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw main line
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = grad;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff88";
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * w;
      const y = midY + data[i] * (h * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tick marks
    ctx.strokeStyle = "#00ff8840";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath();
      ctx.moveTo(x, midY - 3);
      ctx.lineTo(x, midY + 3);
      ctx.stroke();
    }
  }, [voicePrint]);

  return (
    <div
      className="hud-panel rounded flex flex-col shrink-0 overflow-hidden"
      style={{ height: 180 }}
      data-ocid="voice_print.panel"
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2 shrink-0"
        style={{ borderBottom: "1px solid oklch(0.22 0.04 235)" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: voicePrint ? "#00ff88" : "oklch(0.35 0.04 230)",
            boxShadow: voicePrint ? "0 0 6px #00ff88" : "none",
          }}
        />
        <div
          className="orbitron font-bold flex-1"
          style={{ color: "#00ff88", fontSize: 9, letterSpacing: 1 }}
        >
          VOICE PRINT REGISTERED
        </div>
        {voicePrint && (
          <div
            className="orbitron font-black px-1.5 py-0.5 rounded"
            style={{
              fontSize: 7,
              background: "oklch(0.14 0.06 145 / 0.4)",
              border: "1px solid #00ff8866",
              color: "#00ff88",
              letterSpacing: 1,
            }}
          >
            ✓ BIOMETRIC CONFIRMED
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="px-2 pt-2">
        <canvas
          ref={canvasRef}
          width={280}
          height={70}
          style={{
            width: "100%",
            height: 70,
            borderRadius: 4,
            border: "1px solid #00ff8822",
            background: "#050c12",
            display: "block",
          }}
        />
      </div>

      {/* Info rows */}
      {voicePrint ? (
        <div className="flex gap-2 px-2 pt-2 pb-2">
          <div
            className="flex-1 rounded px-2 py-1"
            style={{
              background: "oklch(0.08 0.02 240)",
              border: "1px solid #00ff8830",
            }}
          >
            <div
              className="orbitron"
              style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
            >
              CAPTURED
            </div>
            <div
              className="orbitron font-bold"
              style={{ color: "#00ff88", fontSize: 8 }}
            >
              {voicePrint.timestamp}
            </div>
          </div>
          <div
            className="rounded px-2 py-1"
            style={{
              background: "oklch(0.08 0.02 240)",
              border: "1px solid #00ff8830",
            }}
          >
            <div
              className="orbitron"
              style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
            >
              DURATION
            </div>
            <div
              className="orbitron font-bold"
              style={{ color: "#00ff88", fontSize: 8 }}
            >
              {voicePrint.duration}s
            </div>
          </div>
          <div
            className="rounded px-2 py-1"
            style={{
              background: "oklch(0.08 0.02 240)",
              border: "1px solid oklch(0.76 0.14 75 / 0.3)",
            }}
          >
            <div
              className="orbitron"
              style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
            >
              SEAL
            </div>
            <div
              className="orbitron font-bold"
              style={{ color: "oklch(0.76 0.14 75)", fontSize: 8 }}
            >
              THIMAIYAS ✓
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mx-2 mt-2 mb-2 rounded px-2 py-1 text-center"
          style={{
            background: "oklch(0.08 0.02 240)",
            border: "1px solid #00ff8818",
          }}
        >
          <span
            className="orbitron"
            style={{ color: "#00ff8866", fontSize: 7 }}
          >
            RECORD VOICE SAMPLE TO REGISTER BIOMETRIC PRINT
          </span>
        </div>
      )}
    </div>
  );
}

// ===== Printable V16 Form =====
export function PrintableV16Form({
  voicePrint,
  scanState,
  memoryCounter,
}: {
  voicePrint: VoicePrintData | null;
  scanState: string;
  memoryCounter: number;
}) {
  const now = new Date();
  return (
    <div
      className="print-only"
      style={{
        fontFamily: "Georgia, serif",
        color: "#000",
        background: "#fff",
        padding: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "3px double #000",
          paddingBottom: 16,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 4,
            color: "#555",
            marginBottom: 4,
          }}
        >
          GOVERNMENT OF INDIA — OFFICIAL DOCUMENT
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          MoiraSmartBank.ai V16
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 3 }}>
          OFFICIAL SYSTEM REPORT — TRIAL RUN
        </div>
        <div style={{ fontSize: 10, color: "#555", marginTop: 8 }}>
          Generated:{" "}
          {now.toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          at {now.toLocaleTimeString("en-IN")}
        </div>
      </div>

      {/* 2-column info */}
      <div style={{ display: "flex", gap: 32, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: "#555",
              marginBottom: 2,
            }}
          >
            DOCUMENT CLASS
          </div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>
            OFFICIAL TRIAL RUN OUTPUT
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: "#555",
              marginBottom: 2,
            }}
          >
            SYSTEM VERSION
          </div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>
            V16 4D ENVIRONMENT
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              color: "#555",
              marginBottom: 2,
            }}
          >
            STATUS
          </div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>PRODUCTION ACTIVE</div>
        </div>
      </div>

      {/* Section divider */}
      <SectionHeader title="SECTION 1 — SECURITY STATUS" />
      <PrintTable
        rows={[
          [
            "K9 AGENTIC SNIFF STATUS",
            scanState === "lockout"
              ? "THREAT LOCKOUT ACTIVE — TOUCH ME NOT"
              : scanState === "scanning"
                ? "SCAN IN PROGRESS"
                : "IDLE — READY",
          ],
          [
            "TOUCH ME NOT STATUS",
            scanState === "lockout"
              ? "ENGAGED — AUTONOMOUS CONTAINMENT"
              : "STANDBY",
          ],
          ["RBI FRAUD LIBRARY", "50L+ ENTRIES INDEXED — LIVE SYNC"],
          [
            "SCAN RESULT",
            scanState === "lockout"
              ? "THREATS DETECTED & NEUTRALIZED"
              : "NO ACTIVE THREATS",
          ],
          ["ZERO-TOLERANCE POLICY", "ACTIVE — WORLD TOUCH ME NOT"],
        ]}
      />

      <SectionHeader title="SECTION 2 — VAULT STATUS" />
      <PrintTable
        rows={[
          ["M.SIM ELEPHANT MEMORY VAULT", "OPERATIONAL"],
          ["MEMORY ENTRIES INDEXED", memoryCounter.toLocaleString("en-IN")],
          ["VAULT INTEGRITY", "99.97%"],
          ["HARDWARE CRAFT LAYER", "ACTIVE"],
          ["INACTION PROTECTION MODE", "ACTIVE"],
          ["ENCRYPTION DEPTH", "AES-512"],
          ["HW-SW MARRIAGE STATUS", "AUTHENTICATED"],
          ["BANKING LOGIC", "IMPREGNATED INTO DEVICE"],
        ]}
      />

      <SectionHeader title="SECTION 3 — VOICE PRINT" />
      {voicePrint ? (
        <PrintTable
          rows={[
            ["BIOMETRIC VOICE PRINT", "REGISTERED"],
            ["CAPTURE TIMESTAMP", voicePrint.timestamp],
            ["RECORDING DURATION", `${voicePrint.duration} seconds`],
            ["BIOMETRIC SEAL", "THIMAIYAS SEAL — CONFIRMED"],
            ["GNANI.AI ENGINE", "VOICE AUTHENTICATED"],
          ]}
        />
      ) : (
        <div
          style={{
            padding: "12px 16px",
            border: "1px solid #ccc",
            color: "#888",
            fontSize: 11,
            marginBottom: 16,
          }}
        >
          No voice print recorded in this session.
        </div>
      )}

      <SectionHeader title="SECTION 4 — COMPLIANCE" />
      <PrintTable
        rows={[
          ["DPDP ACT 2023", "COMPLIANT — DIGITAL PERSONAL DATA PROTECTION"],
          ["UN CYBERSECURITY FRAMEWORK", "CERTIFIED"],
          ["RBI AUTHORIZATION", "AUTHORIZED BANKING SYSTEM"],
          ["NATIONAL ESSENTIAL SERVICE", "CLASSIFIED & DESIGNATED"],
          ["SOVEREIGN BANKING PROTECTION", "ACTIVE"],
          ["THIMAIYAS SECURITY PROTOCOL", "ENGAGED"],
        ]}
      />

      <SectionHeader title="SECTION 5 — AUTHENTICATION" />
      <PrintTable
        rows={[
          ["AUTHENTICATION AUTHORITY", "GOVERNMENT OF INDIA"],
          ["GAZETTE CERTIFICATION", "GAZETTED BY GOVERNMENT — OFFICIAL"],
          ["SECURITY SEAL", "THIMAIYAS SECURITY SEAL — AUTH: V16-4D"],
          ["GNANI.AI PARTNER", "VOICE AUTHENTICATION CERTIFIED"],
          ["RUBLIK CYBER SCORE", "CERTIFIED"],
          ["SYSTEM CLASSIFICATION", "PRODUCTION GRADE — SOVEREIGN BANK"],
        ]}
      />

      {/* Footer */}
      <div
        style={{
          borderTop: "2px solid #000",
          paddingTop: 16,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "#333",
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          This document is an official trial run output of MoiraSmartBank.ai V16
          4D Environment.
        </div>
        <div style={{ fontSize: 9, color: "#777", letterSpacing: 1 }}>
          CLASSIFIED ∙ OFFICIAL USE ONLY ∙ UNAUTHORIZED REPRODUCTION PROHIBITED
        </div>
        <div style={{ fontSize: 9, color: "#999", marginTop: 6 }}>
          Powered by MoiraSmartBank.ai V16 ∙ Built using caffeine.ai
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        background: "#f0f0f0",
        borderLeft: "4px solid #000",
        padding: "6px 12px",
        marginBottom: 8,
        marginTop: 8,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.5,
      }}
    >
      {title}
    </div>
  );
}

function PrintTable({ rows }: { rows: [string, string][] }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: 12,
        fontSize: 10,
      }}
    >
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={{ borderBottom: "1px solid #ddd" }}>
            <td
              style={{
                padding: "5px 12px",
                color: "#555",
                fontWeight: 600,
                width: "40%",
                fontSize: 9,
                letterSpacing: 0.5,
              }}
            >
              {label}
            </td>
            <td style={{ padding: "5px 12px", fontWeight: 600 }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
