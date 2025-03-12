// GeoJSON Types based on the GeoJSON specification (RFC 7946)

export interface GeoJsonObject {
  type: string;
  bbox?: number[];
  [key: string]: any;
}

export interface Geometry {
  type: string;
  coordinates: any;
  [key: string]: any;
}

export interface Point extends Geometry {
  type: 'Point';
  coordinates: number[];
}

export interface LineString extends Geometry {
  type: 'LineString';
  coordinates: number[][];
}

export interface Polygon extends Geometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface MultiPoint extends Geometry {
  type: 'MultiPoint';
  coordinates: number[][];
}

export interface MultiLineString extends Geometry {
  type: 'MultiLineString';
  coordinates: number[][][];
}

export interface MultiPolygon extends Geometry {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export interface GeometryCollection extends GeoJsonObject {
  type: 'GeometryCollection';
  geometries: Geometry[];
}

export interface Feature extends GeoJsonObject {
  type: 'Feature';
  geometry: Geometry | null;
  properties: { [key: string]: any } | null;
  id?: string | number;
}

export interface FeatureCollection extends GeoJsonObject {
  type: 'FeatureCollection';
  features: Feature[];
}

// Style options for GeoJSON layers
export interface GeoJsonLayerStyle {
  color?: string;
  weight?: number;
  opacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  dashArray?: string;
  lineCap?: string;
  lineJoin?: string;
  className?: string;
}

// Interface for GeoJSON layer with metadata
export interface GeoJsonLayer {
  id: string;
  name: string;
  data: FeatureCollection;
  visible: boolean;
  style: GeoJsonLayerStyle;
}