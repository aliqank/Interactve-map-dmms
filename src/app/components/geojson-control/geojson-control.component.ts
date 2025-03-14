import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeoJsonService } from '../../services/geojson.service';
import { GeoJsonLayer, GeoJsonLayerStyle } from '../../models/geojson.model';
import * as L from 'leaflet';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-geojson-control',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './geojson-control.component.html',
  styleUrls: ['./geojson-control.component.css']
})
export class GeoJsonControlComponent implements OnChanges {
  @Input() map!: L.Map;
  @Input() isVisible = false;
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() layerAdded = new EventEmitter<GeoJsonLayer>();
  @Output() layerRemoved = new EventEmitter<string>();
  @Output() layerVisibilityChanged = new EventEmitter<{id: string, visible: boolean}>();
  
  layers: GeoJsonLayer[] = [];
  isLoading = false;
  errorMessage = '';
  activeLayerId: string | null = null;
  
  // Color presets for GeoJSON layers
  colorPresets = [
    { color: '#3388ff', fillColor: '#3388ff33' }, // Default blue
    { color: '#ff3333', fillColor: '#ff333333' }, // Red
    { color: '#33cc33', fillColor: '#33cc3333' }, // Green
    { color: '#9933cc', fillColor: '#9933cc33' }, // Purple
    { color: '#ff9900', fillColor: '#ff990033' }, // Orange
    { color: '#00cccc', fillColor: '#00cccc33' }  // Teal
  ];
  
  constructor(private geoJsonService: GeoJsonService) {}
  
  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in the isVisible input
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      // Handle visibility changes if needed
    }
  }
  
  /**
   * Toggle visibility of the component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.errorMessage = 'No file selected';
      return;
    }
    
    const file = input.files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    
    if (file.size > maxSize) {
      this.errorMessage = 'File size exceeds 10MB limit';
      input.value = '';
      return;
    }
    
    if (!file.name.toLowerCase().endsWith('.json') && 
        !file.name.toLowerCase().endsWith('.geojson')) {
      this.errorMessage = 'Please select a GeoJSON file (.json or .geojson)';
      input.value = '';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    
    // Extract name from filename (remove extension)
    const name = file.name.replace(/\.[^\.]+$/, '');
    
    this.geoJsonService.loadFromFile(file, name).subscribe({
      next: (layer) => {
        try {
          this.addLayerToMap(layer);
          this.isLoading = false;
          input.value = '';
        } catch (error) {
          this.errorMessage = 'Failed to add layer to map';
          this.isLoading = false;
          input.value = '';
        }
      },
      error: (error) => {
        this.errorMessage = typeof error === 'string' ? error : 'Failed to load GeoJSON file';
        this.isLoading = false;
        input.value = '';
      }
    });
  }
  
  /**
   * Load GeoJSON from URL
   */
  loadFromUrl(url: string, name: string): void {
    if (!url) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    this.geoJsonService.loadFromUrl(url, name).subscribe({
      next: (layer) => {
        this.addLayerToMap(layer);
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = typeof error === 'string' ? error : 'Failed to load GeoJSON from URL';
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Add a GeoJSON layer to the map
   */
  private addLayerToMap(layer: GeoJsonLayer): void {
    // Create Leaflet layer and add to map
    const leafletLayer = this.geoJsonService.createLeafletLayer(layer);
    leafletLayer.addTo(this.map);
    
    // Add to layers list
    this.layers = [...this.geoJsonService.getLayers()];
    
    // Emit event
    this.layerAdded.emit(layer);
    
    // Set as active layer
    this.activeLayerId = layer.id;
  }
  
  /**
   * Remove a layer from the map
   */
  removeLayer(id: string): void {
    // Get Leaflet layer and remove from map
    const leafletLayer = this.geoJsonService.getLeafletLayer(id);
    if (leafletLayer) {
      this.map.removeLayer(leafletLayer);
    }
    
    // Remove from service
    this.geoJsonService.removeLayer(id);
    
    // Update layers list
    this.layers = [...this.geoJsonService.getLayers()];
    
    // Emit event
    this.layerRemoved.emit(id);
    
    // Clear active layer if it was the one removed
    if (this.activeLayerId === id) {
      this.activeLayerId = null;
    }
  }
  
  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(id: string): void {
    const layer = this.geoJsonService.getLayer(id);
    if (!layer) return;
    
    const visible = !layer.visible;
    this.geoJsonService.toggleLayerVisibility(id, visible);
    
    // Show/hide on map
    const leafletLayer = this.geoJsonService.getLeafletLayer(id);
    if (leafletLayer) {
      if (visible) {
        leafletLayer.addTo(this.map);
      } else {
        this.map.removeLayer(leafletLayer);
      }
    }
    
    // Emit event
    this.layerVisibilityChanged.emit({ id, visible });
  }
  
  /**
   * Set active layer for styling
   */
  setActiveLayer(id: string): void {
    this.activeLayerId = id === this.activeLayerId ? null : id;
  }
  
  /**
   * Apply color preset to active layer
   */
  applyColorPreset(preset: {color: string, fillColor: string}): void {
    if (!this.activeLayerId) return;
    
    const style: Partial<GeoJsonLayerStyle> = {
      color: preset.color,
      fillColor: preset.fillColor
    };
    
    this.updateLayerStyle(this.activeLayerId, style);
  }
  
  /**
   * Update layer style
   */
  updateLayerStyle(id: string, style: Partial<GeoJsonLayerStyle>): void {
    this.geoJsonService.updateLayerStyle(id, style);
    
    // Update layers list to reflect changes
    this.layers = [...this.geoJsonService.getLayers()];
  }
  
  /**
   * Zoom to layer extent
   */
  zoomToLayer(id: string): void {
    const leafletLayer = this.geoJsonService.getLeafletLayer(id);
    if (leafletLayer) {
      const bounds = leafletLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }
  
  /**
   * Load sample GeoJSON file
   */
  loadSampleGeoJson(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.geoJsonService.loadFromUrl('./sample-geojson.json', 'Sample GeoJSON').subscribe({
      next: (layer) => {
        this.addLayerToMap(layer);
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = typeof error === 'string' ? error : 'Failed to load sample GeoJSON';
        this.isLoading = false;
      }
    });
  }
}