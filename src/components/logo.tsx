import logoAsset from "@/assets/weaze-logo.png.asset.json";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  variant?: "default" | "mark";
  alt?: string;
};

/**
 * Official WEAZE logo. Purple wordmark on transparent background.
 * `variant="mark"` crops to the square area — useful for avatars/favicons.
 */
export function Logo({ className, alt = "WEAZE" }: LogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn("h-8 w-auto select-none", className)}
      draggable={false}
    />
  );
}
