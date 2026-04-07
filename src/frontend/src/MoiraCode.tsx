import { useEffect, useRef, useState } from "react";

// ===== Types =====
type ThreatStatus = "DETECTED" | "ANALYSING" | "M.SIM MATCH" | "ABSOLVED";
type ThreatClass =
  | "ADVERSARIAL AI"
  | "DEEPFAKE INJECTION"
  | "VOICE SYNTHETIC"
  | "MODEL POISON"
  | "NEURAL PROBE";

interface AiThreat {
  id: string;
  timestamp: string;
  threatClass: ThreatClass;
  vectorSource: string;
  status: ThreatStatus;
  memoryMatchId: string;
  countermeasure: string;
  confidence: string;
  frequency: string;
  amplitude: string;
}

// ===== Constants =====
const THREAT_CLASSES: ThreatClass[] = [
  "ADVERSARIAL AI",
  "DEEPFAKE INJECTION",
  "VOICE SYNTHETIC",
  "MODEL POISON",
  "NEURAL PROBE",
];

const VECTOR_SOURCES = [
  "GPT-4-TURBO VARIANT",
  "DIFFUSION MODEL BREACH",
  "GAN VOICE CLONE",
  "LLAMA-3 POISONED WEIGHT",
  "NN PROBE: LAYER-7",
  "TRANSFORMER ADVERSARIAL",
  "SYNTHETIC EMBEDDING ATTACK",
  "PROMPT INJECTION VECTOR",
  "REWARD HACK: RL-AGENT",
  "DATA POISONING: TRAIN-SET",
];

const COUNTERMEASURES = [
  "NEURAL PATTERN INVERSION",
  "ADVERSARIAL GRADIENT SHIELD",
  "ELEPHANT MEMORY OVERRIDE",
  "VOICE PRINT NULLIFICATION",
  "WEIGHT CORRUPTION ROLLBACK",
  "EMBEDDING SPACE LOCKOUT",
  "SEMANTIC DRIFT CORRECTION",
  "ACTIVATION PATTERN BLOCK",
];

const FREQUENCIES = ["432.7", "517.3", "388.1", "460.0", "491.5"];
const AMPLITUDES = ["9.4", "11.2", "8.7", "10.5", "7.9"];

function genMemoryMatchId() {
  return `MSM-${Math.floor(2000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
}

function genConfidence() {
  return `${(96 + Math.random() * 3.9).toFixed(1)}%`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nowTs() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ===== Radiowave SVG =====
function RadiowaveNeutraliser({
  hasActive,
  frequency,
  amplitude,
}: {
  hasActive: boolean;
  frequency: string;
  amplitude: string;
}) {
  return (
    <div
      style={{
        background: "oklch(0.08 0.03 240 / 0.9)",
        border: "1px solid oklch(0.22 0.04 235)",
        borderTop: "2px solid oklch(0.82 0.18 200 / 0.6)",
        borderRadius: 6,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 9,
          fontWeight: 900,
          color: "oklch(0.82 0.18 200)",
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
        }}
      >
        📡 RADIOWAVE NEUTRALISER
      </div>

      {/* SVG animation */}
      <div
        style={{
          position: "relative",
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <style>{`
          @keyframes rw-ring {
            0% { transform: scale(0.4); opacity: 0.9; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .rw-ring { animation: rw-ring 2.8s ease-out infinite; transform-origin: center; }
          .rw-ring-1 { animation-delay: 0s; }
          .rw-ring-2 { animation-delay: 0.56s; }
          .rw-ring-3 { animation-delay: 1.12s; }
          .rw-ring-4 { animation-delay: 1.68s; }
          .rw-ring-5 { animation-delay: 2.24s; }
        `}</style>
        <svg
          width="120"
          height="96"
          viewBox="0 0 120 96"
          aria-hidden="true"
          role="presentation"
        >
          <title>Radiowave neutraliser animation</title>
          {[1, 2, 3, 4, 5].map((i) => (
            <ellipse
              key={i}
              className={`rw-ring rw-ring-${i}`}
              cx="60"
              cy="48"
              rx="22"
              ry="18"
              fill="none"
              stroke="#00FFFF"
              strokeWidth={hasActive ? 1.5 : 0.8}
              opacity={hasActive ? 0.85 : 0.4}
            />
          ))}
          <circle
            cx="60"
            cy="48"
            r="4"
            fill={hasActive ? "#FFD700" : "#00FFFF"}
          />
          <circle
            cx="60"
            cy="48"
            r="7"
            fill="none"
            stroke={hasActive ? "#FFD700" : "#00FFFF"}
            strokeWidth="1"
            opacity="0.6"
          />
          {hasActive && (
            <>
              <path
                d="M10,48 Q20,36 30,48 Q40,60 50,48"
                stroke="#00FFFF"
                strokeWidth="1"
                fill="none"
                opacity="0.5"
              />
              <path
                d="M70,48 Q80,36 90,48 Q100,60 110,48"
                stroke="#00FFFF"
                strokeWidth="1"
                fill="none"
                opacity="0.5"
              />
            </>
          )}
        </svg>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          ["FREQUENCY", `${frequency} MHz`],
          ["AMPLITUDE", `${amplitude} dB`],
          ["PULSE INTERVAL", "1.5s"],
        ].map(([label, val]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: 8,
                color: "oklch(0.55 0.05 225)",
                letterSpacing: 0.8,
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: 9,
                fontWeight: 700,
                color: "oklch(0.82 0.18 200)",
              }}
            >
              {val}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 6,
            padding: "4px 8px",
            background: "oklch(0.12 0.05 25 / 0.3)",
            border: "1px solid oklch(0.72 0.25 25 / 0.6)",
            borderRadius: 4,
            fontFamily: "'Orbitron', monospace",
            fontSize: 8,
            fontWeight: 900,
            color: "oklch(0.72 0.25 25)",
            letterSpacing: 1,
            textAlign: "center" as const,
            animation: "blink 1.5s ease-in-out infinite",
          }}
        >
          ⚡ 432.7 MHz — ACTIVE FIELD — AI THREAT INTERCEPTION
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 4,
          border: `1px solid ${
            hasActive
              ? "oklch(0.76 0.14 75 / 0.8)"
              : "oklch(0.55 0.18 145 / 0.7)"
          }`,
          background: hasActive
            ? "oklch(0.18 0.06 75 / 0.25)"
            : "oklch(0.12 0.06 145 / 0.2)",
          fontFamily: "'Orbitron', monospace",
          fontSize: 9,
          fontWeight: 900,
          color: hasActive ? "#FFD700" : "#00FF88",
          letterSpacing: 1,
        }}
      >
        {hasActive ? "⚡ JAMMING ACTIVE" : "✓ CLEAR"}
      </div>
    </div>
  );
}

// ===== M.SIM Absolution Engine =====
function MSimAbsolutionEngine({ threat }: { threat: AiThreat | null }) {
  const isNeutralising =
    threat &&
    (threat.status === "ANALYSING" || threat.status === "M.SIM MATCH");
  const isAbsolved = threat?.status === "ABSOLVED";

  return (
    <div
      style={{
        background: "oklch(0.08 0.03 240 / 0.9)",
        border: "1px solid oklch(0.22 0.04 235)",
        borderTop: `2px solid ${
          isNeutralising
            ? "oklch(0.62 0.20 25 / 0.8)"
            : isAbsolved
              ? "oklch(0.55 0.18 145 / 0.8)"
              : "oklch(0.76 0.14 75 / 0.6)"
        }`,
        borderRadius: 6,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: 9,
          fontWeight: 900,
          color: "oklch(0.76 0.14 75)",
          letterSpacing: 1.5,
        }}
      >
        🧠 M.SIM ABSOLUTION ENGINE
      </div>

      {threat ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["MEMORY MATCH ID", threat.memoryMatchId],
            ["COUNTERMEASURE", threat.countermeasure],
            ["CONFIDENCE", threat.confidence],
            ["THREAT CLASS", threat.threatClass],
          ].map(([label, val]) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 7,
                  color: "oklch(0.50 0.05 225)",
                  letterSpacing: 0.8,
                  marginBottom: 1,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "oklch(0.82 0.18 200)",
                  letterSpacing: 0.5,
                }}
              >
                {val}
              </div>
            </div>
          ))}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 12px",
              borderRadius: 4,
              marginTop: 4,
              border: `1px solid ${
                isAbsolved
                  ? "oklch(0.55 0.18 145 / 0.7)"
                  : isNeutralising
                    ? "oklch(0.62 0.20 25 / 0.8)"
                    : "oklch(0.76 0.14 75 / 0.8)"
              }`,
              background: isAbsolved
                ? "oklch(0.12 0.06 145 / 0.2)"
                : isNeutralising
                  ? "oklch(0.15 0.06 25 / 0.2)"
                  : "oklch(0.18 0.06 75 / 0.25)",
              fontFamily: "'Orbitron', monospace",
              fontSize: 10,
              fontWeight: 900,
              color: isAbsolved
                ? "#00FF88"
                : isNeutralising
                  ? "#FF4444"
                  : "#FFD700",
              letterSpacing: 1,
              animation: isNeutralising
                ? "pulse 1s ease-in-out infinite"
                : "none",
            }}
          >
            {isAbsolved
              ? "\u27e8ABSOLVED\u27e9"
              : isNeutralising
                ? "\u27e8NEUTRALISING\u27e9"
                : "\u27e8STANDBY\u27e9"}
          </div>
        </div>
      ) : (
        <div
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: 9,
            color: "oklch(0.55 0.05 225)",
            paddingTop: 8,
          }}
        >
          AWAITING THREAT SIGNAL...
        </div>
      )}
    </div>
  );
}

// ===== Status colour helper =====
function statusColor(s: ThreatStatus): string {
  if (s === "DETECTED") return "#FF4444";
  if (s === "ANALYSING") return "#FF8C00";
  if (s === "M.SIM MATCH") return "#FFD700";
  return "#00FF88";
}

// ===== Main MoiraCode Panel =====
export function MoiraCodePanel() {
  const [threats, setThreats] = useState<AiThreat[]>([]);
  const [absolvCount, setAbsolvCount] = useState(1247);
  const [termLines, setTermLines] = useState<string[]>([]);
  const [classCounts, setClassCounts] = useState<Record<ThreatClass, number>>({
    "ADVERSARIAL AI": 312,
    "DEEPFAKE INJECTION": 244,
    "VOICE SYNTHETIC": 198,
    "MODEL POISON": 287,
    "NEURAL PROBE": 206,
  });
  const termRef = useRef<HTMLDivElement>(null);
  const threatIdRef = useRef(1000);

  // Spawn threats
  useEffect(() => {
    const spawnThreat = () => {
      const threatClass = pick(THREAT_CLASSES);
      const freq = pick(FREQUENCIES);
      const amp = pick(AMPLITUDES);
      const newThreat: AiThreat = {
        id: `ATL-${(threatIdRef.current++).toString().padStart(5, "0")}`,
        timestamp: nowTs(),
        threatClass,
        vectorSource: pick(VECTOR_SOURCES),
        status: "DETECTED",
        memoryMatchId: genMemoryMatchId(),
        countermeasure: pick(COUNTERMEASURES),
        confidence: genConfidence(),
        frequency: freq,
        amplitude: amp,
      };

      setThreats((prev) => [newThreat, ...prev].slice(0, 6));

      setTermLines((prev) =>
        [
          ...prev,
          `MOIRA> THREAT_DETECTED :: CLASS=${threatClass.replace(/ /g, "_")} :: ID=${newThreat.id} :: VECTOR=${newThreat.vectorSource.split(" ")[0]}`,
        ].slice(-10),
      );

      const steps: [ThreatStatus, number][] = [
        ["ANALYSING", 1200],
        ["M.SIM MATCH", 2400],
        ["ABSOLVED", 3800],
      ];

      let cumulative = 0;
      for (const [nextStatus, delay] of steps) {
        cumulative += delay;
        const capturedStatus = nextStatus;
        const capturedDelay = cumulative;
        setTimeout(() => {
          setThreats((prev) =>
            prev.map((t) =>
              t.id === newThreat.id ? { ...t, status: capturedStatus } : t,
            ),
          );

          if (capturedStatus === "M.SIM MATCH") {
            setTermLines((prev) =>
              [
                ...prev,
                `MOIRA> THREAT_CLASS=${threatClass.replace(/ /g, "_")} :: VECTOR=NEURAL_PROBE :: MSIM.ABSORB(${newThreat.memoryMatchId})`,
                `MOIRA> RADIOWAVE.JAM(${freq}MHz) :: AMPLITUDE=${amp}dB :: STATUS=NEUTRALISING`,
              ].slice(-10),
            );
          }

          if (capturedStatus === "ABSOLVED") {
            setAbsolvCount((c) => c + 1);
            setClassCounts((prev) => ({
              ...prev,
              [threatClass]: prev[threatClass] + 1,
            }));
            setTermLines((prev) =>
              [
                ...prev,
                "MOIRA> MEMORY.BIND(ELEPHANT_VAULT) :: PATTERN_INVERSION=TRUE :: THREAT_ABSOLVED",
                `MOIRA> COMPLIANCE.LOG(RBI-AUTH-PULSE) :: AI_THREAT_LOG_ID=${newThreat.id}`,
              ].slice(-10),
            );
          }
        }, capturedDelay);
      }
    };

    spawnThreat();
    const interval = setInterval(spawnThreat, 2000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal — depends on termLines length
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally watching termLines to scroll on new output
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [termLines]);

  const hasActive = threats.some(
    (t) =>
      t.status === "DETECTED" ||
      t.status === "ANALYSING" ||
      t.status === "M.SIM MATCH",
  );
  const latestNonAbsolved =
    threats.find(
      (t) =>
        t.status === "DETECTED" ||
        t.status === "ANALYSING" ||
        t.status === "M.SIM MATCH",
    ) ??
    threats[0] ??
    null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ===== Panel Header ===== */}
      <div
        style={{
          background: "oklch(0.09 0.04 240 / 0.95)",
          border: "1px solid oklch(0.22 0.04 235)",
          borderTop: "2px solid oklch(0.76 0.14 75)",
          borderRadius: 6,
          padding: "10px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            flexWrap: "wrap" as const,
          }}
        >
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 13,
              fontWeight: 900,
              color: "#FFD700",
              letterSpacing: 2,
            }}
          >
            MOIRA CODE \u27e8/\u27e9 \u2014 AI THREAT ABSOLUTION ENGINE
          </div>
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 8,
              color: "oklch(0.82 0.18 200)",
              letterSpacing: 1,
              opacity: 0.8,
            }}
          >
            POWERED BY M.SIM ELEPHANT MEMORY \u00d7 RADIOWAVE NEUTRALISATION
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap" as const,
          }}
        >
          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 10,
              fontWeight: 700,
              color: "#FFD700",
              letterSpacing: 1,
              background: "oklch(0.15 0.05 75 / 0.3)",
              border: "1px solid oklch(0.76 0.14 75 / 0.5)",
              borderRadius: 4,
              padding: "2px 10px",
            }}
          >
            AI THREATS ABSOLVED: {absolvCount.toLocaleString()}
          </div>

          <div
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 9,
              fontWeight: 900,
              color: hasActive ? "#FF4444" : "#00FF88",
              background: hasActive
                ? "oklch(0.15 0.06 25 / 0.3)"
                : "oklch(0.12 0.06 145 / 0.2)",
              border: `1px solid ${
                hasActive
                  ? "oklch(0.62 0.20 25 / 0.7)"
                  : "oklch(0.55 0.18 145 / 0.6)"
              }`,
              borderRadius: 4,
              padding: "2px 10px",
              animation: hasActive ? "pulse 0.8s ease-in-out infinite" : "none",
            }}
          >
            {hasActive ? "\u26d4 THREAT ACTIVE" : "\u2713 ALL CLEAR"}
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
            {(Object.entries(classCounts) as [ThreatClass, number][]).map(
              ([cls, cnt]) => (
                <div
                  key={cls}
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 7,
                    fontWeight: 700,
                    color: "oklch(0.82 0.18 200)",
                    background: "oklch(0.12 0.04 200 / 0.4)",
                    border: "1px solid oklch(0.82 0.18 200 / 0.3)",
                    borderRadius: 3,
                    padding: "1px 6px",
                    letterSpacing: 0.5,
                  }}
                >
                  {cls}: {cnt}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* ===== Main content area ===== */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left: Threat Stream + Terminal */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flex: 2,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* AI Threat Detection Stream */}
          <div
            style={{
              background: "oklch(0.07 0.03 240 / 0.95)",
              border: "1px solid oklch(0.22 0.04 235)",
              borderTop: "2px solid oklch(0.62 0.20 25 / 0.7)",
              borderRadius: 6,
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: 9,
                fontWeight: 900,
                color: "oklch(0.62 0.20 25)",
                letterSpacing: 1.5,
                marginBottom: 2,
              }}
            >
              \ud83d\udef0 AI THREAT DETECTION STREAM \u2014 LIVE
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr 110px",
                gap: 6,
                padding: "2px 0",
                borderBottom: "1px solid oklch(0.20 0.04 235)",
              }}
            >
              {["TIME", "THREAT CLASS", "VECTOR SOURCE", "STATUS"].map((h) => (
                <div
                  key={h}
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 7,
                    fontWeight: 700,
                    color: "oklch(0.50 0.05 225)",
                    letterSpacing: 0.8,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {threats.map((t, i) => (
                <div
                  key={t.id}
                  data-ocid={`moiracode.threat.item.${i + 1}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 1fr 110px",
                    gap: 6,
                    padding: "4px 6px",
                    borderRadius: 3,
                    background:
                      t.status === "DETECTED"
                        ? "oklch(0.12 0.06 25 / 0.3)"
                        : t.status === "ANALYSING"
                          ? "oklch(0.13 0.05 55 / 0.3)"
                          : t.status === "M.SIM MATCH"
                            ? "oklch(0.15 0.05 75 / 0.3)"
                            : "oklch(0.10 0.05 145 / 0.2)",
                    borderLeft: `3px solid ${statusColor(t.status)}`,
                    transition: "all 0.4s ease",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: 8,
                      color: "oklch(0.55 0.05 225)",
                    }}
                  >
                    {t.timestamp}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      color: statusColor(t.status),
                    }}
                  >
                    {t.threatClass}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: 7,
                      color: "oklch(0.65 0.06 225)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {t.vectorSource}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: 8,
                      fontWeight: 900,
                      color: statusColor(t.status),
                      letterSpacing: 0.5,
                    }}
                  >
                    {t.status}
                  </div>
                </div>
              ))}
              {threats.length === 0 && (
                <div
                  data-ocid="moiracode.threat.empty_state"
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 9,
                    color: "oklch(0.40 0.04 225)",
                    padding: "8px 0",
                  }}
                >
                  MONITORING... NO THREATS DETECTED
                </div>
              )}
            </div>
          </div>

          {/* Moira Code Terminal */}
          <div
            style={{
              background: "oklch(0.05 0.02 240 / 0.98)",
              border: "1px solid oklch(0.22 0.04 235)",
              borderTop: "2px solid oklch(0.76 0.14 75 / 0.8)",
              borderRadius: 6,
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: 9,
                fontWeight: 900,
                color: "#FFD700",
                letterSpacing: 1.5,
              }}
            >
              \u27e8/\u27e9 MOIRA CODE TERMINAL \u2014 LIVE EXECUTION
            </div>
            <div
              ref={termRef}
              data-ocid="moiracode.editor"
              style={{
                flex: 1,
                overflowY: "auto" as const,
                fontFamily: "'Courier New', 'JetBrains Mono', monospace",
                fontSize: 10,
                color: "#FFD700",
                lineHeight: 1.7,
                paddingRight: 4,
                minHeight: 80,
              }}
            >
              {termLines.map((line, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: terminal output lines, append-only, index stable
                  key={`term-${i}`}
                  style={{ opacity: i === termLines.length - 1 ? 1 : 0.75 }}
                >
                  {line}
                </div>
              ))}
              {termLines.length === 0 && (
                <div style={{ opacity: 0.4 }}>
                  MOIRA&gt; SYSTEM INITIALISING...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: M.SIM Engine + Radiowave */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: 220,
            flexShrink: 0,
          }}
        >
          <MSimAbsolutionEngine threat={latestNonAbsolved} />
          <RadiowaveNeutraliser
            hasActive={hasActive}
            frequency={latestNonAbsolved?.frequency ?? "432.7"}
            amplitude={latestNonAbsolved?.amplitude ?? "9.4"}
          />
        </div>
      </div>
    </div>
  );
}
