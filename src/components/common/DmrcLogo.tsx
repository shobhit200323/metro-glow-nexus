import dmrcLogoAsset from "@/assets/dmrc-logo.png.asset.json";

/** Official DMRC logo, served from CDN. */
export function DmrcLogo({ className }: { className?: string }) {
  return (
    <img
      src={dmrcLogoAsset.url}
      alt="Delhi Metro Rail Corporation"
      className={className}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}