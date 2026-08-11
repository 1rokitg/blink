"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import type { VisitorPin } from "@/lib/traffic-live-types";

import "leaflet/dist/leaflet.css";

const PULSE_STYLE_ID = "circle-traffic-pulse-style-v2";

function ensurePulseStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  document.getElementById("circle-traffic-pulse-style")?.remove();
  const style = document.createElement("style");
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    .circle-traffic-marker { background: transparent !important; border: none !important; }
    .circle-pulse {
      position: relative;
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
    }
    .circle-pulse.is-selected { width: 24px; height: 24px; }
    .circle-pulse__ring {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      background: rgba(112, 167, 255, 0.28);
      filter: blur(0.5px);
      animation: circle-pulse-ring 2.4s ease-out infinite;
    }
    .circle-pulse.is-selected .circle-pulse__ring {
      background: rgba(112, 167, 255, 0.38);
      animation-duration: 1.8s;
    }
    .circle-pulse__core {
      position: relative;
      width: 7px;
      height: 7px;
      border-radius: 9999px;
      background: rgba(158, 197, 255, 0.95);
      border: none;
      box-shadow:
        0 0 6px 2px rgba(112, 167, 255, 0.45),
        0 0 14px 4px rgba(112, 167, 255, 0.22);
    }
    .circle-pulse.is-selected .circle-pulse__core {
      width: 9px;
      height: 9px;
      background: rgba(190, 219, 255, 0.98);
      box-shadow:
        0 0 8px 3px rgba(112, 167, 255, 0.55),
        0 0 18px 6px rgba(112, 167, 255, 0.28);
    }
    .circle-pulse.is-unique .circle-pulse__core {
      background: rgba(153, 246, 228, 0.95);
      box-shadow:
        0 0 6px 2px rgba(52, 211, 153, 0.4),
        0 0 14px 4px rgba(52, 211, 153, 0.2);
    }
    .circle-pulse.is-unique .circle-pulse__ring {
      background: rgba(52, 211, 153, 0.26);
    }
    .circle-pulse.is-unique.is-selected .circle-pulse__core {
      background: rgba(167, 243, 208, 0.98);
      box-shadow:
        0 0 8px 3px rgba(52, 211, 153, 0.5),
        0 0 18px 6px rgba(52, 211, 153, 0.26);
    }
    @keyframes circle-pulse-ring {
      0% { transform: scale(0.5); opacity: 0.55; }
      65% { transform: scale(1.9); opacity: 0.12; }
      100% { transform: scale(2.35); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function FitPins({ pins }: { pins: VisitorPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0]!.lat, pins[0]!.lng], 4);
      return;
    }
    const bounds = L.latLngBounds(
      pins.map((pin) => [pin.lat, pin.lng] as [number, number]),
    );
    map.fitBounds(bounds.pad(0.35), { maxZoom: 5, animate: false });
  }, [map, pins]);

  return null;
}

function pulseMarkerIcon(
  selected: boolean,
  mode: "pageviews" | "uniques",
) {
  const size = selected ? 22 : 18;
  const classes = [
    "circle-pulse",
    selected ? "is-selected" : "",
    mode === "uniques" ? "is-unique" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return L.divIcon({
    className: "circle-traffic-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<span class="${classes}" aria-hidden="true"><span class="circle-pulse__ring"></span><span class="circle-pulse__core"></span></span>`,
  });
}

export function WorldTrafficMapCanvas({
  pins,
  mode,
  selectedId,
  onSelect,
}: {
  pins: VisitorPin[];
  mode: "pageviews" | "uniques";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  useEffect(() => {
    ensurePulseStyles();
  }, []);

  const markers = useMemo(
    () =>
      pins.filter(
        (pin) =>
          Number.isFinite(pin.lat) &&
          Number.isFinite(pin.lng) &&
          Math.abs(pin.lat) <= 90 &&
          Math.abs(pin.lng) <= 180,
      ),
    [pins],
  );

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={1}
      maxZoom={8}
      scrollWheelZoom
      worldCopyJump
      className="h-[360px] w-full sm:h-[420px]"
      style={{ background: "#0b1220" }}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <FitPins pins={markers} />
      {markers.map((pin) => {
        const selected = selectedId === pin.id;
        return (
          <Marker
            key={`${mode}-${pin.id}`}
            position={[pin.lat, pin.lng]}
            icon={pulseMarkerIcon(selected, mode)}
            zIndexOffset={selected ? 1000 : 1}
            eventHandlers={{
              click: () => onSelect(selected ? null : pin.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
              <span className="font-mono text-[11px]">
                {pin.shortId} · {pin.city || pin.country} · {pin.path}
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
