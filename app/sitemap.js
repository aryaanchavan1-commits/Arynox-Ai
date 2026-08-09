export default function sitemap() {
  return [
    {
      url: "https://arynox-ai.vercel.app",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://arynox-ai.vercel.app/app",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
