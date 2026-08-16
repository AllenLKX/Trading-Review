import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          border: "16px solid #c8c2ff",
          borderRadius: 96,
          display: "flex",
          fontSize: 150,
          fontWeight: 800,
          height: 340,
          justifyContent: "center",
          width: 340
        }}
      >
        RT
      </div>
    </div>,
    size
  );
}
