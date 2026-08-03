import { NextApiRequest, NextApiResponse } from "next";

export default async function preview(req: NextApiRequest, res: NextApiResponse) {
  const { slug = "" } = req.query;
  const params = req.url?.split("?") || [];

  // Verifica il secret token
  if (req.query.secret !== process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW) {
    return res.status(401).json({ message: "Invalid token" });
  }

  // Abilita il Draft Mode nativo di Next.js 15
  res.setDraftMode({ enable: true });

  // Hack per i cookie in iframe (fondamentale per Storyblok su Vercel)
  const previous = res.getHeader("Set-Cookie");
  if (previous && Array.isArray(previous)) {
    const updated = previous.map((cookie) =>
      cookie.replace("SameSite=Lax", "SameSite=None;Secure")
    );
    res.setHeader("Set-Cookie", updated);
  }

  // Reindirizza allo slug corretto
  res.redirect(`/${slug}?${params[1] || ""}`);
}