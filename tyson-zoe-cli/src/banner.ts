import pc from "picocolors";

export function showBanner(version: string): void {
  const C = pc.green;
  const D = pc.dim;
  const W = pc.white;
  const B = pc.bold;

  const logo = [
    "",
    `  ${C("╔══════════════════════════════════════════════════════╗")}`,
    `  ${C("║")}  ${B(W("🐕 TysonZoeMonitor"))}  ${D("— Home CCTV Intelligence")}    ${C("║")}`,
    `  ${C("║")}  ${D(`v${version}  ·  Dog monitoring & intrusion detection`)}  ${C("║")}`,
    `  ${C("╚══════════════════════════════════════════════════════╝")}`,
    "",
  ];

  console.log(logo.join("\n"));
}
