import { AfterViewInit, Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Loader } from '@googlemaps/js-api-loader';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { GeoJsonControlComponent } from './components/geojson-control/geojson-control.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

interface FavoritePolygon {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number; }[];
  createdAt: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, HttpClientModule, GeoJsonControlComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: true
})
export class AppComponent implements AfterViewInit, OnInit {
  public map!: L.Map;
  private googleMapsLoaded = false;
  private googleMapsLoader!: Loader;
  private baseLayers: {[key: string]: L.TileLayer} = {};
  private layerControl!: L.Control.Layers;
  private searchMarker: L.Marker | null = null;
  private locationMarker: L.Marker | null = null;
  private measurePoints: L.Marker[] = [];
  private measureLine: L.Polyline | null = null;
  private searchSubject = new Subject<string>();
  private measureMode = false;
  private drawPolygonMode = false;
  public tempPolygonPoints: L.LatLng[] = [];
  private tempPolygonMarkers: L.Marker[] = [];
  private tempPolygon: L.Polygon | null = null;
  
  // You need to replace this with your actual Google Maps API key
  private googleMapsApiKey = 'test';

  // UI control properties
  searchQuery = '';
  coordinatesQuery = '';
  searchResults: any[] = [];
  selectedLayer = 'roadmap';
  showLayerControl = false;
  showSearchControl = false;
  showMeasureControl = false;
  showGeoJsonControl = false;
  showPolygonControl = false;
  showDataSendingControl = false;
  showSettingsControl = false;
  showFavoritesControl = false;
  measureDistance = 0;
  isSearching = false;
  private dataSendingMode = false;
  
  // Favorite polygons
  favoritePolygons: FavoritePolygon[] = [];
  newPolygonName = '';
  showPolygonNameInput = false;
  currentPolygonId: string | null = null;
  
  // API Settings
  apiSettings = {
    apiUrl: 'https://dmms-6179-joker-qa.dev-pm.dmms.kz/api/v1/mqtt/galileo-sky',
    bearerId: '3fa85f64-5717-4562-b3fc-2c963f66afa1',
    trackerId: 'string'
  };
  coordinatesInput = [
    { lat: 51.1801, lng: 71.4460 }, // Northwest corner of Astana
    { lat: 51.1801, lng: 71.4704 }, // Northeast corner of Astana
    { lat: 51.1601, lng: 71.4704 }, // Southeast corner of Astana
    { lat: 51.1601, lng: 71.4460 }  // Southwest corner of Astana
  ];

  private get coordinates() {
    return this.coordinatesInput.map(coord => L.latLng(coord.lat, coord.lng));
  }

  layerControlActive = false;
  searchControlActive = false;
  measureControlActive = false;
  geoJsonControlActive = false;
  polygonControlActive = false;
  dataSendingControlActive = false;
  settingsControlActive = false;
  favoritesControlActive = false;

  constructor(private http: HttpClient) {
    // Set up search with debounce
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.length > 2) {
        this.performSearch(query);
      } else {
        this.searchResults = [];
      }
    });
  }

  ngOnInit(): void {
    // Initialize the Google Maps loader
    this.googleMapsLoader = new Loader({
      apiKey: this.googleMapsApiKey,
      version: 'weekly'
    });
    
    // Load saved polygon coordinates from localStorage if available
    const savedPolygon = localStorage.getItem('polygonCoordinates');
    if (savedPolygon) {
      try {
        this.coordinatesInput = JSON.parse(savedPolygon);
      } catch (error) {
        console.error('Error parsing saved polygon coordinates:', error);
      }
    }
    
    // Load saved map layer from localStorage if available
    const savedLayer = localStorage.getItem('selectedMapLayer');
    if (savedLayer) {
      this.selectedLayer = savedLayer;
    }
    
    // Load saved API settings from localStorage if available
    const savedApiSettings = localStorage.getItem('apiSettings');
    if (savedApiSettings) {
      try {
        this.apiSettings = JSON.parse(savedApiSettings);
      } catch (error) {
        console.error('Error parsing saved API settings:', error);
      }
    }

    // Load favorite polygons from localStorage
    const savedFavorites = localStorage.getItem('favoritePolygons');
    if (savedFavorites) {
      try {
        this.favoritePolygons = JSON.parse(savedFavorites);
      } catch (error) {
        console.error('Error parsing saved favorite polygons:', error);
      }
    }

    // Load current polygon ID from localStorage and set its coordinates
    const savedCurrentPolygonId = localStorage.getItem('currentPolygonId');
    if (savedCurrentPolygonId) {
      this.currentPolygonId = savedCurrentPolygonId;
      // Find the matching favorite polygon
      const currentPolygon = this.favoritePolygons.find(fp => fp.id === savedCurrentPolygonId);
      if (currentPolygon) {
        this.coordinatesInput = [...currentPolygon.coordinates];
      }
    }
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }
  
  // Toggle UI controls
  toggleLayerControl(): void {
    this.showLayerControl = !this.showLayerControl;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
  }
  
  toggleSearchControl(): void {
    this.showSearchControl = !this.showSearchControl;
    this.showLayerControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
  }
  
  toggleMeasureControl(): void {
    this.showMeasureControl = !this.showMeasureControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
    this.measureMode = this.showMeasureControl;
    
    if (!this.measureMode) {
      this.clearMeasurement();
    }
  }
  
  toggleGeoJsonControl(): void {
    this.showGeoJsonControl = !this.showGeoJsonControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
    
    if (this.measureMode) {
      this.measureMode = false;
      this.clearMeasurement();
    }
    if (this.drawPolygonMode) {
      this.cancelPolygonDrawing();
    }
  }

  togglePolygonControl(): void {
    this.showPolygonControl = !this.showPolygonControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
    
    this.drawPolygonMode = this.showPolygonControl;
    if (!this.drawPolygonMode) {
      this.cancelPolygonDrawing();
    }
  }

  toggleDataSendingControl(): void {
    this.showDataSendingControl = !this.showDataSendingControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showSettingsControl = false;
    
    this.dataSendingMode = this.showDataSendingControl;
    
    if (this.dataSendingMode) {
      this.showToast('Data sending mode activated. Click on the map to send coordinates to API.', 'info');
    } else {
      this.showToast('Data sending mode deactivated.', 'info');
    }
  }
  
  toggleSettingsControl(): void {
    this.settingsControlActive = !this.settingsControlActive;
    if (this.settingsControlActive) {
      this.resetOtherControls('settings');
    }
  }
  
  toggleFavoritesControl(): void {
    this.showFavoritesControl = !this.showFavoritesControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
  }
  
  resetOtherControls(activeControl: string) {
    if (activeControl !== 'layers') this.layerControlActive = false;
    if (activeControl !== 'search') this.searchControlActive = false;
    if (activeControl !== 'measure') this.measureControlActive = false;
    if (activeControl !== 'geojson') this.geoJsonControlActive = false;
    if (activeControl !== 'polygon') this.polygonControlActive = false;
    if (activeControl !== 'dataSending') this.dataSendingControlActive = false;
    if (activeControl !== 'settings') this.settingsControlActive = false;
    if (activeControl !== 'favorites') this.favoritesControlActive = false;
  }
  
  handleToolSelection(toolId: string): void {
    console.log('Tool selected:', toolId);
    
    // Reset all active modes
    this.measureMode = false;
    this.drawPolygonMode = false;
    this.dataSendingMode = false;
    
    // Hide all control panels
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
    
    // Handle specific tool actions
    switch(toolId) {
      case 'magic':
        // Magic select tool functionality
        break;
      case 'cursor':
        // Cursor tool functionality
        break;
      case 'rectangle':
        // Rectangle tool functionality
        this.showPolygonControl = true;
        this.drawPolygonMode = true;
        break;
      case 'text':
        // Text tool functionality
        break;
      case 'shapes':
        // Shapes tool functionality
        break;
      case 'connector':
        // Connector tool functionality
        break;
      case 'frame':
        // Frame tool functionality
        break;
      case 'comment':
        // Comment tool functionality
        break;
      case 'add':
        // Add tool functionality
        this.showGeoJsonControl = true;
        break;
    }
  }
  
  saveSettings(): void {
    // Save settings to localStorage
    localStorage.setItem('apiSettings', JSON.stringify(this.apiSettings));
    this.showToast('Settings saved successfully', 'success');
  }

  startPolygonDrawing(): void {
    this.drawPolygonMode = true;
    this.tempPolygonPoints = [];
    this.clearTempPolygon();
    
    // Show a toast notification
    this.showToast('Click on the map to add polygon points');
  }

  cancelPolygonDrawing(): void {
    this.drawPolygonMode = false;
    this.showPolygonControl = false;
    this.clearTempPolygon();
    this.showToast('Polygon drawing cancelled', 'info');
  }

  clearTempPolygon(): void {
    if (this.tempPolygon) {
      this.map.removeLayer(this.tempPolygon);
      this.tempPolygon = null;
    }
    this.tempPolygonMarkers.forEach(marker => this.map.removeLayer(marker));
    this.tempPolygonMarkers = [];
    this.tempPolygonPoints = [];
  }

  updateTempPolygon(): void {
    if (this.tempPolygonPoints.length < 2) return;

    if (this.tempPolygon) {
      this.map.removeLayer(this.tempPolygon);
    }

    this.tempPolygon = L.polygon(this.tempPolygonPoints, {
      color: '#4263eb',
      weight: 2,
      fillOpacity: 0.2
    }).addTo(this.map);
  }

  finishPolygonDrawing(): void {
    if (this.tempPolygonPoints.length < 3) {
      this.showToast('Please select at least 3 points to create a polygon', 'error');
      return;
    }

    // Update coordinatesInput with the new polygon points
    this.coordinatesInput = this.tempPolygonPoints.map(point => ({
      lat: point.lat,
      lng: point.lng
    }));

    // Show polygon name input
    this.showPolygonNameInput = true;
    this.showToast('Enter a name for your polygon to save it as favorite', 'info');
  }

  savePolygonAsFavorite(): void {
    if (!this.newPolygonName.trim()) {
      this.showToast('Please enter a name for the polygon', 'error');
      return;
    }

    const newFavorite: FavoritePolygon = {
      id: Date.now().toString(),
      name: this.newPolygonName.trim(),
      coordinates: [...this.coordinatesInput],
      createdAt: new Date().toISOString()
    };

    this.favoritePolygons.push(newFavorite);
    localStorage.setItem('favoritePolygons', JSON.stringify(this.favoritePolygons));
    this.currentPolygonId = newFavorite.id;
    localStorage.setItem('currentPolygonId', newFavorite.id);

    // Clear temporary drawing and reset state
    this.clearTempPolygon();
    this.drawPolygonMode = false;
    this.showPolygonControl = false;
    this.showPolygonNameInput = false;
    this.newPolygonName = '';

    // Update the map borders
    this.updateBorders();
    this.showToast('Polygon saved as favorite!', 'success');
  }

  loadFavoritePolygon(favorite: FavoritePolygon): void {
    this.coordinatesInput = [...favorite.coordinates];
    this.currentPolygonId = favorite.id;
    localStorage.setItem('currentPolygonId', favorite.id);
    this.updateBorders();
    this.showToast(`Loaded polygon: ${favorite.name}`, 'success');
  }

  deleteFavoritePolygon(favorite: FavoritePolygon): void {
    // If deleting the current polygon, clear the current polygon
    if (this.currentPolygonId === favorite.id) {
      this.coordinatesInput = [];
      this.currentPolygonId = null;
      localStorage.removeItem('currentPolygonId');
      this.updateBorders();
    }

    this.favoritePolygons = this.favoritePolygons.filter(p => p.id !== favorite.id);
    localStorage.setItem('favoritePolygons', JSON.stringify(this.favoritePolygons));
    this.showToast(`Deleted polygon: ${favorite.name}`, 'success');
  }

  // Change the map layer
  changeMapLayer(layerType: string): void {
    this.selectedLayer = layerType;
    
    // Save selected layer to localStorage
    localStorage.setItem('selectedMapLayer', layerType);
    
    // Remove all current base layers
    Object.values(this.baseLayers).forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });
    
    // Add the selected layer
    if (this.baseLayers[layerType]) {
      this.baseLayers[layerType].addTo(this.map);
      this.showToast(`Map changed to ${layerType} view`);
    }
  }
  
  // Search functionality
  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }
  
  performSearch(query: string): void {
    this.isSearching = true;
    // Using Nominatim OpenStreetMap search API (free and doesn't require API key)
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    
    this.http.get<any[]>(searchUrl).subscribe({
      next: (results) => {
        this.searchResults = results.slice(0, 5); // Limit to 5 results
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isSearching = false;
        this.showToast('Search failed. Please try again.', 'error');
      }
    });
  }
  
  goToLocation(result: any): void {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    if (this.searchMarker) {
      this.map.removeLayer(this.searchMarker);
    }
    
    this.searchMarker = L.marker([lat, lon], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map);
    
    this.searchMarker.bindPopup(`<strong>${result.display_name}</strong>`).openPopup();
    this.map.flyTo([lat, lon], 14);
    this.searchResults = [];
    this.showSearchControl = false;
  }
  
  searchByCoordinates(): void {
    // Parse the coordinates from the input string
    const coordsStr = this.coordinatesQuery.trim();
    
    // Check if the input matches the expected format (two numbers separated by comma or space)
    const coordsMatch = coordsStr.match(/^\s*([-+]?\d+\.?\d*)\s*[,\s]\s*([-+]?\d+\.?\d*)\s*$/);
    
    if (!coordsMatch) {
      this.showToast('Please enter coordinates in the format: latitude, longitude', 'error');
      return;
    }
    
    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);
    
    // Validate the coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.showToast('Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.', 'error');
      return;
    }
    
    // Remove existing marker if any
    if (this.searchMarker) {
      this.map.removeLayer(this.searchMarker);
    }
    
    // Add a marker at the specified coordinates
    this.searchMarker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map);
    
    this.searchMarker.bindPopup(`<strong>Coordinates: ${lat}, ${lng}</strong>`).openPopup();
    this.map.flyTo([lat, lng], 14);
    this.showSearchControl = false;
  }
  
  // Geolocation
  findMyLocation(): void {
    if (navigator.geolocation) {
      this.showToast('Locating your position...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          if (this.locationMarker) {
            this.map.removeLayer(this.locationMarker);
          }
          
          this.locationMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }).addTo(this.map);
          
          this.locationMarker.bindPopup('<strong>Your Location</strong>').openPopup();
          this.map.flyTo([lat, lng], 14);
          this.showToast('Location found!', 'success');
        },
        (error) => {
          console.error('Geolocation error:', error);
          this.showToast('Unable to retrieve your location. Please check your browser permissions.', 'error');
        }
      );
    } else {
      this.showToast('Geolocation is not supported by your browser.', 'error');
    }
  }
  
  // Toast notification system
  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `map-toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fa ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Update borders method
  private updateBorders(): void {
    // Remove existing polygon if any
    if (this.map) {
      this.map.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          this.map.removeLayer(layer);
        }
      });
    }

    // If no coordinates, return
    if (!this.coordinatesInput || this.coordinatesInput.length < 3) return;
    
    // Create a polygon with the coordinates
    const polygon = L.polygon(this.coordinates, {
      color: this.currentPolygonId ? '#4263eb' : '#6c757d',
      weight: 3,
      fillOpacity: 0.1
    }).addTo(this.map);

    // Add click handler to the polygon
    polygon.on('click', () => {
      // Find the favorite polygon that matches these coordinates
      const matchingFavorite = this.favoritePolygons.find(fp => 
        fp.coordinates.length === this.coordinatesInput.length &&
        fp.coordinates.every((coord, index) => 
          coord.lat === this.coordinatesInput[index].lat &&
          coord.lng === this.coordinatesInput[index].lng
        )
      );

      if (matchingFavorite) {
        this.currentPolygonId = matchingFavorite.id;
        localStorage.setItem('currentPolygonId', matchingFavorite.id);
        this.showToast(`Selected polygon: ${matchingFavorite.name}`, 'success');
        this.updateBorders(); // Refresh to update colors
      }
    });
    
    // Fit the map to the polygon bounds
    this.map.flyToBounds(polygon.getBounds());
  }

  private handleMapClickForMeasurement(e: L.LeafletMouseEvent): void {
    if (!this.measureMode) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Create marker at click location
    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map);
    
    this.measurePoints.push(marker);
    
    // If we have at least 2 points, draw/update the line
    if (this.measurePoints.length >= 2) {
      const points = this.measurePoints.map(marker => marker.getLatLng());
      
      if (this.measureLine) {
        this.map.removeLayer(this.measureLine);
      }
      
      this.measureLine = L.polyline(points, {
        color: '#4263eb',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
      }).addTo(this.map);
      
      // Calculate total distance
      this.calculateTotalDistance();
    }
  }

  clearMeasurement(): void {
    // Remove all measurement markers
    this.measurePoints.forEach(marker => {
      this.map.removeLayer(marker);
    });
    
    // Remove the measurement line
    if (this.measureLine) {
      this.map.removeLayer(this.measureLine);
      this.measureLine = null;
    }
    
    this.measurePoints = [];
    this.measureDistance = 0;
  }

  calculateTotalDistance(): void {
    if (this.measurePoints.length < 2) {
      this.measureDistance = 0;
      return;
    }
    
    let totalDistance = 0;
    for (let i = 0; i < this.measurePoints.length - 1; i++) {
      const point1 = this.measurePoints[i].getLatLng();
      const point2 = this.measurePoints[i + 1].getLatLng();
      totalDistance += point1.distanceTo(point2);
    }
    
    this.measureDistance = totalDistance;
  }

  private initializeMap(): void {
    // Get bounds from coordinates
    const bounds = L.latLngBounds(this.coordinates);
    
    this.map = L.map('map', {
      center: [0, 0],  // Center at equator/prime meridian to show whole world
      zoom: 2,         // Lower zoom level to show the entire world
      maxBoundsViscosity: 0.0,  // Allow free movement around the world
      worldCopyJump: true       // Enable smooth navigation when crossing date line
    });
    
    // Add click event listener to display coordinates and send to API
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      // If in measure mode, handle measurement
      if (this.measureMode) {
        this.handleMapClickForMeasurement(e);
        return;
      }
      
      // If in polygon drawing mode, handle polygon point addition
      if (this.drawPolygonMode) {
        this.handleMapClickForPolygon(e);
        return;
      }
      
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Create popup at click location
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<strong>Coordinates:</strong><br>Latitude: ${lat.toFixed(6)}<br>Longitude: ${lng.toFixed(6)}`)
        .openOn(this.map);
      
      // Only send coordinates to API if data sending mode is active
      if (this.dataSendingMode) {
        this.sendCoordinatesToAPI(lat, lng);
      }
    });

    // Load Google Maps
    this.googleMapsLoader.load().then(() => {
      this.googleMapsLoaded = true;
      
      // Create different map layers
      this.baseLayers = {
        'roadmap': L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
          noWrap: false
        }),
        'satellite': L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
          noWrap: false
        }),
        'hybrid': L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
          noWrap: false
        }),
        'terrain': L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
          noWrap: false
        }),
        'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          noWrap: false
        })
      };
      
      // Add the saved layer or default to roadmap
      this.baseLayers[this.selectedLayer].addTo(this.map);
      
      // Show the world first, then animate to the bounds after a short delay
      setTimeout(() => {
        this.map.flyToBounds(bounds, {
          duration: 1.5,  // Animation duration in seconds
          easeLinearity: 0.5
        });
      }, 1000);
    }).catch(error => {
      console.error('Error loading Google Maps:', error);
      
      // Fallback to OpenStreetMap if Google Maps fails to load
      this.baseLayers = {
        'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          noWrap: false
        })
      };
      
      // Add the OpenStreetMap layer
      this.baseLayers['osm'].addTo(this.map);
      this.selectedLayer = 'osm';
      localStorage.setItem('selectedMapLayer', 'osm');
      
      // Show the world first, then animate to the bounds after a short delay
      setTimeout(() => {
        this.map.flyToBounds(bounds, {
          duration: 1.5,  // Animation duration in seconds
          easeLinearity: 0.5
        });
      }, 1000);
    });
  }

  private handleMapClickForPolygon(e: L.LeafletMouseEvent): void {
    if (!this.drawPolygonMode) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Add the point to the polygon points array
    this.tempPolygonPoints.push(e.latlng);
    
    // Create marker at click location
    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map);
    
    this.tempPolygonMarkers.push(marker);
    
    // Update the polygon visualization
    this.updateTempPolygon();
    
    // Don't send coordinates to API when in polygon drawing mode
  }
  
  private sendCoordinatesToAPI(latitude: number, longitude: number): void {
    const apiUrl = this.apiSettings.apiUrl;
    
    const payload = {
      bearerId: null,
      trackerId: this.apiSettings.trackerId,
      latitude: latitude,
      longitude: longitude
    };

    // Create a compact popup with icons
    const popup = L.popup({
      className: 'compact-popup',
      closeButton: false,
      autoClose: false,
      closeOnEscapeKey: false,
      closeOnClick: false,
      maxWidth: 150,
      minWidth: 120,
      offset: [0, -10]
    })
      .setLatLng([latitude, longitude])
      .setContent(`
        <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
          <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
          <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
        </div>
      `)      
      .openOn(this.map);

    // Add headers to handle CORS and content type
    const headers = { 
      'Content-Type': 'application/json',
      'accept': 'text/plain'
    };

    this.http.post(apiUrl, payload, { headers }).subscribe({
      next: (response: any) => {
        console.log('API response:', response);
        if (response && response.isSuccess) {
          console.log('Coordinates sent successfully');
          popup.setContent(`
            <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
              <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
              <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
              <i class="fas fa-check-circle" style="color:#2b8a3e; font-size:10px; margin-left:2px;"></i>
            </div>
          `);          
          this.showToast('Coordinates sent successfully', 'success');
          
          // Auto-close popup after success
          setTimeout(() => popup.close(), 2000);
        } else {
          console.error('API returned error:', response?.errors || 'Unknown error');
          popup.setContent(`
            <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
              <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
              <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
              <i class="fas fa-exclamation-circle" style="color:#e03131; font-size:10px; margin-left:2px;"></i>
            </div>
          `);          
          this.showToast('Failed to send coordinates: ' + (response?.errors || 'API error'), 'error');
        }
      },
      error: (error) => {
        console.error('API request error:', error);
        popup.setContent(`
          <div style="font-size:11px; line-height:1.2; display:flex; align-items:center; gap:2px; padding:2px;">
            <i class="fas fa-map-marker-alt" style="color:#4263eb; font-size:10px;"></i>
            <span style="white-space:nowrap;">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</span>
            <i class="fas fa-exclamation-circle" style="color:#e03131; font-size:10px; margin-left:2px;"></i>
          </div>
        `);
        this.showToast('Failed to send coordinates: Network or server error', 'error');
      }
    });
  }
}
