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

@Component({
  selector: 'app-root',
  imports: [
    FormsModule, 
    CommonModule, 
    HttpClientModule, 
    GeoJsonControlComponent, 
    SidebarComponent, 
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
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements AfterViewInit, OnInit {
  public map!: L.Map;
  private locationMarker: L.Marker | null = null;
  
  // UI control properties
  showLayerControl = false;
  showSearchControl = false;
  showMeasureControl = false;
  showGeoJsonControl = false;
  showPolygonControl = false;
  showDataSendingControl = false;
  showSettingsControl = false;
  showFavoritesControl = false;
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
    private toastService: ToastService,
    private mapService: MapService
  ) {
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
    // Load saved polygon coordinates from localStorage if available
    const savedCoordinates = this.storageService.loadPolygonCoordinates();
    if (savedCoordinates) {
      this.coordinatesInput = savedCoordinates;
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
  }
  
  toggleGeoJsonControl(): void {
    this.showGeoJsonControl = !this.showGeoJsonControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showPolygonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
  }

  togglePolygonControl(): void {
    this.showPolygonControl = !this.showPolygonControl;
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
    this.showGeoJsonControl = false;
    this.showDataSendingControl = false;
    this.showSettingsControl = false;
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
    this.dataSendingMode = false;
    
    // Hide all control panels
    this.showLayerControl = false;
    this.showSearchControl = false;
    this.showMeasureControl = false;
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
        this.showMeasureControl = true;
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
        this.showFavoritesControl = true;
        break;
      // Legacy tool IDs from before refactoring
      case 'rectangle':
        this.showPolygonControl = true;
        break;
      case 'add':
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

  loadFavoritePolygon(favorite: FavoritePolygon): void {
    this.coordinatesInput = [...favorite.coordinates];
    this.currentPolygonId = favorite.id;
    this.storageService.saveCurrentPolygonId(favorite.id);
    this.updateBorders();
    this.toastService.success(`Loaded polygon: ${favorite.name}`);
  }

  deleteFavoritePolygon(favorite: FavoritePolygon): void {
    this.favoritePolygons = this.favoritePolygons.filter(p => p.id !== favorite.id);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    this.toastService.success(`Deleted polygon: ${favorite.name}`);
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

  private initializeMap(): void {
    // Get bounds from coordinates
    const bounds = L.latLngBounds(this.coordinates);
    
    // Initialize the map using MapService
    this.map = this.mapService.initializeMap('map');
    
    // Add click event listener to display coordinates and send to API
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
      
      // We no longer need to handle data sending here as it's now handled by the DataSendingComponent
    });

    // Fit map to bounds after a short delay
    setTimeout(() => {
      this.map.flyToBounds(bounds, {
        duration: 1.5,  // Animation duration in seconds
        easeLinearity: 0.5
      });
    }, 1000);
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
