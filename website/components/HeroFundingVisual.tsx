import { ArrowUpRight, Check, LockKeyhole } from "lucide-react";

export function HeroFundingVisual() {
  return (
    <figure
      className="hero-visual"
      aria-label="An illustrative fixed-rate funding agreement"
    >
      <div className="hero-visual-halo" aria-hidden="true" />
      <div
        className="hero-visual-orbit hero-visual-orbit-one"
        aria-hidden="true"
      />
      <div
        className="hero-visual-orbit hero-visual-orbit-two"
        aria-hidden="true"
      />
      <svg
        className="hero-signal-path"
        viewBox="0 0 540 540"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="hero-signal"
            x1="10"
            y1="320"
            x2="520"
            y2="180"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8bfaad" stopOpacity="0" />
            <stop offset=".45" stopColor="#8bfaad" stopOpacity=".7" />
            <stop offset="1" stopColor="#8bfaad" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-20 310H55L72 282L91 333L112 292L133 308H167C210 308 191 179 243 179H560"
          stroke="url(#hero-signal)"
          strokeWidth="1.3"
        />
        <circle cx="449" cy="179" r="3" fill="#8bfaad" />
      </svg>

      <div className="hero-floating-label">
        <span />
        Built for a little more certainty <ArrowUpRight size={12} />
      </div>

      <svg
        className="hero-lock-sculpture"
        viewBox="0 0 340 390"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="hero-lock-shackle"
            x1="80"
            y1="40"
            x2="238"
            y2="170"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#39433c" />
            <stop offset=".18" stopColor="#f3f8f3" />
            <stop offset=".34" stopColor="#8b9b8e" />
            <stop offset=".52" stopColor="#d6e5d8" />
            <stop offset=".73" stopColor="#4d6353" />
            <stop offset="1" stopColor="#bdd9c5" />
          </linearGradient>
          <linearGradient
            id="hero-lock-face"
            x1="70"
            y1="155"
            x2="270"
            y2="338"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#75877a" />
            <stop offset=".14" stopColor="#3c4a40" />
            <stop offset=".42" stopColor="#202d25" />
            <stop offset=".76" stopColor="#111c15" />
            <stop offset="1" stopColor="#3b5944" />
          </linearGradient>
          <linearGradient
            id="hero-lock-edge"
            x1="270"
            y1="172"
            x2="276"
            y2="332"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#b4cfbc" />
            <stop offset=".3" stopColor="#496451" />
            <stop offset="1" stopColor="#14291d" />
          </linearGradient>
          <linearGradient
            id="hero-lock-outline"
            x1="76"
            y1="171"
            x2="246"
            y2="323"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#d3e2d4" stopOpacity=".8" />
            <stop offset=".45" stopColor="#a1b4a6" stopOpacity=".1" />
            <stop offset="1" stopColor="#8bfaad" stopOpacity=".7" />
          </linearGradient>
          <radialGradient id="hero-key-glow">
            <stop stopColor="#8bfaad" stopOpacity=".17" />
            <stop offset="1" stopColor="#8bfaad" stopOpacity="0" />
          </radialGradient>
          <filter
            id="hero-lock-shadow"
            x="-50%"
            y="-30%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="25"
              stdDeviation="17"
              floodColor="#000"
              floodOpacity=".5"
            />
          </filter>
        </defs>
        <g transform="rotate(12 170 195)" filter="url(#hero-lock-shadow)">
          <path
            d="M110 179V113C110 74 135 48 171 48C207 48 233 74 233 113V180"
            stroke="#0c1510"
            strokeWidth="30"
            strokeLinecap="round"
          />
          <path
            d="M104 177V109C104 70 130 43 166 43C203 43 229 70 229 109V178"
            stroke="url(#hero-lock-shackle)"
            strokeWidth="25"
            strokeLinecap="round"
          />
          <path
            d="M96 151V108C96 68 126 36 166 36"
            stroke="#f2f7ef"
            strokeOpacity=".45"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M247 155L269 165C280 170 286 182 286 196V304C286 326 275 337 258 340L234 332V165Z"
            fill="url(#hero-lock-edge)"
          />
          <rect
            x="65"
            y="153"
            width="203"
            height="183"
            rx="39"
            fill="url(#hero-lock-face)"
            stroke="url(#hero-lock-outline)"
            strokeWidth="1.4"
          />
          <path
            d="M80 182C83 172 93 165 106 165H227"
            stroke="#e8f1e6"
            strokeOpacity=".25"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M82 316C91 325 102 326 113 326H225C240 326 249 320 253 310"
            stroke="#8bfaad"
            strokeOpacity=".3"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="166" cy="244" r="65" fill="url(#hero-key-glow)" />
          <circle cx="166" cy="236" r="12" fill="#a2fac0" />
          <path
            d="M160 244L157 263C156 268 159 271 164 271H169C174 271 177 268 176 263L172 244"
            fill="#a2fac0"
          />
          <path
            d="M86 288H114"
            stroke="#9cad9f"
            strokeOpacity=".35"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M86 295H102"
            stroke="#9cad9f"
            strokeOpacity=".2"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="237" cy="296" r="3" fill="#8bfaad" />
        </g>
      </svg>

      <div className="hero-agreement-card">
        <div className="hero-agreement-heading">
          <span className="hero-agreement-icon">
            <LockKeyhole size={15} />
          </span>
          <span>Your fixed funding rate</span>
          <span className="hero-agreement-check">
            <Check size={12} />
          </span>
        </div>
        <div className="hero-agreement-rate">
          0.02<span>%</span>
          <small>per 8 hours</small>
        </div>
        <div className="hero-agreement-details">
          <div>
            <span>Market</span>
            <strong>SOL-PERP</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>7 days</strong>
          </div>
        </div>
        <div className="hero-agreement-footer">
          <span />
          <span>One rate. Through every interval.</span>
        </div>
      </div>
      <div className="hero-market-tag" aria-hidden="true">
        <svg width="62" height="25" viewBox="0 0 62 25" fill="none">
          <path
            d="M0 17H6L12 9L18 21L25 4L32 16L39 10L45 19L51 7L57 13H62"
            stroke="#84928a"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        <span>Variable markets.</span>
      </div>
      <figcaption>Illustrative agreement · Solana Testnet</figcaption>
    </figure>
  );
}
