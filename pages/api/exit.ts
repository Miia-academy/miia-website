import { NextApiRequest, NextApiResponse } from "next";

export default function exitPreview(req: NextApiRequest, res: NextApiResponse) {
  const { slug = "" } = req.query;

  // Disabilita il Draft Mode
  res.setDraftMode({ enable: false });

  const previous = res.getHeader("Set-Cookie");
  if (previous && Array.isArray(previous)) {
    const updated = previous.map((cookie) =>
      cookie.replace("SameSite=None;Secure", "SameSite=Lax")
    );
    res.setHeader("Set-Cookie", updated);
  }

  // Only paths of this site: "//other.site" or "\\other.site" would leave it
  const path = String(Array.isArray(slug) ? slug.join("/") : slug).replace(/^[/\\]+/, "");
  res.redirect(/^[\w\-./]*$/.test(path) ? `/${path}` : "/");
}