import React, { useEffect, useState } from "react";

export default function Subtitles() {
  const [captions, setCaptions] = useState("");

  useEffect(() => {
    const ws = new WebSocket("wss://api.vexa.ai/subtitles?token=YOUR_KEY");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "subtitle") {
        if (data.mode === "partial") {
          setCaptions(data.text + " ...");
        } else {
          setCaptions((prev) => prev + "\n" + data.text);
        }
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="p-4 bg-black text-white font-mono text-lg rounded-lg">
      {captions.split("\n").map((line, idx) => (
        <p key={idx}>{line}</p>
      ))}
    </div>
  );
}
