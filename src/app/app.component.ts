import { AfterViewInit, Component, OnInit, Renderer2, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, timeout, TimeoutError } from 'rxjs';
import { GeoJsonControlComponent } from './components/geojson-control/geojson-control.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { LayerControlComponent } from './components/layer-control/layer-control.component';
import { SearchComponent } from './components/search/search.component';
import { MeasurementComponent } from './components/measurement/measurement.component';
import { PolygonDrawComponent } from './components/polygon-draw/polygon-draw.component';
import { FavoritesComponent } from './components/favorites/favorites.component';
import { SettingsComponent } from './components/settings/settings.component';
import { DataSendingComponent } from './components/data-sending/data-sending.component';
import { StorageService, FavoritePolygon, ApiSettings } from './services/storage.service';
import { ToastService } from './services/toast.service';
import { MapService } from './services/map.service';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  template: `
    <div id="map"></div>
    
    <app-sidebar 
      [map]="map" 
      [apiError]="apiError"
      (toolSelected)="handleToolSelection($event)"
      (layerControlToggled)="toggleLayerControl()"
      (searchControlToggled)="toggleSearchControl()"
      (measureControlToggled)="onMeasureControlToggled()"
      (geoJsonControlToggled)="toggleGeoJsonControl()"
      (polygonControlToggled)="togglePolygonControl()"
      (dataSendingControlToggled)="toggleDataSendingControl()"
      (settingsControlToggled)="toggleSettingsControl()"
      (favoritesControlToggled)="toggleFavoritesControl()"
      (findLocationRequested)="findMyLocation()">
    </app-sidebar>
    
    <!-- Measurement Modal Component -->
    <app-measurement 
      [isVisible]="showMeasurementControl" 
      [map]="map"
      (visibilityChange)="showMeasurementControl = $event">
    </app-measurement>

    <!-- Layer Control Panel -->
    <app-layer-control
      [isVisible]="showLayerControl"
      (visibilityChange)="showLayerControl = $event">
    </app-layer-control>

    <!-- Search Control Panel -->
    <app-search
      [isVisible]="showSearchControl"
      [map]="map"
      (visibilityChange)="showSearchControl = $event">
    </app-search>

    <!-- GeoJSON Control Panel -->
    <app-geojson-control
      [isVisible]="showGeoJsonControl"
      [map]="map"
      (visibilityChange)="showGeoJsonControl = $event">
    </app-geojson-control>

    <!-- Polygon Control Panel -->
    <app-polygon-draw
      [isVisible]="showPolygonControl"
      [map]="map"
      (visibilityChange)="showPolygonControl = $event"
      (favoriteSaved)="onFavoriteSaved($event)">
    </app-polygon-draw>

    <!-- Settings Control Panel -->
    <app-settings
      [isVisible]="showSettingsControl"
      [apiSettings]="apiSettings"
      (visibilityChange)="showSettingsControl = $event"
      (settingsSaved)="saveSettings($event)">
    </app-settings>

    <!-- Favorites Control Panel -->
    <app-favorites
      [isVisible]="showFavoritesControl"
      [favoritePolygons]="favoritePolygons"
      [currentPolygonId]="currentPolygonId"
      (visibilityChange)="showFavoritesControl = $event"
      (loadFavorite)="loadFavoritePolygon($event)"
      (deleteFavorite)="deleteFavoritePolygon($event)">
    </app-favorites>

    <!-- Data Sending Control Panel -->
    <app-data-sending
      [isVisible]="showDataSendingControl"
      [map]="map"
      [apiSettings]="apiSettings"
      [apiError]="apiError"
      (visibilityChange)="showDataSendingControl = $event"
      (apiErrorChange)="apiError = $event">
    </app-data-sending>
    
    <app-toast></app-toast>
  `,
  styles: [`
    #map {
      height: 100vh;
      width: 100vw;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      background-color: #f0f0f0;
    }
  `],
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule, 
    HttpClientModule,
    SidebarComponent,
    DataSendingComponent,
    FavoritesComponent,
    PolygonDrawComponent,
    MeasurementComponent,
    LayerControlComponent,
    SearchComponent,
    GeoJsonControlComponent,
    SettingsComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements AfterViewInit, OnInit {
  public map!: L.Map;
  private locationMarker: L.Marker | null = null;
  
  // UI control properties
  showMeasurementControl = false;
  showLayerControl = false;
  showSearchControl = false;
  showGeoJsonControl = false;
  showPolygonControl = false;
  showSettingsControl = false;
  showFavoritesControl = false;
  showDataSendingControl = false;
  isSearching = false;
  public dataSendingMode = false;
  
  // Favorite polygons
  favoritePolygons: FavoritePolygon[] = [];
  currentPolygonId: string | null = null;
  
  // API Settings
  apiSettings = {
    apiUrl: 'https://dmms-6179-joker-qa.dev-pm.dmms.kz/api/v1/mqtt/galileo-sky',
    bearerId: '3fa85f64-5717-4562-b3fc-2c963f66afa1',
    trackerId: 'string'
  };
  
  // Add apiError property
  apiError = false;
  
  constructor(
    private http: HttpClient,
    private renderer: Renderer2,
    private storageService: StorageService,
    private toastService: ToastService,
    private mapService: MapService,
    private apiService: ApiService
  ) {}
  
  ngOnInit(): void {
    // Load saved polygon coordinates from localStorage if available
    const savedCoordinates = this.storageService.loadPolygonCoordinates();
    if (savedCoordinates) {
      // Store coordinates for later use
      console.log('Loaded saved coordinates:', savedCoordinates);
    }
    
    // Load saved API settings from localStorage if available
    const savedApiSettings = this.storageService.loadApiSettings();
    if (savedApiSettings) {
      this.apiSettings = savedApiSettings;
    }

    // Load favorite polygons from localStorage
    this.favoritePolygons = this.storageService.loadFavoritePolygons();
    console.log('App: Loaded favorite polygons from storage:', this.favoritePolygons);

    // Load current polygon ID from localStorage
    const savedCurrentPolygonId = this.storageService.loadCurrentPolygonId();
    if (savedCurrentPolygonId) {
      this.currentPolygonId = savedCurrentPolygonId;
      console.log('App: Loaded current polygon ID from storage:', this.currentPolygonId);
    }
  }

  ngAfterViewInit(): void {
    console.log('ngAfterViewInit called');
    
    // Initialize map with a delay to ensure DOM is ready
    setTimeout(() => {
      try {
        this.initializeMap();
        console.log('Map initialized successfully');
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }, 500);
  }
  
  // Toggle UI controls
  toggleLayerControl(): void {
    this.showLayerControl = !this.showLayerControl;
  }
  
  toggleSearchControl(): void {
    this.showSearchControl = !this.showSearchControl;
  }
  
  toggleMeasurementControl(): void {
    this.showMeasurementControl = !this.showMeasurementControl;
  }
  
  toggleGeoJsonControl(): void {
    this.showGeoJsonControl = !this.showGeoJsonControl;
  }

  togglePolygonControl(): void {
    this.showPolygonControl = !this.showPolygonControl;
  }

  toggleDataSendingControl(): void {
    this.showDataSendingControl = !this.showDataSendingControl;
  }
  
  toggleSettingsControl(): void {
    this.showSettingsControl = !this.showSettingsControl;
  }
  
  toggleFavoritesControl(): void {
    this.showFavoritesControl = !this.showFavoritesControl;
    
    // Reload favorites from storage when opening the favorites panel
    if (this.showFavoritesControl) {
      this.favoritePolygons = this.storageService.loadFavoritePolygons();
      console.log('App: Reloaded favorite polygons when opening favorites panel:', this.favoritePolygons);
    }
  }
  
  // Geolocation
  findMyLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          if (this.locationMarker) {
            this.map.removeLayer(this.locationMarker);
          }
          
          this.locationMarker = L.marker([lat, lng]).addTo(this.map);
          this.map.flyTo([lat, lng], 14);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }
  
  onMeasureControlToggled(): void {
    this.toggleMeasurementControl();
  }

  private initializeMap(): void {
    try {
      console.log('Initializing map...');
      
      // Check if map container exists
      const mapContainer = document.getElementById('map');
      if (!mapContainer) {
        console.error('Map container not found!');
        return;
      }
      console.log('Map container found:', mapContainer);
      
      // Create a simple map
      this.map = L.map('map', {
        center: [51.1694, 71.4491], // Astana, Kazakhstan
        zoom: 13
      });
      
      console.log('Map created:', this.map);
      
      // Add a simple OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
      
      console.log('Tile layer added');
      
      // Make the map available to the MapService
      this.mapService.setMap(this.map);
      console.log('Map set in MapService');
      
      // Add click event listener for coordinates
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Close any existing popups
        this.map.closePopup();
        
        // Create popup at click location
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`<strong>Coordinates:</strong><br>Latitude: ${lat.toFixed(6)}<br>Longitude: ${lng.toFixed(6)}`)
          .openOn(this.map);
      });
      
      // Force a resize to ensure the map renders correctly
      setTimeout(() => {
        console.log('Forcing map resize...');
        this.map.invalidateSize();
      }, 100);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  // Favorites handling
  loadFavoritePolygon(favorite: FavoritePolygon): void {
    console.log('App: Loading favorite polygon:', favorite);
    
    // Update state
    this.currentPolygonId = favorite.id;
    
    // Save to storage
    this.storageService.saveCurrentPolygonId(favorite.id);
    this.storageService.savePolygonCoordinates(favorite.coordinates);
    
    // Draw the polygon on the map
    this.drawPolygonOnMap(favorite.coordinates);
    
    // Success message is shown by the favorites component
  }

  /**
   * Draw a polygon on the map
   * @param coordinates The coordinates of the polygon
   */
  private drawPolygonOnMap(coordinates: { lat: number; lng: number; }[]): void {
    // Clear existing polygons
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        this.map.removeLayer(layer);
      }
    });
    
    // Create a new polygon
    if (coordinates && coordinates.length >= 3) {
      const polygon = L.polygon(coordinates.map(coord => [coord.lat, coord.lng]), {
        color: '#4263eb',
        weight: 3,
        fillOpacity: 0.2
      }).addTo(this.map);
      
      // Fit the map to the polygon bounds
      this.map.fitBounds(polygon.getBounds());
    }
  }

  deleteFavoritePolygon(favorite: FavoritePolygon): void {
    console.log('App: Deleting favorite polygon:', favorite);
    this.favoritePolygons = this.favoritePolygons.filter(p => p.id !== favorite.id);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    this.toastService.success(`Deleted polygon: ${favorite.name}`);
  }

  onFavoriteSaved(favorite: FavoritePolygon): void {
    console.log('App: Favorite saved event received:', favorite);
    // Reload favorites from storage
    this.favoritePolygons = this.storageService.loadFavoritePolygons();
    console.log('App: Reloaded favorite polygons after save:', this.favoritePolygons);
  }

  saveSettings(updatedSettings: ApiSettings): void {
    this.apiSettings = updatedSettings;
    this.storageService.saveApiSettings(this.apiSettings);
    this.toastService.success('Settings saved successfully');
  }

  handleToolSelection(toolId: string | null): void {
    console.log('Tool selected:', toolId);
    
    // Reset all active modes
    this.dataSendingMode = false;
    
    // Hide all control panels
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasurementControl = false;
    this.showGeoJsonControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
    this.showFavoritesControl = false;
    
    // If toolId is null, it means no tool is selected
    if (toolId === null) {
      return;
    }
    
    // Handle specific tool actions
    switch(toolId) {
      case 'layer':
        this.showLayerControl = true;
        break;
      case 'search':
        this.showSearchControl = true;
        break;
      case 'measure':
        this.showMeasurementControl = true;
        break;
      case 'geojson':
        this.showGeoJsonControl = true;
        break;
      case 'polygon':
        this.showPolygonControl = true;
        break;
      case 'dataSending':
        this.showDataSendingControl = true;
        break;
      case 'settings':
        this.showSettingsControl = true;
        break;
      case 'favorites':
        // Reload favorites from storage when selecting the favorites tool
        this.favoritePolygons = this.storageService.loadFavoritePolygons();
        console.log('App: Reloaded favorite polygons when selecting favorites tool:', this.favoritePolygons);
        this.showFavoritesControl = true;
        break;
    }
  }
}
