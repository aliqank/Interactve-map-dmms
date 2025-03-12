import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() map!: L.Map;
  @Output() toolSelected = new EventEmitter<string>();
  
  activeToolId: string | null = null;
  
  // Map control states
  mapControls = {
    showLayerControl: false,
    showSearchControl: false,
    showMeasureControl: false,
    showGeoJsonControl: false,
    showPolygonControl: false,
    showDataSendingControl: false,
    showSettingsControl: false
  };
  
  // Map control events
  @Output() layerControlToggled = new EventEmitter<void>();
  @Output() searchControlToggled = new EventEmitter<void>();
  @Output() measureControlToggled = new EventEmitter<void>();
  @Output() geoJsonControlToggled = new EventEmitter<void>();
  @Output() polygonControlToggled = new EventEmitter<void>();
  @Output() dataSendingControlToggled = new EventEmitter<void>();
  @Output() settingsControlToggled = new EventEmitter<void>();
  @Output() findLocationRequested = new EventEmitter<void>();
  
  constructor() {}
  
  selectTool(toolId: string): void {
    this.activeToolId = this.activeToolId === toolId ? null : toolId;
    this.toolSelected.emit(toolId);
  }
  
  toggleMapControl(controlType: string): void {
    // Reset all controls first
    Object.keys(this.mapControls).forEach(key => {
      this.mapControls[key as keyof typeof this.mapControls] = false;
    });
    
    // Toggle the selected control
    switch(controlType) {
      case 'layer':
        this.mapControls.showLayerControl = true;
        this.layerControlToggled.emit();
        break;
      case 'search':
        this.mapControls.showSearchControl = true;
        this.searchControlToggled.emit();
        break;
      case 'measure':
        this.mapControls.showMeasureControl = true;
        this.measureControlToggled.emit();
        break;
      case 'geojson':
        this.mapControls.showGeoJsonControl = true;
        this.geoJsonControlToggled.emit();
        break;
      case 'polygon':
        this.mapControls.showPolygonControl = true;
        this.polygonControlToggled.emit();
        break;
      case 'dataSending':
        this.mapControls.showDataSendingControl = true;
        this.dataSendingControlToggled.emit();
        break;
      case 'settings':
        this.mapControls.showSettingsControl = true;
        this.settingsControlToggled.emit();
        break;
    }
  }
  
  findMyLocation(): void {
    this.findLocationRequested.emit();
  }
}