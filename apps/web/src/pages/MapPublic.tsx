import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../map/leafletIcons";
import PriorityBadge from "../components/common/PriorityBadge";

type MapItem = {
  id: string;
  lng: number;
  lat: number;
  type?: "point" | "cluster";
  count?: number;
  category?: string;
  status?: string;
  createdAt?: string;
  effectivePriority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const defaultCategories = ["BACHE", "LUMINARIA", "VEREDA", "DRENAJE"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const defaultCategoryLabels: Record<string, string> = {
  BACHE: "Bache",
  LUMINARIA: "Luminaria",
  VEREDA: "Vereda",
  DRENAJE: "Drenaje",
};

const defaultCategoryColors: Record<string, string> = {
  BACHE: "#ef4444",
  LUMINARIA: "#f59e0b",
  VEREDA: "#10b981",
  DRENAJE: "#3b82f6",
};

const fallbackPalette = [
  "#0ea5e9",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
  "#22c55e",
  "#f43f5e",
  "#eab308",
];

const labelForCategory = (category: string) =>
  defaultCategoryLabels[category] ?? category;

const lng2tile = (lng: number, z: number) => {
  const n = Math.pow(2, z);
  return Math.floor(((lng + 180) / 360) * n);
};

const lat2tile = (lat: number, z: number) => {
  const n = Math.pow(2, z);
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const MapEvents = ({ onBoundsChange }: { onBoundsChange: () => void }) => {
  useMapEvents({
    moveend: onBoundsChange,
    zoomend: onBoundsChange,
  });
  return null;
};

const labelIcon = (label: string, color: string) =>
  L.divIcon({
    html: `
      <div style="
        display:flex;
        align-items:center;
        gap:6px;
        background:rgba(255,255,255,0.95);
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(212,204,192,0.8);
        box-shadow:0 10px 24px rgba(0,0,0,0.18);
        font-size:12px;
        font-weight:600;
        color:#1a1c1e;
        white-space:nowrap;">
        <span style="width:8px;height:8px;border-radius:999px;background:${color};"></span>
        <span style="text-align:center;display:block;">${label}</span>
      </div>`,
    className: "map-label",
  });

const pinIcon = (color: string, size: number) =>
  L.divIcon({
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:999px 999px 999px 0;
        transform:rotate(-45deg);
        background:${color};
        border:2px solid white;
        box-shadow:0 8px 18px rgba(0,0,0,0.25);
        position:relative;">
        <div style="
          width:${Math.max(6, Math.round(size * 0.4))}px;
          height:${Math.max(6, Math.round(size * 0.4))}px;
          border-radius:999px;
          background:white;
          position:absolute;
          top:${Math.round(size * 0.25)}px;
          left:${Math.round(size * 0.25)}px;
          transform:rotate(45deg);
        "></div>
      </div>`,
    className: "map-pin",
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size * 0.9)],
  });

const MapReady = ({ onReady }: { onReady: (map: L.Map) => void }) => {
  const map = useMap();
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    onReady(map);
  }, [map, onReady]);
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
  const [districtFilter, setDistrictFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([...defaultCategories]);
  const [districts, setDistricts] = useState<string[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const debounceRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const initialLoadRef = useRef(false);
  const lastBoundsKeyRef = useRef<string | null>(null);
  const fetchRef = useRef<() => void>(() => {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeHaloId, setActiveHaloId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [debug, setDebug] = useState<{
    mapReady: boolean;
    lastFetchAt?: string;
    lastUrl?: string;
    lastStatus?: number;
    lastError?: string;
  }>({ mapReady: false });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pointItems = useMemo(
    () => items.filter((item) => item.type !== "cluster"),
    [items],
  );
  const clusterItems = useMemo(
    () => items.filter((item) => item.type === "cluster"),
    [items],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/config/public`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          reportCategories?: string[];
          districts?: string[];
        };
        if (payload.reportCategories?.length) {
          setCategories(payload.reportCategories);
        }
        if (payload.districts?.length) {
          setDistricts(payload.districts);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    };

    loadConfig();
    return () => controller.abort();
  }, []);

  const fetchMarkers = useCallback(async () => {
    if (!mapRef.current) {
      console.log("[Map] mapRef no listo");
      return;
    }
    const map = mapRef.current;
    const bounds = map.getBounds();
    const size = map.getSize();
    if (!bounds.isValid() || size.x === 0 || size.y === 0) {
      return;
    }
    const west = bounds.getWest();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    if (
      !Number.isFinite(west) ||
      !Number.isFinite(south) ||
      !Number.isFinite(east) ||
      !Number.isFinite(north) ||
      west >= east ||
      south >= north
    ) {
      return;
    }

    const getTilesForBounds = (zoomLevel: number) => {
      const n = Math.pow(2, zoomLevel);
      let minX = clamp(lng2tile(west, zoomLevel), 0, n - 1);
      let maxX = clamp(lng2tile(east, zoomLevel), 0, n - 1);
      let minY = clamp(lat2tile(north, zoomLevel), 0, n - 1);
      let maxY = clamp(lat2tile(south, zoomLevel), 0, n - 1);
      if (minX > maxX) [minX, maxX] = [maxX, minX];
      if (minY > maxY) [minY, maxY] = [maxY, minY];

      const tiles: Array<{ x: number; y: number }> = [];
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          tiles.push({ x, y });
        }
      }
      return tiles;
    };

    const mapZoom = Math.round(map.getZoom());
    let tileZoom = Math.min(Math.max(mapZoom, 0), 18);
    let tiles = getTilesForBounds(tileZoom);
    while (tiles.length > 12 && tileZoom > 8) {
      tileZoom -= 1;
      tiles = getTilesForBounds(tileZoom);
    }

    const boundsKey = [
      west.toFixed(5),
      south.toFixed(5),
      east.toFixed(5),
      north.toFixed(5),
      categoryFilter,
      statusFilter,
      priorityFilter,
      districtFilter,
      fromDate,
      toDate,
      tileZoom,
    ].join("|");
    if (boundsKey === lastBoundsKeyRef.current) {
      return;
    }

    const params = new URLSearchParams();
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (districtFilter !== "ALL") params.set("district", districtFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const queryString = params.toString();
    const tileUrls = tiles.map(
      (tile) =>
        `${API_BASE}/api/reports/map/tiles/${tileZoom}/${tile.x}/${tile.y}${
          queryString ? `?${queryString}` : ""
        }`,
    );

    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all(
        tileUrls.map((url) =>
          fetch(url, { credentials: "include" }).then((response) => {
            if (!response.ok) {
              throw new Error("No se pudieron cargar los reportes del mapa.");
            }
            return response.json();
          }),
        ),
      );
      const combined = responses.flatMap((payload: { items?: MapItem[] }) =>
        payload.items ?? [],
      );
      const deduped = new Map<string, MapItem>();
      combined.forEach((item) => {
        const key = `${item.type ?? "point"}-${item.id}-${item.lng}-${item.lat}`;
        if (!deduped.has(key)) {
          deduped.set(key, item);
        }
      });
      setItems(Array.from(deduped.values()));
      lastBoundsKeyRef.current = boundsKey;
      setDebug((prev) => ({
        ...prev,
        lastFetchAt: new Date().toLocaleTimeString(),
        lastUrl: tileUrls[0],
        lastStatus: 200,
        lastError: undefined,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setDebug((prev) => ({
        ...prev,
        lastFetchAt: new Date().toLocaleTimeString(),
        lastUrl: tileUrls[0],
        lastStatus: undefined,
        lastError: message,
      }));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [
    categoryFilter,
    statusFilter,
    priorityFilter,
    districtFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    fetchRef.current = fetchMarkers;
  }, [fetchMarkers]);

  const scheduleFetch = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      fetchMarkers();
    }, 300);
  }, [fetchMarkers]);

  useEffect(() => {
    lastBoundsKeyRef.current = null;
    fetchMarkers();
  }, [categoryFilter, statusFilter, priorityFilter, districtFilter, fromDate, toDate, fetchMarkers]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setDebug((prev) => ({ ...prev, mapReady: true }));
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchRef.current();
    }
  }, []);

  const center = useMemo<[number, number]>(() => [-16.5, -68.15], []);
  const maxBounds = useMemo<L.LatLngBoundsExpression>(
    () => [
      [-16.65, -68.25],
      [-16.35, -68.0],
    ],
    [],
  );
  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = { ...defaultCategoryColors };
    let paletteIndex = 0;
    categories.forEach((category) => {
      if (!colors[category]) {
        colors[category] = fallbackPalette[paletteIndex % fallbackPalette.length];
        paletteIndex += 1;
      }
    });
    return colors;
  }, [categories]);

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    categories.forEach((category) => {
      labels[category] = labelForCategory(category);
    });
    return labels;
  }, [categories]);

  const getPointColor = (category?: string) =>
    category ? categoryColors[category] ?? "#64748b" : "#64748b";

  const getClusterColor = (count = 0) => {
    if (count >= 50) return "#ef4444";
    if (count >= 20) return "#f59e0b";
    if (count >= 10) return "#0ea5e9";
    return "#64748b";
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
          category?: string;
          status?: string;
          effectivePriority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
          photoUrls?: string[];
        };
        const coords = data.location?.coordinates;
        if (coords && mapRef.current) {
          setSelectedId(data.id);
          setSelectedItem({
            id: data.id,
            lat: coords[1],
            lng: coords[0],
            category: data.category,
            status: data.status,
            effectivePriority: data.effectivePriority ?? null,
          });
          const photo = data.photoUrls?.[0];
          setSelectedPhoto(photo ? (photo.startsWith("http") ? photo : `${API_BASE}${photo}`) : null);
          setPanelOpen(true);
          mapRef.current.setView([coords[1], coords[0]], 16);
          scheduleFetch();
        }
      } catch {
        // ignore focus errors
      }
    },
    [scheduleFetch],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const params = new URLSearchParams(location.search);
        const email =
          params.get("email") ?? localStorage.getItem("civictrack_last_email") ?? undefined;
        const url = new URL(`${API_BASE}/api/reports/${id}`);
        if (email) url.searchParams.set("email", email);
        const response = await fetch(url.toString(), { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as { photoUrls?: string[] };
        const photo = data.photoUrls?.[0];
        setSelectedPhoto(photo ? (photo.startsWith("http") ? photo : `${API_BASE}${photo}`) : null);
      } catch {
        // ignore detail errors
      }
    },
    [location.search],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reportId = params.get("reportId");
    const email = params.get("email") ?? localStorage.getItem("civictrack_last_email") ?? undefined;
    if (reportId) {
      focusReport(reportId, email ?? undefined);
    }
  }, [location.search, focusReport]);

  useEffect(() => {
    if (!mapRef.current) return;
    const raf = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
    const handle = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
      const center = mapRef.current?.getCenter();
      const zoom = mapRef.current?.getZoom();
      if (center && typeof zoom === "number") {
        mapRef.current?.setView(center, zoom, { animate: false });
      }
    }, 250);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(handle);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      document.body.style.overflow = "";
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  const pointCount = pointItems.length;
  const clusterCount = clusterItems.length;

  return (
    <div
      className={`relative flex flex-col gap-6 map-public-bg ${
        isFullscreen ? "min-h-screen" : ""
      }`}
    >
      <header className={`space-y-1 ${isFullscreen ? "hidden" : ""}`}>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Mapa de Incidencias
        </h1>
      </header>

      <div
        className={`rounded-[2rem] border border-[var(--ct-border)] bg-white/85 p-5 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.4)] ${
          isFullscreen ? "hidden" : ""
        }`}
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.25rem] border border-[var(--ct-border)] bg-white px-4 py-4">
            
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Categorias
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                >
                  <option value="ALL">Todas</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category] ?? category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Estados
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                >
                  <option value="ALL">Todos</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="REOPENED">REOPENED</option>
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Prioridades
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                >
                  <option value="ALL">Todas</option>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Distrito
                <select
                  value={districtFilter}
                  onChange={(event) => setDistrictFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                >
                  <option value="ALL">Todos</option>
                  {districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Desde
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                />
              </label>
              <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Hasta
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                />
              </label>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-[var(--ct-border)] bg-white/95 px-4 py-4 text-xs text-[var(--ct-ink-muted)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Leyenda de categorias
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <div key={category} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: categoryColors[category] ?? "#64748b" }}
                  />
                  <span>{categoryLabels[category] ?? category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section
        style={
          isFullscreen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 10000,
              }
            : undefined
        }
        className={`relative rounded-[2rem] border border-[var(--ct-border)] bg-white/80 p-4 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)] ${
          isFullscreen ? "rounded-none border-none bg-[var(--ct-bg)] p-0 shadow-none" : ""
        }`}
      >
        <div
          className={`overflow-hidden rounded-[1.5rem] ${
            isFullscreen ? "absolute inset-0 rounded-none" : "h-[520px]"
          }`}
          style={isFullscreen ? { position: "absolute", inset: 0 } : undefined}
        >
          <MapContainer
            center={center}
            zoom={13}
            className="h-full w-full"
            style={{
              height: "100%",
              width: "100%",
              position: isFullscreen ? "absolute" : "relative",
              inset: isFullscreen ? 0 : undefined,
            }}
            maxBounds={maxBounds}
            minZoom={11}
            maxZoom={18}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapReady onReady={handleMapReady} />
            <MapEvents onBoundsChange={scheduleFetch} />
            {clusterItems.map((item) => (
              <Marker
                key={`cluster-${item.id}-${item.lng}-${item.lat}`}
                position={[item.lat, item.lng]}
                icon={labelIcon(
                  `${item.count ?? 0}`,
                  getClusterColor(item.count ?? 0),
                )}
                eventHandlers={{
                  click: () => {
                    const map = mapRef.current;
                    if (!map) return;
                    const nextZoom = Math.min(map.getZoom() + 2, 18);
                    map.setView([item.lat, item.lng], nextZoom);
                    scheduleFetch();
                  },
                }}
              />
            ))}
            {pointItems.map((item) => {
              const color = getPointColor(item.category);
              const size =
                item.effectivePriority === "CRITICAL"
                  ? 28
                  : item.effectivePriority === "HIGH"
                    ? 24
                    : item.effectivePriority === "MEDIUM"
                      ? 22
                      : item.effectivePriority === "LOW"
                        ? 20
                        : 20;
              return (
                <Marker
                  key={`pin-${item.id}`}
                  position={[item.lat, item.lng]}
                  icon={pinIcon(color, size)}
                  eventHandlers={{
                    click: () => {
                      setSelectedId(item.id);
                      setSelectedItem(item);
                      setPanelOpen(true);
                      setActiveHaloId(item.id);
                      loadDetail(item.id);
                    },
                    mouseover: () => setHoveredId(item.id),
                    mouseout: () => setHoveredId(null),
                  }}
                />
              );
            })}
            {pointItems
              .filter((item) => item.id === hoveredId || item.id === activeHaloId)
              .map((item) => (
                <CircleMarker
                  key={`halo-${item.id}`}
                  center={[item.lat, item.lng]}
                  radius={
                    item.effectivePriority === "CRITICAL"
                      ? 26
                      : item.effectivePriority === "HIGH"
                        ? 24
                        : item.effectivePriority === "MEDIUM"
                          ? 22
                          : 20
                  }
                  pathOptions={{
                    color: getPointColor(item.category),
                    weight: 2,
                    opacity: 0.4,
                    fillOpacity: 0,
                  }}
                  interactive={false}
                />
              ))}
          </MapContainer>
        </div>
        {!isFullscreen && (
          <>
            <div className="mt-3 text-xs text-[var(--ct-ink-muted)]">
              {loading
                ? "Cargando reportes..."
                : `Mostrando ${pointCount} reportes${
                    clusterCount ? ` en ${clusterCount} clusters` : ""
                  }`}
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            {import.meta.env.DEV && debug.lastError && (
              <p className="mt-2 text-xs text-red-600">Error mapa: {debug.lastError}</p>
            )}
          </>
        )}
      {selectedItem && panelOpen && (
        <section className="absolute right-6 top-6 z-[999] w-[320px] rounded-[2rem] border border-[var(--ct-border)] bg-white/95 p-5 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Reporte seleccionado
          </p>
          <button
            type="button"
            onClick={() => {
              setPanelOpen(false);
              setActiveHaloId(null);
            }}
            className="absolute right-5 top-5 rounded-full border border-[var(--ct-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
          >
            Cerrar
          </button>
          <p className="mt-2 text-lg font-semibold text-[var(--ct-ink)]">
            {selectedItem.category
              ? categoryLabels[selectedItem.category] ?? selectedItem.category
              : "Incidencia"}
          </p>
          <p className="mt-1">Estado: {selectedItem.status ?? "N/D"}</p>
          <div className="mt-2">
            <PriorityBadge priority={selectedItem.effectivePriority ?? undefined} />
          </div>
          {selectedPhoto ? (
            <img
              src={selectedPhoto}
              alt="Evidencia"
              className="mt-3 h-32 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-[var(--ct-border)] px-3 py-4 text-center text-xs text-[var(--ct-ink-muted)]">
              Sin evidencia adjunta
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(`/reports/${selectedItem.id}`)}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold text-white"
          >
            Ver detalle
          </button>
        </section>
        )}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className={`absolute bottom-6 right-6 z-[800] inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ct-border)] bg-white/90 text-[var(--ct-ink-muted)] shadow-md transition hover:scale-[1.03] ${
            isFullscreen ? "backdrop-blur" : ""
          }`}
        >
          {isFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M8 4H4v4M12 4h4v4M4 12v4h4M16 12v4h-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </button>
      </section>

      {isFullscreen && (
        <>
          <div className="fixed left-6 top-6 z-[10020] max-w-[360px] rounded-[1.5rem] border border-[var(--ct-border)] bg-white/90 px-5 py-4 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)] backdrop-blur">
            <h2 className="mt-1 text-2xl font-[var(--ct-font-display)] text-[var(--ct-ink)]">
              Mapa de Incidencias
            </h2>
            <p className="mt-1 text-sm text-[var(--ct-ink-muted)]">
              Explora la ciudad y ubica reportes activos.
            </p>
          </div>

          <aside
            className={`fixed left-6 top-40 z-[10020] w-[260px] space-y-4 transition-transform duration-300 ${
              filtersOpen ? "translate-x-0" : "-translate-x-[110%]"
            }`}
          >
            <div className="rounded-[1.25rem] border border-[var(--ct-border)] bg-white/95 px-4 py-4 text-xs text-[var(--ct-ink-muted)] shadow-[0_14px_40px_-30px_rgba(0,0,0,0.45)] backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Filtros
                </p>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-full border border-[var(--ct-border)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                >
                  Ocultar
                </button>
              </div>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Categorias
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    <option value="ALL">Todas</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category] ?? category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Estados
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    <option value="ALL">Todos</option>
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REOPENED">REOPENED</option>
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Prioridades
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    <option value="ALL">Todas</option>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Distrito
                  <select
                    value={districtFilter}
                    onChange={(event) => setDistrictFilter(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  >
                    <option value="ALL">Todos</option>
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Desde
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  />
                </label>
                <label className="grid gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Hasta
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--ct-border)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]"
                  />
                </label>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--ct-border)] bg-white/95 px-4 py-4 text-xs text-[var(--ct-ink-muted)] shadow-[0_14px_40px_-30px_rgba(0,0,0,0.45)] backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                Leyenda de categorias
              </p>
              <div className="mt-3 grid gap-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: categoryColors[category] ?? "#64748b" }}
                    />
                    <span>{categoryLabels[category] ?? category}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {!filtersOpen && (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="fixed left-0 top-40 z-[10030] rounded-r-full border border-[var(--ct-border)] bg-white/95 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)] shadow-md backdrop-blur"
            >
              Filtros
            </button>
          )}
        </>
      )}

      {selectedItem && !panelOpen && (
        <button
          type="button"
          onClick={() => {
            setPanelOpen(true);
            setActiveHaloId(selectedItem.id);
          }}
          className="fixed bottom-6 right-6 rounded-full bg-[var(--ct-accent)] px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Ver reporte
        </button>
      )}
    </div>
  );
};

export default MapPublic;
