import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#051425",
        color: "white",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%"
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#5447e8",
          border: "6px solid #c8c2ff",
          borderRadius: 34,
          display: "flex",
          fontSize: 54,
          fontWeight: 800,
          height: 120,
          justifyContent: "center",
          width: 120
        }}
      >
        RT
      </div>
    </div>,
    size
  );
}
