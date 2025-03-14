import { AfterViewInit, Component, OnInit, Renderer2 } from '@angular/core';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Loader } from '@googlemaps/js-api-loader';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, timeout, TimeoutError } from 'rxjs';
import { GeoJsonControlComponent } from './components/geojson-control/geojson-control.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MeasurementModalComponent } from './components/measurement-modal/measurement-modal.component';
import { LayerControlComponent } from './components/layer-control/layer-control.component';
import { SearchComponent } from './components/search/search.component';
import { MeasurementComponent } from './components/measurement/measurement.component';
import { PolygonDrawComponent } from './components/polygon-draw/polygon-draw.component';
import { FavoritesComponent } from './components/favorites/favorites.component';
import { SettingsComponent } from './components/settings/settings.component';
import { DataSendingComponent } from './components/data-sending/data-sending.component';
import { StorageService, FavoritePolygon, ApiSettings } from './services/storage.service';
import { ToastService } from './services/toast.service';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule, 
    CommonModule, 
    HttpClientModule, 
    GeoJsonControlComponent, 
    SidebarComponent, 
    MeasurementModalComponent,
    LayerControlComponent,
    SearchComponent,
    MeasurementComponent,
    PolygonDrawComponent,
    FavoritesComponent,
    SettingsComponent,
    DataSendingComponent
  ],
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
  public measurePoints: L.Layer[] = [];
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
  public dataSendingMode = false;
  
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

  // Add apiError property
  apiError = false;

  // Add properties for modal dragging
  private modalDragging = false;
  private activeModal: HTMLElement | null = null;
  private modalOffset = { x: 0, y: 0 };
  
  // Add property to store modal positions
  private modalPositions: { [key: string]: { left: string, top: string } } = {};

  constructor(
    private http: HttpClient, 
    private renderer: Renderer2,
    private storageService: StorageService,
    private toastService: ToastService
  ) {
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

    // Add event listeners for modal dragging
    this.setupModalDragListeners();
    
    // Add keyboard shortcut for canceling data sending mode
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.dataSendingMode) {
        this.cancelDataSendingMode();
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
    const savedCoordinates = this.storageService.loadPolygonCoordinates();
    if (savedCoordinates) {
      this.coordinatesInput = savedCoordinates;
    }
    
    // Load saved map layer from localStorage if available
    const savedLayer = this.storageService.loadSelectedMapLayer();
    if (savedLayer) {
      this.selectedLayer = savedLayer;
    }
    
    // Load saved API settings from localStorage if available
    const savedApiSettings = this.storageService.loadApiSettings();
    if (savedApiSettings) {
      this.apiSettings = savedApiSettings;
    }

    // Load favorite polygons from localStorage
    this.favoritePolygons = this.storageService.loadFavoritePolygons();

    // Load current polygon ID from localStorage and set its coordinates
    const savedCurrentPolygonId = this.storageService.loadCurrentPolygonId();
    if (savedCurrentPolygonId) {
      this.currentPolygonId = savedCurrentPolygonId;
      // Find the matching favorite polygon
      const currentPolygon = this.favoritePolygons.find(fp => fp.id === savedCurrentPolygonId);
      if (currentPolygon) {
        this.coordinatesInput = [...currentPolygon.coordinates];
      }
    }

    // Load saved modal positions
    const savedModalPositions = localStorage.getItem('modalPositions');
    if (savedModalPositions) {
      try {
        this.modalPositions = JSON.parse(savedModalPositions);
      } catch (error) {
        console.error('Error parsing saved modal positions:', error);
      }
    }
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    
    // Apply saved modal positions after a short delay to ensure DOM is ready
    setTimeout(() => this.applyModalPositions(), 100);
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
    this.showFavoritesControl = false;
    
    // The dataSendingMode and API error handling is now managed by the DataSendingComponent
  }
  
  toggleSettingsControl(): void {
    this.showSettingsControl = !this.showSettingsControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showFavoritesControl = false;
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
  
  handleToolSelection(toolId: string | null): void {
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
    
    // If toolId is null, it means no tool is selected
    if (toolId === null) {
      return;
    }
    
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
    // Add visual feedback by showing a loading state
    const saveButton = document.querySelector('.save-button') as HTMLButtonElement;
    if (saveButton) {
      const originalContent = saveButton.innerHTML;
      saveButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      saveButton.disabled = true;
      
      // Simulate a short delay to show the loading state
      setTimeout(() => {
        // Save settings to localStorage
        localStorage.setItem('apiSettings', JSON.stringify(this.apiSettings));
        
        // Show success state
        saveButton.innerHTML = '<i class="fa fa-check"></i> Saved!';
        saveButton.classList.add('saved');
        
        // Show toast notification
        this.showToast('Settings saved successfully', 'success');
        
        // Reset button after a delay
        setTimeout(() => {
          saveButton.innerHTML = originalContent;
          saveButton.disabled = false;
          saveButton.classList.remove('saved');
        }, 1500);
      }, 600);
    } else {
      // Fallback if button element not found
      localStorage.setItem('apiSettings', JSON.stringify(this.apiSettings));
      this.showToast('Settings saved successfully', 'success');
    }
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
      this.toastService.error('Please enter a name for the polygon');
      return;
    }

    const newFavorite: FavoritePolygon = {
      id: Date.now().toString(),
      name: this.newPolygonName.trim(),
      coordinates: [...this.coordinatesInput],
      createdAt: new Date().toISOString()
    };

    this.favoritePolygons.push(newFavorite);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    this.currentPolygonId = newFavorite.id;
    this.storageService.saveCurrentPolygonId(newFavorite.id);

    // Clear temporary drawing and reset state
    this.clearTempPolygon();
    this.drawPolygonMode = false;
    this.showPolygonControl = false;
    this.showPolygonNameInput = false;
    this.newPolygonName = '';

    // Update the map borders
    this.updateBorders();
    this.toastService.success('Polygon saved as favorite!');
  }

  loadFavoritePolygon(favorite: FavoritePolygon): void {
    this.coordinatesInput = [...favorite.coordinates];
    this.currentPolygonId = favorite.id;
    this.storageService.saveCurrentPolygonId(favorite.id);
    this.updateBorders();
    this.toastService.success(`Loaded polygon: ${favorite.name}`);
  }

  deleteFavoritePolygon(favorite: FavoritePolygon): void {
    // If deleting the current polygon, clear the current polygon
    if (this.currentPolygonId === favorite.id) {
      this.coordinatesInput = [];
      this.currentPolygonId = null;
      this.storageService.saveCurrentPolygonId(null);
      this.updateBorders();
    }

    this.favoritePolygons = this.favoritePolygons.filter(p => p.id !== favorite.id);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    this.toastService.success(`Deleted polygon: ${favorite.name}`);
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
  
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
  }
  
  clearCoordinates(): void {
    this.coordinatesQuery = '';
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
    // Use the ToastService instead of creating DOM elements directly
    if (type === 'success') {
      this.toastService.success(message);
    } else if (type === 'error') {
      this.toastService.error(message);
    } else {
      this.toastService.info(message);
    }
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
        this.storageService.saveCurrentPolygonId(matchingFavorite.id);
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
    
    // Create a custom green circular marker for measurement points
    const circleMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#4CAF50',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(this.map);
    
    this.measurePoints.push(circleMarker);
    
    // If we have at least 2 points, draw/update the line
    if (this.measurePoints.length >= 2) {
      const points = this.measurePoints.map(marker => (marker as L.CircleMarker).getLatLng());
      
      if (this.measureLine) {
        this.map.removeLayer(this.measureLine);
      }
      
      this.measureLine = L.polyline(points, {
        color: '#4285F4',
        weight: 3,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
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
      const point1 = (this.measurePoints[i] as L.CircleMarker).getLatLng();
      const point2 = (this.measurePoints[i + 1] as L.CircleMarker).getLatLng();
      totalDistance += point1.distanceTo(point2);
    }
    
    this.measureDistance = totalDistance;
  }

  undoLastMeasurementPoint(): void {
    if (this.measurePoints.length === 0) return;
    
    // Remove the last marker
    const lastMarker = this.measurePoints.pop();
    if (lastMarker) {
      this.map.removeLayer(lastMarker);
    }
    
    // Update or remove the line
    if (this.measurePoints.length >= 2) {
      const points = this.measurePoints.map(marker => (marker as L.CircleMarker).getLatLng());
      if (this.measureLine) {
        this.map.removeLayer(this.measureLine);
      }
      this.measureLine = L.polyline(points, {
        color: '#4285F4',
        weight: 3,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(this.map);
    } else if (this.measureLine) {
      this.map.removeLayer(this.measureLine);
      this.measureLine = null;
    }
    
    // Recalculate distance
    this.calculateTotalDistance();
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
      
      // Close any existing popups
      this.map.closePopup();
      
      // Create popup at click location
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<strong>Coordinates:</strong><br>Latitude: ${lat.toFixed(6)}<br>Longitude: ${lng.toFixed(6)}`)
        .openOn(this.map);
      
      // We no longer need to handle data sending here as it's now handled by the DataSendingComponent
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
  
  // Setup modal drag functionality
  private setupModalDragListeners(): void {
    // Global mouse/touch move event
    const moveHandler = (e: MouseEvent | TouchEvent) => {
      if (this.modalDragging && this.activeModal) {
        e.preventDefault();
        
        // Get current pointer position
        const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
        const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;
        
        // Calculate new position
        const left = clientX - this.modalOffset.x;
        const top = clientY - this.modalOffset.y;
        
        // Apply new position
        this.renderer.setStyle(this.activeModal, 'left', `${left}px`);
        this.renderer.setStyle(this.activeModal, 'top', `${top}px`);
        
        // Save position for this modal type
        if (this.activeModal.classList.contains('modal-panel')) {
          const modalType = this.getModalType(this.activeModal);
          if (modalType) {
            this.modalPositions[modalType] = { left: `${left}px`, top: `${top}px` };
            this.saveModalPositions();
          }
        }
      }
    };
    
    // Global mouse/touch up event
    const upHandler = () => {
      this.modalDragging = false;
      this.activeModal = null;
    };
    
    // Add global event listeners
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('touchend', upHandler);
  }
  
  // Start dragging a modal
  public startModalDrag(event: MouseEvent | TouchEvent, modalElement: HTMLElement): void {
    // Only start drag if clicking on the header
    const target = event.target as HTMLElement;
    if (!target.closest('.modal-header')) {
      return;
    }
    
    event.preventDefault();
    this.modalDragging = true;
    this.activeModal = modalElement;
    
    // Get current pointer position
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    
    // Calculate offset (distance from pointer to top-left corner of modal)
    const rect = modalElement.getBoundingClientRect();
    this.modalOffset.x = clientX - rect.left;
    this.modalOffset.y = clientY - rect.top;
  }
  
  // Get the modal type from its class list
  private getModalType(element: HTMLElement): string | null {
    const classList = element.classList;
    const modalClasses = [
      'layer-modal', 
      'search-modal', 
      'geojson-modal', 
      'polygon-modal', 
      'data-modal', 
      'settings-modal', 
      'favorites-modal'
    ];
    
    for (const className of modalClasses) {
      if (classList.contains(className)) {
        return className;
      }
    }
    
    return null;
  }
  
  // Save modal positions to localStorage
  private saveModalPositions(): void {
    localStorage.setItem('modalPositions', JSON.stringify(this.modalPositions));
  }
  
  // Apply saved positions to modals
  private applyModalPositions(): void {
    for (const [modalType, position] of Object.entries(this.modalPositions)) {
      const modalElements = document.getElementsByClassName(modalType);
      if (modalElements.length > 0) {
        const modalElement = modalElements[0] as HTMLElement;
        this.renderer.setStyle(modalElement, 'left', position.left);
        this.renderer.setStyle(modalElement, 'top', position.top);
      }
    }
  }

  // Method to cancel data sending mode
  public cancelDataSendingMode(): void {
    // Simply turn off the data sending control
    // The actual cancellation is now handled by the DataSendingComponent
    this.showDataSendingControl = false;
  }
}
