"use client";

import { ArrowUpRight } from "lucide-react";
import {
  CryptoHubIllustration,
  LayeredCubesIllustration,
  SatelliteIllustration,
} from "./BlockeyIllustrations";
import type { NavTab } from "./SideNavbar";

export function WorkspaceResources({
  onNavigate,
}: {
  onNavigate: (tab: NavTab) => void;
}) {
  return (
    <div className="app-resource-grid" aria-label="Explore the workspace">
      {[
        {
          title: "Your funding workspace",
          text: "Explore the terms and the mechanics behind your hedge.",
          link: "Read the guide",
          tab: "overview" as const,
          art: CryptoHubIllustration,
        },
        {
          title: "Find your other side",
          text: "Browse fixed-rate offers from other Testnet participants.",
          link: "Explore offers",
          tab: "marketplace" as const,
          art: SatelliteIllustration,
        },
        {
          title: "An easier first step",
          text: "Follow an agreement from matching to final settlement.",
          link: "Try the walkthrough",
          tab: "replay" as const,
          art: LayeredCubesIllustration,
        },
      ].map((item, index) => (
        <article
          className={`app-resource-card${index === 2 ? " app-resource-mint" : ""}`}
          key={item.title}
        >
          <div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
            <button onClick={() => onNavigate(item.tab)}>
              {item.link}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <item.art className="app-resource-illustration" />
        </article>
      ))}
    </div>
  );
}
