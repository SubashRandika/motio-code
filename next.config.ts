import type { NextConfig } from "next";

/**
 * The Supabase project's hostname, for the avatars bucket.
 *
 * Read from the environment rather than hardcoded so this file does not have to
 * change per deployment, and narrowed to the one bucket path: the allowance
 * exists for profile pictures, and should not double as a way to proxy anything
 * else the project stores.
 */
function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();

const nextConfig: NextConfig = {
  images: {
    /*
      Gravatar, for avatars derived from a user's email address.

      Going through the image optimizer rather than pointing an <img> straight
      at gravatar.com is deliberate: the browser fetches from this origin and
      this origin fetches from Gravatar, so Automattic never sees a signed-in
      user's IP address. `pathname` is pinned to the avatar endpoint so the
      allowance cannot be reused to proxy arbitrary Gravatar URLs.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gravatar.com",
        port: "",
        pathname: "/avatar/**",
      },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              port: "",
              pathname: "/storage/v1/object/public/avatars/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
