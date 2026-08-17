import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "交易笔记本",
    short_name: "交易笔记本",
    description: "记录每一次判断，沉淀你的交易系统",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#051425",
    theme_color: "#5447e8",
    lang: "zh-CN",
    icons: [
      {
        src: "/brand-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
