import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { MapService } from '../../services/map.service';
import { ToastService } from '../../services/toast.service';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-measurement',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './measurement.component.html',
  styleUrls: ['./measurement.component.css']
})
export class MeasurementComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Output() visibilityChange = new EventEmitter<boolean>();
  
  measurePoints: L.Layer[] = [];
  measureLine: L.Polyline | null = null;
  measureDistance = 0;
  measureMode = false;
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

  constructor(
    private mapService: MapService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    if (!this.map) {
      this.map = this.mapService.getMap();
    }
    
    // Initialize with current visibility state
    this.measureMode = this.isVisible;
    if (this.measureMode) {
      this.activateMeasureMode();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in the isVisible input
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      const currentValue = changes['isVisible'].currentValue;
      const previousValue = changes['isVisible'].previousValue;
      
      if (currentValue !== previousValue) {
        this.measureMode = currentValue;
        
        if (this.measureMode) {
          this.activateMeasureMode();
        } else {
          this.deactivateMeasureMode();
          this.clearMeasurement();
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.deactivateMeasureMode();
    this.clearMeasurement();
  }

  /**
   * Toggle measurement mode
   */
  toggleMeasurement(): void {
    this.isVisible = !this.isVisible;
    this.measureMode = this.isVisible;
    this.visibilityChange.emit(this.isVisible);
    
    if (this.measureMode) {
      this.activateMeasureMode();
    } else {
      this.deactivateMeasureMode();
      this.clearMeasurement();
    }
  }

  /**
   * Activate measurement mode
   */
  private activateMeasureMode(): void {
    // Create a map click handler
    this.mapClickHandler = (e: L.LeafletMouseEvent) => this.handleMapClick(e);
    
    // Add the click handler to the map
    if (this.map && this.mapClickHandler) {
      this.map.on('click', this.mapClickHandler);
    }
    
    // Show a toast message
    this.toastService.info('Measurement mode activated. Click on the map to add measurement points.');
  }

  /**
   * Deactivate measurement mode
   */
  private deactivateMeasureMode(): void {
    // Remove the click handler from the map
    if (this.map && this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler);
      this.mapClickHandler = null;
    }
  }

  /**
   * Handle map click for measurement
   * @param e The click event
   */
  private handleMapClick(e: L.LeafletMouseEvent): void {
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

  /**
   * Clear all measurement points and lines
   */
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

  /**
   * Calculate the total distance of the measurement line
   */
  private calculateTotalDistance(): void {
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

  /**
   * Undo the last measurement point
   */
  undoLastPoint(): void {
    if (this.measurePoints.length > 0) {
      const lastPoint = this.measurePoints.pop();
      if (lastPoint) {
        this.map.removeLayer(lastPoint);
      }
      this.updateMeasurementLine();
    }
  }

  /**
   * Update the measurement line and recalculate distance
   */
  private updateMeasurementLine(): void {
    // Remove existing line
    if (this.measureLine) {
      this.map.removeLayer(this.measureLine);
      this.measureLine = null;
    }
    
    // Create new line if we have at least 2 points
    if (this.measurePoints.length >= 2) {
      const points = this.measurePoints.map(marker => (marker as L.CircleMarker).getLatLng());
      this.measureLine = L.polyline(points, {
        color: '#4285F4',
        weight: 3,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(this.map);
    }
    
    // Recalculate total distance
    this.calculateTotalDistance();
  }

  /**
   * Close the measurement modal
   */
  closeModal(): void {
    this.toggleMeasurement();
  }
} 