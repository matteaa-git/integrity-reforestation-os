"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string, size = 28) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};border:2.5px solid white;
      transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const CAMP_COLORS: Record<string, string> = {
  active:  "#22c55e",
  next:    "#f59e0b",
  planned: "#6366f1",
  past:    "#6b7280",
};

const HOSPITAL_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:26px;height:26px;border-radius:50%;
    background:#ef4444;border:2.5px solid white;
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;font-weight:bold;
    box-shadow:0 2px 6px rgba(0,0,0,.4);
  ">✚</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -16],
});

const BLOCK_COLORS: Record<string, string> = {
  planting: "#22c55e",
  complete: "#3b82f6",
  upcoming: "#9ca3af",
};

interface Camp {
  id: string; name: string; lat: number; lng: number;
  status: "active" | "next" | "planned" | "past";
  arrivalDate: string; departureDate: string; notes: string;
}
interface Hospital {
  name: string; city: string; lat: number; lng: number; phone: string; distanceKm: number;
}
interface Block {
  id: string; name: string; lat: number; lng: number; species: string;
  targetTrees: number; plantedTrees: number; crew: string;
  status: "planting" | "complete" | "upcoming";
}

interface Props {
  camps: Camp[];
  hospitals: Hospital[];
  blocks: Block[];
  selectedCamp: Camp;
  onSelectCamp: (c: Camp) => void;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 9, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

export default function OpsMap({ camps, hospitals, blocks, selectedCamp, onSelectCamp }: Props) {
  const campRoute = camps
    .filter(c => c.status !== "past")
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))
    .map(c => [c.lat, c.lng] as [number, number]);

  return (
    <MapContainer
      center={[selectedCamp.lat, selectedCamp.lng]}
      zoom={8}
      style={{ height: "100%", width: "100%", background: "#1a1f2e" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />

      <FlyTo lat={selectedCamp.lat} lng={selectedCamp.lng} />

      {/* Route line between camps */}
      <Polyline
        positions={campRoute}
        pathOptions={{ color: "#f59e0b", weight: 2, dashArray: "6 4", opacity: 0.6 }}
      />

      {/* Camps */}
      {camps.map(camp => (
        <Marker
          key={camp.id}
          position={[camp.lat, camp.lng]}
          icon={makeIcon(CAMP_COLORS[camp.status])}
          eventHandlers={{ click: () => onSelectCamp(camp) }}
        >
          <Popup>
            <div style={{ minWidth: 180, fontFamily: "sans-serif" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{camp.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                {camp.arrivalDate} → {camp.departureDate}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{camp.notes}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Hospitals */}
      {hospitals.map(h => (
        <Marker key={h.name} position={[h.lat, h.lng]} icon={HOSPITAL_ICON}>
          <Popup>
            <div style={{ minWidth: 180, fontFamily: "sans-serif" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#ef4444", marginBottom: 4 }}>✚ {h.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{h.city}</div>
              <div style={{ fontSize: 11, color: "#374151" }}>{h.phone}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{h.distanceKm} km from active camp</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Planting blocks */}
      {blocks.map(blk => (
        <Marker
          key={blk.id}
          position={[blk.lat, blk.lng]}
          icon={makeIcon(BLOCK_COLORS[blk.status], 22)}
        >
          <Popup>
            <div style={{ minWidth: 180, fontFamily: "sans-serif" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{blk.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{blk.species} · {blk.crew}</div>
              <div style={{ fontSize: 11, color: "#22c55e" }}>
                {blk.plantedTrees.toLocaleString()} / {blk.targetTrees.toLocaleString()} planted
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
