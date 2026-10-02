// Social logo for the public page, sign-in, and the staff header.
// Notice letters do not use this image.
// Width and height are both fixed so a flex parent cannot squash the mark.

import Image from "next/image";
import { SOCIAL_LOGO_HEIGHT, SOCIAL_LOGO_SRC, SOCIAL_LOGO_WIDTH } from "@/lib/brand";

const HEIGHT = {
  header: 56,
  mark: 72,
  hero: 88,
} as const;

export function BrandLogo({
  size = "mark",
  priority = false,
}: {
  size?: keyof typeof HEIGHT;
  priority?: boolean;
}) {
  const height = HEIGHT[size];
  const width = Math.round((height * SOCIAL_LOGO_WIDTH) / SOCIAL_LOGO_HEIGHT);

  return (
    <Image
      src={SOCIAL_LOGO_SRC}
      alt="Being Vakil"
      width={SOCIAL_LOGO_WIDTH}
      height={SOCIAL_LOGO_HEIGHT}
      priority={priority}
      unoptimized
      className="block max-w-none shrink-0 self-start"
      style={{ width, height, maxWidth: "none" }}
    />
  );
}
