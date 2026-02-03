import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../map/leafletIcons";
import PriorityBadge from "../components/common/PriorityBadge";

type MapItem = {
  id: string;
  lng: number;
  lat: number;
  type: "point" | "cluster";
  count?: number;
  category?: string;
  status?: string;
  createdAt?: string;
  effectivePriority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const categories = ["BACHE", "LUMINARIA", "VEREDA", "DRENAJE"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const MapEvents = ({ onBoundsChange }: { onBoundsChange: () => void }) => {
  useMapEvents({
    moveend: onBoundsChange,
    zoomend: onBoundsChange,
  });
  return null;
};

const MapPublic = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const mapRef = useRef<L.Map | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchMarkers = useCallback(async () => {
    if (!mapRef.current) return;
    const zoom = mapRef.current.getZoom();
    const bounds = mapRef.current.getBounds();

    const tileSize = 256;
    const project = (latLng: L.LatLng) =>
      mapRef.current!.project(latLng, zoom).divideBy(tileSize).floor();

    const nw = project(bounds.getNorthWest());
    const se = project(bounds.getSouthEast());

    const urls: string[] = [];
    for (let x = nw.x; x <= se.x; x += 1) {
      for (let y = nw.y; y <= se.y; y += 1) {
        const url = new URL(`${API_BASE}/api/reports/map/tiles/${zoom}/${x}/${y}`);
        if (categoryFilter !== "ALL") url.searchParams.set("category", categoryFilter);
        if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
        if (priorityFilter !== "ALL") url.searchParams.set("priority", priorityFilter);
        urls.push(url.toString());
      }
    }

    setLoading(true);
    setError(null);
    const fetchWithTimeout = (url: string) =>
      Promise.race([
        fetch(url, { credentials: "include" }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout de mapa")), 8000),
        ),
      ]);

    try {
      const results = await Promise.allSettled(urls.map(fetchWithTimeout));
      const okResponses = results
        .filter(
          (result): result is PromiseFulfilledResult<Response> =>
            result.status === "fulfilled" && result.value.ok,
        )
        .map((result) => result.value);

      if (okResponses.length === 0) {
        throw new Error("No se pudieron cargar los reportes del mapa.");
      }

      const payloads = await Promise.all(
        okResponses.map((resp) => resp.json() as Promise<{ items: MapItem[] }>),
      );
      const merged = payloads.flatMap((payload) => payload.items);
      const unique = new Map<string, MapItem>();
      merged.forEach((item) => {
        unique.set(`${item.type}-${item.id}`, item);
      });
      setItems(Array.from(unique.values()));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, priorityFilter]);

  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      fetchMarkers();
    }, 300);
  }, [fetchMarkers]);

  useEffect(() => {
    if (!mapRef.current) return;
    fetchMarkers();
  }, [fetchMarkers]);

  const center = useMemo<[number, number]>(() => [-16.5, -68.15], []);
  const maxBounds = useMemo<L.LatLngBoundsExpression>(
    () => [
      [-16.65, -68.25],
      [-16.35, -68.0],
    ],
    [],
  );

  const getPointColor = (priority?: string | null) => {
    switch (priority) {
      case "LOW":
        return "#059669";
      case "MEDIUM":
        return "#b45309";
      case "HIGH":
        return "#c2410c";
      case "CRITICAL":
        return "#dc2626";
      default:
        return "#64748b";
    }
  };

  const focusReport = useCallback(
    async (reportId: string, email?: string) => {
      try {
        const url = new URL(`${API_BASE}/api/reports/${reportId}`);
        if (email) url.searchParams.set("email", email);
        const response = await fetch(url.toString(), { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          id: string;
          location?: { coordinates?: [number, number] };
        };
        const coords = data.location?.coordinates;
        if (coords && mapRef.current) {
          setSelectedId(data.id);
          mapRef.current.setView([coords[1], coords[0]], 16);
          scheduleFetch();
        }
      } catch {
        // ignore focus errors
      }
    },
    [scheduleFetch],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reportId = params.get("reportId");
    const email = params.get("email") ?? localStorage.getItem("civictrack_last_email") ?? undefined;
    if (reportId) {
      focusReport(reportId, email ?? undefined);
    }
  }, [location.search, focusReport]);

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Mapa publico
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Incidencias visibles para toda la ciudad.
        </h1>
        <p className="max-w-2xl text-sm text-[var(--ct-ink-muted)] sm:text-base">
          Explora reportes y aplica filtros para encontrar incidencias cercanas.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todos los estados</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="SCHEDULED">SCHEDULED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="REOPENED">REOPENED</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="rounded-full border border-[var(--ct-border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
        >
          <option value="ALL">Todas las prioridades</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-[2rem] border border-[var(--ct-border)] bg-white/80 p-4 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
        <div className="h-[520px] overflow-hidden rounded-[1.5rem]">
          <MapContainer
            center={center}
            zoom={13}
            className="h-full w-full"
            maxBounds={maxBounds}
            minZoom={11}
            maxZoom={18}
            whenCreated={(map) => {
              mapRef.current = map;
              fetchMarkers();
            }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapEvents onBoundsChange={scheduleFetch} />
            {items.map((item) => {
              if (item.type === "cluster") {
                const size = Math.min(40 + (item.count ?? 0) / 2, 80);
                const icon = L.divIcon({
                  html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(11,107,100,0.9);color:white;border-radius:9999px;font-size:12px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,0.25);">${item.count}</div>`,
                  className: "cluster-marker",
                });
                return (
                  <Marker
                    key={`${item.type}-${item.id}`}
                    position={[item.lat, item.lng]}
                    icon={icon}
                    eventHandlers={{
                      click: () => {
                        mapRef.current?.setView([item.lat, item.lng], mapRef.current.getZoom() + 1);
                      },
                    }}
                  />
                );
              }
              return (
                <CircleMarker
                  key={`${item.type}-${item.id}`}
                  center={[item.lat, item.lng]}
                  radius={item.id === selectedId ? 12 : 7}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: getPointColor(item.effectivePriority),
                    fillOpacity: item.id === selectedId ? 1 : 0.9,
                    weight: item.id === selectedId ? 3 : 2,
                  }}
                >
                  <Popup>
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold">{item.category}</p>
                      <p>Estado: {item.status}</p>
                      <PriorityBadge priority={item.effectivePriority ?? undefined} />
                      {item.createdAt && <p>{new Date(item.createdAt).toLocaleString()}</p>}
                      <button
                        type="button"
                        onClick={() => navigate(`/track?reportId=${item.id}`)}
                        className="rounded-full bg-[var(--ct-accent)] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Rastrear
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <div className="mt-3 text-xs text-[var(--ct-ink-muted)]">
          {loading ? "Cargando reportes..." : `Mostrando ${items.length} reportes`}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </section>
    </div>
  );
};

export default MapPublic;
