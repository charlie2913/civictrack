import { useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../map/leafletIcons";

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
};

const MapPicker = ({ lat, lng, onChange }: MapPickerProps) => {
  const center = useMemo<[number, number]>(
    () => [lat ?? -16.5, lng ?? -68.15],
    [lat, lng],
  );

  const MapEvents = () => {
    useMapEvents({
      click: (event) => {
        onChange(event.latlng.lat, event.latlng.lng);
      },
    });
    return null;
  };

  return (
    <div className="h-[280px] overflow-hidden rounded-[1.5rem] border border-[var(--ct-border)]">
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        whenCreated={(map) => {
          if (lat && lng) {
            map.setView(new L.LatLng(lat, lng), 15);
          }
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapEvents />
        {lat !== null && lng !== null && (
          <CircleMarker
            center={[lat, lng]}
            radius={10}
            pathOptions={{
              color: "#0b6b64",
              fillColor: "#0b6b64",
              fillOpacity: 0.95,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapPicker;
