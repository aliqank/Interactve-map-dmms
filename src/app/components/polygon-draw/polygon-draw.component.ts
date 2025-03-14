import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
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
export class PolygonDrawComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Output() visibilityChange = new EventEmitter<boolean>();
  
  showPolygonNameInput = false;
  newPolygonName = '';
  tempPolygonPoints: L.LatLng[] = [];
  private tempPolygonMarkers: L.Marker[] = [];
  private tempPolygon: L.Polygon | null = null;
  private drawPolygonMode = false;
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private favoritePolygons: FavoritePolygon[] = [];
  private currentPolygonId: string | null = null;
  private coordinatesInput: { lat: number; lng: number; }[] = [];

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
    this.currentPolygonId = this.storageService.loadCurrentPolygonId();
    const savedCoordinates = this.storageService.loadPolygonCoordinates();
    if (savedCoordinates) {
      this.coordinatesInput = savedCoordinates;
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
    this.drawPolygonMode = this.isVisible;
    this.visibilityChange.emit(this.isVisible);
    
    if (this.drawPolygonMode) {
      this.activatePolygonDrawMode();
    } else {
      this.deactivatePolygonDrawMode();
      this.clearTempPolygon();
    }
  }

  /**
   * Activate polygon drawing mode
   */
  private activatePolygonDrawMode(): void {
    // Reset state
    this.tempPolygonPoints = [];
    this.clearTempPolygon();
    this.showPolygonNameInput = false;
    
    // Create a map click handler
    this.mapClickHandler = (e: L.LeafletMouseEvent) => this.handleMapClick(e);
    
    // Add the click handler to the map
    if (this.map && this.mapClickHandler) {
      this.map.on('click', this.mapClickHandler);
    }
    
    // Show a toast message
    this.toastService.info('Polygon drawing mode activated. Click on the map to add points.');
  }

  /**
   * Deactivate polygon drawing mode
   */
  private deactivatePolygonDrawMode(): void {
    // Remove the click handler from the map
    if (this.map && this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler);
      this.mapClickHandler = null;
    }
    
    this.drawPolygonMode = false;
  }

  /**
   * Handle map click for polygon drawing
   * @param e The click event
   */
  private handleMapClick(e: L.LeafletMouseEvent): void {
    if (!this.drawPolygonMode) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Add the point to the polygon points array
    this.tempPolygonPoints.push(e.latlng);
    
    // Create marker at click location
    const marker = L.marker([lat, lng], {
      icon: this.mapService.getPolygonIcon()
    }).addTo(this.map);
    
    this.tempPolygonMarkers.push(marker);
    
    // Update the polygon visualization
    this.updateTempPolygon();
  }

  /**
   * Clear temporary polygon
   */
  clearTempPolygon(): void {
    if (this.tempPolygon) {
      this.map.removeLayer(this.tempPolygon);
      this.tempPolygon = null;
    }
    this.tempPolygonMarkers.forEach(marker => this.map.removeLayer(marker));
    this.tempPolygonMarkers = [];
    this.tempPolygonPoints = [];
  }

  /**
   * Update temporary polygon visualization
   */
  private updateTempPolygon(): void {
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

    // Add to favorites
    this.favoritePolygons.push(newFavorite);
    this.storageService.saveFavoritePolygons(this.favoritePolygons);
    
    // Set as current polygon
    this.currentPolygonId = newFavorite.id;
    this.storageService.saveCurrentPolygonId(newFavorite.id);

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
} 