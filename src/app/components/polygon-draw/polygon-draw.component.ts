import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { MapService } from '../../services/map.service';
import { StorageService, FavoritePolygon } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-polygon-draw',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './polygon-draw.component.html',
  styleUrls: ['./polygon-draw.component.css']
})
export class PolygonDrawComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() favoriteSaved = new EventEmitter<FavoritePolygon>();
  
  showPolygonNameInput = false;
  newPolygonName = '';
  tempPolygonPoints: L.LatLng[] = [];
  private tempPolygonMarkers: L.Marker[] = [];
  private tempPolygon: L.Polygon | null = null;
  private tempPolyline: L.Polyline | null = null;
  private closingLine: L.Polyline | null = null;
  private mouseMarker: L.Marker | null = null;
  private drawPolygonMode = false;
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private mapMoveHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private favoritePolygons: FavoritePolygon[] = [];
  private currentPolygonId: string | null = null;
  private coordinatesInput: { lat: number; lng: number; }[] = [];
  isCoordinatesListCollapsed = false;

  // Custom marker options for better visual feedback
  private readonly markerOptions = {
    icon: L.divIcon({
      className: 'custom-polygon-marker',
      html: '<div class="marker-point"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    }),
    draggable: false
  };

  // First and last marker options (different styling)
  private readonly firstMarkerOptions = {
    icon: L.divIcon({
      className: 'custom-polygon-marker',
      html: '<div class="marker-point first-point"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    }),
    draggable: false
  };

  // Mouse marker options
  private readonly mouseMarkerOptions = {
    icon: L.divIcon({
      className: 'custom-polygon-marker',
      html: '<div class="marker-point mouse-point"></div>',
      iconSize: [8, 8],
      iconAnchor: [4, 4]
    }),
    draggable: false,
    interactive: false
  };

  // Custom polygon style options
  private readonly polygonOptions = {
    color: '#4285F4',
    weight: 3,
    opacity: 0.8,
    fillColor: '#4285F4',
    fillOpacity: 0.2,
    dashArray: '5, 5'
  };

  // Custom polyline style options
  private readonly polylineOptions = {
    color: '#4285F4',
    weight: 3,
    opacity: 0.9,
    lineCap: 'round' as L.LineCapShape,
    lineJoin: 'round' as L.LineJoinShape
  };

  // Closing line style options
  private readonly closingLineOptions = {
    color: '#34A853',
    weight: 2,
    opacity: 0.7,
    dashArray: '5, 5',
    lineCap: 'round' as L.LineCapShape,
    lineJoin: 'round' as L.LineJoinShape
  };

  constructor(
    private mapService: MapService,
    private storageService: StorageService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    if (!this.map) {
      this.map = this.mapService.getMap();
    }
    this.favoritePolygons = this.storageService.loadFavoritePolygons();
    console.log('PolygonDraw: Loaded favorite polygons from storage:', this.favoritePolygons);
    
    this.currentPolygonId = this.storageService.loadCurrentPolygonId();
    console.log('PolygonDraw: Loaded current polygon ID from storage:', this.currentPolygonId);
    
    const savedCoordinates = this.storageService.loadPolygonCoordinates();
    if (savedCoordinates) {
      this.coordinatesInput = savedCoordinates;
      console.log('PolygonDraw: Loaded saved coordinates:', this.coordinatesInput);
      
      // If we have coordinates and we're not in draw mode, display the polygon
      if (!this.drawPolygonMode && this.coordinatesInput.length >= 3) {
        this.updateBorders();
      }
    }
    
    // Initialize with current visibility state
    this.drawPolygonMode = this.isVisible;
    if (this.drawPolygonMode) {
      this.activatePolygonDrawMode();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in the isVisible input
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      const currentValue = changes['isVisible'].currentValue;
      const previousValue = changes['isVisible'].previousValue;
      
      if (currentValue !== previousValue) {
        this.drawPolygonMode = currentValue;
        
        if (this.drawPolygonMode) {
          this.activatePolygonDrawMode();
        } else {
          this.deactivatePolygonDrawMode();
          this.clearTempPolygon();
          
          // Check if we need to update the borders (e.g., if a favorite was loaded)
          const savedCoordinates = this.storageService.loadPolygonCoordinates();
          if (savedCoordinates && savedCoordinates.length >= 3) {
            this.coordinatesInput = savedCoordinates;
            this.updateBorders();
          }
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.deactivatePolygonDrawMode();
    this.clearTempPolygon();
  }

  /**
   * Toggle polygon drawing mode
   */
  togglePolygonDrawing(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
    
    if (this.isVisible) {
      // Reset state when opening
      this.tempPolygonPoints = [];
      this.clearTempPolygon();
      this.showPolygonNameInput = false;
      this.newPolygonName = '';
      this.isCoordinatesListCollapsed = false;
      
      // Activate drawing mode
      this.activatePolygonDrawMode();
      
      // Show a toast message with instructions
      this.toastService.info('Click on the map to add polygon points');
    } else {
      // Deactivate drawing mode when closing
      this.deactivatePolygonDrawMode();
    }
  }

  /**
   * Activate polygon drawing mode
   */
  private activatePolygonDrawMode(): void {
    this.drawPolygonMode = true;
    this.mapClickHandler = this.handleMapClick.bind(this);
    this.mapMoveHandler = this.handleMapMouseMove.bind(this);
    this.map.on('click', this.mapClickHandler);
    this.map.on('mousemove', this.mapMoveHandler);
    
    // Add custom CSS for markers
    if (!document.getElementById('polygon-marker-style')) {
      const style = document.createElement('style');
      style.id = 'polygon-marker-style';
      style.textContent = `
        .custom-polygon-marker {
          background: transparent;
        }
        .marker-point {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: #4285F4;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s ease;
        }
        .marker-point:hover {
          transform: scale(1.2);
        }
        .first-point {
          width: 16px;
          height: 16px;
          background-color: #34A853;
          border: 3px solid white;
          animation: pulse-green 2s infinite;
        }
        .mouse-point {
          width: 8px;
          height: 8px;
          background-color: rgba(66, 133, 244, 0.5);
          border: 1px solid white;
          box-shadow: none;
        }
        @keyframes pulse-green {
          0% {
            box-shadow: 0 0 0 0 rgba(52, 168, 83, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(52, 168, 83, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(52, 168, 83, 0);
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Change cursor to indicate drawing mode
    this.map.getContainer().style.cursor = 'crosshair';
    
    // Create mouse marker
    this.mouseMarker = L.marker([0, 0], this.mouseMarkerOptions).addTo(this.map);
  }

  /**
   * Deactivate polygon drawing mode
   */
  private deactivatePolygonDrawMode(): void {
    this.drawPolygonMode = false;
    if (this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler);
      this.mapClickHandler = null;
    }
    
    if (this.mapMoveHandler) {
      this.map.off('mousemove', this.mapMoveHandler);
      this.mapMoveHandler = null;
    }
    
    // Remove mouse marker
    if (this.mouseMarker) {
      this.map.removeLayer(this.mouseMarker);
      this.mouseMarker = null;
    }
    
    // Remove closing line
    if (this.closingLine) {
      this.map.removeLayer(this.closingLine);
      this.closingLine = null;
    }
    
    // Reset cursor
    this.map.getContainer().style.cursor = '';
  }

  /**
   * Handle mouse movement to show potential connections
   */
  private handleMapMouseMove(e: L.LeafletMouseEvent): void {
    if (!this.drawPolygonMode || !this.mouseMarker) return;
    
    // Update mouse marker position
    this.mouseMarker.setLatLng(e.latlng);
    
    // If we have at least 2 points, show the closing line
    if (this.tempPolygonPoints.length >= 2) {
      this.updateClosingLine(e.latlng);
    }
  }

  /**
   * Update the closing line that shows how the polygon would be completed
   */
  private updateClosingLine(currentMousePos: L.LatLng): void {
    // Remove existing closing line
    if (this.closingLine) {
      this.map.removeLayer(this.closingLine);
    }
    
    // Create a line from the last point to the mouse position and back to the first point
    const linePoints = [
      this.tempPolygonPoints[this.tempPolygonPoints.length - 1],
      currentMousePos,
      this.tempPolygonPoints[0]
    ];
    
    this.closingLine = L.polyline(linePoints, this.closingLineOptions).addTo(this.map);
  }

  /**
   * Handle map click for polygon drawing
   * @param e The click event
   */
  private handleMapClick(e: L.LeafletMouseEvent): void {
    const clickedPoint = e.latlng;
    this.tempPolygonPoints.push(clickedPoint);
    
    // Create marker with custom icon - use special styling for first point
    const isFirstPoint = this.tempPolygonPoints.length === 1;
    const marker = L.marker(clickedPoint, 
      isFirstPoint ? this.firstMarkerOptions : this.markerOptions
    ).addTo(this.map);
    
    // Add tooltip to markers
    if (isFirstPoint) {
      marker.bindTooltip('Starting point', { permanent: false, direction: 'top' });
    } else {
      marker.bindTooltip(`Point ${this.tempPolygonPoints.length}`, { permanent: false });
    }
    
    this.tempPolygonMarkers.push(marker);
    
    // Add animation effect to the marker
    const markerElement = marker.getElement();
    if (markerElement) {
      markerElement.style.animation = isFirstPoint ? '' : 'pulse 0.5s';
    }
    
    // Update the visualization
    this.updateTempPolygon();
    this.updateConnectingLines();
  }

  /**
   * Update the connecting lines between points
   */
  private updateConnectingLines(): void {
    // Remove existing polyline if it exists
    if (this.tempPolyline) {
      this.map.removeLayer(this.tempPolyline);
    }
    
    // Create new polyline if we have at least 2 points
    if (this.tempPolygonPoints.length >= 2) {
      this.tempPolyline = L.polyline(this.tempPolygonPoints, this.polylineOptions).addTo(this.map);
      
      // Add arrow decorations to show direction
      if (this.tempPolygonPoints.length >= 3) {
        // Add directional arrows or decorations if needed
        // This would require additional plugins or custom implementation
      }
    }
  }

  /**
   * Clear temporary polygon
   */
  clearTempPolygon(): void {
    // Remove all markers
    this.tempPolygonMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.tempPolygonMarkers = [];
    
    // Remove polygon if it exists
    if (this.tempPolygon) {
      this.map.removeLayer(this.tempPolygon);
      this.tempPolygon = null;
    }
    
    // Remove polyline if it exists
    if (this.tempPolyline) {
      this.map.removeLayer(this.tempPolyline);
      this.tempPolyline = null;
    }
    
    // Remove closing line if it exists
    if (this.closingLine) {
      this.map.removeLayer(this.closingLine);
      this.closingLine = null;
    }
    
    // Clear points array
    this.tempPolygonPoints = [];
    
    // Show toast notification
    this.toastService.info('Polygon points cleared');
  }

  /**
   * Update temporary polygon visualization
   */
  private updateTempPolygon(): void {
    // Remove existing polygon if it exists
    if (this.tempPolygon) {
      this.map.removeLayer(this.tempPolygon);
    }
    
    // Create new polygon if we have at least 3 points
    if (this.tempPolygonPoints.length >= 3) {
      this.tempPolygon = L.polygon(this.tempPolygonPoints, this.polygonOptions).addTo(this.map);
      
      // Add hover effect to the polygon
      this.tempPolygon.on('mouseover', () => {
        if (this.tempPolygon) {
          this.tempPolygon.setStyle({ fillOpacity: 0.3, weight: 4 });
        }
      });
      
      this.tempPolygon.on('mouseout', () => {
        if (this.tempPolygon) {
          this.tempPolygon.setStyle({ fillOpacity: 0.2, weight: 3 });
        }
      });
    }
  }

  /**
   * Finish polygon drawing
   */
  finishPolygonDrawing(): void {
    if (this.tempPolygonPoints.length < 3) {
      this.toastService.error('Please select at least 3 points to create a polygon');
      return;
    }

    // Update coordinatesInput with the new polygon points
    this.coordinatesInput = this.tempPolygonPoints.map(point => ({
      lat: point.lat,
      lng: point.lng
    }));

    // Save coordinates to storage
    this.storageService.savePolygonCoordinates(this.coordinatesInput);

    // Show polygon name input
    this.showPolygonNameInput = true;
    this.toastService.info('Enter a name for your polygon to save it as favorite');
  }

  /**
   * Cancel polygon drawing
   */
  cancelPolygonDrawing(): void {
    this.deactivatePolygonDrawMode();
    this.clearTempPolygon();
    this.isVisible = false;
    this.toastService.info('Polygon drawing cancelled');
  }

  /**
   * Save polygon as favorite
   */
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

    console.log('PolygonDraw: Saving new favorite polygon:', newFavorite);

    // Add to favorites
    this.favoritePolygons.push(newFavorite);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    console.log('PolygonDraw: Updated favorites list:', this.favoritePolygons);
    
    // Set as current polygon
    this.currentPolygonId = newFavorite.id;
    this.storageService.saveCurrentPolygonId(newFavorite.id);
    console.log('PolygonDraw: Set current polygon ID:', this.currentPolygonId);

    // Emit event to notify parent component
    this.favoriteSaved.emit(newFavorite);

    // Clear temporary drawing and reset state
    this.clearTempPolygon();
    this.deactivatePolygonDrawMode();
    this.isVisible = false;
    this.showPolygonNameInput = false;
    this.newPolygonName = '';

    // Update the map borders
    this.updateBorders();
    this.toastService.success('Polygon saved as favorite!');
  }

  /**
   * Update map borders with current polygon
   */
  private updateBorders(): void {
    // Remove existing polygon if any
    if (this.map) {
      this.map.eachLayer((layer) => {
        if (layer instanceof L.Polygon && layer !== this.tempPolygon) {
          this.map.removeLayer(layer);
        }
      });
    }

    // If no coordinates, return
    if (!this.coordinatesInput || this.coordinatesInput.length < 3) return;
    
    // Create a polygon with the coordinates
    const polygon = L.polygon(this.coordinatesInput.map(coord => [coord.lat, coord.lng]), {
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
        this.toastService.success(`Selected polygon: ${matchingFavorite.name}`);
        this.updateBorders(); // Refresh to update colors
      }
    });
    
    // Fit the map to the polygon bounds
    this.map.flyToBounds(polygon.getBounds());
  }

  /**
   * Close the polygon modal
   */
  closeModal(): void {
    if (this.showPolygonNameInput) {
      // If showing name input, just go back to drawing mode
      this.showPolygonNameInput = false;
    } else {
      // Otherwise close the modal completely
      this.togglePolygonDrawing();
    }
  }

  // Toggle coordinates list collapse state
  toggleCoordinatesList(): void {
    this.isCoordinatesListCollapsed = !this.isCoordinatesListCollapsed;
  }
} 