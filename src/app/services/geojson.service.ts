import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as L from 'leaflet';
import {
  FeatureCollection,
  Feature,
  GeoJsonLayer,
  GeoJsonLayerStyle
} from '../models/geojson.model';

@Injectable({
  providedIn: 'root'
})
export class GeoJsonService {
  private layers: Map<string, GeoJsonLayer> = new Map();
  private leafletLayers: Map<string, L.GeoJSON> = new Map();
  
  // Default style for GeoJSON features
  private defaultStyle: GeoJsonLayerStyle = {
    color: '#3388ff',
    weight: 3,
    opacity: 1,
    fillColor: '#3388ff',
    fillOpacity: 0.2
  };

  constructor(private http: HttpClient) {}

  /**
   * Load GeoJSON from a URL
   */
  loadFromUrl(url: string, name: string, style?: GeoJsonLayerStyle): Observable<GeoJsonLayer> {
    return this.http.get<any>(url).pipe(
      map(data => this.processGeoJson(data, name, style)),
      catchError(error => {
        console.error('Error loading GeoJSON from URL:', error);
        return throwError(() => new Error('Failed to load GeoJSON from URL'));
      })
    );
  }

  /**
   * Load GeoJSON from a file
   */
  loadFromFile(file: File, name: string, style?: GeoJsonLayerStyle): Observable<GeoJsonLayer> {
    return new Observable<GeoJsonLayer>(observer => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        try {
          const data = JSON.parse(e.target.result);
          const layer = this.processGeoJson(data, name, style);
          observer.next(layer);
          observer.complete();
        } catch (error) {
          console.error('Error parsing GeoJSON file:', error);
          observer.error('Failed to parse GeoJSON file');
        }
      };
      
      reader.onerror = (e) => {
        console.error('Error reading file:', e);
        observer.error('Failed to read file');
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Process GeoJSON data and create a layer
   */
  private processGeoJson(data: any, name: string, style?: GeoJsonLayerStyle): GeoJsonLayer {
    // Validate GeoJSON structure
    if (!this.isValidGeoJson(data)) {
      throw new Error('Invalid GeoJSON format');
    }
    
    const layerId = `geojson-${Date.now()}`;
    const layerStyle = { ...this.defaultStyle, ...style };
    
    const layer: GeoJsonLayer = {
      id: layerId,
      name: name,
      data: data as FeatureCollection,
      visible: true,
      style: layerStyle
    };
    
    // Store the layer
    this.layers.set(layerId, layer);
    
    return layer;
  }

  /**
   * Create a Leaflet GeoJSON layer from a GeoJsonLayer
   */
  createLeafletLayer(layer: GeoJsonLayer): L.GeoJSON {
    const leafletLayer = L.geoJSON(layer.data as any, {
      style: (feature) => {
        // Allow per-feature styling if available, otherwise use layer style
        if (feature?.properties?.style) {
          return { ...layer.style, ...feature.properties.style };
        }
        return layer.style;
      },
      pointToLayer: (feature, latlng) => {
        // Custom marker for point features
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: layer.style.fillColor || '#3388ff',
          color: layer.style.color || '#3388ff',
          weight: layer.style.weight || 1,
          opacity: layer.style.opacity || 1,
          fillOpacity: layer.style.fillOpacity || 0.8
        });
      },
      onEachFeature: (feature, leafletFeature) => {
        // Add popups for feature properties
        if (feature.properties) {
          const popupContent = this.createPopupContent(feature);
          leafletFeature.bindPopup(popupContent);
        }
      }
    });
    
    // Store the Leaflet layer reference
    this.leafletLayers.set(layer.id, leafletLayer);
    
    return leafletLayer;
  }

  /**
   * Create HTML content for feature popups
   */
  private createPopupContent(feature: any): string {
    if (!feature.properties) return 'No properties';
    
    let content = '<div class="geojson-popup">';
    
    // Add title if available
    if (feature.properties['name'] || feature.properties['title']) {
      content += `<h3>${feature.properties['name'] || feature.properties['title']}</h3>`;
    }
    
    // Add description if available
    if (feature.properties['description']) {
      content += `<p>${feature.properties['description']}</p>`;
    }
    
    // Add table of other properties
    content += '<table class="properties-table">';
    for (const [key, value] of Object.entries(feature.properties)) {
      // Skip already displayed properties and style
      if (['name', 'title', 'description', 'style'].includes(key)) continue;
      
      // Skip complex objects
      if (typeof value === 'object') continue;
      
      content += `<tr><th>${key}</th><td>${value}</td></tr>`;
    }
    content += '</table></div>';
    
    return content;
  }

  /**
   * Validate if the data is a valid GeoJSON object
   */
  private isValidGeoJson(data: any): boolean {
    // Check if it's an object
    if (!data || typeof data !== 'object') return false;
    
    // Check for FeatureCollection
    if (data.type === 'FeatureCollection') {
      return Array.isArray(data.features);
    }
    
    // Check for Feature
    if (data.type === 'Feature') {
      return data.geometry && data.properties !== undefined;
    }
    
    // Check for Geometry
    const geometryTypes = [
      'Point', 'MultiPoint', 'LineString', 'MultiLineString',
      'Polygon', 'MultiPolygon', 'GeometryCollection'
    ];
    
    if (geometryTypes.includes(data.type)) {
      return data.coordinates !== undefined || 
             (data.type === 'GeometryCollection' && Array.isArray(data.geometries));
    }
    
    return false;
  }

  /**
   * Get all GeoJSON layers
   */
  getLayers(): GeoJsonLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get a specific GeoJSON layer by ID
   */
  getLayer(id: string): GeoJsonLayer | undefined {
    return this.layers.get(id);
  }

  /**
   * Get a specific Leaflet layer by ID
   */
  getLeafletLayer(id: string): L.GeoJSON | undefined {
    return this.leafletLayers.get(id);
  }

  /**
   * Remove a GeoJSON layer
   */
  removeLayer(id: string): boolean {
    const removed = this.layers.delete(id);
    this.leafletLayers.delete(id);
    return removed;
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(id: string, visible?: boolean): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    
    // If visible is provided, set it; otherwise toggle
    layer.visible = visible !== undefined ? visible : !layer.visible;
    this.layers.set(id, layer);
    
    return layer.visible;
  }

  /**
   * Update layer style
   */
  updateLayerStyle(id: string, style: Partial<GeoJsonLayerStyle>): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    
    layer.style = { ...layer.style, ...style };
    this.layers.set(id, layer);
    
    // Update Leaflet layer style if it exists
    const leafletLayer = this.leafletLayers.get(id);
    if (leafletLayer) {
      leafletLayer.setStyle(layer.style as L.PathOptions);
    }
    
    return true;
  }
}