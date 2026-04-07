import { Progress } from "@/components/ui/progress";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoiraCodePanel } from "./MoiraCode";
import {
  PrintableV16Form,
  VoicePrintPanel,
  VoiceRecorderPanel,
} from "./VoiceFeatures";
import type { VoicePrintData } from "./VoiceFeatures";

// Precomputed static arrays for SVG keys
const SEAL_OUTER_TICKS = Array.from({ length: 36 }, (_, i) => i * 10);
const SEAL_INNER_RECTS = Array.from({ length: 24 }, (_, i) => i * 15);
const VAULT_OUTER_TICKS = Array.from({ length: 60 }, (_, i) => ({
  angle: i * 6,
  major: i % 5 === 0,
}));
const VAULT_INNER_RECTS = Array.from({ length: 8 }, (_, i) => i * 45);
const WAVEFORM_BARS = Array.from({ length: 11 }, (_, i) => i);

// ===== Speech Recognition Types =====
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ===== Types =====
type ScanState = "idle" | "scanning" | "lockout";
type ThreatEntry = {
  id: number;
  time: string;
  type: string;
  status: "BLOCKED" | "NEUTRALIZED";
  source: string;
};
type TabId =
  | "command"
  | "threat"
  | "operations"
  | "vault"
  | "compliance"
  | "admin"
  | "moira-lab"
  | "moira-library"
  | "moira-brain"
  | "moiracode"
  | "roc-india";

// ===== Constants =====
const THREAT_TYPES = [
  "PHISHING VECTOR DETECTED",
  "SQL INJECTION ATTEMPT",
  "CREDENTIAL STUFFING ATTACK",
  "MAN-IN-THE-MIDDLE INTERCEPT",
  "DEEPFAKE TRANSACTION PROBE",
  "ZERO-DAY EXPLOIT ATTEMPT",
  "MONEY MULE NETWORK NODE",
  "SYNTHETIC IDENTITY FRAUD",
  "AML PATTERN MATCH",
  "UPI SPOOFING DETECTED",
  "GHOST ACCOUNT ACTIVATION",
  "CROSS-BORDER FRAUD SIGNAL",
];

const THREAT_SOURCES = [
  "IP: 185.220.101.47",
  "IP: 193.56.29.215",
  "IP: 91.108.4.0",
  "TOR NODE EXIT",
  "PROXY: AS44477",
  "DARKNET: onion://fraud-hub",
  "IP: 45.142.212.100",
  "BOTNET: C2-RU-7",
];

const SIMULATED_COMMANDS = [
  "K9 SNIFF",
  "STATUS CHECK",
  "LOCK",
  "THREAT SCAN",
  "STATUS",
  "K9 SNIFF",
  "VERIFY VAULT",
  "LOCK",
];

const TICKER_TEXT =
  "⬡ ROC INDIA REGISTERED ENTITY ∙ MOIRASMARTBANK FINTECH LOGIC & LOGISTICS LTD ∙ CIN: U74999TN2024PTC000000 ∙ MCA21 COMPLIANT ∙ MINISTRY OF CORPORATE AFFAIRS — GOVT. OF INDIA ∙ ⬡ MOIRA IS INFINITE ∙ BANKING IN V18 ∙ GLOBAL INFRA BASELINE: 99.97% ∙ 432.7 MHz NEURAL JAMMING: ACTIVE FIELD ∙ 0.01% M.SIM THRESHOLD — ELEPHANT MEMORY INSTANT ABSOLUTION ∙ 0.961 NEURAL INDEX — KIMI × SASVA 4.0 — MODEL POISON SHIELD ACTIVE ∙ ONE-CLICK RBI→US REGULATORY SYNC ∙ DPDP ACT 2023 COMPLIANT ∙ UN CYBERSECURITY FRAMEWORK CERTIFIED ∙ NATIONAL ESSENTIAL SERVICE ∙ RBI AUTHORIZED BANKING SYSTEM ∙ SOVEREIGN BANKING PROTECTION ACTIVE ∙ THIMAIYAS SECURITY PROTOCOL ENGAGED ∙ TOUCH ME NOT WORLD — ZERO TOLERANCE FOR FRAUD ∙ BANKING LOGIC IMPREGNATED INTO HARDWARE ∙ M.SIM ELEPHANT MEMORY ACTIVE ∙ K9 AGENTIC SNIFFER ONLINE ∙ GAZETTED BY GOVERNMENT OF INDIA ∙ GNANI.AI VOICE AUTHENTICATED ∙ RUBLIK CYBER SCORE: CERTIFIED ∙ MOIRA CODE PROTOCOL v1.0 ACTIVE ∙ AI THREAT ABSOLUTION ENGINE ONLINE ∙";

const NAV_TABS: { id: TabId; label: string }[] = [
  { id: "command", label: "COMMAND DASHBOARD" },
  { id: "threat", label: "THREAT INTELLIGENCE" },
  { id: "operations", label: "GLOBAL OPERATIONS" },
  { id: "vault", label: "SECURE VAULT" },
  { id: "compliance", label: "COMPLIANCE LOGS" },
  { id: "admin", label: "ADMIN PORTAL" },
  { id: "moira-lab", label: "⚗ MOIRA LAB" },
  { id: "moira-library", label: "📚 MOIRA LIBRARY" },
  { id: "moira-brain", label: "🧠 MOIRA BRAIN" },
  { id: "moiracode", label: "⟨/⟩ MOIRA CODE" },
  { id: "roc-india", label: "🏛 ROC INDIA" },
];

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== Sub-components =====

function HexEmblem({ size = 32 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
    >
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="1.5"
        fill="oklch(0.12 0.03 240)"
      />
      <polygon
        points="16,7 23,11 23,21 16,25 9,21 9,11"
        stroke="oklch(0.82 0.18 200 / 0.4)"
        strokeWidth="1"
        fill="none"
      />
      <circle cx="16" cy="16" r="3" fill="oklch(0.82 0.18 200)" />
      <line
        x1="16"
        y1="7"
        x2="16"
        y2="11"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="1"
      />
      <line
        x1="16"
        y1="21"
        x2="16"
        y2="25"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="1"
      />
      <line
        x1="9"
        y1="11"
        x2="12"
        y2="13"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="1"
      />
      <line
        x1="20"
        y1="13"
        x2="23"
        y2="11"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="1"
      />
    </svg>
  );
}

function GazettedSeal() {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 220, height: 220 }}
    >
      <div
        className="absolute inset-0 rounded-full animate-pulse-glow-gold"
        style={{
          background:
            "radial-gradient(circle, oklch(0.76 0.14 75 / 0.08) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 animate-rotate-slow">
        <svg aria-hidden="true" width="220" height="220" viewBox="0 0 220 220">
          {SEAL_OUTER_TICKS.map((angle) => (
            <line
              key={angle}
              x1="110"
              y1="8"
              x2="110"
              y2="22"
              stroke="oklch(0.76 0.14 75 / 0.7)"
              strokeWidth="2"
              transform={`rotate(${angle} 110 110)`}
            />
          ))}
          <circle
            cx="110"
            cy="110"
            r="100"
            stroke="oklch(0.76 0.14 75 / 0.8)"
            strokeWidth="1.5"
            fill="none"
          />
          <circle
            cx="110"
            cy="110"
            r="94"
            stroke="oklch(0.76 0.14 75 / 0.3)"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      </div>
      <div
        className="absolute animate-rotate-slow-reverse"
        style={{ inset: 12 }}
      >
        <svg aria-hidden="true" width="196" height="196" viewBox="0 0 196 196">
          {SEAL_INNER_RECTS.map((angle) => (
            <rect
              key={angle}
              x="95"
              y="4"
              width="6"
              height="12"
              fill="oklch(0.82 0.18 200 / 0.5)"
              transform={`rotate(${angle} 98 98)`}
            />
          ))}
          <circle
            cx="98"
            cy="98"
            r="88"
            stroke="oklch(0.82 0.18 200 / 0.4)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="4 4"
          />
        </svg>
      </div>
      <div
        className="relative flex flex-col items-center justify-center rounded-full animate-pulse-glow"
        style={{
          width: 160,
          height: 160,
          background:
            "radial-gradient(circle at 40% 35%, oklch(0.18 0.05 235), oklch(0.10 0.025 245))",
          border: "2px solid oklch(0.82 0.18 200 / 0.7)",
          boxShadow: "inset 0 0 30px oklch(0.82 0.18 200 / 0.15)",
        }}
      >
        <div
          className="orbitron font-black text-center leading-none"
          style={{ color: "oklch(0.76 0.14 75)", fontSize: 11 }}
        >
          GOVT. OF INDIA
        </div>
        <div
          className="orbitron font-black text-center mt-1"
          style={{
            color: "oklch(0.82 0.18 200)",
            fontSize: 16,
            lineHeight: 1.1,
          }}
        >
          GAZETTED
        </div>
        <div
          className="orbitron font-bold text-center"
          style={{ color: "oklch(0.82 0.18 200 / 0.8)", fontSize: 10 }}
        >
          BY GOVERNMENT
        </div>
        <div
          className="my-1"
          style={{ color: "oklch(0.76 0.14 75)", fontSize: 20 }}
        >
          ★
        </div>
        <div
          className="orbitron font-bold text-center"
          style={{ color: "oklch(0.76 0.14 75)", fontSize: 8 }}
        >
          THIMAIYAS SEAL
        </div>
        <div
          style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
          className="orbitron text-center mt-0.5"
        >
          AUTH: V17-4D
        </div>
      </div>
    </div>
  );
}

function K9NetworkSVG({ scanning }: { scanning: boolean }) {
  const nodes = [
    { cx: 80, cy: 40 },
    { cx: 150, cy: 30 },
    { cx: 200, cy: 80 },
    { cx: 170, cy: 140 },
    { cx: 110, cy: 160 },
    { cx: 50, cy: 120 },
    { cx: 30, cy: 60 },
    { cx: 120, cy: 95 },
    { cx: 90, cy: 160 },
    { cx: 220, cy: 120 },
    { cx: 60, cy: 170 },
    { cx: 190, cy: 50 },
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 0],
    [7, 0],
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [8, 4],
    [8, 5],
    [9, 2],
    [9, 3],
    [10, 5],
    [10, 8],
    [11, 1],
    [11, 2],
  ];
  return (
    <svg
      aria-hidden="true"
      width="250"
      height="200"
      viewBox="0 0 250 200"
      className="w-full"
      style={{ maxHeight: 140 }}
    >
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={nodes[a].cx}
          y1={nodes[a].cy}
          x2={nodes[b].cx}
          y2={nodes[b].cy}
          stroke="oklch(0.82 0.18 200 / 0.3)"
          strokeWidth="0.8"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={`node-${n.cx}-${n.cy}`}
          cx={n.cx}
          cy={n.cy}
          r={i === 7 ? 6 : 3}
          fill={i === 7 ? "oklch(0.82 0.18 200)" : "oklch(0.82 0.18 200 / 0.6)"}
          style={
            scanning
              ? {
                  animation: `node-pulse ${0.8 + (i % 4) * 0.3}s ease-in-out ${i * 0.1}s infinite`,
                }
              : {}
          }
        />
      ))}
      {scanning && (
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="200"
          stroke="oklch(0.82 0.18 200 / 0.6)"
          strokeWidth="2"
          style={{
            animation: "scan-sweep 2s linear infinite",
            transformOrigin: "125px 100px",
          }}
        />
      )}
    </svg>
  );
}

function VaultHUD() {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 180, height: 180 }}
    >
      <div className="absolute inset-0 animate-rotate-slow">
        <svg aria-hidden="true" width="180" height="180" viewBox="0 0 180 180">
          {VAULT_OUTER_TICKS.map(({ angle, major }) => (
            <line
              key={angle}
              x1="90"
              y1="6"
              x2="90"
              y2={major ? 18 : 12}
              stroke={
                major ? "oklch(0.82 0.18 200)" : "oklch(0.82 0.18 200 / 0.4)"
              }
              strokeWidth={major ? 1.5 : 0.8}
              transform={`rotate(${angle} 90 90)`}
            />
          ))}
          <circle
            cx="90"
            cy="90"
            r="82"
            stroke="oklch(0.82 0.18 200 / 0.6)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
      <div
        className="absolute animate-rotate-slow-reverse"
        style={{ inset: 16 }}
      >
        <svg aria-hidden="true" width="148" height="148" viewBox="0 0 148 148">
          <circle
            cx="74"
            cy="74"
            r="68"
            stroke="oklch(0.58 0.22 250 / 0.5)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="6 3"
          />
          {VAULT_INNER_RECTS.map((angle) => (
            <rect
              key={angle}
              x="71"
              y="8"
              width="6"
              height="10"
              fill="oklch(0.58 0.22 250 / 0.6)"
              transform={`rotate(${angle} 74 74)`}
            />
          ))}
        </svg>
      </div>
      <div className="absolute animate-rotate-medium" style={{ inset: 30 }}>
        <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="oklch(0.76 0.14 75 / 0.4)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="3 6"
          />
        </svg>
      </div>
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 70,
          height: 70,
          background:
            "radial-gradient(circle, oklch(0.16 0.04 235), oklch(0.10 0.025 245))",
          border: "2px solid oklch(0.82 0.18 200 / 0.5)",
          boxShadow:
            "0 0 15px oklch(0.82 0.18 200 / 0.3), inset 0 0 10px oklch(0.82 0.18 200 / 0.1)",
        }}
      >
        <svg
          aria-hidden="true"
          width="28"
          height="32"
          viewBox="0 0 28 32"
          fill="none"
        >
          <rect
            x="3"
            y="14"
            width="22"
            height="16"
            rx="3"
            fill="oklch(0.82 0.18 200 / 0.2)"
            stroke="oklch(0.82 0.18 200)"
            strokeWidth="1.5"
          />
          <path
            d="M8 14V10a6 6 0 0 1 12 0v4"
            stroke="oklch(0.82 0.18 200)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="14" cy="22" r="3" fill="oklch(0.82 0.18 200)" />
          <line
            x1="14"
            y1="25"
            x2="14"
            y2="28"
            stroke="oklch(0.82 0.18 200)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 hud-grid-bg" />
      <div
        className="absolute"
        style={{
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, oklch(0.82 0.18 200 / 0.04) 0%, transparent 70%)",
        }}
      />
      <svg
        className="absolute"
        style={{
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 700,
          opacity: 0.06,
        }}
        aria-hidden="true"
        viewBox="0 0 700 700"
      >
        {[80, 150, 220, 290, 340].map((r) => (
          <circle
            key={r}
            cx="350"
            cy="350"
            r={r}
            stroke="oklch(0.82 0.18 200)"
            strokeWidth="0.8"
            fill="none"
          />
        ))}
        <g
          style={{
            transformOrigin: "350px 350px",
            animation: "radar-arc 4s linear infinite",
          }}
        >
          <path
            d="M350 350 L350 10"
            stroke="oklch(0.82 0.18 200)"
            strokeWidth="1"
            opacity="0.6"
          />
          <path
            d="M350 350 L350 10 A340 340 0 0 1 420 40 Z"
            fill="oklch(0.82 0.18 200 / 0.08)"
          />
        </g>
      </svg>
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "30%",
          background:
            "linear-gradient(to bottom, transparent, oklch(0.09 0.025 245 / 0.8))",
        }}
      />
    </div>
  );
}

// ===== Gnani Voice Panel =====
function GnaniVoicePanel({
  startScan,
  onVoiceActiveChange,
}: {
  startScan: () => void;
  onVoiceActiveChange: (active: boolean) => void;
}) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState("SAY: K9 SNIFF / STATUS / LOCK");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simIndexRef = useRef(0);

  const handleCommand = useCallback(
    (cmd: string) => {
      const upper = cmd.toUpperCase();
      if (upper.includes("K9") || upper.includes("SNIFF")) {
        setTranscript("🐕 K9 SNIFF — INITIATING SCAN ✓GNANI-AUTH");
        startScan();
      } else if (upper.includes("STATUS")) {
        setTranscript("📊 STATUS — SYSTEMS NOMINAL ✓GNANI-AUTH");
      } else if (upper.includes("LOCK")) {
        setTranscript("🔒 LOCK — VAULT SECURED ✓GNANI-AUTH");
      } else {
        setTranscript(`▶ ${cmd.slice(0, 22)} ✓GNANI-AUTH`);
      }
    },
    [startScan],
  );

  const toggleVoice = useCallback(() => {
    const next = !voiceActive;
    setVoiceActive(next);
    onVoiceActiveChange(next);

    if (!next) {
      // Stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      setTranscript("SAY: K9 SNIFF / STATUS / LOCK");
      return;
    }

    // Start
    const SpeechAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechAPI) {
      try {
        const rec = new SpeechAPI();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-IN";
        rec.onresult = (event: SpeechRecognitionEvent) => {
          const last = event.results[event.results.length - 1];
          if (last.isFinal) handleCommand(last[0].transcript);
        };
        rec.onend = () => {
          if (voiceActive && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (_) {
              /* ignore */
            }
          }
        };
        rec.onerror = () => {
          // Fallback to simulation
          startSimulation();
        };
        rec.start();
        recognitionRef.current = rec;
      } catch (_) {
        startSimulation();
      }
    } else {
      startSimulation();
    }

    function startSimulation() {
      simTimerRef.current = setInterval(() => {
        const cmd =
          SIMULATED_COMMANDS[simIndexRef.current % SIMULATED_COMMANDS.length];
        simIndexRef.current += 1;
        handleCommand(cmd);
      }, 4000);
    }
  }, [voiceActive, onVoiceActiveChange, handleCommand]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  return (
    <div
      className="hud-panel rounded flex flex-col shrink-0 overflow-hidden"
      style={{ height: 192 }}
      data-ocid="gnani.panel"
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: voiceActive
              ? "oklch(0.82 0.18 200)"
              : "oklch(0.45 0.04 230)",
            boxShadow: voiceActive ? "0 0 6px oklch(0.82 0.18 200)" : "none",
            animation: voiceActive ? "blink 1s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="orbitron font-bold flex-1"
          style={{
            color: "oklch(0.82 0.18 200)",
            fontSize: 9,
            letterSpacing: 1,
          }}
        >
          GNANI.AI VOICE ENGINE
        </div>
        {voiceActive && (
          <div
            className="orbitron font-black px-1.5 py-0.5 rounded"
            style={{
              fontSize: 7,
              background: "oklch(0.65 0.18 145 / 0.2)",
              border: "1px solid oklch(0.65 0.18 145 / 0.6)",
              color: "oklch(0.65 0.18 145)",
              letterSpacing: 1,
            }}
          >
            ● LIVE
          </div>
        )}
        {voiceActive && (
          <div
            className="orbitron font-black px-1.5 py-0.5 rounded"
            style={{
              fontSize: 7,
              background: "oklch(0.15 0.05 75 / 0.3)",
              border: "1px solid oklch(0.76 0.14 75 / 0.7)",
              color: "oklch(0.76 0.14 75)",
              letterSpacing: 0.5,
            }}
          >
            GNANI-AUTH✓
          </div>
        )}
        <div
          className="orbitron font-bold"
          style={{
            fontSize: 7,
            color: "oklch(0.82 0.18 200)",
            letterSpacing: 0.5,
          }}
        >
          GNANI.AI
        </div>
      </div>

      <div className="flex flex-1 gap-2 p-2 overflow-hidden">
        {/* Mic button col */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          {/* Mic circle */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 52, height: 52 }}
          >
            {voiceActive && (
              <>
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 52,
                    height: 52,
                    border: "2px solid oklch(0.82 0.18 200 / 0.6)",
                    animation: "ring-pulse 1.2s ease-out infinite",
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 52,
                    height: 52,
                    border: "2px solid oklch(0.82 0.18 200 / 0.4)",
                    animation: "ring-pulse 1.2s ease-out 0.4s infinite",
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 52,
                    height: 52,
                    border: "2px solid oklch(0.82 0.18 200 / 0.2)",
                    animation: "ring-pulse 1.2s ease-out 0.8s infinite",
                  }}
                />
              </>
            )}
            <button
              type="button"
              data-ocid="gnani.toggle"
              onClick={toggleVoice}
              className="relative rounded-full flex items-center justify-center transition-all"
              style={{
                width: 44,
                height: 44,
                background: voiceActive
                  ? "radial-gradient(circle, oklch(0.25 0.08 200), oklch(0.15 0.05 220))"
                  : "radial-gradient(circle, oklch(0.18 0.04 240), oklch(0.12 0.03 245))",
                border: `2px solid ${voiceActive ? "oklch(0.82 0.18 200)" : "oklch(0.35 0.05 230)"}`,
                boxShadow: voiceActive
                  ? "0 0 12px oklch(0.82 0.18 200 / 0.5)"
                  : "none",
                cursor: "pointer",
              }}
            >
              {/* Mic SVG */}
              <svg
                aria-hidden="true"
                width="18"
                height="20"
                viewBox="0 0 18 20"
                fill="none"
              >
                <rect
                  x="5"
                  y="1"
                  width="8"
                  height="11"
                  rx="4"
                  fill={
                    voiceActive
                      ? "oklch(0.82 0.18 200)"
                      : "oklch(0.45 0.04 230)"
                  }
                />
                <path
                  d="M2 9a7 7 0 0 0 14 0"
                  stroke={
                    voiceActive
                      ? "oklch(0.82 0.18 200)"
                      : "oklch(0.45 0.04 230)"
                  }
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
                <line
                  x1="9"
                  y1="16"
                  x2="9"
                  y2="19"
                  stroke={
                    voiceActive
                      ? "oklch(0.82 0.18 200)"
                      : "oklch(0.45 0.04 230)"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="6"
                  y1="19"
                  x2="12"
                  y2="19"
                  stroke={
                    voiceActive
                      ? "oklch(0.82 0.18 200)"
                      : "oklch(0.45 0.04 230)"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Waveform bars */}
          <div className="flex items-center gap-0.5" style={{ height: 24 }}>
            {WAVEFORM_BARS.map((i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: 20,
                  background: voiceActive
                    ? "oklch(0.82 0.18 200)"
                    : "oklch(0.35 0.05 230)",
                  borderRadius: 2,
                  transformOrigin: "center bottom",
                  animation: voiceActive
                    ? `waveform-bar ${0.5 + (i % 5) * 0.15}s ease-in-out ${i * 0.07}s infinite`
                    : "none",
                  transform: voiceActive
                    ? "scaleY(1)"
                    : `scaleY(${0.15 + (i % 3) * 0.08})`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Transcript col */}
        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
          <div
            className="flex-1 rounded p-1.5 flex items-center"
            style={{
              background: "oklch(0.09 0.025 245 / 0.8)",
              border: "1px solid oklch(0.22 0.04 235)",
              minHeight: 0,
            }}
          >
            <div
              className="orbitron"
              style={{
                color: voiceActive
                  ? "oklch(0.82 0.18 200)"
                  : "oklch(0.45 0.04 230)",
                fontSize: 8,
                letterSpacing: 0.5,
                lineHeight: 1.4,
              }}
            >
              {transcript}
            </div>
          </div>
          <div
            className="orbitron"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            {voiceActive ? "⬤ LISTENING FOR COMMANDS" : "TAP MIC TO ACTIVATE"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Rublik Cyber Score Panel =====
function RublikScorePanel() {
  const [score, setScore] = useState(87);
  const [gaugeWidth, setGaugeWidth] = useState(13);
  const [breachProb, setBreachProb] = useState(3.2);

  useEffect(() => {
    const t = setInterval(() => {
      setScore((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = Math.max(80, Math.min(95, prev + delta));
        return next;
      });
      setGaugeWidth((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(8, Math.min(20, prev + delta));
      });
      setBreachProb((prev) =>
        Number.parseFloat(
          Math.max(
            0.5,
            Math.min(15, prev + (Math.random() - 0.6) * 0.8),
          ).toFixed(1),
        ),
      );
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const scoreColor =
    score >= 80
      ? "oklch(0.65 0.18 145)"
      : score >= 60
        ? "oklch(0.76 0.14 75)"
        : "oklch(0.62 0.25 25)";

  return (
    <div
      className="hud-panel rounded flex flex-col shrink-0 overflow-hidden"
      style={{ height: 176 }}
      data-ocid="rublik.panel"
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
      >
        {/* Shield icon */}
        <svg
          aria-hidden="true"
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
        >
          <path
            d="M6 1L1 3v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V3L6 1z"
            fill="oklch(0.76 0.14 75 / 0.2)"
            stroke="oklch(0.76 0.14 75)"
            strokeWidth="1"
          />
          <path
            d="M4 7l1.5 1.5L8 5"
            stroke="oklch(0.65 0.18 145)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex flex-col flex-1">
          <div
            className="orbitron font-bold"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            RUBLIK CYBER SCORE
          </div>
          <div
            className="orbitron"
            style={{
              color: "oklch(0.76 0.14 75 / 0.6)",
              fontSize: 6,
              letterSpacing: 0.5,
            }}
          >
            RISK SHIELD
          </div>
        </div>
        <div
          className="orbitron font-bold"
          style={{
            fontSize: 7,
            color: "oklch(0.76 0.14 75)",
            letterSpacing: 0.5,
          }}
        >
          RUBLIK
        </div>
      </div>

      <div className="flex gap-2 p-2 flex-1 overflow-hidden">
        {/* Score display */}
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{ width: 56 }}
        >
          <div
            className="orbitron font-black"
            style={{
              color: scoreColor,
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: -1,
              transition: "color 0.5s",
            }}
          >
            {score}
          </div>
          <div
            className="orbitron"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7, marginTop: 2 }}
          >
            / 100
          </div>
          {/* Breach probability */}
          <div
            className="orbitron font-bold mt-1 text-center"
            style={{
              color: "oklch(0.65 0.18 145)",
              fontSize: 7,
              letterSpacing: 0.5,
            }}
          >
            {breachProb < 5 ? "LOW" : breachProb < 10 ? "MED" : "HIGH"}{" "}
            {breachProb}%
          </div>
          <div
            className="orbitron"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 6 }}
          >
            BREACH PROB.
          </div>
        </div>

        {/* Right col */}
        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
          {/* Gauge */}
          <div>
            <div
              className="orbitron"
              style={{
                color: "oklch(0.45 0.04 230)",
                fontSize: 7,
                marginBottom: 3,
              }}
            >
              THREAT SEVERITY
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{
                height: 6,
                background: "oklch(0.16 0.04 240)",
                border: "1px solid oklch(0.22 0.04 235)",
              }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${gaugeWidth}%`,
                  background:
                    "linear-gradient(90deg, oklch(0.65 0.18 145), oklch(0.76 0.14 75))",
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>

          {/* Status rows */}
          {(
            [
              {
                label: "INTRUSION DETECT",
                value: "ACTIVE",
                color: "oklch(0.65 0.18 145)",
              },
              {
                label: "ZERO-TRUST",
                value: "ENABLED",
                color: "oklch(0.82 0.18 200)",
              },
              {
                label: "CERT STATUS",
                value: "VALID",
                color: "oklch(0.65 0.18 145)",
              },
            ] as const
          ).map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span
                className="orbitron"
                style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
              >
                {row.label}:
              </span>
              <span
                className="orbitron font-bold"
                style={{ color: row.color, fontSize: 7 }}
              >
                {row.value}
              </span>
            </div>
          ))}

          {/* Rublik certified badge */}
          <div
            className="orbitron font-black text-center rounded py-0.5 mt-auto"
            style={{
              fontSize: 7,
              background: "oklch(0.15 0.05 75 / 0.2)",
              border: "1px solid oklch(0.76 0.14 75 / 0.5)",
              color: "oklch(0.76 0.14 75)",
              letterSpacing: 1,
            }}
          >
            🛡 RUBLIK CERTIFIED
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Main App =====

// ===== RBI Report Modal =====
interface RBIReportModalProps {
  onClose: () => void;
  scanState: "idle" | "scanning" | "lockout";
  memoryCounter: number;
  voicePrint: import("./VoiceFeatures").VoicePrintData | null;
}

function RBIReportModal({
  onClose,
  scanState,
  memoryCounter,
  voicePrint,
}: RBIReportModalProps) {
  const now = new Date();
  const refNo = `RBI/FRAUD/${now.getFullYear()}/${Date.now()}`;
  const reportDate = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const reportPeriod = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="rbi-report-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "oklch(0.04 0.02 245 / 0.97)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0 40px",
      }}
    >
      {/* Screen-only controls */}
      <div
        className="no-print flex gap-3 mb-4 sticky top-4 z-10"
        style={{ alignSelf: "flex-end", marginRight: 32 }}
      >
        <button
          type="button"
          data-ocid="rbi_report.primary_button"
          onClick={handlePrint}
          className="orbitron font-black px-3 py-1 rounded"
          style={{
            fontSize: 10,
            background:
              "linear-gradient(135deg, oklch(0.18 0.06 145), oklch(0.12 0.04 145))",
            border: "1px solid oklch(0.65 0.18 145 / 0.8)",
            color: "oklch(0.80 0.18 145)",
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          🖨 PRINT REPORT
        </button>
        <button
          type="button"
          data-ocid="rbi_report.close_button"
          onClick={onClose}
          className="orbitron font-black px-3 py-1 rounded"
          style={{
            fontSize: 10,
            background:
              "linear-gradient(135deg, oklch(0.18 0.06 25), oklch(0.12 0.04 25))",
            border: "1px solid oklch(0.62 0.20 25 / 0.8)",
            color: "oklch(0.78 0.18 25)",
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      {/* A4 Document */}
      <div
        className="rbi-report-modal"
        style={{
          width: 794,
          minHeight: 1123,
          background: "#fff",
          color: "#111",
          fontFamily: "Georgia, serif",
          padding: "60px 70px",
          boxShadow: "0 0 40px oklch(0 0 0 / 0.6)",
          position: "relative",
        }}
      >
        {/* COVER PAGE */}
        <div
          style={{
            textAlign: "center",
            paddingBottom: 40,
            borderBottom: "3px double #222",
            marginBottom: 32,
          }}
        >
          {/* RBI Logo text */}
          <div
            style={{
              fontSize: 11,
              letterSpacing: 3,
              fontFamily: "Arial, sans-serif",
              color: "#555",
              marginBottom: 6,
            }}
          >
            GOVERNMENT OF INDIA
          </div>
          <div
            style={{
              display: "inline-block",
              border: "3px solid #8B0000",
              borderRadius: "50%",
              width: 80,
              height: 80,
              lineHeight: "80px",
              fontSize: 28,
              color: "#8B0000",
              fontFamily: "serif",
              marginBottom: 12,
              fontWeight: "bold",
            }}
          >
            ₹
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: "bold",
              letterSpacing: 2,
              color: "#8B0000",
              fontFamily: "Arial, sans-serif",
            }}
          >
            RESERVE BANK OF INDIA
          </div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1,
              color: "#555",
              fontFamily: "Arial, sans-serif",
              marginBottom: 20,
            }}
          >
            STATUTORY REPORTING FORMAT — FRAUD &amp; CYBERSECURITY INCIDENT
            REPORT
          </div>
          <div
            style={{
              borderTop: "1px solid #aaa",
              borderBottom: "1px solid #aaa",
              padding: "12px 0",
              margin: "16px 0",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 4 }}>
              MoiraSmartBank.ai
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>
              National Essential Service · Gazetted Banking Institution
            </div>
          </div>
          <table
            style={{
              width: "100%",
              fontSize: 11,
              fontFamily: "Arial, sans-serif",
              borderCollapse: "collapse",
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#555",
                    textAlign: "right",
                    width: "50%",
                  }}
                >
                  Report Type:
                </td>
                <td style={{ padding: "4px 8px", fontWeight: "bold" }}>
                  Fraud &amp; Cybersecurity Incident Report
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#555",
                    textAlign: "right",
                  }}
                >
                  Reporting Period:
                </td>
                <td style={{ padding: "4px 8px", fontWeight: "bold" }}>
                  {reportPeriod}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#555",
                    textAlign: "right",
                  }}
                >
                  Report Date:
                </td>
                <td style={{ padding: "4px 8px", fontWeight: "bold" }}>
                  {reportDate}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#555",
                    textAlign: "right",
                  }}
                >
                  Submitted By:
                </td>
                <td style={{ padding: "4px 8px", fontWeight: "bold" }}>
                  THIMAIYAS Security Operations
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "#555",
                    textAlign: "right",
                  }}
                >
                  Reference No:
                </td>
                <td
                  style={{
                    padding: "4px 8px",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    fontSize: 10,
                  }}
                >
                  {refNo}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            style={{
              marginTop: 20,
              display: "inline-block",
              border: "2px solid #8B0000",
              padding: "8px 20px",
              fontSize: 10,
              letterSpacing: 2,
              color: "#8B0000",
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
            }}
          >
            ✦ GAZETTED BY GOVERNMENT OF INDIA ✦
          </div>
        </div>

        {/* SECTION 1 — Bank Identification */}
        <SectionHeader num="1" title="BANK IDENTIFICATION" />
        <ReportTable
          rows={[
            ["Bank Name", "MoiraSmartBank.ai"],
            [
              "Designation",
              "National Essential Service — Scheduled Commercial Bank",
            ],
            ["Bank License No.", "MSB/RBI/SCB/2024/0042"],
            ["RBI Registration No.", "RBI/REG/2024/MSB/1187"],
            ["SWIFT Code", "MOIRASINBB"],
            ["BSR Code", "0042187"],
            ["Head Office", "New Delhi — National Capital Territory, India"],
            [
              "Contact: Security Ops",
              "security@moirasmartbank.ai | +91-11-4200-0000",
            ],
            [
              "Contact: Compliance",
              "compliance@moirasmartbank.ai | +91-11-4200-0001",
            ],
          ]}
        />

        <PageBreak />

        {/* SECTION 2 — Fraud Detection Summary */}
        <SectionHeader
          num="2"
          title="FRAUD DETECTION SUMMARY — K9 AGENTIC SNIFF"
        />
        <div
          style={{
            fontSize: 10,
            fontFamily: "Arial, sans-serif",
            color: "#555",
            marginBottom: 8,
          }}
        >
          Powered by K9 AGENTIC SNIFF™ — RBI Fraud Library Reference Integration
          (Circular RBI/2023-24/65)
        </div>
        <ReportTable
          rows={[
            [
              "Total Transactions Scanned (Period)",
              memoryCounter.toLocaleString("en-IN"),
            ],
            [
              "Fraudulent Transactions Detected",
              scanState === "lockout"
                ? "⚠ THREAT DETECTED — ESCALATED"
                : "2 (Blocked & Contained)",
            ],
            [
              "Transactions Cleared",
              scanState === "lockout"
                ? "N/A — Lockout Active"
                : `${(memoryCounter - 2).toLocaleString("en-IN")}`,
            ],
            ["Amount at Risk (INR)", "₹ 4,72,000 (Contained)"],
            [
              "K9 Scan Status",
              scanState === "lockout"
                ? "🔴 LOCKOUT — THREAT ACTIVE"
                : "🟢 CLEAR — NO ACTIVE THREATS",
            ],
            ["Last Scan Timestamp", now.toISOString()],
            ["RBI Fraud Library Version", "FLv2024.Q4.3"],
            ["Pattern Match Rate", "99.7%"],
            ["False Positive Rate", "0.03%"],
          ]}
        />

        <PageBreak />

        {/* SECTION 3 — Cybersecurity Incident Report */}
        <SectionHeader
          num="3"
          title="CYBERSECURITY INCIDENT REPORT — RUBLIK SCORE"
        />
        <div
          style={{
            fontSize: 10,
            fontFamily: "Arial, sans-serif",
            color: "#555",
            marginBottom: 8,
          }}
        >
          Rublik™ Real-Time Cyber Scoring Engine — Continuous Monitoring per RBI
          IT Master Direction 2023
        </div>
        <ReportTable
          rows={[
            ["Current Rublik Cyber Score", "87/100 (HIGH RESILIENCE)"],
            ["Score Classification", "🟢 SECURE"],
            ["Total Cyber Incidents Logged (Period)", "3"],
            ["Critical Incidents", "0"],
            ["High Severity Incidents", "1 (Resolved)"],
            ["Medium Severity Incidents", "2 (Contained)"],
            ["Threat Level Classification", "ELEVATED — MONITORED"],
            [
              "Mitigation: Intrusion Attempt",
              "Blocked via K9 SNIFF — IP Range Blacklisted",
            ],
            [
              "Mitigation: Deepfake Probe",
              "TOUCH ME NOT™ Lockout Activated — Escalated to CERT-In",
            ],
            [
              "Mitigation: TOR Node Exit",
              "Traffic Rejected — Zero Trust Policy Enforced",
            ],
            [
              "CERT-In Incident Reporting",
              "FILED — Ref: CERT-IN/2026/MSB/0031",
            ],
          ]}
        />

        <PageBreak />

        {/* SECTION 4 — Compliance Status */}
        <SectionHeader num="4" title="REGULATORY COMPLIANCE STATUS" />
        <ReportTable
          rows={[
            [
              "DPDP Act 2023 (Digital Personal Data Protection)",
              "✓ FULLY COMPLIANT",
            ],
            ["UN Cybersecurity Framework v2.0", "✓ FULLY COMPLIANT"],
            [
              "RBI Master Direction on IT Framework (2023)",
              "✓ FULLY COMPLIANT",
            ],
            [
              "RBI Cyber Security Framework for Banks (2016)",
              "✓ FULLY COMPLIANT",
            ],
            [
              "ISO/IEC 27001:2022 — Information Security",
              "✓ CERTIFIED COMPLIANT",
            ],
            ["PCI-DSS v4.0 — Payment Card Security", "✓ FULLY COMPLIANT"],
            [
              "SEBI Cybersecurity Circular (2023)",
              "✓ APPLICABLE &amp; COMPLIANT",
            ],
            ["IT Act 2000 (Amended 2008) — Section 43A", "✓ FULLY COMPLIANT"],
            [
              "RBI Fraud Monitoring Return (FMR) — Circular 65/2023",
              "✓ FILED &amp; COMPLIANT",
            ],
            [
              "Annual Compliance Audit",
              `COMPLETED — ${now.getFullYear()} | Auditor: M/s THIMAIYAS &amp; Associates`,
            ],
          ]}
        />

        <PageBreak />

        {/* SECTION 5 — M.SIM Elephant Memory Vault */}
        <SectionHeader
          num="5"
          title="M.SIM ELEPHANT MEMORY VAULT — AUDIT REPORT"
        />
        <div
          style={{
            fontSize: 10,
            fontFamily: "Arial, sans-serif",
            color: "#555",
            marginBottom: 8,
          }}
        >
          M.SIM™ (Multi-layer Secure Immutable Memory) — Sovereign Data Vault,
          Air-Gapped &amp; Blockchain-Anchored
        </div>
        <ReportTable
          rows={[
            [
              "Total Records Encrypted (Cumulative)",
              memoryCounter.toLocaleString("en-IN"),
            ],
            ["New Records This Period", "3,42,891"],
            ["Vault Integrity Status", "✓ INTACT — SHA-512 Verified"],
            ["Encryption Standard", "AES-256-GCM + RSA-4096 Hybrid"],
            ["Last Vault Audit Date", reportDate],
            ["Blockchain Anchor Hash", "0x7f3a...b2e9 (Immutable)"],
            ["Air-Gap Status", "✓ ACTIVE — Physical Isolation Confirmed"],
            ["Backup Redundancy", "3 Geo-Distributed Copies — Active"],
            [
              "Data Sovereignty",
              "India-Only Storage — Compliant with DPDP Act 2023",
            ],
            [
              "Next Scheduled Audit",
              new Date(
                now.getTime() + 30 * 24 * 60 * 60 * 1000,
              ).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              }),
            ],
          ]}
        />

        <PageBreak />

        {/* SECTION 6 — Voice Audit Trail */}
        <SectionHeader num="6" title="VOICE AUDIT TRAIL — GNANI.AI ENGINE" />
        <div
          style={{
            fontSize: 10,
            fontFamily: "Arial, sans-serif",
            color: "#555",
            marginBottom: 8,
          }}
        >
          Gnani.ai™ Voice Intelligence Platform — Voice Commands, Biometric
          Print &amp; Audit Log
        </div>
        <ReportTable
          rows={[
            ["Gnani.ai Engine Status", "✓ ACTIVE — v3.2.1"],
            ["Voice Commands Logged (Period)", "47"],
            [
              "Voice Print Biometric Verified",
              voicePrint
                ? `✓ VERIFIED — Print ID: VP-${voicePrint.timestamp || now.getTime()}`
                : "— NO VOICE PRINT REGISTERED THIS PERIOD",
            ],
            ["Voice Authentication Events", "12 Successful | 0 Failed"],
            ["K9 SNIFF Voice Trigger Count", "8"],
            ["LOCK Command Invocations", "3"],
            ["STATUS Query Count", "36"],
            ["Voice Anomaly Detections", "0"],
            ["Language Detected", "English (IN) — Confidence: 99.1%"],
            [
              "Voice Data Retention Policy",
              "90 Days — Encrypted — DPDP Act 2023 Compliant",
            ],
          ]}
        />

        <PageBreak />

        {/* SECTION 7 — Declaration */}
        <SectionHeader
          num="7"
          title="OFFICIAL DECLARATION FOR RBI SUBMISSION"
        />
        <div
          style={{
            fontSize: 11,
            fontFamily: "Arial, sans-serif",
            lineHeight: 1.8,
            marginBottom: 24,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            We, the undersigned, on behalf of{" "}
            <strong>MoiraSmartBank.ai (National Essential Service)</strong>,
            hereby solemnly declare that the information furnished in this Fraud
            &amp; Cybersecurity Incident Report for the period of{" "}
            <strong>{reportPeriod}</strong> is true, accurate, and complete to
            the best of our knowledge and belief.
          </p>
          <p style={{ marginBottom: 12 }}>
            This report has been prepared in accordance with the Reserve Bank of
            India's Master Directions on Fraud Risk Management (RBI/2023-24/65),
            the IT Framework for Banks (2023), and the Digital Personal Data
            Protection Act, 2023. All incidents have been investigated,
            mitigated, and reported to the appropriate regulatory and law
            enforcement authorities as required.
          </p>
          <p style={{ marginBottom: 12 }}>
            We confirm that MoiraSmartBank.ai maintains all required
            cybersecurity controls, conducts continuous monitoring via THIMAIYAS
            Security Operations Center, and is fully operational as a gazetted
            National Essential Service.
          </p>
        </div>

        {/* Signature block */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
            marginTop: 40,
          }}
        >
          <div>
            <div
              style={{
                borderTop: "1px solid #222",
                paddingTop: 8,
                fontSize: 11,
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div style={{ fontWeight: "bold" }}>
                Authorized Signatory (Security)
              </div>
              <div style={{ color: "#555", marginTop: 4 }}>
                Chief Information Security Officer
              </div>
              <div style={{ color: "#555" }}>THIMAIYAS Security Operations</div>
              <div style={{ color: "#555", marginTop: 8 }}>
                Date: {reportDate}
              </div>
            </div>
          </div>
          <div>
            <div
              style={{
                borderTop: "1px solid #222",
                paddingTop: 8,
                fontSize: 11,
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div style={{ fontWeight: "bold" }}>
                Authorized Signatory (Compliance)
              </div>
              <div style={{ color: "#555", marginTop: 4 }}>
                Chief Compliance Officer
              </div>
              <div style={{ color: "#555" }}>MoiraSmartBank.ai</div>
              <div style={{ color: "#555", marginTop: 8 }}>
                Date: {reportDate}
              </div>
            </div>
          </div>
        </div>

        {/* Seal area */}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <div
            style={{
              border: "3px solid #8B0000",
              borderRadius: "50%",
              width: 120,
              height: 120,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              color: "#8B0000",
              fontFamily: "Arial, sans-serif",
            }}
          >
            <div
              style={{
                fontSize: 7,
                fontWeight: "bold",
                letterSpacing: 1,
                textAlign: "center",
                padding: "0 10px",
              }}
            >
              ✦ OFFICIAL SEAL ✦<br />
              MOIRASMARTBANK.AI
              <br />
              GAZETTED BY
              <br />
              GOVERNMENT OF INDIA
              <br />✦ {now.getFullYear()} ✦
            </div>
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#888",
              fontFamily: "Arial, sans-serif",
              marginTop: 12,
            }}
          >
            Ref: {refNo} | Generated: {now.toISOString()} | THIMAIYAS Security
            Operations
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ marginBottom: 12, marginTop: 24 }}>
      <div
        style={{
          background: "#8B0000",
          color: "#fff",
          padding: "6px 12px",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          fontSize: 12,
          letterSpacing: 1,
        }}
      >
        SECTION {num}: {title}
      </div>
    </div>
  );
}

function ReportTable({ rows }: { rows: [string, string][] }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: 16,
        fontSize: 10,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <tbody>
        {rows.map(([label, value], i) => (
          <tr
            key={label}
            style={{ background: i % 2 === 0 ? "#f9f9f9" : "#fff" }}
          >
            <td
              style={{
                padding: "5px 10px",
                border: "1px solid #ddd",
                width: "40%",
                color: "#444",
                fontWeight: "600",
              }}
            >
              {label}
            </td>
            <td
              style={{
                padding: "5px 10px",
                border: "1px solid #ddd",
                fontWeight: value.startsWith("✓") ? "bold" : "normal",
                color: value.startsWith("✓")
                  ? "#006400"
                  : value.startsWith("⚠") || value.startsWith("🔴")
                    ? "#8B0000"
                    : "#111",
              }}
            >
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PageBreak() {
  return (
    <div
      style={{
        pageBreakAfter: "always",
        marginTop: 20,
        borderBottom: "1px dashed #ccc",
        paddingBottom: 20,
      }}
    />
  );
}

// ===== Blackbox Widget (V17) =====
type ShardStatus = "SECURE" | "COMPROMISED";
interface Shard {
  id: string;
  label: string;
  status: ShardStatus;
}

function BlackboxWidget() {
  const [shards, setShards] = useState<Shard[]>([
    { id: "IN", label: "INDIA SHARD", status: "SECURE" },
    { id: "US", label: "US SHARD", status: "SECURE" },
    { id: "ESC", label: "ESCROW SHARD", status: "SECURE" },
  ]);
  const securedCount = shards.filter((s) => s.status === "SECURE").length;
  const systemSafe = securedCount >= 2;

  const simulateBreach = () => {
    const idx = Math.floor(Math.random() * 3);
    setShards((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, status: "COMPROMISED" } : s)),
    );
    setTimeout(
      () => setShards((prev) => prev.map((s) => ({ ...s, status: "SECURE" }))),
      6000,
    );
  };

  return (
    <div
      className="hud-panel rounded flex flex-col shrink-0 overflow-hidden"
      style={{ height: 168 }}
      data-ocid="blackbox.panel"
    >
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
      >
        <span style={{ fontSize: 18 }}>🔑</span>
        <div className="flex flex-col flex-1">
          <div
            className="orbitron font-bold"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            THE BLACKBOX
          </div>
          <div
            className="orbitron"
            style={{
              color: "oklch(0.76 0.14 75 / 0.6)",
              fontSize: 6,
              letterSpacing: 0.5,
            }}
          >
            2-OF-3 SHARD CONSENSUS
          </div>
        </div>
        <div
          className="orbitron font-black px-1.5 py-0.5 rounded"
          style={{
            fontSize: 7,
            background: systemSafe
              ? "oklch(0.12 0.05 145 / 0.3)"
              : "oklch(0.15 0.06 25 / 0.3)",
            border: `1px solid ${systemSafe ? "oklch(0.65 0.18 145 / 0.6)" : "oklch(0.62 0.25 25 / 0.7)"}`,
            color: systemSafe ? "oklch(0.65 0.18 145)" : "oklch(0.72 0.25 25)",
          }}
        >
          {systemSafe ? `${securedCount}/3 ✓` : `${securedCount}/3 ⚠`}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between p-2 gap-1 overflow-hidden">
        <div className="space-y-1">
          {shards.map((shard) => (
            <div
              key={shard.id}
              className="flex items-center gap-2 rounded px-2 py-1"
              style={{
                background: "oklch(0.09 0.025 245 / 0.6)",
                border: `1px solid ${shard.status === "SECURE" ? "oklch(0.65 0.18 145 / 0.3)" : "oklch(0.62 0.25 25 / 0.5)"}`,
              }}
            >
              <span style={{ fontSize: 10 }}>🔐</span>
              <span
                className="orbitron flex-1"
                style={{ fontSize: 7, color: "oklch(0.65 0.12 220)" }}
              >
                {shard.label} [{shard.id}]
              </span>
              <span
                className="orbitron font-black px-1.5 py-0.5 rounded"
                style={{
                  fontSize: 7,
                  background:
                    shard.status === "SECURE"
                      ? "oklch(0.12 0.05 145 / 0.3)"
                      : "oklch(0.15 0.06 25 / 0.3)",
                  border: `1px solid ${shard.status === "SECURE" ? "oklch(0.65 0.18 145 / 0.6)" : "oklch(0.62 0.25 25 / 0.7)"}`,
                  color:
                    shard.status === "SECURE"
                      ? "oklch(0.65 0.18 145)"
                      : "oklch(0.72 0.25 25)",
                }}
              >
                {shard.status === "SECURE" ? "✓ SECURE" : "⚠ BREACHED"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div
            className="orbitron font-black"
            style={{
              fontSize: 7,
              letterSpacing: 0.3,
              color: systemSafe
                ? "oklch(0.65 0.18 145)"
                : "oklch(0.72 0.25 25)",
            }}
          >
            {systemSafe
              ? "✓ LEGACY SECURED — SIM-INDEPENDENT"
              : "⚠ CONSENSUS FAILED"}
          </div>
          <button
            type="button"
            onClick={simulateBreach}
            className="orbitron px-1.5 py-0.5 rounded"
            style={{
              fontSize: 6,
              cursor: "pointer",
              background: "oklch(0.12 0.04 25 / 0.3)",
              border: "1px solid oklch(0.62 0.25 25 / 0.5)",
              color: "oklch(0.72 0.25 25)",
            }}
          >
            SIM BREACH
          </button>
        </div>
        <div
          style={{
            borderTop: "1px solid oklch(0.25 0.05 230)",
            paddingTop: 6,
            marginTop: 4,
          }}
        >
          <div
            className="orbitron font-bold text-center"
            style={{
              fontSize: 8,
              color: "oklch(0.65 0.18 145)",
              letterSpacing: 1,
            }}
          >
            ⚡ SASVA LABS: POWERING BLACKBOX —{" "}
            <span style={{ color: "oklch(0.65 0.18 145)" }}>ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== HIAE Acoustic Guard Widget (V17) =====
function HIAEWidget({ onAlert }: { onAlert: (active: boolean) => void }) {
  const [eventActive, setEventActive] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState(0);
  const archiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateKineticEvent = () => {
    if (eventActive) return;
    setEventActive(true);
    onAlert(true);
    setArchiveProgress(0);
    let p = 0;
    archiveTimerRef.current = setInterval(() => {
      p += 100 / 80;
      setArchiveProgress(Math.min(p, 100));
      if (p >= 100) {
        if (archiveTimerRef.current) clearInterval(archiveTimerRef.current);
        setTimeout(() => {
          setEventActive(false);
          onAlert(false);
          setArchiveProgress(0);
        }, 2000);
      }
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (archiveTimerRef.current) clearInterval(archiveTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`rounded flex flex-col shrink-0 overflow-hidden ${eventActive ? "hud-panel-red" : "hud-panel"}`}
      style={{ height: 108 }}
      data-ocid="hiae.panel"
    >
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          borderBottom: `1px solid ${eventActive ? "oklch(0.62 0.25 25 / 0.5)" : "oklch(0.25 0.05 230)"}`,
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: eventActive
              ? "oklch(0.62 0.25 25)"
              : "oklch(0.38 0.04 230)",
            animation: eventActive ? "blink 0.5s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="orbitron font-bold flex-1"
          style={{
            color: eventActive ? "oklch(0.72 0.25 25)" : "oklch(0.50 0.04 230)",
            fontSize: 9,
            letterSpacing: 1,
          }}
        >
          ACOUSTIC GUARD (HIAE)
        </div>
        <div
          className="orbitron font-black px-1.5 py-0.5 rounded"
          style={{
            fontSize: 7,
            background: eventActive
              ? "oklch(0.15 0.06 25 / 0.4)"
              : "oklch(0.11 0.03 240 / 0.4)",
            border: `1px solid ${eventActive ? "oklch(0.62 0.25 25 / 0.8)" : "oklch(0.30 0.04 230 / 0.5)"}`,
            color: eventActive ? "oklch(0.72 0.25 25)" : "oklch(0.40 0.04 230)",
          }}
        >
          {eventActive ? "⚠ KINETIC ALERT" : "◉ DORMANT"}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between p-2">
        {eventActive ? (
          <>
            <div
              className="orbitron font-black text-center"
              style={{
                color: "oklch(0.72 0.25 25)",
                fontSize: 7.5,
                letterSpacing: 0.8,
                animation: "blink 0.8s ease-in-out infinite",
              }}
            >
              ⚡ KINETIC EVENT — EMERGENCY ARCHIVAL TRIGGERED
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span
                  className="orbitron"
                  style={{ color: "oklch(0.72 0.25 25)", fontSize: 7 }}
                >
                  🔑 BLACKBOX ARCHIVAL: IN PROGRESS
                </span>
                <span
                  className="orbitron"
                  style={{ color: "oklch(0.72 0.25 25)", fontSize: 7 }}
                >
                  {Math.round(archiveProgress)}%
                </span>
              </div>
              <div
                className="rounded-full overflow-hidden"
                style={{
                  height: 4,
                  background: "oklch(0.16 0.04 240)",
                  border: "1px solid oklch(0.22 0.04 235)",
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${archiveProgress}%`,
                    background:
                      "linear-gradient(90deg, oklch(0.62 0.25 25), oklch(0.72 0.25 25))",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div
              className="orbitron flex-1"
              style={{
                color: "oklch(0.40 0.04 230)",
                fontSize: 7,
                letterSpacing: 0.3,
              }}
            >
              ◉ DORMANT — NO HIGH-IMPACT ACOUSTIC EVENTS DETECTED
            </div>
            <button
              type="button"
              onClick={simulateKineticEvent}
              className="orbitron font-black px-2 py-1 rounded shrink-0"
              style={{
                fontSize: 7,
                cursor: "pointer",
                letterSpacing: 0.3,
                background: "oklch(0.12 0.04 25 / 0.3)",
                border: "1px solid oklch(0.62 0.25 25 / 0.6)",
                color: "oklch(0.72 0.25 25)",
              }}
            >
              ⚡ SIMULATE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Silent Auth Tracker (RBI) =====
interface SilentAuthEvent {
  id: number;
  time: string;
  method: string;
  status: "VERIFIED" | "ESCALATED";
  ref: string;
}

const SILENT_AUTH_POOL: Omit<SilentAuthEvent, "time" | "id">[] = [
  { method: "VOICE MATCH", status: "VERIFIED", ref: "RBI-MD-PSS-002" },
  { method: "BEHAVIORAL ANALYTICS", status: "VERIFIED", ref: "RBI-DPDP-2023" },
  { method: "DEVICE BINDING", status: "VERIFIED", ref: "RBI-IT-ACT-43A" },
  {
    method: "GEO-LOCATION CHECK",
    status: "VERIFIED",
    ref: "RBI-CIRCULAR-2024",
  },
  { method: "SESSION TOKEN", status: "VERIFIED", ref: "RBI-MD-PSS-007" },
  { method: "BIOMETRIC PULSE", status: "ESCALATED", ref: "RBI-MD-PSS-002" },
];

function SilentAuthTracker() {
  const [events, setEvents] = useState<SilentAuthEvent[]>([]);
  const [confidence, setConfidence] = useState(97.3);
  const authEventIdRef = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 4000 + Math.random() * 4000;
      t = setTimeout(() => {
        const pick =
          SILENT_AUTH_POOL[Math.floor(Math.random() * SILENT_AUTH_POOL.length)];
        const event: SilentAuthEvent = {
          ...pick,
          id: authEventIdRef.current++,
          time: formatTime(new Date()),
        };
        setEvents((prev) => [event, ...prev].slice(0, 20));
        setConfidence((prev) => {
          const delta = event.status === "VERIFIED" ? 0.01 : -0.2;
          return Math.min(
            99.9,
            Math.max(85, Math.round((prev + delta) * 100) / 100),
          );
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="rounded p-2"
      style={{
        background: "oklch(0.08 0.025 245 / 0.9)",
        border: "1px solid oklch(0.65 0.18 145 / 0.35)",
        marginTop: 6,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: "oklch(0.65 0.18 145)",
              boxShadow: "0 0 5px oklch(0.65 0.18 145)",
              animation: "blink 1.5s ease-in-out infinite",
            }}
          />
          <span
            className="orbitron font-bold"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 8,
              letterSpacing: 1,
            }}
          >
            RBI SILENT AUTH TRACKER &#8729; ACTIVE
          </span>
        </div>
        <span
          className="orbitron font-black"
          style={{
            color: "oklch(0.76 0.14 75)",
            fontSize: 9,
            letterSpacing: 1,
          }}
        >
          AUTH CONFIDENCE: {confidence.toFixed(2)}%
        </span>
      </div>
      <div style={{ height: 96, overflowY: "auto", overflowX: "hidden" }}>
        {events.length === 0 ? (
          <div
            className="orbitron"
            style={{
              color: "oklch(0.45 0.04 230)",
              fontSize: 7,
              padding: "4px 0",
            }}
          >
            AWAITING AUTH EVENTS...
          </div>
        ) : (
          events.slice(0, 6).map((ev) => (
            <div
              key={ev.id}
              className="orbitron"
              style={{
                fontSize: 7.5,
                color:
                  ev.status === "VERIFIED"
                    ? "oklch(0.65 0.18 145)"
                    : "oklch(0.76 0.14 75)",
                lineHeight: 1.6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              [{ev.time}] {ev.method} &#9656; {ev.status}{" "}
              <span style={{ color: "oklch(0.45 0.04 230)" }}>[{ev.ref}]</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===== Auto Pilot Widget =====
const AUTOPILOT_ACTIONS = [
  "K9 FRAUD SCAN \u2219 ALL CLEAR",
  "AUTH PULSE CHECK \u2219 VERIFIED",
  "RUBLIK SCORE REFRESH \u2219 87/100",
  "VAULT INTEGRITY CHECK \u2219 99.97%",
  "TRANSACTION MONITOR \u2219 NO ANOMALY",
  "COMPLIANCE CHECK \u2219 DPDP ACT SATISFIED",
];

function AutoPilotWidget() {
  const [engaged, setEngaged] = useState(true);
  const [anomaly, setAnomaly] = useState(false);
  const [autoPilotLog, setAutoPilotLog] = useState<string[]>([]);
  const autoPilotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (engaged) {
      autoPilotTimerRef.current = setInterval(() => {
        const action =
          AUTOPILOT_ACTIONS[
            Math.floor(Math.random() * AUTOPILOT_ACTIONS.length)
          ];
        const entry = `[${formatTime(new Date())}] ${action}`;
        setAutoPilotLog((prev) => [entry, ...prev].slice(0, 8));
        if (Math.random() < 1 / 6) {
          setAnomaly(true);
          setTimeout(() => setAnomaly(false), 10000);
        }
      }, 10000);
    } else {
      if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
      setAnomaly(false);
    }
    return () => {
      if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
    };
  }, [engaged]);

  return (
    <div
      className="hud-panel rounded"
      data-ocid="autopilot.panel"
      style={{
        border: engaged
          ? "1px solid oklch(0.76 0.14 75 / 0.7)"
          : "1px solid oklch(0.22 0.04 235)",
        boxShadow: engaged ? "0 0 12px oklch(0.76 0.14 75 / 0.2)" : "none",
        padding: 8,
        flexShrink: 0,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="orbitron font-bold"
          style={{
            color: "oklch(0.82 0.18 200)",
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          &#128747; AUTO PILOT &#8212; BANKING AUTOMATION
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setEngaged((v) => !v)}
          data-ocid="autopilot.toggle"
          className="orbitron font-bold rounded px-2 py-1"
          style={{
            fontSize: 8,
            background: engaged
              ? "oklch(0.76 0.14 75 / 0.15)"
              : "oklch(0.12 0.03 240)",
            border: engaged
              ? "1px solid oklch(0.76 0.14 75)"
              : "1px solid oklch(0.35 0.06 230)",
            color: engaged ? "oklch(0.76 0.14 75)" : "oklch(0.55 0.05 225)",
            cursor: "pointer",
            boxShadow: engaged ? "0 0 8px oklch(0.76 0.14 75 / 0.4)" : "none",
          }}
        >
          {engaged ? "\u23f9 DISENGAGE" : "\u25b6 ENGAGE AUTO PILOT"}
        </button>
        {engaged && (
          <span
            className="orbitron font-bold"
            style={{
              fontSize: 7.5,
              color: anomaly ? "oklch(0.72 0.25 25)" : "oklch(0.65 0.18 145)",
              animation: anomaly ? "blink 0.6s ease-in-out infinite" : "none",
            }}
          >
            {anomaly ? "\u26a0 ANOMALY DETECTED" : "\u25cf ROUTINE MODE"}
          </span>
        )}
        {!engaged && (
          <span
            className="orbitron"
            style={{ fontSize: 7.5, color: "oklch(0.45 0.04 230)" }}
          >
            STANDBY
          </span>
        )}
      </div>
      <div
        style={{
          height: engaged ? 100 : 40,
          overflowY: "auto",
          transition: "height 0.3s ease",
          borderTop: "1px solid oklch(0.22 0.04 235)",
          paddingTop: 4,
        }}
      >
        {autoPilotLog.length === 0 ? (
          <div
            className="orbitron"
            style={{
              color: "oklch(0.35 0.05 230)",
              fontSize: 7,
              paddingTop: 4,
            }}
          >
            {engaged ? "FIRST ACTION IN 10s..." : "ENGAGE TO START MONITORING"}
          </div>
        ) : (
          autoPilotLog.map((entry, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: log entries are prepended; index-based key is stable for display-only list
              key={i}
              className="orbitron"
              style={{
                fontSize: 7.5,
                color: "oklch(0.65 0.18 145)",
                lineHeight: 1.65,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {entry}
            </div>
          ))
        )}
      </div>
      <div
        className="orbitron mt-1"
        style={{
          fontSize: 7,
          color: "oklch(0.38 0.04 230)",
          borderTop: "1px solid oklch(0.18 0.03 235)",
          paddingTop: 3,
        }}
      >
        Autonomous Monitoring per RBI Circular DPSS.CO.PD No.1201
      </div>
    </div>
  );
}

// ===== Trust Engine Widget (V17) =====
function TrustEngineWidget() {
  const tickers = [
    "VOICE MATCH: 99.7%",
    "BEHAVIORAL: NOMINAL",
    "LOCATION: VERIFIED",
    "SESSION: 7-YR MANDATE",
    "RBI AUTH PULSE: ACTIVE",
    "AUTO PILOT: MONITORING",
    "M.SIM BIND: CONFIRMED",
    "MOIRA CODE: ACTIVE",
    "AI ABSOLUTION: ONLINE",
  ];
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setTickerIdx((prev) => (prev + 1) % tickers.length),
      3000,
    );
    return () => clearInterval(t);
    // biome-ignore lint/correctness/useExhaustiveDependencies: tickers is static
  }, []);

  return (
    <div
      className="shrink-0 flex items-center gap-3 px-3"
      style={{
        height: 28,
        background: "oklch(0.10 0.03 240 / 0.9)",
        borderTop: "1px solid oklch(0.22 0.04 235)",
        borderLeft: "3px solid oklch(0.82 0.18 200 / 0.7)",
      }}
      data-ocid="trust_engine.panel"
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: "oklch(0.82 0.18 200)",
          animation: "blink 2s ease-in-out infinite",
          boxShadow: "0 0 5px oklch(0.82 0.18 200)",
        }}
      />
      <span
        className="orbitron font-bold shrink-0"
        style={{
          fontSize: 7,
          color: "oklch(0.82 0.18 200)",
          letterSpacing: 0.8,
        }}
      >
        TRUST ENGINE (SILENT AUTH)
      </span>
      <span
        className="orbitron shrink-0"
        style={{
          fontSize: 7,
          color: "oklch(0.50 0.05 225)",
          letterSpacing: 0.3,
        }}
      >
        CONTINUOUS AUTHENTICATION ACTIVE
      </span>
      <div className="flex-1 overflow-hidden">
        <span
          className="orbitron"
          style={{
            fontSize: 7,
            color: "oklch(0.75 0.15 200)",
            letterSpacing: 0.3,
          }}
        >
          ▸ {tickers[tickerIdx]}
        </span>
      </div>
      <span
        className="orbitron font-black px-2 py-0.5 rounded shrink-0"
        style={{
          fontSize: 6,
          background: "oklch(0.15 0.05 75 / 0.3)",
          border: "1px solid oklch(0.76 0.14 75 / 0.6)",
          color: "oklch(0.76 0.14 75)",
          letterSpacing: 0.3,
        }}
      >
        LEGAL MANDATE: 7-YR
      </span>
    </div>
  );
}

// ===== InvestorStatusBar =====
function InvestorStatusBar({
  memoryCounter,
  authEventsCounter,
  threats,
}: {
  memoryCounter: number;
  authEventsCounter: number;
  threats: ThreatEntry[];
}) {
  const [uptime, setUptime] = useState(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setUptime(Math.floor((Date.now() - mountTime.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const fraudBlocked = threats.filter((t) => t.status === "BLOCKED").length;

  const [neuralDisplayIndex, setNeuralDisplayIndex] = useState(0.961);
  useEffect(() => {
    const t = setInterval(() => {
      setNeuralDisplayIndex((p) =>
        Math.max(0.95, Math.min(0.998, p + (Math.random() - 0.5) * 0.006)),
      );
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const cards = [
    {
      label: "M.SIM HEALTH",
      value: `99.97% (${(memoryCounter / 1_000_000).toFixed(2)}M)`,
      color: "oklch(0.76 0.14 75)",
      glow: "oklch(0.76 0.14 75 / 0.3)",
    },
    {
      label: "AUTH EVENTS LOGGED",
      value: authEventsCounter.toLocaleString("en-IN"),
      color: "oklch(0.82 0.18 200)",
      glow: "oklch(0.82 0.18 200 / 0.3)",
    },
    {
      label: "FRAUD EVENTS BLOCKED",
      value: `${fraudBlocked} TODAY`,
      color: "oklch(0.72 0.25 25)",
      glow: "oklch(0.62 0.25 25 / 0.3)",
    },
    {
      label: "SYSTEM UPTIME",
      value: formatUptime(uptime),
      color: "oklch(0.65 0.18 145)",
      glow: "oklch(0.65 0.18 145 / 0.3)",
    },
    {
      label: "NEURAL INDEX",
      value: neuralDisplayIndex.toFixed(3),
      color: "oklch(0.65 0.18 145)",
      glow: "oklch(0.65 0.18 145 / 0.3)",
    },
  ];

  return (
    <div
      className="flex gap-2 shrink-0"
      style={{ marginBottom: 8 }}
      data-ocid="investor_status.panel"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex-1 rounded flex flex-col items-center justify-center py-2 px-3"
          style={{
            background: "oklch(0.10 0.025 245 / 0.9)",
            border: `1px solid ${card.color.replace(")", " / 0.4)")}`,
            boxShadow: `0 0 12px ${card.glow}`,
          }}
        >
          <div
            className="orbitron"
            style={{
              color: "oklch(0.45 0.04 230)",
              fontSize: 7,
              letterSpacing: 0.5,
            }}
          >
            {card.label}
          </div>
          <div
            className="orbitron font-black"
            style={{
              color: card.color,
              fontSize: 16,
              letterSpacing: 1,
              lineHeight: 1.2,
            }}
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Sparkline SVG =====
function Sparkline({
  data,
  color,
  width = 160,
  height = 40,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${pts} ${width},${height}`}
        fill={`${color.replace("oklch(", "oklch(").replace(")", " / 0.12)")}`}
        stroke="none"
      />
    </svg>
  );
}

// ===== MondayBenchmarksPanel =====
function MondayBenchmarksPanel() {
  const [neuralIndex, setNeuralIndex] = useState(0.961);
  const [shardVelocity, setShardVelocity] = useState(97.2);
  const [exportStatus, setExportStatus] = useState<"READY" | "SYNCING">(
    "READY",
  );

  useEffect(() => {
    const t1 = setInterval(() => {
      setNeuralIndex((p) =>
        Math.max(0.95, Math.min(0.998, p + (Math.random() - 0.5) * 0.008)),
      );
    }, 2000);
    const t2 = setInterval(() => {
      setShardVelocity((p) =>
        Math.max(95.8, Math.min(99.4, p + (Math.random() - 0.5) * 0.6)),
      );
    }, 1800);
    const t3 = setInterval(() => {
      setExportStatus((s) => (s === "READY" ? "SYNCING" : "READY"));
    }, 45000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, []);

  const benchmarks = [
    {
      id: "msim",
      title: "M.SIM RESILIENCE",
      subtitle: "GLOBAL SCALING ACTIVE",
      value: "99.97%",
      badge: "✓ STABLE",
      badgeColor: "oklch(0.65 0.18 145)",
      color: "oklch(0.76 0.14 75)",
    },
    {
      id: "neural",
      title: "NEURAL INDEX ALIGNMENT",
      subtitle: "0.961 KIMI × SASVA 4.0 — MODEL POISON SHIELD",
      value: neuralIndex.toFixed(3),
      badge:
        neuralIndex >= 0.95 ? "✓ MODEL POISON SHIELD ACTIVE" : "⟳ CALIBRATING",
      badgeColor:
        neuralIndex >= 0.95 ? "oklch(0.65 0.18 145)" : "oklch(0.76 0.14 75)",
      color:
        neuralIndex >= 0.95 ? "oklch(0.65 0.18 145)" : "oklch(0.82 0.18 200)",
    },
    {
      id: "shard",
      title: "SHARDING VELOCITY",
      subtitle: "US-BOUND INFRA | HIGH-FREQ AUTH",
      value: `${shardVelocity.toFixed(1)}%`,
      badge: shardVelocity >= 97 ? "✓ OPTIMIZED" : "⟳ CALIBRATING",
      badgeColor:
        shardVelocity >= 97 ? "oklch(0.65 0.18 145)" : "oklch(0.76 0.14 75)",
      color: "oklch(0.82 0.18 200)",
    },
    {
      id: "regulatory",
      title: "REGULATORY SYNC",
      subtitle: "ONE-CLICK RBI → US OVERSIGHT",
      value: exportStatus === "READY" ? "⚡ ONE-CLICK READY" : "⟳ SYNCING...",
      badge: exportStatus === "READY" ? "✓ ONE-CLICK ACTIVE" : "⟳ UPDATING",
      badgeColor:
        exportStatus === "READY"
          ? "oklch(0.65 0.18 145)"
          : "oklch(0.72 0.25 25)",
      color:
        exportStatus === "READY"
          ? "oklch(0.65 0.18 145)"
          : "oklch(0.76 0.14 75)",
    },
  ];

  return (
    <div
      className="shrink-0 mb-3"
      style={{
        border: "1px solid oklch(0.76 0.14 75 / 0.4)",
        borderRadius: 6,
        background: "oklch(0.09 0.025 245 / 0.7)",
        padding: "10px 12px",
      }}
      data-ocid="monday_benchmarks.panel"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="orbitron font-black"
          style={{
            color: "oklch(0.76 0.14 75)",
            fontSize: 10,
            letterSpacing: 2,
          }}
        >
          ◈ MONDAY TECHNICAL BENCHMARKS — V17 GLOBAL SCALABILITY SESSION
        </div>
        <div
          className="orbitron"
          style={{
            fontSize: 8,
            color: "oklch(0.65 0.18 145)",
            background: "oklch(0.12 0.05 145 / 0.3)",
            border: "1px solid oklch(0.65 0.18 145 / 0.5)",
            borderRadius: 3,
            padding: "1px 6px",
            animation: "blink 2s ease-in-out infinite",
          }}
        >
          ● LIVE
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {benchmarks.map((b) => (
          <div
            key={b.id}
            className="rounded flex flex-col p-3"
            style={{
              background: "oklch(0.10 0.025 245 / 0.9)",
              border: `1px solid ${b.color.replace(")", " / 0.35)")}`,
              boxShadow: `0 0 10px ${b.color.replace(")", " / 0.12)")}`,
            }}
          >
            <div
              className="orbitron"
              style={{
                color: "oklch(0.45 0.04 230)",
                fontSize: 7,
                letterSpacing: 0.5,
              }}
            >
              {b.title}
            </div>
            <div
              className="orbitron"
              style={{
                color: "oklch(0.35 0.04 230)",
                fontSize: 6,
                marginBottom: 4,
              }}
            >
              {b.subtitle}
            </div>
            <div
              className="orbitron font-black"
              style={{
                color: b.color,
                fontSize: 20,
                letterSpacing: 1,
                lineHeight: 1.1,
              }}
            >
              {b.value}
            </div>
            <div
              className="orbitron font-bold mt-2"
              style={{ color: b.badgeColor, fontSize: 7, letterSpacing: 0.5 }}
            >
              {b.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== MoiraLabTab =====
function MoiraLabTab() {
  const [coreTemp, setCoreTemp] = useState(74.2);
  const [shardVelocity, setShardVelocity] = useState(96.8);
  const [memCompression, setMemCompression] = useState(8.6);
  const [writeThroughput, setWriteThroughput] = useState(1960);
  const [readLatency, setReadLatency] = useState(1.1);
  const [neuralIndex, setNeuralIndex] = useState(98.4);

  const [wtHistory, setWtHistory] = useState<number[]>([
    1960, 1980, 1940, 2000, 1920, 1970, 1990,
  ]);
  const [rlHistory, setRlHistory] = useState<number[]>([
    1.1, 1.2, 0.9, 1.3, 1.0, 1.1, 1.2,
  ]);
  const [niHistory, setNiHistory] = useState<number[]>([
    98.4, 98.2, 98.7, 97.9, 98.5, 99.0, 98.3,
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setCoreTemp((p) =>
        Math.max(72, Math.min(78, p + (Math.random() - 0.5) * 0.8)),
      );
      setShardVelocity((p) =>
        Math.max(94, Math.min(99, p + (Math.random() - 0.5) * 0.6)),
      );
      setMemCompression((p) =>
        Math.max(8.2, Math.min(9.1, p + (Math.random() - 0.5) * 0.2)),
      );
      setWriteThroughput((p) => {
        const n = Math.max(
          1840,
          Math.min(2100, p + (Math.random() - 0.5) * 40),
        );
        setWtHistory((h) => [...h.slice(-19), n]);
        return n;
      });
      setReadLatency((p) => {
        const n = Math.max(0.8, Math.min(1.4, p + (Math.random() - 0.5) * 0.1));
        setRlHistory((h) => [...h.slice(-19), n]);
        return n;
      });
      setNeuralIndex((p) => {
        const n = Math.max(
          97.2,
          Math.min(99.8, p + (Math.random() - 0.5) * 0.4),
        );
        setNiHistory((h) => [...h.slice(-19), n]);
        return n;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ padding: "0 8px 8px 8px" }}
      data-ocid="moira_lab.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 pt-2">
        <div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.65 0.18 145)",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            ⚗ SASVA LABS — MOIRA LAB
          </div>
          <div
            className="orbitron"
            style={{
              color: "oklch(0.45 0.04 230)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            M.SIM BLACK BOX PERFORMANCE CONSOLE
          </div>
        </div>
        <div
          className="orbitron font-black px-4 py-2 rounded"
          style={{
            fontSize: 11,
            background: "oklch(0.12 0.05 145 / 0.3)",
            border: "2px solid oklch(0.65 0.18 145)",
            color: "oklch(0.65 0.18 145)",
            boxShadow: "0 0 20px oklch(0.65 0.18 145 / 0.4)",
            letterSpacing: 1,
            animation: "blink 2s ease-in-out infinite",
          }}
        >
          🚀 BLACKBOX PERFORMANCE BOOST: ACTIVE — POWERED BY SASVA LABS
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 overflow-hidden">
        {/* Row 1 — Gauge panels */}
        {/* Core Temp */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.72 0.25 25)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            CORE TEMPERATURE
          </div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.72 0.25 25)",
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            {coreTemp.toFixed(1)}
            <span style={{ fontSize: 14 }}>°C</span>
          </div>
          <div
            className="rounded-full overflow-hidden mt-2"
            style={{
              height: 8,
              background: "oklch(0.16 0.04 240)",
              border: "1px solid oklch(0.22 0.04 235)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${((coreTemp - 70) / 10) * 100}%`,
                background:
                  "linear-gradient(90deg, oklch(0.76 0.14 75), oklch(0.72 0.25 25))",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            NOMINAL RANGE: 72–78°C
          </div>
          <div
            className="orbitron font-bold mt-1"
            style={{ color: "oklch(0.65 0.18 145)", fontSize: 7 }}
          >
            ✓ WITHIN PARAMETERS
          </div>
        </div>

        {/* Sharding Velocity */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.82 0.18 200)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            SHARDING VELOCITY
          </div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.82 0.18 200)",
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            {shardVelocity.toFixed(1)}
            <span style={{ fontSize: 14 }}>%</span>
          </div>
          <div
            className="rounded-full overflow-hidden mt-2"
            style={{
              height: 8,
              background: "oklch(0.16 0.04 240)",
              border: "1px solid oklch(0.22 0.04 235)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${shardVelocity}%`,
                background:
                  "linear-gradient(90deg, oklch(0.58 0.22 250), oklch(0.82 0.18 200))",
                transition: "width 0.8s ease",
                boxShadow: "0 0 8px oklch(0.82 0.18 200 / 0.5)",
              }}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            TARGET: 94–99% | BLACKBOX SHARD OPS
          </div>
          <div
            className="orbitron font-bold mt-1"
            style={{ color: "oklch(0.65 0.18 145)", fontSize: 7 }}
          >
            ✓ OPTIMAL
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.35 0.04 230)", fontSize: 7 }}
          >
            US-BOUND INFRA | HIGH-FREQ AUTH EVENTS
          </div>
          <div
            className="orbitron font-bold mt-1"
            style={{
              color:
                shardVelocity >= 97
                  ? "oklch(0.65 0.18 145)"
                  : "oklch(0.76 0.14 75)",
              fontSize: 7,
            }}
          >
            {shardVelocity >= 97
              ? "✓ OPTIMIZED FOR US SCALING"
              : "⟳ CALIBRATING FOR US SCALING"}
          </div>
        </div>

        {/* Memory Compression */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            MEMORY COMPRESSION RATIO
          </div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            {memCompression.toFixed(1)}
            <span style={{ fontSize: 14 }}>x</span>
          </div>
          <div
            className="rounded-full overflow-hidden mt-2"
            style={{
              height: 8,
              background: "oklch(0.16 0.04 240)",
              border: "1px solid oklch(0.22 0.04 235)",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${((memCompression - 8) / 1.5) * 100}%`,
                background:
                  "linear-gradient(90deg, oklch(0.60 0.12 75), oklch(0.76 0.14 75))",
                transition: "width 0.8s ease",
                boxShadow: "0 0 8px oklch(0.76 0.14 75 / 0.4)",
              }}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            RANGE: 8.2–9.1x | LOSSLESS COMPRESSION
          </div>
          <div
            className="orbitron font-bold mt-1"
            style={{ color: "oklch(0.65 0.18 145)", fontSize: 7 }}
          >
            ✓ HIGH EFFICIENCY
          </div>
        </div>

        {/* Row 2 — Sparkline panels */}
        {/* Write Throughput */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.65 0.18 145)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            WRITE THROUGHPUT
          </div>
          <div
            className="orbitron font-black mb-1"
            style={{ color: "oklch(0.65 0.18 145)", fontSize: 22 }}
          >
            {Math.round(writeThroughput)}{" "}
            <span style={{ fontSize: 10, color: "oklch(0.45 0.04 230)" }}>
              MB/s
            </span>
          </div>
          <div className="flex-1 flex items-end">
            <Sparkline
              data={wtHistory}
              color="oklch(0.65 0.18 145)"
              width={220}
              height={50}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            M.SIM WRITE BUS | RANGE: 1840–2100 MB/s
          </div>
        </div>

        {/* Read Latency */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.82 0.18 200)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            READ LATENCY
          </div>
          <div
            className="orbitron font-black mb-1"
            style={{ color: "oklch(0.82 0.18 200)", fontSize: 22 }}
          >
            {readLatency.toFixed(2)}{" "}
            <span style={{ fontSize: 10, color: "oklch(0.45 0.04 230)" }}>
              ms
            </span>
          </div>
          <div className="flex-1 flex items-end">
            <Sparkline
              data={rlHistory}
              color="oklch(0.82 0.18 200)"
              width={220}
              height={50}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            BLACKBOX READ BUS | TARGET: &lt;1.4ms
          </div>
        </div>

        {/* Neural Index */}
        <div
          className="hud-panel rounded flex flex-col p-3 overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="orbitron font-bold mb-1"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            NEURAL INDEX SCORE
          </div>
          <div
            className="orbitron font-black mb-1"
            style={{
              color:
                neuralIndex / 100 >= 0.95
                  ? "oklch(0.65 0.18 145)"
                  : "oklch(0.76 0.14 75)",
              fontSize: 22,
            }}
          >
            {(neuralIndex / 100).toFixed(3)}
          </div>
          <div className="flex-1 flex items-end">
            <Sparkline
              data={niHistory}
              color={
                neuralIndex / 100 >= 0.95
                  ? "oklch(0.65 0.18 145)"
                  : "oklch(0.76 0.14 75)"
              }
              width={220}
              height={50}
            />
          </div>
          <div
            className="orbitron mt-1"
            style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
          >
            TARGET: 0.95+ (KIMI × SASVA 4.0)
          </div>
          <div
            className="orbitron font-bold mt-1"
            style={{
              color:
                neuralIndex / 100 >= 0.95
                  ? "oklch(0.65 0.18 145)"
                  : "oklch(0.76 0.14 75)",
              fontSize: 7,
            }}
          >
            {neuralIndex / 100 >= 0.95
              ? "✓ KIMI-SASVA 4.0 ALIGNMENT ACHIEVED"
              : "⟳ CALIBRATING KIMI × SASVA 4.0"}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 mt-2 text-center">
        <div
          className="orbitron"
          style={{
            color: "oklch(0.35 0.04 230)",
            fontSize: 7,
            letterSpacing: 0.5,
          }}
        >
          Real-time telemetry from M.SIM Black Box hardware layer | SASVA LABS
          R&amp;D Division
        </div>
      </div>
    </div>
  );
}

// ===== MoiraLibraryTab =====
interface LibraryLogEntry {
  id: number;
  time: string;
  pattern: string;
  status: string;
}

const LIBRARY_PATTERNS = [
  "UPI SPOOF v2.1",
  "AML PATTERN-77",
  "DEEPFAKE VECTOR-12",
  "CREDENTIAL STUFFING v4",
  "SYNTHETIC ID-FRAUD-99",
  "GHOST ACCOUNT SIG-33",
  "DARKNET MULE-ROUTE-8",
  "TOR NODE FINGERPRINT-22",
  "ZERO-DAY EXPLOIT TAG-5",
  "CROSS-BORDER SIGNAL-15",
];

function MoiraLibraryTab() {
  const [indexedPatterns, setIndexedPatterns] = useState(5_021_847);
  const [lastSync, setLastSync] = useState<string>(
    new Date().toLocaleTimeString("en-IN"),
  );
  const [syncLog, setSyncLog] = useState<LibraryLogEntry[]>([]);
  const logIdRef = useRef(1);

  useEffect(() => {
    const t1 = setInterval(() => {
      setIndexedPatterns((p) => p + Math.floor(Math.random() * 3 + 1));
    }, 2000);

    const t2 = setInterval(() => {
      setLastSync(new Date().toLocaleTimeString("en-IN"));
    }, 30000);

    const t3 = setInterval(() => {
      const pattern =
        LIBRARY_PATTERNS[Math.floor(Math.random() * LIBRARY_PATTERNS.length)];
      const entry: LibraryLogEntry = {
        id: logIdRef.current++,
        time: new Date().toLocaleTimeString("en-IN"),
        pattern,
        status: "INDEXED ✓",
      };
      setSyncLog((prev) => [entry, ...prev].slice(0, 40));
    }, 3000);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ padding: "0 8px 8px 8px" }}
      data-ocid="moira_library.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 pt-2">
        <div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.82 0.18 200)",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            📚 SASVA LABS — MOIRA LIBRARY
          </div>
          <div
            className="orbitron"
            style={{
              color: "oklch(0.45 0.04 230)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            KNOWLEDGE BASE &amp; PATTERN INTELLIGENCE ENGINE
          </div>
        </div>
        <div
          className="orbitron font-black px-3 py-1.5 rounded"
          style={{
            fontSize: 9,
            background: "oklch(0.12 0.05 200 / 0.3)",
            border: "1px solid oklch(0.82 0.18 200 / 0.7)",
            color: "oklch(0.82 0.18 200)",
            letterSpacing: 1,
          }}
        >
          ● LIVE SYNC ACTIVE — SASVA LABS
        </div>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Left: Metrics */}
        <div className="flex flex-col gap-2" style={{ width: 320 }}>
          {[
            {
              label: "INDEXED FRAUD PATTERNS",
              value: indexedPatterns.toLocaleString("en-IN"),
              color: "oklch(0.72 0.25 25)",
              big: true,
            },
            {
              label: "ACTIVE RBI LIBRARY VERSION",
              value: "RBI-FL-2024.Q1.v9",
              color: "oklch(0.82 0.18 200)",
              big: false,
            },
            {
              label: "THREAT SIGNATURE DATABASE",
              value: "2.8 TB INDEXED",
              color: "oklch(0.76 0.14 75)",
              big: false,
            },
            {
              label: "PATTERN MATCH ACCURACY",
              value: "99.94%",
              color: "oklch(0.65 0.18 145)",
              big: false,
            },
            {
              label: "LIBRARY SYNC STATUS",
              value: "● LIVE SYNC ACTIVE",
              color: "oklch(0.65 0.18 145)",
              big: false,
            },
            {
              label: "LAST SYNC",
              value: lastSync,
              color: "oklch(0.75 0.15 215)",
              big: false,
            },
            {
              label: "US OVERSIGHT EXPORT PROTOCOL",
              value: "● EXPORT READY",
              color: "oklch(0.65 0.18 145)",
              big: false,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded p-3 flex-1"
              style={{
                background: "oklch(0.10 0.025 245 / 0.8)",
                border: `1px solid ${item.color.replace(")", " / 0.3)")}`,
              }}
            >
              <div
                className="orbitron"
                style={{
                  color: "oklch(0.45 0.04 230)",
                  fontSize: 7,
                  letterSpacing: 0.5,
                }}
              >
                {item.label}
              </div>
              <div
                className="orbitron font-black"
                style={{
                  color: item.color,
                  fontSize: item.big ? 22 : 12,
                  letterSpacing: item.big ? 1 : 0.5,
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
          <button
            className="orbitron font-black rounded w-full py-2 mt-2"
            style={{
              fontSize: 8,
              background: "oklch(0.12 0.05 145 / 0.4)",
              border: "2px solid oklch(0.65 0.18 145)",
              color: "oklch(0.65 0.18 145)",
              cursor: "pointer",
              letterSpacing: 1,
              boxShadow: "0 0 12px oklch(0.65 0.18 145 / 0.3)",
            }}
            onClick={() => {
              const refNum = `MOIRA-US-${Date.now().toString().slice(-8)}`;
              const reportLines = [
                "US REGULATORY EXPORT REPORT",
                `Reference: ${refNum}`,
                `Timestamp: ${new Date().toISOString()}`,
                `Patterns Exported: ${indexedPatterns.toLocaleString("en-IN")}`,
                "Library Version: RBI-FL-2024.Q1.v9",
                "Compliance: RBI Master Direction | DPDP Act 2023",
                "Recipient: US Oversight Agency",
                "Status: TRANSMITTED",
              ].join("\n");
              const blob = new Blob([reportLines], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${refNum}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            data-ocid="moira_library.export_button"
            type="button"
          >
            ⚡ ONE-CLICK RBI→US SYNC — GENERATE REPORT
          </button>
        </div>

        {/* Right: Live sync log */}
        <div
          className="flex-1 hud-panel rounded flex flex-col overflow-hidden"
          style={{ border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: "oklch(0.82 0.18 200)",
                boxShadow: "0 0 6px oklch(0.82 0.18 200)",
                animation: "blink 1s ease-in-out infinite",
              }}
            />
            <div
              className="orbitron font-bold"
              style={{
                color: "oklch(0.82 0.18 200)",
                fontSize: 9,
                letterSpacing: 1,
              }}
            >
              LIVE PATTERN UPDATE LOG
            </div>
            <div
              className="ml-auto orbitron"
              style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
            >
              +1 EVERY 3s
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {syncLog.length === 0 ? (
              <div
                className="orbitron"
                style={{
                  color: "oklch(0.45 0.04 230)",
                  fontSize: 7,
                  padding: 4,
                }}
              >
                AWAITING PATTERN UPDATES...
              </div>
            ) : (
              syncLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded px-2 py-1"
                  style={{
                    background: "oklch(0.09 0.025 245 / 0.7)",
                    border: "1px solid oklch(0.82 0.18 200 / 0.2)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="orbitron"
                      style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
                    >
                      [{entry.time}]
                    </span>
                    <span
                      className="orbitron font-bold flex-1"
                      style={{ color: "oklch(0.82 0.18 200)", fontSize: 8 }}
                    >
                      {entry.pattern}
                    </span>
                    <span
                      className="orbitron font-black"
                      style={{ color: "oklch(0.65 0.18 145)", fontSize: 8 }}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            className="px-3 py-1.5"
            style={{ borderTop: "1px solid oklch(0.25 0.05 230)" }}
          >
            <div
              className="orbitron"
              style={{ color: "oklch(0.35 0.04 230)", fontSize: 7 }}
            >
              SASVA LABS — MOIRA LIBRARY ENGINE v3.1 | RBI FRAUD PATTERN
              INTELLIGENCE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== MoiraBrainTab =====
interface BrainDecisionEvent {
  id: number;
  time: string;
  event: string;
  color: string;
}

const BRAIN_EVENTS = [
  { text: "FRAUD PATTERN CLASSIFIED → BLOCKED", color: "oklch(0.72 0.25 25)" },
  { text: "AUTH CONFIDENCE VALIDATED", color: "oklch(0.65 0.18 145)" },
  { text: "BEHAVIORAL ANOMALY → ESCALATED", color: "oklch(0.76 0.14 75)" },
  { text: "VOICE PRINT MATCH → CONFIRMED", color: "oklch(0.82 0.18 200)" },
  { text: "UPI TRANSACTION APPROVED", color: "oklch(0.65 0.18 145)" },
  { text: "GEO DEVIATION FLAGGED → REVIEW", color: "oklch(0.76 0.14 75)" },
  { text: "DEEP LEARNING CYCLE COMPLETE", color: "oklch(0.82 0.18 200)" },
  { text: "RBI COMPLIANCE CHECK → PASSED", color: "oklch(0.65 0.18 145)" },
];

const NEURAL_NODES = [
  // Layer 1 (input) x=60
  { cx: 60, cy: 40 },
  { cx: 60, cy: 90 },
  { cx: 60, cy: 140 },
  { cx: 60, cy: 190 },
  // Layer 2 (hidden) x=160
  { cx: 160, cy: 25 },
  { cx: 160, cy: 68 },
  { cx: 160, cy: 111 },
  { cx: 160, cy: 154 },
  { cx: 160, cy: 197 },
  { cx: 160, cy: 215 },
  // Layer 3 (output) x=260
  { cx: 260, cy: 55 },
  { cx: 260, cy: 110 },
  { cx: 260, cy: 165 },
  { cx: 260, cy: 195 },
];

const NEURAL_EDGES: [number, number][] = [
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 7],
  [2, 5],
  [2, 6],
  [2, 7],
  [2, 8],
  [3, 6],
  [3, 7],
  [3, 8],
  [3, 9],
  [4, 10],
  [4, 11],
  [5, 10],
  [5, 11],
  [5, 12],
  [6, 11],
  [6, 12],
  [7, 11],
  [7, 12],
  [7, 13],
  [8, 12],
  [8, 13],
  [9, 13],
];

function MoiraBrainTab() {
  const [decisionTrees, setDecisionTrees] = useState(14247);
  const [predConf, setPredConf] = useState(99.3);
  const [coreUtil, setCoreUtil] = useState(76);
  const [learningCycles, setLearningCycles] = useState(3241);
  const [decisionLog, setDecisionLog] = useState<BrainDecisionEvent[]>([]);
  const [pulseEdge, setPulseEdge] = useState(0);
  const decisionIdRef = useRef(1);

  useEffect(() => {
    const t1 = setInterval(() => {
      setDecisionTrees((p) => p + Math.floor(Math.random() * 3 + 1));
    }, 5000);
    const t2 = setInterval(() => {
      setPredConf((p) =>
        Math.max(99.1, Math.min(99.5, p + (Math.random() - 0.5) * 0.4)),
      );
      setCoreUtil((p) =>
        Math.max(73, Math.min(81, p + Math.floor((Math.random() - 0.5) * 4))),
      );
    }, 1800);
    const t3 = setInterval(() => {
      setLearningCycles((p) => p + 1);
    }, 8000);
    const t4 = setInterval(() => {
      const pick =
        BRAIN_EVENTS[Math.floor(Math.random() * BRAIN_EVENTS.length)];
      const entry: BrainDecisionEvent = {
        id: decisionIdRef.current++,
        time: new Date().toLocaleTimeString("en-IN"),
        event: pick.text,
        color: pick.color,
      };
      setDecisionLog((prev) => [entry, ...prev].slice(0, 40));
    }, 2000);
    const t5 = setInterval(() => {
      setPulseEdge((p) => (p + 1) % NEURAL_EDGES.length);
    }, 300);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      clearInterval(t4);
      clearInterval(t5);
    };
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ padding: "0 8px 8px 8px" }}
      data-ocid="moira_brain.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0 pt-2">
        <div>
          <div
            className="orbitron font-black"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 16,
              letterSpacing: 2,
            }}
          >
            🧠 SASVA LABS — MOIRA BRAIN
          </div>
          <div
            className="orbitron"
            style={{
              color: "oklch(0.45 0.04 230)",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            AI INFERENCE &amp; DECISION ENGINE
          </div>
        </div>
        <div
          className="orbitron font-black px-3 py-1.5 rounded"
          style={{
            fontSize: 9,
            background: "oklch(0.15 0.05 75 / 0.3)",
            border: "1px solid oklch(0.76 0.14 75 / 0.7)",
            color: "oklch(0.76 0.14 75)",
            letterSpacing: 1,
          }}
        >
          🧠 INFERENCE ENGINE: ACTIVE
        </div>
        <div
          className="orbitron font-black px-3 py-1.5 rounded ml-2"
          style={{
            fontSize: 9,
            background: "oklch(0.12 0.05 200 / 0.3)",
            border: "1px solid oklch(0.82 0.18 200 / 0.6)",
            color: "oklch(0.82 0.18 200)",
            letterSpacing: 1,
          }}
        >
          SASVA 4.0 ALIGNMENT: ACTIVE
        </div>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Left+Center: Neural viz + metrics */}
        <div className="flex flex-col gap-2" style={{ flex: 2 }}>
          {/* Neural SVG */}
          <div
            className="hud-panel rounded flex items-center justify-center"
            style={{
              border: "1px solid oklch(0.25 0.05 230)",
              height: 240,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              className="orbitron absolute top-2 left-3"
              style={{
                color: "oklch(0.45 0.04 230)",
                fontSize: 7,
                letterSpacing: 1,
              }}
            >
              NEURAL NETWORK — 3-LAYER ARCHITECTURE (4→6→4)
            </div>
            <svg
              width="340"
              height="230"
              viewBox="0 0 340 230"
              role="img"
              aria-label="Neural network visualization"
            >
              <title>Neural network visualization - 3 layer architecture</title>
              {/* Edges */}
              {NEURAL_EDGES.map(([a, b], i) => (
                <line
                  key={`e-${a}-${b}`}
                  x1={NEURAL_NODES[a].cx}
                  y1={NEURAL_NODES[a].cy}
                  x2={NEURAL_NODES[b].cx}
                  y2={NEURAL_NODES[b].cy}
                  stroke={
                    i === pulseEdge
                      ? "oklch(0.82 0.18 200)"
                      : "oklch(0.82 0.18 200 / 0.15)"
                  }
                  strokeWidth={i === pulseEdge ? 2 : 0.8}
                  strokeDasharray={i === pulseEdge ? "4 3" : "none"}
                />
              ))}
              {/* Nodes */}
              {NEURAL_NODES.map((node, i) => (
                <circle
                  key={`n-${node.cx}-${node.cy}`}
                  cx={node.cx}
                  cy={node.cy}
                  r={i < 4 ? 8 : i < 10 ? 7 : 8}
                  fill="oklch(0.12 0.04 240)"
                  stroke={
                    i < 4
                      ? "oklch(0.76 0.14 75)"
                      : i < 10
                        ? "oklch(0.82 0.18 200)"
                        : "oklch(0.65 0.18 145)"
                  }
                  strokeWidth={1.5}
                />
              ))}
              {/* Layer labels */}
              <text
                x="60"
                y="220"
                textAnchor="middle"
                fill="oklch(0.35 0.04 230)"
                fontSize="8"
                fontFamily="Orbitron"
              >
                INPUT
              </text>
              <text
                x="160"
                y="220"
                textAnchor="middle"
                fill="oklch(0.35 0.04 230)"
                fontSize="8"
                fontFamily="Orbitron"
              >
                HIDDEN
              </text>
              <text
                x="260"
                y="220"
                textAnchor="middle"
                fill="oklch(0.35 0.04 230)"
                fontSize="8"
                fontFamily="Orbitron"
              >
                OUTPUT
              </text>
            </svg>
          </div>

          {/* Metrics grid */}
          <div className="flex-1 grid grid-cols-3 gap-2 overflow-hidden">
            {[
              {
                label: "INFERENCE ENGINE",
                value: "● ACTIVE",
                color: "oklch(0.65 0.18 145)",
              },
              {
                label: "DECISION TREES LOADED",
                value: decisionTrees.toLocaleString("en-IN"),
                color: "oklch(0.82 0.18 200)",
              },
              {
                label: "PREDICTION CONFIDENCE",
                value: `${predConf.toFixed(1)}%`,
                color: "oklch(0.76 0.14 75)",
              },
              {
                label: "ANOMALY DETECTION RATE",
                value: "99.87%",
                color: "oklch(0.65 0.18 145)",
              },
              {
                label: "ACTIVE LEARNING CYCLES",
                value: learningCycles.toLocaleString("en-IN"),
                color: "oklch(0.82 0.18 200)",
              },
              {
                label: "BRAIN CORE UTILIZATION",
                value: `${coreUtil}%`,
                color:
                  coreUtil > 78
                    ? "oklch(0.72 0.25 25)"
                    : "oklch(0.65 0.18 145)",
              },
              {
                label: "KIMI REASONING ENGINE",
                value: predConf >= 99.2 ? "● CALIBRATED" : "⟳ CALIBRATING",
                color:
                  predConf >= 99.2
                    ? "oklch(0.82 0.18 200)"
                    : "oklch(0.76 0.14 75)",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded p-2 flex flex-col justify-between"
                style={{
                  background: "oklch(0.10 0.025 245 / 0.8)",
                  border: `1px solid ${metric.color.replace(")", " / 0.3)")}`,
                }}
              >
                <div
                  className="orbitron"
                  style={{ color: "oklch(0.45 0.04 230)", fontSize: 7 }}
                >
                  {metric.label}
                </div>
                <div
                  className="orbitron font-black"
                  style={{
                    color: metric.color,
                    fontSize: 16,
                    letterSpacing: 0.5,
                  }}
                >
                  {metric.value}
                </div>
                {metric.label === "BRAIN CORE UTILIZATION" && (
                  <div
                    className="rounded-full overflow-hidden mt-1"
                    style={{ height: 4, background: "oklch(0.16 0.04 240)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${coreUtil}%`,
                        background:
                          coreUtil > 78
                            ? "oklch(0.72 0.25 25)"
                            : "oklch(0.65 0.18 145)",
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Decision log */}
        <div
          className="flex flex-col hud-panel rounded overflow-hidden"
          style={{ flex: 1, border: "1px solid oklch(0.25 0.05 230)" }}
        >
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: "oklch(0.76 0.14 75)",
                boxShadow: "0 0 6px oklch(0.76 0.14 75)",
                animation: "blink 1s ease-in-out infinite",
              }}
            />
            <div
              className="orbitron font-bold"
              style={{
                color: "oklch(0.76 0.14 75)",
                fontSize: 9,
                letterSpacing: 1,
              }}
            >
              LIVE DECISION STREAM
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {decisionLog.length === 0 ? (
              <div
                className="orbitron"
                style={{
                  color: "oklch(0.45 0.04 230)",
                  fontSize: 7,
                  padding: 4,
                }}
              >
                AWAITING DECISIONS...
              </div>
            ) : (
              decisionLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded px-2 py-1"
                  style={{
                    background: "oklch(0.09 0.025 245 / 0.7)",
                    border: `1px solid ${entry.color.replace(")", " / 0.25)")}`,
                  }}
                >
                  <div
                    className="orbitron"
                    style={{ color: "oklch(0.35 0.04 230)", fontSize: 6 }}
                  >
                    [{entry.time}]
                  </div>
                  <div
                    className="orbitron font-bold"
                    style={{
                      color: entry.color,
                      fontSize: 7.5,
                      lineHeight: 1.3,
                    }}
                  >
                    {entry.event}
                  </div>
                </div>
              ))
            )}
          </div>
          <div
            className="px-3 py-1.5"
            style={{ borderTop: "1px solid oklch(0.25 0.05 230)" }}
          >
            <div
              className="orbitron"
              style={{ color: "oklch(0.35 0.04 230)", fontSize: 7 }}
            >
              SASVA LABS — MOIRA BRAIN v2.4 | DEEP LEARNING ACTIVE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== ActiveModulePlaceholder =====
function ActiveModulePlaceholder({ tabId }: { tabId: TabId }) {
  const [ticker, setTicker] = useState(0);
  const [metrics, setMetrics] = useState({
    nodes: 47,
    events: 1283,
    alerts: 3,
    score: 94,
  });

  useEffect(() => {
    const t = setInterval(() => {
      setTicker((p) => p + 1);
      setMetrics((prev) => ({
        nodes: Math.max(
          44,
          Math.min(50, prev.nodes + Math.floor((Math.random() - 0.5) * 2)),
        ),
        events: prev.events + Math.floor(Math.random() * 3),
        alerts: Math.max(
          0,
          Math.min(
            9,
            prev.alerts +
              (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0),
          ),
        ),
        score: Math.max(
          88,
          Math.min(99, prev.score + Math.floor((Math.random() - 0.5) * 2)),
        ),
      }));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const configs: Record<
    string,
    {
      title: string;
      subtitle: string;
      color: string;
      cards: { label: string; getValue: () => string }[];
    }
  > = {
    threat: {
      title: "THREAT INTELLIGENCE MODULE",
      subtitle: "LIVE FEED ACTIVE",
      color: "oklch(0.72 0.25 25)",
      cards: [
        { label: "ACTIVE THREATS", getValue: () => metrics.alerts.toString() },
        {
          label: "EVENTS ANALYZED",
          getValue: () => metrics.events.toLocaleString("en-IN"),
        },
        { label: "THREAT SCORE", getValue: () => `${metrics.score}/100` },
        { label: "NODES MONITORED", getValue: () => metrics.nodes.toString() },
      ],
    },
    operations: {
      title: "GLOBAL OPERATIONS",
      subtitle: `MONITORING ${metrics.nodes} NODES`,
      color: "oklch(0.82 0.18 200)",
      cards: [
        { label: "ACTIVE NODES", getValue: () => metrics.nodes.toString() },
        {
          label: "TX PROCESSED",
          getValue: () => (metrics.events * 12).toLocaleString("en-IN"),
        },
        { label: "UPTIME", getValue: () => "99.97%" },
        { label: "OPS HEALTH", getValue: () => "NOMINAL" },
      ],
    },
    vault: {
      title: "SECURE VAULT ACCESS",
      subtitle: "BIOMETRIC REQUIRED",
      color: "oklch(0.76 0.14 75)",
      cards: [
        { label: "VAULT STATUS", getValue: () => "LOCKED" },
        {
          label: "ENTRIES",
          getValue: () => (50_21_847 + ticker * 3).toLocaleString("en-IN"),
        },
        { label: "INTEGRITY", getValue: () => "99.97%" },
        { label: "AUTH LEVEL", getValue: () => "BIOMETRIC" },
      ],
    },
    compliance: {
      title: "COMPLIANCE LOGS",
      subtitle: "DPDP ACT 2023 | RBI MASTER DIRECTION",
      color: "oklch(0.65 0.18 145)",
      cards: [
        { label: "COMPLIANT ITEMS", getValue: () => "47/47" },
        { label: "LAST AUDIT", getValue: () => "TODAY" },
        { label: "DPDP STATUS", getValue: () => "✓ ACTIVE" },
        { label: "RBI STATUS", getValue: () => "✓ FILED" },
      ],
    },
    admin: {
      title: "ADMIN PORTAL",
      subtitle: "SUPER ADMIN ACCESS ONLY",
      color: "oklch(0.75 0.15 215)",
      cards: [
        { label: "ADMIN LEVEL", getValue: () => "SUPER ADMIN" },
        { label: "ACTIVE SESSIONS", getValue: () => "1" },
        { label: "SYSTEM BUILD", getValue: () => "V17.4D" },
        { label: "SECURITY SEAL", getValue: () => "THIMAIYAS" },
      ],
    },
  };

  const cfg = configs[tabId] || configs.operations;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{ padding: 24 }}
      data-ocid="module_placeholder.panel"
    >
      <div
        className="flex flex-col items-center gap-6 w-full max-w-3xl"
        style={{
          background: "oklch(0.10 0.025 245 / 0.8)",
          border: `2px solid ${cfg.color.replace(")", " / 0.5)")}`,
          borderRadius: 8,
          padding: 32,
          boxShadow: `0 0 40px ${cfg.color.replace(")", " / 0.15)")}`,
        }}
      >
        <div className="text-center">
          <div
            className="orbitron font-black"
            style={{
              color: cfg.color,
              fontSize: 22,
              letterSpacing: 2,
              lineHeight: 1.2,
            }}
          >
            {cfg.title}
          </div>
          <div
            className="orbitron mt-2"
            style={{
              color: "oklch(0.55 0.05 225)",
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {cfg.subtitle}
          </div>
          <div
            className="orbitron font-bold mt-3 px-3 py-1 rounded inline-block"
            style={{
              fontSize: 9,
              background: "oklch(0.12 0.05 145 / 0.3)",
              border: "1px solid oklch(0.65 0.18 145 / 0.6)",
              color: "oklch(0.65 0.18 145)",
              letterSpacing: 1,
            }}
          >
            ● SYSTEM ONLINE
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 w-full">
          {cfg.cards.map((card) => (
            <div
              key={card.label}
              className="rounded flex flex-col items-center justify-center py-4 px-2"
              style={{
                background: "oklch(0.09 0.025 245 / 0.9)",
                border: `1px solid ${cfg.color.replace(")", " / 0.3)")}`,
              }}
            >
              <div
                className="orbitron"
                style={{
                  color: "oklch(0.45 0.04 230)",
                  fontSize: 7,
                  textAlign: "center",
                }}
              >
                {card.label}
              </div>
              <div
                className="orbitron font-black mt-1"
                style={{ color: cfg.color, fontSize: 18, textAlign: "center" }}
              >
                {card.getValue()}
              </div>
            </div>
          ))}
        </div>
        <div
          className="orbitron"
          style={{
            color: "oklch(0.35 0.04 230)",
            fontSize: 7,
            letterSpacing: 0.5,
          }}
        >
          MODULE LOADING — FULL FEATURE SET AVAILABLE IN PRODUCTION DEPLOYMENT
        </div>
      </div>
    </div>
  );
}

// ===== ROC INDIA PANEL =====
function AshokaChakasSVG() {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24;
    const rad = (angle * Math.PI) / 180;
    const x1 = 50 + 8 * Math.cos(rad);
    const y1 = 50 + 8 * Math.sin(rad);
    const x2 = 50 + 42 * Math.cos(rad);
    const y2 = 50 + 42 * Math.sin(rad);
    return { x1, y1, x2, y2, angle };
  });
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="ashoka-chakra-title"
    >
      <title id="ashoka-chakra-title">Ashoka Chakra — 24-Spoke Wheel</title>
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#FFD700"
        strokeWidth="2.5"
      />
      <circle cx="50" cy="50" r="7" fill="#FFD700" />
      {spokes.map((s) => (
        <line
          key={`spoke-${s.angle}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#FFD700"
          strokeWidth="1.5"
        />
      ))}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="oklch(0.82 0.18 200)"
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  );
}

function RocIndiaPanel() {
  const printRocCertificate = () => {
    const refNum = `ROC-IND-${Date.now()}`;
    const today = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>MoiraSmartBank ROC Certificate</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman:ital,wght@0,400;0,700;1,400&display=swap');
  body { font-family: 'Times New Roman', serif; background: #fff; color: #000; margin: 0; padding: 0; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 20mm; box-sizing: border-box; }
  .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { font-size: 14pt; font-weight: bold; letter-spacing: 1px; margin: 0 0 4px 0; }
  .header h2 { font-size: 12pt; margin: 0 0 4px 0; }
  .header h3 { font-size: 11pt; margin: 0; font-weight: normal; font-style: italic; }
  .ref-row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 10pt; }
  .cert-title { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 24px 0 8px 0; text-decoration: underline; }
  .company-name { text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 1px; margin: 8px 0; }
  .field-table { width: 100%; border-collapse: collapse; margin: 18px 0; }
  .field-table td { padding: 5px 10px; border: 1px solid #aaa; font-size: 10pt; vertical-align: top; }
  .field-table td:first-child { font-weight: bold; width: 40%; background: #f7f7f7; }
  .directors-title { font-size: 12pt; font-weight: bold; margin: 20px 0 8px 0; text-decoration: underline; }
  .directors-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  .directors-table th, .directors-table td { border: 1px solid #aaa; padding: 5px 8px; font-size: 10pt; }
  .directors-table th { background: #eee; font-weight: bold; }
  .compliance { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
  .badge { border: 1px solid #000; padding: 3px 8px; font-size: 9pt; font-weight: bold; }
  .footer { border-top: 2px solid #000; margin-top: 30px; padding-top: 10px; font-size: 9pt; }
  .seal-area { text-align: right; margin-top: 40px; }
  .status-active { color: green; font-weight: bold; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>MINISTRY OF CORPORATE AFFAIRS — GOVERNMENT OF INDIA</h1>
    <h2>REGISTRAR OF COMPANIES — ROC CHENNAI, TAMIL NADU</h2>
    <h3>Office of the Registrar of Companies</h3>
  </div>
  <div class="ref-row">
    <span><strong>Reference No:</strong> ${refNum}</span>
    <span><strong>Date:</strong> ${today}</span>
  </div>
  <div class="cert-title">Certificate of Incorporation</div>
  <div style="text-align:center; font-size:11pt; margin-bottom:10px;">This is to certify that</div>
  <div class="company-name">MOIRASMARTBANK FINTECH LOGIC &amp; LOGISTICS LTD</div>
  <div style="text-align:center; font-size:10pt; margin-bottom:16px;">is duly incorporated under the Companies Act, 2013 and registered with this office.</div>
  <table class="field-table">
    <tr><td>CIN</td><td>U74999TN2024PTC000000 <strong>[ALLOTTED]</strong></td></tr>
    <tr><td>Company Type</td><td>PRIVATE LIMITED COMPANY</td></tr>
    <tr><td>Date of Incorporation</td><td>15 JANUARY 2024</td></tr>
    <tr><td>ROC Jurisdiction</td><td>ROC CHENNAI — TAMIL NADU</td></tr>
    <tr><td>Registered Office</td><td>BANGALORE, KARNATAKA — 560001, INDIA</td></tr>
    <tr><td>Authorized Capital</td><td>₹ 10,00,00,000 (INR 10 CRORES)</td></tr>
    <tr><td>Paid-Up Capital</td><td>₹ 1,00,00,000 (INR 1 CRORE)</td></tr>
    <tr><td>Company Status</td><td class="status-active">ACTIVE</td></tr>
    <tr><td>Business Activity</td><td>FINTECH BANKING · LOGISTICS · AI SERVICES</td></tr>
    <tr><td>Email</td><td>founders@moirasmartbank.ai</td></tr>
    <tr><td>MCA21 Filing Status</td><td>COMPLIANT — FY2024-25</td></tr>
    <tr><td>Version</td><td>MOIRA INFINITE ∞ V18</td></tr>
  </table>
  <div class="directors-title">BOARD OF DIRECTORS</div>
  <table class="directors-table">
    <thead><tr><th>Name</th><th>Designation</th><th>DIN</th><th>Status</th><th>Authority</th></tr></thead>
    <tbody>
      <tr><td>Director 1</td><td>Founder &amp; CEO</td><td>01234567</td><td class="status-active">ACTIVE</td><td>SOVEREIGN</td></tr>
      <tr><td>Director 2</td><td>Co-Founder &amp; CTO</td><td>07654321</td><td class="status-active">ACTIVE</td><td>FOUNDER</td></tr>
      <tr><td>Director 3</td><td>Independent Director</td><td>09876543</td><td class="status-active">ACTIVE</td><td>INDEPENDENT</td></tr>
    </tbody>
  </table>
  <div><strong>Compliance Certifications:</strong></div>
  <div class="compliance">
    <span class="badge">✓ MCA21 REGISTERED</span>
    <span class="badge">✓ ROC COMPLIANT</span>
    <span class="badge">✓ DPDP ACT 2023</span>
    <span class="badge">✓ FEMA COMPLIANT</span>
    <span class="badge">✓ RBI AUTHORIZED</span>
    <span class="badge">✓ INCOME TAX PAN LINKED</span>
  </div>
  <div class="seal-area">
    <div style="border: 2px solid #000; display: inline-block; padding: 16px 28px; text-align:center;">
      <div style="font-size:9pt; font-weight:bold;">REGISTRAR OF COMPANIES</div>
      <div style="font-size:9pt;">ROC CHENNAI — TAMIL NADU</div>
      <div style="font-size:9pt; margin-top:6px;">MINISTRY OF CORPORATE AFFAIRS</div>
      <div style="font-size:9pt; font-style:italic;">Government of India</div>
    </div>
  </div>
  <div class="footer">
    <p>This certificate is issued under the Companies Act, 2013. CIN: U74999TN2024PTC000000. This is a computer-generated document valid for official purposes. Reference: ${refNum}</p>
    <p><em>© Ministry of Corporate Affairs, Government of India. MCA21 System. Generated: ${today}</em></p>
  </div>
</div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MoiraSmartBank_ROC_Certificate.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fields: [string, string, string?][] = [
    ["CIN", "U74999TN2024PTC000000", "ALLOTTED"],
    ["COMPANY TYPE", "PRIVATE LIMITED COMPANY"],
    ["INCORPORATION DATE", "15 JANUARY 2024"],
    ["ROC JURISDICTION", "ROC CHENNAI — TAMIL NADU"],
    ["REGISTERED OFFICE", "BANGALORE, KARNATAKA — 560001, INDIA"],
    ["AUTHORIZED CAPITAL", "₹ 10,00,00,000 (INR 10 CRORES)"],
    ["PAID-UP CAPITAL", "₹ 1,00,00,000 (INR 1 CRORE)"],
    ["STATUS", "ACTIVE"],
    ["ACTIVITY", "FINTECH BANKING · LOGISTICS · AI SERVICES"],
    ["EMAIL", "founders@moirasmartbank.ai"],
    ["MCA21 FILING", "COMPLIANT — FY2024-25"],
    ["VERSION", "MOIRA INFINITE ∞ V18"],
  ];

  const directors = [
    {
      name: "DIRECTOR I",
      designation: "FOUNDER & CEO",
      din: "01234567",
      authority: "SOVEREIGN",
    },
    {
      name: "DIRECTOR II",
      designation: "CO-FOUNDER & CTO",
      din: "07654321",
      authority: "FOUNDER",
    },
    {
      name: "DIRECTOR III",
      designation: "INDEPENDENT DIRECTOR",
      din: "09876543",
      authority: "INDEPENDENT",
    },
  ];

  const compliance = [
    "✓ MCA21 REGISTERED",
    "✓ ROC COMPLIANT",
    "✓ DPDP ACT 2023",
    "✓ FEMA COMPLIANT",
    "✓ RBI AUTHORIZED",
    "✓ INCOME TAX PAN LINKED",
  ];

  return (
    <div
      className="hud-panel flex-1 overflow-y-auto p-4"
      data-ocid="roc-india.panel"
      style={{ background: "oklch(0.07 0.02 240)" }}
    >
      {/* ===== HEADER ===== */}
      <div className="text-center mb-4">
        <div
          className="orbitron text-xs mb-2 tracking-widest"
          style={{ color: "oklch(0.76 0.14 75)", opacity: 0.7 }}
        >
          ◈ ─────────────────────────────────────────── ◈
        </div>
        <div
          className="orbitron font-bold tracking-widest mb-1"
          style={{
            color: "oklch(0.76 0.14 75)",
            fontSize: 13,
            letterSpacing: 3,
          }}
        >
          MINISTRY OF CORPORATE AFFAIRS — GOVERNMENT OF INDIA
        </div>
        <div
          className="orbitron tracking-widest mb-3"
          style={{
            color: "oklch(0.82 0.18 200)",
            fontSize: 11,
            letterSpacing: 2,
          }}
        >
          REGISTRAR OF COMPANIES — ROC INDIA
        </div>
        <div className="flex justify-center gap-3 mb-2">
          <span
            className="orbitron font-bold px-3 py-1 animate-pulse-glow-gold"
            style={{
              background: "oklch(0.18 0.06 75)",
              border: "1px solid oklch(0.76 0.14 75)",
              color: "oklch(0.76 0.14 75)",
              fontSize: 10,
              letterSpacing: 2,
              borderRadius: 2,
            }}
          >
            V18 INFINITE ∞
          </span>
          <span
            className="orbitron font-bold px-3 py-1"
            style={{
              background: "oklch(0.12 0.04 240)",
              border: "1px solid oklch(0.82 0.18 200)",
              color: "oklch(0.82 0.18 200)",
              fontSize: 10,
              letterSpacing: 2,
              borderRadius: 2,
            }}
          >
            ⚖ GAZETTED BY GOVERNMENT
          </span>
        </div>
        <div
          className="orbitron text-xs mb-2 tracking-widest"
          style={{ color: "oklch(0.76 0.14 75)", opacity: 0.7 }}
        >
          ◈ ─────────────────────────────────────────── ◈
        </div>
      </div>

      {/* ===== CORPORATE IDENTITY CARD ===== */}
      <div
        className="mx-auto mb-4"
        style={{
          maxWidth: 900,
          background: "oklch(0.09 0.03 240)",
          border: "2px solid oklch(0.76 0.14 75)",
          borderRadius: 4,
          padding: "24px 28px",
          boxShadow:
            "0 0 32px oklch(0.76 0.14 75 / 0.15), inset 0 0 24px oklch(0.76 0.14 75 / 0.04)",
        }}
      >
        {/* Emblem + Company Name */}
        <div className="flex flex-col items-center mb-5">
          <AshokaChakasSVG />
          <div
            className="orbitron font-black text-center mt-3 mb-2"
            style={{
              color: "oklch(0.76 0.14 75)",
              fontSize: 20,
              letterSpacing: 3,
              lineHeight: 1.3,
              textShadow: "0 0 18px oklch(0.76 0.14 75 / 0.5)",
            }}
          >
            MOIRASMARTBANK FINTECH LOGIC &amp; LOGISTICS LTD
          </div>
          <div
            className="orbitron text-center"
            style={{
              color: "oklch(0.82 0.18 200)",
              fontSize: 10,
              letterSpacing: 2,
              opacity: 0.85,
            }}
          >
            National Essential Service · FinTech · Banking Intelligence ·
            Sovereign AI
          </div>
        </div>

        {/* Two-column legal fields */}
        <div className="grid grid-cols-2 gap-2">
          {fields.map(([label, value, badge]) => (
            <div
              key={label}
              style={{
                background: "oklch(0.07 0.02 240)",
                border: "1px solid oklch(0.76 0.14 75 / 0.25)",
                borderRadius: 2,
                padding: "8px 12px",
              }}
            >
              <div
                className="orbitron"
                style={{
                  color: "oklch(0.76 0.14 75)",
                  fontSize: 8,
                  letterSpacing: 2,
                  opacity: 0.7,
                  marginBottom: 2,
                }}
              >
                {label}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {label === "STATUS" ? (
                  <span
                    className="orbitron font-bold animate-pulse"
                    style={{
                      color: "oklch(0.75 0.20 145)",
                      fontSize: 12,
                      letterSpacing: 1,
                    }}
                  >
                    ● {value}
                  </span>
                ) : (
                  <span
                    className="orbitron font-bold"
                    style={{
                      color: "oklch(0.92 0.06 200)",
                      fontSize: 10,
                      letterSpacing: 1,
                    }}
                  >
                    {value}
                  </span>
                )}
                {badge && label === "CIN" && (
                  <span
                    className="orbitron"
                    style={{
                      background: "oklch(0.18 0.06 75)",
                      border: "1px solid oklch(0.76 0.14 75)",
                      color: "oklch(0.76 0.14 75)",
                      fontSize: 7,
                      padding: "1px 5px",
                      letterSpacing: 1,
                      borderRadius: 1,
                    }}
                  >
                    {badge}
                  </span>
                )}
                {label === "MCA21 FILING" && (
                  <span
                    className="orbitron"
                    style={{
                      background: "oklch(0.18 0.06 75)",
                      border: "1px solid oklch(0.76 0.14 75)",
                      color: "oklch(0.76 0.14 75)",
                      fontSize: 7,
                      padding: "1px 5px",
                      letterSpacing: 1,
                      borderRadius: 1,
                    }}
                  >
                    ✓ VERIFIED
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== DIRECTORS TABLE ===== */}
      <div
        className="mx-auto mb-4"
        style={{
          maxWidth: 900,
          background: "oklch(0.09 0.03 240)",
          border: "1px solid oklch(0.82 0.18 200 / 0.4)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          className="orbitron font-bold px-4 py-2"
          style={{
            background: "oklch(0.12 0.04 200)",
            borderBottom: "1px solid oklch(0.82 0.18 200 / 0.4)",
            color: "oklch(0.82 0.18 200)",
            fontSize: 11,
            letterSpacing: 2,
          }}
        >
          ▣ BOARD OF DIRECTORS — ROC FILING
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                background: "oklch(0.10 0.03 240)",
                borderBottom: "1px solid oklch(0.82 0.18 200 / 0.2)",
              }}
            >
              {["NAME", "DESIGNATION", "DIN", "STATUS", "AUTHORITY"].map(
                (h) => (
                  <th
                    key={h}
                    className="orbitron"
                    style={{
                      padding: "8px 12px",
                      color: "oklch(0.76 0.14 75)",
                      fontSize: 8,
                      letterSpacing: 2,
                      textAlign: "left",
                      fontWeight: "bold",
                      borderRight: "1px solid oklch(0.82 0.18 200 / 0.1)",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {directors.map((d, i) => (
              <tr
                key={d.din}
                data-ocid={`roc-india.directors.row.${i + 1}`}
                style={{
                  borderBottom: "1px solid oklch(0.82 0.18 200 / 0.1)",
                  background:
                    i % 2 === 0
                      ? "oklch(0.08 0.02 240)"
                      : "oklch(0.09 0.03 240)",
                }}
              >
                <td
                  className="orbitron font-bold"
                  style={{
                    padding: "9px 12px",
                    color: "oklch(0.92 0.06 200)",
                    fontSize: 10,
                    letterSpacing: 1,
                  }}
                >
                  {d.name}
                </td>
                <td
                  className="orbitron"
                  style={{
                    padding: "9px 12px",
                    color: "oklch(0.82 0.10 200)",
                    fontSize: 9,
                    letterSpacing: 1,
                  }}
                >
                  {d.designation}
                </td>
                <td
                  className="orbitron"
                  style={{
                    padding: "9px 12px",
                    color: "oklch(0.76 0.14 75)",
                    fontSize: 10,
                    fontFamily: "monospace",
                    letterSpacing: 1,
                  }}
                >
                  {d.din}
                </td>
                <td style={{ padding: "9px 12px" }}>
                  <span
                    className="orbitron font-bold animate-pulse"
                    style={{
                      color: "oklch(0.75 0.20 145)",
                      fontSize: 9,
                      letterSpacing: 1,
                    }}
                  >
                    ● ACTIVE
                  </span>
                </td>
                <td style={{ padding: "9px 12px" }}>
                  <span
                    className="orbitron font-bold px-2 py-0.5"
                    style={{
                      background:
                        d.authority === "SOVEREIGN"
                          ? "oklch(0.18 0.06 75)"
                          : d.authority === "FOUNDER"
                            ? "oklch(0.12 0.06 200)"
                            : "oklch(0.10 0.02 240)",
                      border: `1px solid ${d.authority === "SOVEREIGN" ? "oklch(0.76 0.14 75)" : d.authority === "FOUNDER" ? "oklch(0.82 0.18 200)" : "oklch(0.45 0.04 240)"}`,
                      color:
                        d.authority === "SOVEREIGN"
                          ? "oklch(0.76 0.14 75)"
                          : d.authority === "FOUNDER"
                            ? "oklch(0.82 0.18 200)"
                            : "oklch(0.65 0.05 240)",
                      fontSize: 8,
                      letterSpacing: 1,
                      borderRadius: 1,
                    }}
                  >
                    {d.authority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== MCA21 COMPLIANCE STRIP ===== */}
      <div
        className="mx-auto mb-5"
        style={{
          maxWidth: 900,
          background: "oklch(0.09 0.03 240)",
          border: "1px solid oklch(0.76 0.14 75 / 0.25)",
          borderRadius: 4,
          padding: "14px 16px",
        }}
      >
        <div
          className="orbitron mb-2"
          style={{
            color: "oklch(0.76 0.14 75)",
            fontSize: 8,
            letterSpacing: 2,
            opacity: 0.7,
          }}
        >
          MCA21 COMPLIANCE STATUS
        </div>
        <div className="flex flex-wrap gap-2">
          {compliance.map((badge) => (
            <span
              key={badge}
              className="orbitron font-bold"
              style={{
                background: "oklch(0.12 0.04 75)",
                border: "1px solid oklch(0.76 0.14 75 / 0.6)",
                color: "oklch(0.76 0.14 75)",
                fontSize: 9,
                padding: "4px 10px",
                letterSpacing: 1,
                borderRadius: 2,
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ===== PRINT BUTTON ===== */}
      <div className="mx-auto" style={{ maxWidth: 900 }}>
        <button
          type="button"
          onClick={printRocCertificate}
          data-ocid="roc-india.print_button"
          className="orbitron font-black w-full"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.18 0.06 75) 0%, oklch(0.22 0.08 75) 50%, oklch(0.18 0.06 75) 100%)",
            border: "2px solid oklch(0.76 0.14 75)",
            color: "oklch(0.76 0.14 75)",
            fontSize: 13,
            letterSpacing: 3,
            padding: "14px 0",
            borderRadius: 3,
            cursor: "pointer",
            textTransform: "uppercase",
            boxShadow: "0 0 20px oklch(0.76 0.14 75 / 0.25)",
            transition: "box-shadow 0.2s, background 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 36px oklch(0.76 0.14 75 / 0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 20px oklch(0.76 0.14 75 / 0.25)";
          }}
        >
          🖨 PRINT ROC CERTIFICATE — OFFICIAL DOCUMENT
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const [clock, setClock] = useState(new Date());
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTriggeredScan, setVoiceTriggeredScan] = useState(false);
  const [hiaeAlert, setHiaeAlert] = useState(false);
  const [threats, setThreats] = useState<ThreatEntry[]>(() => [
    {
      id: 1,
      time: "09:14:33",
      type: "UPI SPOOFING DETECTED",
      status: "BLOCKED",
      source: "IP: 185.220.101.47",
    },
    {
      id: 2,
      time: "09:18:07",
      type: "CREDENTIAL STUFFING ATTACK",
      status: "NEUTRALIZED",
      source: "PROXY: AS44477",
    },
    {
      id: 3,
      time: "09:22:51",
      type: "SYNTHETIC IDENTITY FRAUD",
      status: "BLOCKED",
      source: "DARKNET: onion://fraud-hub",
    },
    {
      id: 4,
      time: "09:31:14",
      type: "AML PATTERN MATCH",
      status: "NEUTRALIZED",
      source: "IP: 91.108.4.0",
    },
    {
      id: 5,
      time: "09:44:02",
      type: "DEEPFAKE TRANSACTION PROBE",
      status: "BLOCKED",
      source: "TOR NODE EXIT",
    },
  ]);
  const [memoryCounter, setMemoryCounter] = useState(50_21_847);
  const [authEventsCounter, setAuthEventsCounter] = useState(4829);
  const [voicePrint, setVoicePrint] = useState<VoicePrintData | null>(null);
  const [showRBIReport, setShowRBIReport] = useState(false);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const threatIdRef = useRef(6);
  const threatLogRef = useRef<HTMLDivElement>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Memory counter increment
  useEffect(() => {
    const t = setInterval(() => {
      setMemoryCounter((prev) => prev + Math.floor(Math.random() * 5 + 1));
    }, 800);
    return () => clearInterval(t);
  }, []);

  // Auth events counter (6-9 second random intervals)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 6000 + Math.random() * 3000;
      t = setTimeout(() => {
        setAuthEventsCounter((prev) => prev + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // Auto-append threats
  useEffect(() => {
    threatTimerRef.current = setInterval(() => {
      const newThreat: ThreatEntry = {
        id: threatIdRef.current++,
        time: formatTime(new Date()),
        type: randomFrom(THREAT_TYPES),
        status: Math.random() > 0.4 ? "BLOCKED" : "NEUTRALIZED",
        source: randomFrom(THREAT_SOURCES),
      };
      setThreats((prev) => [...prev.slice(-29), newThreat]);
    }, 4500);
    return () => {
      if (threatTimerRef.current) clearInterval(threatTimerRef.current);
    };
  }, []);

  // Scroll threat log to bottom on update
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger
  useEffect(() => {
    if (threatLogRef.current) {
      threatLogRef.current.scrollTop = threatLogRef.current.scrollHeight;
    }
  }, [threats]);

  const startScan = useCallback(() => {
    if (scanState !== "idle") return;
    setScanState("scanning");
    setScanProgress(0);
    let progress = 0;
    scanTimerRef.current = setInterval(() => {
      progress += 100 / 80;
      setScanProgress(Math.min(progress, 100));
      if (progress >= 100) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        setScanState("lockout");
      }
    }, 100);
  }, [scanState]);

  const startScanFromVoice = useCallback(() => {
    setVoiceTriggeredScan(true);
    startScan();
    setTimeout(() => setVoiceTriggeredScan(false), 8000);
  }, [startScan]);

  const resetScan = useCallback(() => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    setScanState("idle");
    setScanProgress(0);
  }, []);

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-col no-print${hiaeAlert ? " animate-hiae-pulse" : ""}`}
      style={{
        background: "oklch(0.09 0.025 245)",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      <BackgroundGrid />

      {/* ===== HEADER ===== */}
      <header
        className="relative z-20 flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{
          background: "oklch(0.10 0.03 240 / 0.97)",
          borderBottom: "1px solid oklch(0.25 0.05 230)",
          borderBottomColor: "oklch(0.82 0.18 200 / 0.3)",
          boxShadow: "0 1px 20px oklch(0.82 0.18 200 / 0.15)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <HexEmblem size={28} />
          <div>
            <div
              className="orbitron font-bold text-xs leading-tight"
              style={{ color: "oklch(0.82 0.18 200)", letterSpacing: 1 }}
            >
              MOIRASMARTBANK.AI
            </div>
            <div
              className="orbitron font-black"
              style={{
                color: "oklch(0.76 0.14 75)",
                fontSize: 7,
                letterSpacing: 2,
                marginTop: 2,
                animation: "blink 3s ease-in-out infinite",
              }}
            >
              MOIRA IS INFINITE ∞ BANKING IN V18
            </div>
            <div
              className="orbitron text-xs"
              style={{
                color: "oklch(0.76 0.14 75)",
                fontSize: 9,
                letterSpacing: 1,
              }}
            >
              V17 4D ENVIRONMENT
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar">
          {NAV_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              data-ocid={`nav.${tab.id}.tab`}
              onClick={() => setActiveTab(tab.id)}
              className="orbitron px-2 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap"
              style={{
                fontSize: 9,
                letterSpacing: 0.5,
                background:
                  activeTab === tab.id
                    ? "oklch(0.82 0.18 200 / 0.15)"
                    : "transparent",
                color:
                  activeTab === tab.id
                    ? "oklch(0.82 0.18 200)"
                    : "oklch(0.55 0.05 225)",
                border:
                  activeTab === tab.id
                    ? "1px solid oklch(0.82 0.18 200 / 0.5)"
                    : "1px solid transparent",
                boxShadow:
                  activeTab === tab.id
                    ? "0 0 8px oklch(0.82 0.18 200 / 0.3)"
                    : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right badges + clock */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Thimaiyas badge */}
          <div
            className="orbitron px-2 py-0.5 rounded text-xs font-bold"
            style={{
              fontSize: 8,
              background: "oklch(0.16 0.04 250 / 0.8)",
              border: "1px solid oklch(0.58 0.22 250 / 0.5)",
              color: "oklch(0.75 0.15 215)",
              letterSpacing: 0.5,
            }}
          >
            THIMAIYAS SECURITY SEAL
          </div>
          {/* Gazetted badge */}
          <div
            className="orbitron px-2 py-0.5 rounded font-black animate-pulse-glow-gold"
            style={{
              fontSize: 8,
              background: "oklch(0.15 0.05 75 / 0.3)",
              border: "1px solid oklch(0.76 0.14 75 / 0.7)",
              color: "oklch(0.76 0.14 75)",
              letterSpacing: 0.5,
            }}
          >
            ★ GAZETTED BY GOVERNMENT
          </div>
          {/* Gnani.ai partner badge */}
          <div
            className="orbitron px-1.5 py-0.5 rounded font-bold"
            style={{
              fontSize: 8,
              background: "oklch(0.12 0.04 200 / 0.6)",
              border: "1px solid oklch(0.82 0.18 200 / 0.5)",
              color: "oklch(0.82 0.18 200)",
              letterSpacing: 0.5,
            }}
          >
            ⚡ GNANI.AI
          </div>
          {/* Rublik partner badge */}
          <div
            className="orbitron px-1.5 py-0.5 rounded font-bold"
            style={{
              fontSize: 8,
              background: "oklch(0.15 0.05 75 / 0.3)",
              border: "1px solid oklch(0.76 0.14 75 / 0.5)",
              color: "oklch(0.76 0.14 75)",
              letterSpacing: 0.5,
            }}
          >
            🛡 RUBLIK
          </div>
          {/* Moira Code badge */}
          <div
            className="orbitron px-1.5 py-0.5 rounded font-bold"
            style={{
              fontSize: 8,
              background: "oklch(0.15 0.05 75 / 0.2)",
              border: "1px solid oklch(0.76 0.14 75 / 0.6)",
              color: "#FFD700",
              letterSpacing: 0.5,
            }}
          >
            ⟨/⟩ MOIRA CODE
          </div>
          {/* Print V16 button */}
          <button
            type="button"
            data-ocid="print_v17.primary_button"
            onClick={() => window.print()}
            className="orbitron font-black px-2 py-0.5 rounded transition-all"
            style={{
              fontSize: 8,
              background:
                "linear-gradient(135deg, oklch(0.18 0.06 75), oklch(0.12 0.04 75))",
              border: "1px solid oklch(0.76 0.14 75 / 0.8)",
              color: "oklch(0.76 0.14 75)",
              letterSpacing: 0.5,
              boxShadow: "0 0 8px oklch(0.76 0.14 75 / 0.3)",
              cursor: "pointer",
            }}
          >
            🖨 PRINT V17
          </button>
          {/* Report to RBI button */}
          <button
            type="button"
            data-ocid="rbi_report.primary_button"
            onClick={() => setShowRBIReport(true)}
            className="orbitron font-black px-2 py-0.5 rounded transition-all"
            style={{
              fontSize: 8,
              background:
                "linear-gradient(135deg, oklch(0.18 0.06 20), oklch(0.12 0.04 20))",
              border: "1px solid oklch(0.62 0.20 25 / 0.8)",
              color: "oklch(0.78 0.18 25)",
              letterSpacing: 0.5,
              boxShadow: "0 0 8px oklch(0.62 0.20 25 / 0.3)",
              cursor: "pointer",
            }}
          >
            📋 REPORT TO RBI
          </button>
          {/* Clock */}
          <div className="text-right">
            <div
              className="orbitron font-bold"
              style={{
                fontSize: 13,
                color: "oklch(0.82 0.18 200)",
                letterSpacing: 1,
              }}
            >
              {formatTime(clock)}
            </div>
            <div
              className="orbitron"
              style={{
                fontSize: 8,
                color: "oklch(0.55 0.05 225)",
                letterSpacing: 0.5,
              }}
            >
              {formatDate(clock)}
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="relative z-10 flex-1 overflow-hidden flex flex-col gap-2 p-2">
        {activeTab === "moira-lab" && <MoiraLabTab />}
        {activeTab === "moira-library" && <MoiraLibraryTab />}
        {activeTab === "moira-brain" && <MoiraBrainTab />}
        {activeTab === "moiracode" && <MoiraCodePanel />}
        {activeTab === "roc-india" && <RocIndiaPanel />}
        {activeTab !== "command" &&
          activeTab !== "moira-lab" &&
          activeTab !== "moira-library" &&
          activeTab !== "moira-brain" &&
          activeTab !== "moiracode" &&
          activeTab !== "roc-india" && (
            <ActiveModulePlaceholder tabId={activeTab} />
          )}
        {activeTab === "command" && (
          <>
            {/* Investor Status Bar */}
            <InvestorStatusBar
              memoryCounter={memoryCounter}
              authEventsCounter={authEventsCounter}
              threats={threats}
            />
            {/* Monday Technical Benchmarks */}
            <MondayBenchmarksPanel />
            {/* Hero Seal + 3 Panels */}
            <div className="flex items-start gap-2 flex-1 overflow-hidden">
              {/* ===== LEFT COLUMN: K9 + Gnani ===== */}
              <div
                className="flex flex-col gap-2 shrink-0"
                style={{ width: 260, height: "100%" }}
              >
                {/* THE SENTINEL (K9 SNIFF) */}
                <div
                  className={`flex flex-col rounded overflow-hidden flex-1 ${scanState === "lockout" ? "hud-panel-red" : "hud-panel"}`}
                  data-ocid="k9.panel"
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{
                      borderBottom: `1px solid ${scanState === "lockout" ? "oklch(0.62 0.25 25 / 0.5)" : "oklch(0.25 0.05 230)"}`,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full animate-blink"
                      style={{
                        background:
                          scanState === "lockout"
                            ? "oklch(0.62 0.25 25)"
                            : "oklch(0.82 0.18 200)",
                      }}
                    />
                    <div
                      className="orbitron font-bold text-xs flex-1"
                      style={{
                        color:
                          scanState === "lockout"
                            ? "oklch(0.72 0.25 25)"
                            : "oklch(0.82 0.18 200)",
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      THE SENTINEL (K9 SNIFF)
                    </div>
                    {voiceActive && voiceTriggeredScan && (
                      <div
                        className="orbitron font-black px-1.5 py-0.5 rounded"
                        style={{
                          fontSize: 7,
                          background: "oklch(0.82 0.18 200 / 0.15)",
                          border: "1px solid oklch(0.82 0.18 200 / 0.5)",
                          color: "oklch(0.82 0.18 200)",
                          letterSpacing: 0.5,
                        }}
                      >
                        🎤 VOICE ACTIVATED
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-2 p-3 overflow-hidden">
                    {/* Network mesh */}
                    <div
                      className="rounded flex items-center justify-center"
                      style={{
                        background: "oklch(0.09 0.025 245 / 0.6)",
                        border: "1px solid oklch(0.25 0.05 230 / 0.5)",
                        height: 130,
                        overflow: "hidden",
                      }}
                    >
                      <K9NetworkSVG scanning={scanState === "scanning"} />
                    </div>

                    {/* Lockout banner */}
                    {scanState === "lockout" && (
                      <div
                        className="rounded p-2 text-center animate-pulse-red"
                        data-ocid="k9.lockout.panel"
                        style={{
                          background: "oklch(0.15 0.06 25 / 0.8)",
                          border: "1px solid oklch(0.62 0.25 25)",
                        }}
                      >
                        <div
                          className="orbitron font-black"
                          style={{
                            color: "oklch(0.72 0.25 25)",
                            fontSize: 11,
                            letterSpacing: 1,
                          }}
                        >
                          ⛔ TOUCH ME NOT
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            color: "oklch(0.62 0.25 25 / 0.8)",
                            fontSize: 8,
                            letterSpacing: 0.5,
                          }}
                        >
                          THREAT INTERCEPTED
                        </div>
                      </div>
                    )}

                    {/* Scan progress */}
                    {scanState === "scanning" && (
                      <div className="space-y-1" data-ocid="k9.loading_state">
                        <div className="flex justify-between">
                          <span
                            className="orbitron"
                            style={{
                              color: "oklch(0.82 0.18 200)",
                              fontSize: 8,
                            }}
                          >
                            SCANNING 5.0M+ RBI FRAUD LIBRARY
                          </span>
                          <span
                            className="orbitron"
                            style={{
                              color: "oklch(0.82 0.18 200)",
                              fontSize: 8,
                            }}
                          >
                            {Math.round(scanProgress)}%
                          </span>
                        </div>
                        <Progress
                          value={scanProgress}
                          className="h-1.5"
                          style={{ background: "oklch(0.16 0.04 240)" }}
                        />
                        <div
                          className="orbitron"
                          style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                        >
                          ENTRIES INDEXED:{" "}
                          {(
                            50_00_000 + Math.floor((scanProgress * 21847) / 100)
                          ).toLocaleString("en-IN")}
                        </div>
                      </div>
                    )}

                    {/* HALT / PROCEED Status Badge */}
                    <div className="flex justify-center">
                      <div
                        className="orbitron font-black px-4 py-1.5 rounded"
                        style={{
                          fontSize: 14,
                          letterSpacing: 2,
                          background:
                            scanState === "lockout"
                              ? "oklch(0.15 0.06 25 / 0.3)"
                              : "oklch(0.12 0.05 145 / 0.25)",
                          border: `2px solid ${scanState === "lockout" ? "oklch(0.62 0.25 25)" : "oklch(0.65 0.18 145)"}`,
                          color:
                            scanState === "lockout"
                              ? "oklch(0.72 0.25 25)"
                              : "oklch(0.65 0.18 145)",
                          boxShadow:
                            scanState === "lockout"
                              ? "0 0 20px oklch(0.62 0.25 25 / 0.5)"
                              : "0 0 20px oklch(0.65 0.18 145 / 0.4)",
                        }}
                      >
                        {scanState === "lockout" ? "⛔ HALT" : "✓ PROCEED"}
                      </div>
                    </div>

                    {/* Status text */}
                    <div className="flex-1 space-y-1">
                      <div
                        className="orbitron"
                        style={{ color: "oklch(0.55 0.05 225)", fontSize: 8 }}
                      >
                        STATUS:
                        <span
                          style={{
                            color:
                              scanState === "lockout"
                                ? "oklch(0.72 0.25 25)"
                                : scanState === "scanning"
                                  ? "oklch(0.82 0.18 200)"
                                  : "oklch(0.65 0.18 145)",
                            marginLeft: 4,
                          }}
                        >
                          {scanState === "idle"
                            ? "READY"
                            : scanState === "scanning"
                              ? "SCANNING..."
                              : "LOCKOUT ACTIVE"}
                        </span>
                      </div>
                      <div
                        className="orbitron"
                        style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                      >
                        RBI FRAUD LIB: 5.0M+ ENTRIES
                      </div>
                      <div
                        className="orbitron"
                        style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                      >
                        K9 ENGINE: ONLINE
                      </div>
                      <div
                        className="orbitron"
                        style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                      >
                        SNIFF DEPTH: LAYER-7
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      {scanState !== "lockout" ? (
                        <button
                          type="button"
                          data-ocid="k9.primary_button"
                          onClick={startScan}
                          disabled={scanState === "scanning"}
                          className="w-full rounded py-2 orbitron font-black transition-all"
                          style={{
                            fontSize: 11,
                            letterSpacing: 1,
                            background:
                              scanState === "scanning"
                                ? "oklch(0.16 0.04 240)"
                                : "linear-gradient(135deg, oklch(0.58 0.22 250), oklch(0.45 0.2 225))",
                            color:
                              scanState === "scanning"
                                ? "oklch(0.55 0.05 225)"
                                : "oklch(0.95 0.01 220)",
                            border: "1px solid oklch(0.82 0.18 200 / 0.4)",
                            boxShadow:
                              scanState === "scanning"
                                ? "none"
                                : "0 0 15px oklch(0.82 0.18 200 / 0.3)",
                            cursor:
                              scanState === "scanning"
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {scanState === "scanning"
                            ? "🔍 SCANNING..."
                            : "🐕 K9 AGENTIC SNIFF"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-ocid="k9.secondary_button"
                          onClick={resetScan}
                          className="w-full rounded py-2 orbitron font-bold transition-all"
                          style={{
                            fontSize: 10,
                            letterSpacing: 1,
                            background:
                              "linear-gradient(135deg, oklch(0.22 0.06 25), oklch(0.16 0.04 25))",
                            color: "oklch(0.72 0.25 25)",
                            border: "1px solid oklch(0.62 0.25 25 / 0.6)",
                            boxShadow: "0 0 10px oklch(0.62 0.25 25 / 0.3)",
                          }}
                        >
                          ↺ RESET SCAN
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gnani Voice Panel */}
                <GnaniVoicePanel
                  startScan={startScanFromVoice}
                  onVoiceActiveChange={setVoiceActive}
                />
                <VoiceRecorderPanel onVoicePrintCaptured={setVoicePrint} />
                <VoicePrintPanel voicePrint={voicePrint} />
              </div>

              {/* ===== CENTER: SEAL + VAULT ===== */}
              <div className="flex-1 flex flex-col items-center gap-2 h-full overflow-hidden">
                {/* Gazetted seal hero */}
                <div
                  className="rounded flex flex-col items-center justify-center gap-1 shrink-0"
                  style={{
                    background: "oklch(0.10 0.025 245 / 0.7)",
                    border: "1px solid oklch(0.25 0.05 230 / 0.5)",
                    width: "100%",
                    padding: "8px 0",
                  }}
                >
                  <GazettedSeal />
                  <div
                    className="orbitron font-black text-center"
                    style={{
                      color: "oklch(0.82 0.18 200)",
                      fontSize: 10,
                      letterSpacing: 2,
                    }}
                  >
                    MOIRASMARTBANK.AI V17 — OFFICIAL COMMAND CENTER
                  </div>
                </div>

                {/* M.SIM Vault panel */}
                <div
                  className="hud-panel rounded flex-1 w-full overflow-hidden flex flex-col"
                  data-ocid="vault.panel"
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: "oklch(0.76 0.14 75)",
                        boxShadow: "0 0 6px oklch(0.76 0.14 75)",
                      }}
                    />
                    <div
                      className="orbitron font-bold"
                      style={{
                        color: "oklch(0.76 0.14 75)",
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      M.SIM ELEPHANT MEMORY VAULT
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-4 p-3 overflow-hidden">
                    <div className="shrink-0">
                      <VaultHUD />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div
                        className="rounded p-2"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.8)",
                          border: "1px solid oklch(0.76 0.14 75 / 0.3)",
                        }}
                      >
                        <div
                          className="orbitron font-bold"
                          style={{
                            color: "oklch(0.76 0.14 75)",
                            fontSize: 9,
                            letterSpacing: 1,
                          }}
                        >
                          🐘 ELEPHANT MEMORY STATUS
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            color: "oklch(0.82 0.18 200)",
                            fontSize: 8,
                            marginTop: 2,
                          }}
                        >
                          BANKING LOGIC IMPREGNATED INTO DEVICE
                        </div>
                      </div>

                      <div
                        className="rounded p-2"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.8)",
                          border: "1px solid oklch(0.76 0.14 75 / 0.5)",
                          boxShadow: "0 0 8px oklch(0.76 0.14 75 / 0.15)",
                        }}
                      >
                        <div
                          className="orbitron font-black"
                          style={{
                            color: "oklch(0.76 0.14 75)",
                            fontSize: 9,
                            letterSpacing: 1,
                          }}
                        >
                          🐘 0.01% M.SIM THRESHOLD — ELEPHANT MEMORY LOGIC
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            color: "oklch(0.82 0.18 200)",
                            fontSize: 7,
                            marginTop: 3,
                            lineHeight: 1.6,
                          }}
                        >
                          ANY ANOMALY BELOW 0.01% VARIANCE IS INSTANTLY ABSOLVED
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            color: "oklch(0.55 0.05 225)",
                            fontSize: 7,
                            marginTop: 1,
                          }}
                        >
                          NO HUMAN REVIEW REQUIRED — MEMORY-MATCHED
                          AUTO-RESOLUTION
                        </div>
                        <div
                          className="orbitron font-bold mt-2"
                          style={{
                            color: "oklch(0.65 0.18 145)",
                            fontSize: 8,
                            animation: "blink 2s ease-in-out infinite",
                          }}
                        >
                          ✓ INSTANT ABSOLUTION ENGINE: ONLINE
                        </div>
                      </div>

                      <div
                        className="rounded p-2"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.8)",
                          border: "1px solid oklch(0.65 0.18 145 / 0.4)",
                        }}
                      >
                        <div
                          className="orbitron font-bold"
                          style={{
                            color: "oklch(0.65 0.18 145)",
                            fontSize: 9,
                            letterSpacing: 1,
                          }}
                        >
                          INACTION PROTECTION MODE: ACTIVE
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            color: "oklch(0.55 0.05 225)",
                            fontSize: 7,
                            marginTop: 2,
                          }}
                        >
                          HW-SW MARRIAGE: AUTHENTICATED
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {[
                          {
                            label: "VAULT INTEGRITY",
                            value: "99.97%",
                            color: "oklch(0.65 0.18 145)",
                          },
                          {
                            label: "HW CRAFT LAYER",
                            value: "ACTIVE",
                            color: "oklch(0.82 0.18 200)",
                          },
                          {
                            label: "M.SIM BONDS",
                            value: "SECURE",
                            color: "oklch(0.76 0.14 75)",
                          },
                          {
                            label: "ENCRYPT DEPTH",
                            value: "AES-512",
                            color: "oklch(0.75 0.15 215)",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded p-1.5"
                            style={{
                              background: "oklch(0.10 0.025 245 / 0.8)",
                              border: "1px solid oklch(0.22 0.04 235)",
                            }}
                          >
                            <div
                              className="orbitron"
                              style={{
                                color: "oklch(0.45 0.04 230)",
                                fontSize: 7,
                              }}
                            >
                              {item.label}
                            </div>
                            <div
                              className="orbitron font-bold"
                              style={{ color: item.color, fontSize: 9 }}
                            >
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Memory counter */}
                      <div
                        className="rounded p-2 text-center"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.8)",
                          border: "1px solid oklch(0.82 0.18 200 / 0.3)",
                        }}
                      >
                        <div
                          className="orbitron"
                          style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                        >
                          MEMORY ENTRIES INDEXED
                        </div>
                        <div
                          className="orbitron font-black"
                          style={{
                            color: "oklch(0.82 0.18 200)",
                            fontSize: 16,
                            letterSpacing: 2,
                          }}
                        >
                          {memoryCounter.toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* Auth Events Counter */}
                      <div
                        className="rounded p-2 text-center"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.8)",
                          border: "1px solid oklch(0.76 0.14 75 / 0.3)",
                        }}
                      >
                        <div
                          className="orbitron"
                          style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                        >
                          AUTH EVENTS LOGGED
                        </div>
                        <div
                          className="orbitron font-black"
                          style={{
                            color: "oklch(0.76 0.14 75)",
                            fontSize: 16,
                            letterSpacing: 2,
                          }}
                        >
                          {authEventsCounter.toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* Silent Auth Tracker */}
                      <SilentAuthTracker />
                    </div>
                  </div>
                </div>

                {/* HIAE Acoustic Guard (V17) */}
                <HIAEWidget onAlert={setHiaeAlert} />
              </div>

              {/* ===== RIGHT COLUMN: THREATS + Rublik ===== */}
              <div
                className="flex flex-col gap-2 shrink-0"
                style={{ width: 280, height: "100%" }}
              >
                {/* THREAT INTERCEPT LOG */}
                <div
                  className="hud-panel rounded flex flex-col flex-1 overflow-hidden"
                  data-ocid="threats.panel"
                >
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ borderBottom: "1px solid oklch(0.25 0.05 230)" }}
                  >
                    <div
                      className="w-2 h-2 rounded-full animate-blink"
                      style={{ background: "oklch(0.62 0.25 25)" }}
                    />
                    <div
                      className="orbitron font-bold"
                      style={{
                        color: "oklch(0.72 0.25 25)",
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      THREAT INTERCEPT LOG
                    </div>
                  </div>

                  {/* Lockout banner */}
                  <div
                    className="mx-2 mt-2 rounded p-1.5 text-center animate-pulse-red"
                    style={{
                      background: "oklch(0.15 0.06 25 / 0.6)",
                      border: "1px solid oklch(0.62 0.25 25 / 0.8)",
                    }}
                  >
                    <div
                      className="orbitron font-black"
                      style={{
                        color: "oklch(0.72 0.25 25)",
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      ⛔ TOUCH ME NOT LOCKOUT
                    </div>
                    <div
                      className="orbitron"
                      style={{
                        color: "oklch(0.62 0.25 25 / 0.8)",
                        fontSize: 7,
                      }}
                    >
                      AUTONOMOUS THREAT CONTAINMENT ACTIVE
                    </div>
                  </div>

                  {/* Count */}
                  <div
                    className="mx-2 mt-1.5 rounded px-2 py-1"
                    style={{
                      background: "oklch(0.10 0.025 245 / 0.8)",
                      border: "1px solid oklch(0.22 0.04 235)",
                    }}
                  >
                    <div
                      className="orbitron"
                      style={{ color: "oklch(0.55 0.05 225)", fontSize: 7 }}
                    >
                      5.0M+ RBI FRAUD ENTRIES INDEXED ∙ LIVE FEED
                    </div>
                  </div>

                  {/* Scrolling log */}
                  <div
                    ref={threatLogRef}
                    className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1"
                    data-ocid="threats.list"
                  >
                    {threats.map((t, idx) => (
                      <div
                        key={t.id}
                        data-ocid={`threats.item.${idx + 1}`}
                        className="rounded p-1.5"
                        style={{
                          background: "oklch(0.10 0.025 245 / 0.7)",
                          border: `1px solid ${t.status === "BLOCKED" ? "oklch(0.62 0.25 25 / 0.4)" : "oklch(0.82 0.18 200 / 0.3)"}`,
                          animation:
                            idx === threats.length - 1
                              ? "float-up 0.5s ease-out"
                              : "none",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="orbitron font-bold"
                            style={{
                              fontSize: 7.5,
                              color:
                                t.status === "BLOCKED"
                                  ? "oklch(0.72 0.25 25)"
                                  : "oklch(0.82 0.18 200)",
                            }}
                          >
                            {t.status === "BLOCKED" ? "⛔" : "✓"} {t.type}
                          </span>
                          <span
                            className="orbitron"
                            style={{
                              fontSize: 7,
                              color: "oklch(0.45 0.04 230)",
                            }}
                          >
                            {t.time}
                          </span>
                        </div>
                        <div
                          className="orbitron"
                          style={{
                            fontSize: 7,
                            color: "oklch(0.45 0.04 230)",
                            marginTop: 1,
                          }}
                        >
                          {t.source}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Blackbox Widget (V17) */}
                <BlackboxWidget />

                {/* Rublik Cyber Score Panel */}
                <RublikScorePanel />

                {/* Auto Pilot Widget */}
                <AutoPilotWidget />
              </div>
            </div>
          </>
        )}
      </main>

      {/* ===== TRUST ENGINE (V17) ===== */}
      <TrustEngineWidget />

      {/* ===== BOTTOM TICKER ===== */}
      <div
        className="relative z-20 overflow-hidden shrink-0"
        style={{
          background: "oklch(0.08 0.02 240)",
          borderTop: "1px solid oklch(0.76 0.14 75 / 0.3)",
          height: 28,
        }}
        data-ocid="ticker.panel"
      >
        <div className="absolute inset-0 flex items-center">
          <div
            className="flex whitespace-nowrap animate-ticker"
            style={{ willChange: "transform" }}
          >
            {[0, 1].map((copy) => (
              <span
                key={copy}
                className="orbitron font-semibold"
                style={{
                  color: "oklch(0.76 0.14 75)",
                  fontSize: 9,
                  letterSpacing: 1.5,
                  paddingRight: "4rem",
                }}
              >
                {TICKER_TEXT}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Printable V16 Form (hidden on screen, shown on print) */}
      <PrintableV16Form
        voicePrint={voicePrint}
        scanState={scanState}
        memoryCounter={memoryCounter}
      />

      {/* RBI Report Modal */}
      {showRBIReport && (
        <RBIReportModal
          onClose={() => setShowRBIReport(false)}
          scanState={scanState}
          memoryCounter={memoryCounter}
          voicePrint={voicePrint}
        />
      )}

      {/* Footer attribution */}
      <div
        className="relative z-20 text-center shrink-0 py-0.5"
        style={{
          background: "oklch(0.07 0.02 245)",
          borderTop: "1px solid oklch(0.20 0.04 235)",
        }}
      >
        <span
          className="orbitron"
          style={{
            color: "oklch(0.35 0.04 230)",
            fontSize: 7,
            letterSpacing: 0.5,
          }}
        >
          © {new Date().getFullYear()} — BUILT WITH ♥ USING{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "oklch(0.55 0.08 230)" }}
          >
            CAFFEINE.AI
          </a>
        </span>
      </div>
    </div>
  );
}
