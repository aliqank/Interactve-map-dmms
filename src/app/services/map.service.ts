import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Loader } from '@googlemaps/js-api-loader';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: L.Map;
  private googleMapsLoaded = false;
  private googleMapsLoader!: Loader;
  private baseLayers: {[key: string]: L.TileLayer} = {};
  private layerControl!: L.Control.Layers;
  private _selectedLayer = new BehaviorSubject<string>('roadmap');
  
  // You need to replace this with your actual Google Maps API key
  private googleMapsApiKey = 'test';

  // Icons
  private measurementIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [20, 32],  // Reduced size
    iconAnchor: [10, 32],
    popupAnchor: [1, -32],
    shadowSize: [32, 32]
  });

  private searchIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  private polygonIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  constructor() {
    // Initialize the Google Maps loader
    this.googleMapsLoader = new Loader({
      apiKey: this.googleMapsApiKey,
      version: 'weekly'
    });
    
    // Load the selected layer from localStorage if available
    const savedLayer = localStorage.getItem('selectedMapLayer');
    if (savedLayer) {
      this._selectedLayer.next(savedLayer);
      console.log('Loaded saved map layer from localStorage:', savedLayer);
    }
  }

  /**
   * Initialize the map
   * @param elementId The ID of the HTML element to render the map in
   * @returns The initialized map instance
   */
  initializeMap(elementId: string): L.Map {
    try {
      console.log('MapService: Initializing map with element ID:', elementId);
      
      // Create the map
      this.map = L.map(elementId, {
        center: [51.1694, 71.4491], // Astana, Kazakhstan
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });
      
      console.log('MapService: Map created successfully');

      // Add zoom control to the bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(this.map);

      // Add attribution control to the bottom right
      L.control.attribution({
        position: 'bottomright'
      }).addTo(this.map);

      // Initialize base layers
      this.initializeBaseLayers();
      console.log('MapService: Base layers initialized');

      // Add a fallback OSM layer in case Google Maps layers aren't loaded yet
      if (!this.baseLayers['osm']) {
        this.baseLayers['osm'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
        console.log('MapService: Added OSM fallback layer');
      }

      // Add the default layer to the map
      const defaultLayer = this.getSelectedLayer();
      console.log('MapService: Default layer is:', defaultLayer);
      
      if (this.baseLayers[defaultLayer]) {
        this.baseLayers[defaultLayer].addTo(this.map);
        console.log('MapService: Added default layer to map:', defaultLayer);
      } else {
        // Fallback to OSM if the default layer isn't available
        this.baseLayers['osm'].addTo(this.map);
        console.log('MapService: Default layer not available, using OSM fallback');
      }

      // Initialize layer control
      this.initializeLayerControl();
      console.log('MapService: Layer control initialized');

      // Force a resize event to ensure the map renders correctly
      setTimeout(() => {
        this.map.invalidateSize();
        console.log('MapService: Map size invalidated');
      }, 100);

      return this.map;
    } catch (error) {
      console.error('MapService: Error initializing map:', error);
      throw error;
    }
  }

  /**
   * Initialize the base layers
   */
  private initializeBaseLayers(): void {
    console.log('MapService: Initializing base layers');
    
    // OpenStreetMap layer
    this.baseLayers['osm'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    console.log('MapService: OSM layer initialized');

    // Initialize Google Maps layers immediately to avoid white screen
    try {
      // Google Maps Road layer
      this.baseLayers['roadmap'] = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });
      
      // Google Maps Satellite layer
      this.baseLayers['satellite'] = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });
      
      // Google Maps Hybrid layer
      this.baseLayers['hybrid'] = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });
      
      // Google Maps Terrain layer
      this.baseLayers['terrain'] = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });
      
      this.googleMapsLoaded = true;
      console.log('MapService: Google Maps layers initialized directly');
    } catch (error) {
      console.error('MapService: Error initializing Google Maps layers directly:', error);
      // Still try the async loading as fallback
      this.initializeGoogleMapsLayers();
    }
  }

  /**
   * Initialize Google Maps layers
   */
  private initializeGoogleMapsLayers(): void {
    if (!this.map) {
      console.warn('Map not initialized yet, skipping Google Maps layer initialization');
      return;
    }

    this.googleMapsLoader.load().then(() => {
      this.googleMapsLoaded = true;

      // Google Maps Road layer
      this.baseLayers['roadmap'] = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });

      // Google Maps Satellite layer
      this.baseLayers['satellite'] = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });

      // Google Maps Hybrid layer
      this.baseLayers['hybrid'] = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });

      // Google Maps Terrain layer
      this.baseLayers['terrain'] = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
      });

      // Update the map with the selected layer if it's a Google layer
      const currentLayer = this.getSelectedLayer();
      if (currentLayer !== 'osm' && !this.map.hasLayer(this.baseLayers[currentLayer])) {
        this.changeMapLayer(currentLayer);
      }

      // Update the layer control
      this.updateLayerControl();
    }).catch(error => {
      console.error('Error loading Google Maps:', error);
      // Fallback to OSM if Google Maps fails to load
      if (!this.baseLayers['osm']) {
        this.baseLayers['osm'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
      }
      this.changeMapLayer('osm');
    });
  }

  /**
   * Initialize the layer control
   */
  private initializeLayerControl(): void {
    // Create the layer control but don't add it to the map
    this.layerControl = L.control.layers({}, {}, {
      position: 'bottomleft',
      collapsed: true
    });
    
    // Add the control to the map
    this.layerControl.addTo(this.map);
    
    // Hide the default toggle button by adding a CSS class
    const layerControlElement = document.querySelector('.leaflet-control-layers');
    if (layerControlElement) {
      layerControlElement.classList.add('leaflet-control-layers-hidden');
      
      // Add a style tag to hide the default control toggle
      const style = document.createElement('style');
      style.textContent = `
        .leaflet-control-layers-hidden .leaflet-control-layers-toggle {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    this.updateLayerControl();
  }

  /**
   * Update the layer control with the current base layers
   */
  private updateLayerControl(): void {
    // Remove the existing control if it exists
    if (this.layerControl && this.map) {
      this.layerControl.remove();
    }

    // Create a new control if map exists
    if (this.map) {
      this.layerControl = L.control.layers({}, {}, {
        position: 'bottomleft',
        collapsed: true
      }).addTo(this.map);

      // Add all base layers to the control
      for (const [name, layer] of Object.entries(this.baseLayers)) {
        this.layerControl.addBaseLayer(layer, name.charAt(0).toUpperCase() + name.slice(1));
      }
      
      // Hide the default toggle button again
      setTimeout(() => {
        const layerControlElement = document.querySelector('.leaflet-control-layers');
        if (layerControlElement) {
          layerControlElement.classList.add('leaflet-control-layers-hidden');
        }
      }, 0);
    }
  }

  /**
   * Change the map layer
   * @param layerType The type of layer to switch to
   */
  changeMapLayer(layerType: string): void {
    // If the layer doesn't exist yet (Google Maps not loaded), initialize it
    if (!this.baseLayers[layerType] && !this.googleMapsLoaded) {
      this.initializeGoogleMapsLayers();
      return;
    }

    // If the layer doesn't exist, return
    if (!this.baseLayers[layerType]) {
      console.error(`Layer ${layerType} does not exist`);
      return;
    }

    // Remove all base layers
    for (const layer of Object.values(this.baseLayers)) {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    }

    // Add the selected layer
    this.baseLayers[layerType].addTo(this.map);

    // Update the selected layer
    this._selectedLayer.next(layerType);

    // Save the selected layer to localStorage
    localStorage.setItem('selectedMapLayer', layerType);
  }

  /**
   * Get the currently selected layer
   * @returns The currently selected layer
   */
  getSelectedLayer(): string {
    return this._selectedLayer.getValue();
  }

  /**
   * Get an observable of the selected layer
   * @returns An observable of the selected layer
   */
  getSelectedLayerObservable(): Observable<string> {
    return this._selectedLayer.asObservable();
  }

  /**
   * Get the map instance
   * @returns The map instance
   */
  getMap(): L.Map {
    return this.map;
  }

  /**
   * Set the map instance
   * @param map The map instance to set
   */
  setMap(map: L.Map): void {
    this.map = map;
  }

  /**
   * Get the measurement icon
   * @returns The measurement icon
   */
  getMeasurementIcon(): L.Icon {
    return this.measurementIcon;
  }

  /**
   * Get the search icon
   * @returns The search icon
   */
  getSearchIcon(): L.Icon {
    return this.searchIcon;
  }

  /**
   * Get the polygon icon
   * @returns The polygon icon
   */
  getPolygonIcon(): L.Icon {
    return this.polygonIcon;
  }

  /**
   * Pan the map to a specific location
   * @param lat The latitude
   * @param lng The longitude
   * @param zoom The zoom level
   */
  panTo(lat: number, lng: number, zoom?: number): void {
    if (zoom) {
      this.map.setView([lat, lng], zoom);
    } else {
      this.map.panTo([lat, lng]);
    }
  }

  /**
   * Fit the map to bounds
   * @param bounds The bounds to fit
   * @param options The fit bounds options
   */
  fitBounds(bounds: L.LatLngBoundsExpression, options?: L.FitBoundsOptions): void {
    this.map.fitBounds(bounds, options);
  }

  /**
   * Programmatically expand the layer control
   * This can be used by your custom control to show the layer options
   */
  expandLayerControl(): void {
    const layerControlElement = document.querySelector('.leaflet-control-layers');
    if (layerControlElement) {
      layerControlElement.classList.add('leaflet-control-layers-expanded');
    }
  }
  
  /**
   * Programmatically collapse the layer control
   */
  collapseLayerControl(): void {
    const layerControlElement = document.querySelector('.leaflet-control-layers');
    if (layerControlElement) {
      layerControlElement.classList.remove('leaflet-control-layers-expanded');
    }
  }
  
  /**
   * Get all available map layers
   * @returns An object with layer names as keys and layer instances as values
   */
  getAvailableLayers(): {[key: string]: L.TileLayer} {
    return this.baseLayers;
  }
} 